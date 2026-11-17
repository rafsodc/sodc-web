import path from "node:path";
import ts from "typescript";

function unwrap(node) {
  while (node && (ts.isParenthesizedExpression(node) || ts.isAsExpression(node) ||
    ts.isTypeAssertionExpression(node) || ts.isNonNullExpression(node) || ts.isSatisfiesExpression(node))) node = node.expression;
  return node;
}

function propertyName(node) {
  return node && (ts.isIdentifier(node) || ts.isStringLiteral(node)) ? node.text : undefined;
}

function objectField(argument, field) {
  const object = unwrap(argument);
  if (!object || !ts.isObjectLiteralExpression(object)) return undefined;
  const property = object.properties.find((node) =>
    (ts.isPropertyAssignment(node) || ts.isShorthandPropertyAssignment(node)) && propertyName(node.name) === field);
  if (property && ts.isPropertyAssignment(property)) return unwrap(property.initializer);
  return property && ts.isShorthandPropertyAssignment(property) ? property.name : undefined;
}

function visit(node, callback) {
  callback(node);
  ts.forEachChild(node, (child) => visit(child, callback));
}

function relativeModule(modulePath, specifier) {
  if (!specifier.startsWith(".")) return undefined;
  const resolved = path.posix.normalize(path.posix.join(path.posix.dirname(modulePath), specifier));
  return resolved.endsWith(".ts") ? resolved : `${resolved}.ts`;
}

/** Bounded syntactic evidence for tests, not a complete runtime call graph.
 * Supports named top-level functions, direct named/imported calls and inline
 * Firebase endpoint callbacks. It deliberately does not resolve property calls,
 * dependency injection, factories, re-exports or branch feasibility. Tests must
 * assert nonempty expected paths and separately constrain conditional inputs. */
export function buildTemplateSourceContract(sources) {
  const modules = new Map();
  const functions = new Map();
  const concreteTemplateKeys = new Set();
  for (const [modulePath, source] of sources) {
    const file = ts.createSourceFile(modulePath, source, ts.ScriptTarget.Latest, true);
    if (file.parseDiagnostics.length) throw new Error(`Cannot parse template source: ${modulePath}`);
    const imports = new Map();
    for (const statement of file.statements) {
      if (!ts.isImportDeclaration(statement) || !ts.isStringLiteral(statement.moduleSpecifier)) continue;
      const bindings = statement.importClause?.namedBindings;
      if (!bindings || !ts.isNamedImports(bindings)) continue;
      for (const imported of bindings.elements) imports.set(imported.name.text, {
        specifier: statement.moduleSpecifier.text,
        name: imported.propertyName?.text ?? imported.name.text,
      });
    }
    modules.set(modulePath, { file, imports });
    const add = (name, node, cloud = false) => {
      if (!node?.body) return;
      const id = `${modulePath}#${name}`;
      if (functions.has(id)) throw new Error(`Duplicate template source function: ${id}`);
      functions.set(id, { id, modulePath, name, node, cloud, calls: [], templateKeys: new Set() });
    };
    for (const statement of file.statements) {
      if (ts.isFunctionDeclaration(statement) && statement.name) add(statement.name.text, statement);
      if (!ts.isVariableStatement(statement)) continue;
      for (const declaration of statement.declarationList.declarations) {
        if (!ts.isIdentifier(declaration.name)) continue;
        const initializer = unwrap(declaration.initializer);
        if (!initializer) continue;
        if (ts.isArrowFunction(initializer) || ts.isFunctionExpression(initializer)) add(declaration.name.text, initializer);
        if (!ts.isCallExpression(initializer) || !ts.isIdentifier(initializer.expression)) continue;
        const imported = imports.get(initializer.expression.text);
        if (!imported?.specifier.startsWith("firebase-functions/v2/") ||
          !["onCall", "onRequest", "onSchedule", "onTaskDispatched"].includes(imported.name)) continue;
        const callback = unwrap(initializer.arguments.at(-1));
        if (callback && (ts.isArrowFunction(callback) || ts.isFunctionExpression(callback))) add(declaration.name.text, callback, true);
      }
    }
    visit(file, (node) => {
      const key = concreteTemplateKey(node);
      if (key) concreteTemplateKeys.add(key);
    });
  }

  const incoming = new Map();
  for (const record of functions.values()) {
    visit(record.node.body, (node) => {
      const key = concreteTemplateKey(node);
      if (key) record.templateKeys.add(key);
      if (!ts.isCallExpression(node) || !ts.isIdentifier(node.expression)) return;
      const imported = modules.get(record.modulePath).imports.get(node.expression.text);
      const modulePath = imported ? relativeModule(record.modulePath, imported.specifier) : record.modulePath;
      const target = modulePath && functions.get(`${modulePath}#${imported?.name ?? node.expression.text}`);
      if (!target) return;
      const edge = { caller: record, target, call: node };
      record.calls.push(edge);
      if (!incoming.has(target.id)) incoming.set(target.id, []);
      incoming.get(target.id).push(edge);
    });
  }

  return {
    concreteTemplateKeys: [...concreteTemplateKeys].sort(),
    /** Returns only direct syntactic paths ending at a concrete send/lookup.
     * A missing/unsupported edge removes the path, so callers assert its shape. */
    pathsToTemplate(key) {
      const paths = [];
      const follow = (record, reverseEdges, seen) => {
        if (record.cloud) { paths.push({ sender: record.name, edges: [...reverseEdges].reverse(), sink: reverseEdges[0]?.target ?? record }); return; }
        for (const edge of incoming.get(record.id) ?? []) {
          if (!seen.has(edge.caller.id)) follow(edge.caller, [...reverseEdges, edge], new Set([...seen, edge.caller.id]));
        }
      };
      for (const record of functions.values()) if (record.templateKeys.has(key)) follow(record, [], new Set([record.id]));
      return paths;
    },
  };
}

function concreteTemplateKey(node) {
  if (!ts.isCallExpression(node)) return undefined;
  const callee = unwrap(node.expression);
  const method = ts.isPropertyAccessExpression(callee) ? callee.name.text : ts.isIdentifier(callee) ? callee.text : undefined;
  const first = unwrap(node.arguments[0]);
  if (method === "resolveNotifyTemplateId" && first && ts.isStringLiteral(first)) return first.text;
  if (!["sendEmail", "sendAuthEmail"].includes(method)) return undefined;
  const key = objectField(first, "templateName");
  return key && ts.isStringLiteral(key) ? key.text : undefined;
}

/** A selected source edge forwards the parameter's field unchanged. This does
 * not attempt alias analysis or infer the values permitted by validation. */
export function forwardsParameterField(edge, field) {
  const parameter = edge.caller.node.parameters[0]?.name;
  const value = objectField(edge.call.arguments[0], field);
  return !!parameter && ts.isIdentifier(parameter) && !!value && ts.isPropertyAccessExpression(value) &&
    ts.isIdentifier(value.expression) && value.expression.text === parameter.text && value.name.text === field;
}

/** Recognizes the current request.data destructuring/direct-access shape.
 * In particular a local const newStatus = "RESIGNED" is not dynamic input and
 * must not imply that a restricted-only endpoint can send activation mail. */
export function forwardsRequestDataField(edge, field) {
  const parameter = edge.caller.node.parameters[0]?.name;
  if (!parameter || !ts.isIdentifier(parameter)) return false;
  const isRequestData = (expression) => {
    const value = unwrap(expression);
    return value && ts.isPropertyAccessExpression(value) && ts.isIdentifier(value.expression) &&
      value.expression.text === parameter.text && value.name.text === "data";
  };
  const value = objectField(edge.call.arguments[0], field);
  if (value && ts.isPropertyAccessExpression(value) && value.name.text === field && isRequestData(value.expression)) return true;
  if (!value || !ts.isIdentifier(value)) return false;
  let forwarded = false;
  visit(edge.caller.node.body, (node) => {
    if (!ts.isVariableDeclaration(node) || !ts.isObjectBindingPattern(node.name) || !isRequestData(node.initializer)) return;
    forwarded ||= node.name.elements.some((binding) => ts.isIdentifier(binding.name) && binding.name.text === value.text &&
      propertyName(binding.propertyName ?? binding.name) === field);
  });
  return forwarded;
}

export function generatedTemplateManifestKeys(source) {
  const file = ts.createSourceFile("generatedEmailTemplateManifest.ts", source, ts.ScriptTarget.Latest, true);
  for (const statement of file.statements) {
    if (!ts.isVariableStatement(statement)) continue;
    for (const declaration of statement.declarationList.declarations) {
      if (!ts.isIdentifier(declaration.name) || declaration.name.text !== "EMAIL_TEMPLATE_MANIFEST") continue;
      const value = unwrap(declaration.initializer);
      if (value && ts.isObjectLiteralExpression(value)) return value.properties.map((node) => propertyName(node.name)).sort();
    }
  }
  throw new Error("Cannot resolve generated template manifest keys");
}

/** Correct known generator output defects without changing query options or variables. */
export function normalizeGeneratedRuntime(source) {
  return source.replace(/[ \t]+$/gm, "").replace(
    /const \{ dc: dcInstance, vars: inputVars, options: inputOpts \} = (validateArgsWithOptions\(connectorConfig, dcOrOptions, options, undefined,\s*false,\s*false\);)\n( {2}return executeQuery\(\w+Ref\(dcInstance), inputVars(\), inputOpts && \{ fetchPolicy: inputOpts.fetchPolicy \}\);)/g,
    "const { dc: dcInstance, options: inputOpts } = $1\n$2$3",
  );
}

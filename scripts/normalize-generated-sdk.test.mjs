import { describe, expect, it, vi } from "vitest";
import { runInNewContext } from "node:vm";
import { normalizeGeneratedRuntime } from "./normalize-generated-sdk-lib.mjs";

const noVariablesBody = `
  const { dc: dcInstance, vars: inputVars, options: inputOpts } = validateArgsWithOptions(connectorConfig, dcOrOptions, options, undefined,false, false);
  return executeQuery(getReportRef(dcInstance, inputVars), inputOpts && { fetchPolicy: inputOpts.fetchPolicy });
`;

describe("generated SDK normalization", () => {
  it.each([false, true])("preserves no-variable query options (CommonJS: %s)", (commonJs) => {
    const source = commonJs
      ? `exports.getReport = function getReport(dcOrOptions, options) {${noVariablesBody}};`
      : `export function getReport(dcOrOptions, options) {${noVariablesBody}}`;
    const normalized = normalizeGeneratedRuntime(source);
    const dc = {};
    const reference = {};
    const getReportRef = vi.fn(() => reference);
    const executeQuery = vi.fn(() => "result");
    const validateArgsWithOptions = vi.fn(() => ({ dc, options: { fetchPolicy: "SERVER" } }));
    const context = { exports: {}, connectorConfig: {}, getReportRef, executeQuery, validateArgsWithOptions };
    runInNewContext(normalized.replace(/^export /, ""), context);
    const query = commonJs ? context.exports.getReport : context.getReport;
    const options = { fetchPolicy: "SERVER" };
    expect(query(dc, options)).toBe("result");
    expect(validateArgsWithOptions).toHaveBeenCalledWith(context.connectorConfig, dc, options, undefined, false, false);
    expect(getReportRef).toHaveBeenCalledWith(dc);
    expect(executeQuery).toHaveBeenCalledWith(reference, options);
    expect(normalized).not.toContain("inputVars");
    expect(normalizeGeneratedRuntime(normalized)).toBe(normalized);
  });

  it("preserves variable-bearing queries and their options", () => {
    const source = noVariablesBody.replace(
      "dcOrOptions, options, undefined,false, false", "dcOrVars, varsOrOptions, options, true, true",
    );
    expect(normalizeGeneratedRuntime(source)).toBe(source);
  });

  it("continues to remove trailing whitespace", () => {
    expect(normalizeGeneratedRuntime("const value = 1;  \n  \t\n")).toBe("const value = 1;\n\n");
  });
});

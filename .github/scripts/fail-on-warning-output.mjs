#!/usr/bin/env node

import { spawn } from "node:child_process";

const args = process.argv.slice(2);
const separatorIndex = args.indexOf("--");

if (separatorIndex === -1 || separatorIndex === args.length - 1) {
  console.error("Usage: node .github/scripts/fail-on-warning-output.mjs [--cwd <path>] -- <command> [args...]");
  process.exit(2);
}

let cwd = process.cwd();
for (let i = 0; i < separatorIndex; i += 1) {
  if (args[i] !== "--cwd" || i + 1 >= separatorIndex) {
    console.error(`Unknown option: ${args[i]}`);
    process.exit(2);
  }
  cwd = args[i + 1];
  i += 1;
}

const command = args[separatorIndex + 1];
const commandArgs = args.slice(separatorIndex + 2);
// CI warning policy: no warning output is currently allowed. Add narrowly scoped
// filtering here only when a known external warning cannot be fixed immediately.
const warningPattern = /(^|[^a-z])(?:warn|warnings?)([^a-z]|$)|[a-z]+warning\b|::warning::/i;
const outputLines = [];

const child = spawn(command, commandArgs, {
  cwd,
  stdio: ["inherit", "pipe", "pipe"],
});

function handleOutput(stream, chunk) {
  const text = chunk.toString();
  stream.write(text);
  outputLines.push(...text.split(/\r?\n/));
}

child.stdout.on("data", (chunk) => handleOutput(process.stdout, chunk));
child.stderr.on("data", (chunk) => handleOutput(process.stderr, chunk));

child.on("error", (error) => {
  console.error(error);
  process.exit(1);
});

child.on("close", (code, signal) => {
  if (signal) {
    console.error(`Command terminated by signal ${signal}`);
    process.exit(1);
  }

  if (code !== 0) {
    process.exit(code ?? 1);
  }

  const warningLines = outputLines.filter((line) => warningPattern.test(line));
  if (warningLines.length > 0) {
    console.error("::error::Command emitted warning output:");
    for (const line of warningLines) {
      console.error(line);
    }
    process.exit(1);
  }
});

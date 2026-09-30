#!/usr/bin/env node
import process from "node:process";
import { runCli } from "./run";

const stdin = async () => {
  const chunks: Buffer[] = [];
  for await (const chunk of process.stdin) chunks.push(Buffer.from(chunk));
  return Buffer.concat(chunks).toString("utf8");
};

process.exitCode = await runCli(process.argv, {
  cwd: process.cwd(),
  stdin,
  stdout: (value) => process.stdout.write(`${value}\n`),
  stderr: (value) => process.stderr.write(`${value}\n`),
});

import test from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { readFile } from "node:fs/promises";
import ts from "typescript";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function importTsModule(relativePath) {
  const targetPath = path.resolve(__dirname, "..", relativePath);
  const source = await readFile(targetPath, "utf8");
  const { outputText } = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.ES2020,
      target: ts.ScriptTarget.ES2022,
      moduleResolution: ts.ModuleResolutionKind.NodeNext,
    },
  });
  const base64 = Buffer.from(outputText, "utf8").toString("base64");
  const dataUrl = `data:text/javascript;base64,${base64}`;
  return import(dataUrl);
}

const {
  resolveSignInError,
  sanitizeCallbackPath,
} = await importTsModule("lib/signin-messages.ts");

test("resolveSignInError returns structured fallback for unknown codes", () => {
  const result = resolveSignInError("SomethingElse");
  assert.ok(result);
  assert.equal(result.title, "Sign-in failed");
  assert.match(result.description, /try again/i);
});

test("resolveSignInError returns null when code is missing", () => {
  const result = resolveSignInError(undefined);
  assert.equal(result, null);
});

test("resolveSignInError covers session expiry detail", () => {
  const result = resolveSignInError("SessionRequired");
  assert.ok(result);
  assert.equal(result.title, "Session expired");
  assert.match(result.description, /sign in again/i);
});

test("sanitizeCallbackPath allows relative paths and strips arrays", () => {
  const result = sanitizeCallbackPath(["/dashboard", "/ignored"]);
  assert.equal(result, "/dashboard");
});

test("sanitizeCallbackPath rejects absolute URLs and traversal", () => {
  const candidates = [
    "https://example.com/evil",
    "//evil.com/path",
    " /space",
    "../escape",
    "http://example.com",
  ];
  for (const candidate of candidates) {
    assert.equal(sanitizeCallbackPath(candidate), undefined);
  }
});


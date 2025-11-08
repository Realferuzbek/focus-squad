import test from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { readFile } from "node:fs/promises";
import { createHash } from "node:crypto";
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
  requireAdminSession,
  requireAdminOrInternal,
  INTERNAL_ADMIN_SIGNATURE_HEADER,
} = await importTsModule("lib/adminGuard.ts");

test("requireAdminSession denies non-admin sessions", async () => {
  const result = await requireAdminSession({
    session: {
      user: { email: "user@example.com", is_admin: false },
    },
  });
  assert.equal(result.ok, false);
  assert.equal(result.status, 403);
  assert.equal(result.message, "forbidden");
});

test("requireAdminSession accepts admin sessions", async () => {
  const result = await requireAdminSession({
    session: {
      user: { email: "admin@example.com", is_admin: true, id: "admin-1" },
    },
  });
  assert.equal(result.ok, true);
  assert.equal(result.user.email, "admin@example.com");
  assert.equal(result.user.is_admin, true);
});

test("requireAdminOrInternal allows signed internal requests", async () => {
  process.env.NEXTAUTH_SECRET = "internal-secret";
  const signature = createHash("sha256").update("internal-secret").digest("hex");
  const request = new Request("https://example.com/api/admin/state", {
    headers: { [INTERNAL_ADMIN_SIGNATURE_HEADER]: signature },
  });

  const result = await requireAdminOrInternal({
    request,
    session: null,
  });

  assert.equal(result.ok, true);
  assert.equal(result.via, "internal");
});

test("requireAdminOrInternal rejects unsigned internal requests", async () => {
  process.env.NEXTAUTH_SECRET = "internal-secret";
  const request = new Request("https://example.com/api/admin/state");

  const result = await requireAdminOrInternal({
    request,
    session: null,
  });

  assert.equal(result.ok, false);
  assert.equal(result.status, 401);
  assert.equal(result.message, "unauthorized");
});


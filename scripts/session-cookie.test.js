// scripts/session-cookie.test.js
const assert = require("assert");
const fs = require("fs");
const path = require("path");

const authPath = path.resolve(__dirname, "..", "lib", "auth.ts");
const content = fs.readFileSync(authPath, "utf8");

// Check session strategy set to jwt
assert(
  /session:\s*\{[^}]*strategy:\s*"jwt"/m.test(content),
  "session strategy must be jwt in lib/auth.ts",
);

// Check cookie options existence with httpOnly and sameSite
assert(
  /cookies:\s*\{[\s\S]*sessionToken:[\s\S]*options:[\s\S]*httpOnly:\s*true/m.test(
    content,
  ),
  "cookie httpOnly option must be present",
);
assert(/sameSite:\s*"?lax"?/i.test(content), "sameSite must be lax");
assert(
  /secure:\s*SESSION_COOKIE_SECURE/.test(content),
  "secure flag must use SESSION_COOKIE_SECURE",
);

// Check sid generation & rotation hints
assert(/sidIssuedAt/.test(content), "sidIssuedAt tracking must be present");
assert(
  /mintSessionState/.test(content),
  "mintSessionState helper should be used",
);
assert(/needsRollingRotation/.test(content), "rolling rotation check required");

console.log("session-cookie static tests passed");
process.exit(0);

const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");
const COMPONENTS_DIR = path.join(ROOT, "components");
const LIB_PUSH_CLIENT = path.join(ROOT, "lib", "pushClient.ts");
const ADMIN_CHAT_BAK = path.join(
  ROOT,
  "components",
  "community",
  "AdminChatClient.tsx.bak",
);

const VIOLATION_REGEX =
  /fetch\([^)]*\{\s*method:\s*['"](POST|PUT|PATCH|DELETE)['"]/gim;

function isStateChangingFetch(content) {
  return VIOLATION_REGEX.test(content);
}

function collectComponentFiles(dirPath, accumulator) {
  const entries = fs.readdirSync(dirPath, { withFileTypes: true });
  for (const entry of entries) {
    if (entry.name === "node_modules") continue;
    const fullPath = path.join(dirPath, entry.name);
    if (entry.isDirectory()) {
      collectComponentFiles(fullPath, accumulator);
    } else if (
      entry.isFile() &&
      (entry.name.endsWith(".ts") || entry.name.endsWith(".tsx"))
    ) {
      accumulator.push(fullPath);
    }
  }
}

const filesToCheck = [];
collectComponentFiles(COMPONENTS_DIR, filesToCheck);
filesToCheck.push(LIB_PUSH_CLIENT, ADMIN_CHAT_BAK);

const violations = filesToCheck
  .filter((filePath) => fs.existsSync(filePath))
  .filter((filePath) => {
    const content = fs.readFileSync(filePath, "utf8");
    return isStateChangingFetch(content);
  })
  .map((filePath) => path.relative(ROOT, filePath));

if (violations.length > 0) {
  console.error("State-changing fetch calls must use csrfFetch:", violations);
  process.exit(1);
}

console.log("csrf fetch static checks passed");


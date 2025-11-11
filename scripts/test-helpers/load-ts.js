const fs = require("fs");
const path = require("path");
const ts = require("typescript");

const projectRoot = path.resolve(__dirname, "..", "..");

function resolveAlias(specifier) {
  if (specifier.startsWith("@/")) {
    return path.resolve(projectRoot, specifier.slice(2));
  }
  return null;
}

function loadTsModule(relativePath) {
  const absolutePath = path.resolve(projectRoot, relativePath);
  const source = fs.readFileSync(absolutePath, "utf8");
  const transpiled = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2020,
    },
    fileName: path.basename(absolutePath),
  });

  const sandboxModule = { exports: {} };
  const customRequire = (specifier) => {
    const aliased = resolveAlias(specifier);
    if (aliased) return require(aliased);
    if (specifier.startsWith("."))
      return require(path.resolve(path.dirname(absolutePath), specifier));
    return require(specifier);
  };

  const runner = new Function(
    "require",
    "module",
    "exports",
    transpiled.outputText,
  );
  runner(customRequire, sandboxModule, sandboxModule.exports);
  return sandboxModule.exports;
}

module.exports = { loadTsModule };

const assert = require("assert");
const { loadTsModule } = require("./test-helpers/load-ts");

const { buildHighlightSnippet, buildPlainSnippet, ensureSafeHtml } =
  loadTsModule("lib/highlight.ts");

(function simulateServerClientHighlightFlow() {
  const serverHighlight = buildHighlightSnippet(
    `hello <img src=x onerror=alert(1)> world`,
    "<img src=x onerror=alert(1)>",
    { maxLength: 200 },
  );
  const renderedHtml = ensureSafeHtml(
    serverHighlight ??
      buildPlainSnippet("fallback content", { maxLength: 160 }) ??
      "",
  );
  assert(
    renderedHtml.includes("<mark>&lt;img src=x onerror=alert(1)&gt;</mark>"),
  );
  assert(
    !renderedHtml.includes("<img"),
    "escaped highlight must never emit <img> tags to the client",
  );
})();

(function simulateMissingServerHighlight() {
  const fallback = ensureSafeHtml(
    buildPlainSnippet("[FILE]", { maxLength: 20 }) ?? "",
  );
  assert.strictEqual(fallback, "[FILE]", "plain snippets render text only");
})();

console.log("highlight e2e tests passed");
process.exit(0);

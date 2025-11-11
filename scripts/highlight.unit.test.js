const assert = require("assert");
const { loadTsModule } = require("./test-helpers/load-ts");

const {
  escapeHtml,
  buildPlainSnippet,
  buildHighlightSnippet,
  ensureSafeHtml,
} = loadTsModule("lib/highlight.ts");

(function testEscapeHtml() {
  const escaped = escapeHtml(`<script>alert("&")</script>`);
  assert(
    escaped.includes("&lt;script&gt;alert(&quot;&amp;&quot;)&lt;/script&gt;"),
    "escapeHtml must encode script brackets and quotes",
  );
})();

(function testPlainSnippet() {
  const snippet = buildPlainSnippet("   hello   world   ", { maxLength: 5 });
  assert.strictEqual(snippet, "hello", "plain snippet trims and slices text");
})();

(function testHighlightSnippet() {
  const output = buildHighlightSnippet(
    "evil <div>needle</div> needle",
    "<div>needle</div>",
    { maxLength: 100 },
  );
  assert(output?.includes("<mark>&lt;div&gt;needle&lt;/div&gt;</mark>"));
  assert(!output?.includes("<div>needle</div>"), "raw HTML must stay escaped");
})();

(function testEnsureSafeHtml() {
  assert.strictEqual(ensureSafeHtml("<mark>ok</mark>"), "<mark>ok</mark>");
  assert.throws(
    () => ensureSafeHtml("<script>alert(1)</script>"),
    /Unsafe HTML/,
    "ensureSafeHtml must reject script tags",
  );
})();

console.log("highlight unit tests passed");
process.exit(0);


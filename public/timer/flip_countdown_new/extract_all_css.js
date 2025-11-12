const fs = require("fs");
const text = fs.readFileSync("tmp_main.js", "utf8");
const regex = /(\w)\.push\(\[t.id,(['\"])\s*([\s\S]*?)\2,''\]\)/g;
let match;
let idx = 0;
while ((match = regex.exec(text)) !== null) {
  const quote = match[2];
  const raw = match[3];
  const decoded = eval(quote + raw.replace(/\\/g, "\\\\") + quote);
  fs.writeFileSync(extracted_.css, decoded);
  idx++;
}
console.log("chunks", idx);

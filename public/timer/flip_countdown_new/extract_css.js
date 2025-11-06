const fs = require('fs');
const text = fs.readFileSync('tmp_main.js', 'utf8');
const regex = /(\w)\.push\(\[t.id,\"([\s\S]*?)\",\"\"\]\)/g;
let match;
let index = 0;
while ((match = regex.exec(text)) !== null) {
  const arrName = match[1];
  const raw = match[2];
  const css = eval('\"' + raw.replace(/\"/g, '\\\"') + '\"');
  if (index < 5) {
    console.log('---chunk ' + index + '---');
    console.log(css.substring(0, 200));
  }
  index++;
}
console.log('total chunks', index);

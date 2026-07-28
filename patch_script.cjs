const fs = require('fs');
let content = fs.readFileSync('src/print/printVorraetePaged.ts', 'utf8');

const target = "'<script src=\"https://unpkg.com/pagedjs@0.4.3/dist/paged.polyfill.min.js\"></' + 'script>' +";
const replacement = "'<script src=\"' + window.location.origin + '/paged.polyfill.min.js\"></' + 'script>' +";

if (content.includes(target)) {
    content = content.replace(target, replacement);
    fs.writeFileSync('src/print/printVorraetePaged.ts', content, 'utf8');
    console.log("Success");
} else {
    console.log("Not found");
}

const fs = require('fs');
let code = fs.readFileSync('dist/assets/index-BAPdzr-i.js', 'utf8');
const arrays = code.match(/\["[^"]+"(?:,"[^"]+")*\]/g);
if (arrays) {
  arrays.forEach(a => {
    if (a.toLowerCase().includes('diesel') || a.toLowerCase().includes('eur')) {
        console.log(a);
    }
  })
}

const fs = require('fs');
let lines = fs.readFileSync('src/App.tsx', 'utf8').split('\n');

for(let i=0; i<lines.length; i++) {
  if (lines[i].includes('                              ))}')) {
    if (lines[i-1].includes('</div>')) {
      console.log('Found line ' + i);
      lines[i] = '                                  );\n                              })}';
    }
  }
}

fs.writeFileSync('src/App.tsx', lines.join('\n'), 'utf8');
console.log("Patched array map end.");

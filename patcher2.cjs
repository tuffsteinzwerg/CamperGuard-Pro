const fs = require('fs');
let lines = fs.readFileSync('src/App.tsx', 'utf8').split('\n');

// Restore 1067 if needed
if(lines[1067].includes('});') && lines[1067-1].includes('</div>')) {
   lines[1067] = '                                                    ))}';
   lines.splice(1068, 1);
}

// Fix pharmacy map
lines[1151] = '                                  );';
lines.splice(1152, 0, '                              })}');

fs.writeFileSync('src/App.tsx', lines.join('\n'), 'utf8');
console.log("Patched 1151.");

const fs = require('fs');
let lines = fs.readFileSync('src/App.tsx', 'utf8').split('\n');

lines[1068-1] = '                                                    ))}';
lines.splice(1069-1, 1); // remove 1069

// now my pharmacy logic at 1152 shifted because of the splice
// I need to look at the exact strings

fs.writeFileSync('src/App.tsx', lines.join('\n'), 'utf8');

const fs = require('fs');

let code = fs.readFileSync('src/views/InhaltView.tsx', 'utf8');

code = code.replace(
  "return formatWeight(totalKg);",
  "return totalKg > 0 ? formatWeight(totalKg) : '0 kg';"
);

fs.writeFileSync('src/views/InhaltView.tsx', code);
console.log("Patched InhaltView.tsx");

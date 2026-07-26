const fs = require('fs');

let code = fs.readFileSync('src/views/ProfilView.tsx', 'utf8');

code = code.replace(
  "Cloud-Synchronisation",
  "Cloud-Sicherung"
);

code = code.replace(
  "Verbinde dein Google-Konto, um Daten automatisch zu synchronisieren und mit anderen zu teilen.",
  "Verbinde dein Google-Konto, um zusätzlich eine Sicherungskopie in deiner eigenen Google Drive abzulegen. Geteilt wird damit nichts."
);

code = code.replace(
  "Jetzt synchronisieren",
  "Jetzt sichern"
);

code = code.replace(
  "Synchronisiere...",
  "Sichere..."
);

code = code.replace(
  "Alle Daten bleiben lokal auf deinem Gerät (IndexedDB). Optional kannst du sie per Google Drive synchronisieren.",
  "Alle Daten bleiben lokal auf deinem Gerät. Optional kannst du zusätzlich eine Sicherungskopie in deiner eigenen Google Drive ablegen."
);

code = code.replace(
  "Rueckkehrpunkt konnte nicht gelesen werden.",
  "Rückkehrpunkt konnte nicht gelesen werden."
);

fs.writeFileSync('src/views/ProfilView.tsx', code);
console.log("Patched ProfilView.tsx");

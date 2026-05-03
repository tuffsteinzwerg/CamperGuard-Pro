const fs = require('fs');
let c = fs.readFileSync('src/App.tsx', 'utf8');

c = c.replace(
`    const pharmacyResults = (state.sos?.pharmacy || [])
        .filter((p: any) => 
            p.name && p.name.trim() !== '' && p.isHidden !== true && p.isDeleted !== true &&
            ((p.name && p.name.toLowerCase().includes(term)) ||
            (p.purpose && p.purpose.toLowerCase().includes(term)) ||
            (p.location && p.location.toLowerCase().includes(term)) ||
            (p.unit && p.unit.toLowerCase().includes(term)) ||
            "apotheke".includes(term) ||
            "safety hub".includes(term))
        )`,
`    const pharmacyResults = (state.sos?.pharmacy || [])
        .filter((p: any) => {
            if (!p) return false;
            const pName = String(p.name || '');
            const pPurpose = String(p.purpose || '');
            const pLoc = String(p.location || '');
            const pUnit = String(p.unit || '');
            
            return pName.trim() !== '' && p.isHidden !== true && p.isDeleted !== true &&
            (pName.toLowerCase().includes(term) ||
            pPurpose.toLowerCase().includes(term) ||
            pLoc.toLowerCase().includes(term) ||
            pUnit.toLowerCase().includes(term) ||
            "apotheke".includes(term) ||
            "safety hub".includes(term));
        })`
);

let lines = c.split('\n');
// Let's also patch the map
for(let i=0; i<lines.length; i++) {
   if (lines[i].includes(' {(state.sos.pharmacy || []).map((p: any, i: number) => {') && lines[i+1].includes('const isEditing = editingPharmacyId === p.id;')) {
      lines.splice(i+1, 0, '                                  if (!p) return null;');
      break;
   }
}

// And ensure properties are strings inside the map
for(let i=0; i<lines.length; i++) {
   if (lines[i].includes('const isEditing = editingPharmacyId === p.id;')) {
      lines[i] = "                                  const isEditing = editingPharmacyId === String(p.id);";
   }
   if (lines[i].includes('if (p.purpose) metaParts.push(p.purpose);')) {
      lines[i] = "                                  if (p.purpose) metaParts.push(String(p.purpose));";
   }
   if (lines[i].includes('if (p.location) metaParts.push(p.location);')) {
      lines[i] = "                                  if (p.location) metaParts.push(String(p.location));";
   }
   if (lines[i].includes('if (p.expiry) metaParts.push(p.expiry);')) {
      lines[i] = "                                  if (p.expiry) metaParts.push(String(p.expiry));";
   }
   if (lines[i].includes('<input value={p.name} onChange=')) {
      lines[i] = lines[i].replace('<input value={p.name}', '<input value={p.name || \'\'}');
   }
   if (lines[i].includes('<input value={p.purpose} onChange={')) {
      lines[i] = lines[i].replace('<input value={p.purpose}', '<input value={p.purpose || \'\'}');
   }
   if (lines[i].includes('<input type="month" value={p.expiry}')) {
      lines[i] = lines[i].replace('<input type="month" value={p.expiry}', '<input type="month" value={p.expiry || \'\'}');
   }
   if (lines[i].includes('<input value={p.location} onChange={')) {
      lines[i] = lines[i].replace('<input value={p.location}', '<input value={p.location || \'\'}');
   }
}

fs.writeFileSync('src/App.tsx', lines.join('\n'));
console.log('patched_runtime_error');

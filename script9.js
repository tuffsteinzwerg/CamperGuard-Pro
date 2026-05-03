import { readFileSync, writeFileSync } from 'fs';
let content = readFileSync('src/App.tsx', 'utf-8');

// Replace standard tags that have class "input-standard"
// For <input>
content = content.replace(/<input([^>]*)className="([^"]*)input-standard([^"]*)"/g, '<input$1className="$2cg-master-input$3"');
// For <select>
content = content.replace(/<select([^>]*)className="([^"]*)input-standard([^"]*)"/g, '<select$1className="$2cg-master-select$3"');
// For <textarea>
content = content.replace(/<textarea([^>]*)className="([^"]*)input-standard([^"]*)"/g, '<textarea$1className="$2cg-master-textarea$3"');

writeFileSync('src/App.tsx', content);
console.log('done script9');

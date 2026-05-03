import fs from 'fs';
let c = fs.readFileSync('src/App.tsx', 'utf8');

c = c.replace(
"                                   )}\n                                  </div>\n                              ))}\n                          </div>\n",
"                                   )}\n                                  </div>\n                                  );\n                              })}\n                          </div>\n");

fs.writeFileSync('src/App.tsx', c);
console.log("Patched!");

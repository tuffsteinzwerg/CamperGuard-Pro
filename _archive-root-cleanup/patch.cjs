const fs = require('fs');
let c = fs.readFileSync('src/App.tsx', 'utf8');

c = c.replace(/                            \)}\n                                  <\/div>\n                              \)}\)\}\n                          <\/div>/g, 
`                                  )}
                                  </div>
                                  );
                              })}
                          </div>`);

fs.writeFileSync('src/App.tsx', c);
console.log("Patched!");

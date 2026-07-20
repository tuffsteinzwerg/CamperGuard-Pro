const fs = require('fs');
let code = fs.readFileSync('src/lib/__tests__/syncCoordinatorEndToEnd.test.ts', 'utf8');

code = code.replace(
  `                            store.put = function(val, key) {
                                if (val.inventory && val.inventory.length === 2) {
                                    throw new Error('Controlled local storage error during page save');
                                }
                                return originalPut(val, key);
                            };`,
  `                            store.put = function(val, key) {
                                if (val.inventory && val.inventory.length === 2) {
                                    try { tx.abort(); } catch(e) {}
                                    return Promise.reject(new Error('Controlled local storage error during page save'));
                                }
                                return originalPut(val, key);
                            };`
);

fs.writeFileSync('src/lib/__tests__/syncCoordinatorEndToEnd.test.ts', code);

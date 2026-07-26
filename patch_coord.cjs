const fs = require('fs');
let code = fs.readFileSync('src/lib/syncCoordinator.ts', 'utf8');

const regex1 = /result\.selectedCount\+\+;\s*const itemIndex = inventory\.findIndex\(\(i\) => i\.id === entry\.event\.itemId\);/m;

const replacement1 = `result.selectedCount++;

          if (isStructureEvent(entry.event)) {
            const structResult = reduceStructureEvent(localState.subcategories, entry.event);
            if (structResult.status === 'applied') {
              localState.subcategories = structResult.subcategories;
              stateChanged = true;
              await tx.objectStore('eventLog').put({ event: entry.event, source: 'remote', recordedAt: this.clock.nowIso() });
              await tx.objectStore('appliedEvents').put({ eventId: entry.event.eventId, appliedAt: this.clock.nowIso() });
              await tx.objectStore('deferredEvents').delete(entry.event.eventId);
              result.appliedCount++;
            } else {
              entry.status = 'permanent_failure';
              entry.reason = structResult.reason;
              await tx.objectStore('deferredEvents').put(entry);
              result.permanentFailureCount++;
            }
            continue;
          }

          const itemIndex = inventory.findIndex((i) => i.id === entry.event.itemId);`;

if (!regex1.test(code)) throw new Error("Could not find regex1 target");
code = code.replace(regex1, replacement1);


const regex2 = /if \(alreadyApplied\) \{\s*pageAlreadyAppliedCount\+\+;\s*continue;\s*\}\s*const inventory = localState\.inventory \|\| \[\];/m;

const replacement2 = `if (alreadyApplied) {
                  pageAlreadyAppliedCount++;
                  continue;
                }

                if (isStructureEvent(remoteEvent.event)) {
                  const structResult = reduceStructureEvent(localState.subcategories, remoteEvent.event);
                  if (structResult.status === 'applied') {
                    localState.subcategories = structResult.subcategories;
                    localState.inventoryRevision = (localState.inventoryRevision || 0) + 1;
                    await tx.objectStore('eventLog').put({ event: remoteEvent.event, source: 'remote', recordedAt: this.clock.nowIso() });
                    await tx.objectStore('appliedEvents').put({ eventId: remoteEvent.event.eventId, appliedAt: this.clock.nowIso() });
                    pageAppliedCount++;
                  }
                  continue;
                }
                
                const inventory = localState.inventory || [];`;

if (!regex2.test(code)) throw new Error("Could not find regex2 target");
code = code.replace(regex2, replacement2);

fs.writeFileSync('src/lib/syncCoordinator.ts', code);
console.log("Patched syncCoord");

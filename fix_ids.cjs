const fs = require('fs');
let code = fs.readFileSync('src/lib/__tests__/syncCoordinatorEndToEnd.test.ts', 'utf8');

// Test 3
code = code.replace(
  "await pushOutbox('e1', { eventId: 'e1', type: 'quantity_delta'",
  "await pushOutbox('e3_1', { eventId: 'e3_1', type: 'quantity_delta'"
);
code = code.replace(
  "await pushOutbox('e2', { eventId: 'e2', type: 'quantity_delta'",
  "await pushOutbox('e3_2', { eventId: 'e3_2', type: 'quantity_delta'"
);

// Test 4
code = code.replace(
  "await pushOutbox('e1', { eventId: 'e1', type: 'item_removed'",
  "await pushOutbox('e4_1', { eventId: 'e4_1', type: 'item_removed'"
);
code = code.replace(
  "await pushOutbox('e2', { eventId: 'e2', type: 'item_updated'",
  "await pushOutbox('e4_2', { eventId: 'e4_2', type: 'item_updated'"
);
code = code.replace(
  "await pushOutbox('e3', { eventId: 'e3', type: 'item_restored'",
  "await pushOutbox('e4_3', { eventId: 'e4_3', type: 'item_restored'"
);

// Test 5
code = code.replace(
  "await pushDeferred('e1', { eventId: 'e1', type: 'item_updated'",
  "await pushDeferred('e5_1', { eventId: 'e5_1', type: 'item_updated'"
);
code = code.replace(
  "eventId: 'e0', type: 'item_created'",
  "eventId: 'e5_0', type: 'item_created'"
);
code = code.replace(
  "await pushOutbox('e0', e0);",
  "await pushOutbox('e5_0', e0);"
);

// Test 6
code = code.replace(
  "await pushDeferred('e1', { eventId: 'e1', type: 'item_updated'",
  "await pushDeferred('e6_1', { eventId: 'e6_1', type: 'item_updated'"
);

fs.writeFileSync('src/lib/__tests__/syncCoordinatorEndToEnd.test.ts', code);

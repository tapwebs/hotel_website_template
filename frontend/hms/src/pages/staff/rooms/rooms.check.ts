// Run: npx tsx src/pages/staff/rooms/rooms.check.ts
import assert from 'node:assert/strict';
import { parseRoomNumbers, previewNumbers } from './roomNumbers';

assert.deepEqual(parseRoomNumbers('101-103, 201 205').numbers, ['101', '102', '103', '201', '205']);
assert.deepEqual(parseRoomNumbers('g1;G1, 101,101').numbers, ['G1', '101'], 'letters upper-cased, duplicates dropped');
assert.deepEqual(parseRoomNumbers('').numbers, []);
assert.match(parseRoomNumbers('110-101').error ?? '', /backwards/);
assert.match(parseRoomNumbers('10 1!').error ?? '', /not a room number/);
assert.match(parseRoomNumbers('1-500').error ?? '', /at most 200/);
assert.equal(parseRoomNumbers('1-200').numbers.length, 200);
assert.equal(previewNumbers(['101', '102', '103', '104', '105', '106', '107']), '101, 102, 103 … 106, 107');
console.log('rooms checks passed');

'use strict';
const fs = require('fs');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const html = fs.readFileSync('LODU_Phase2I.html', 'utf8');
const board = require('./board.js');

// Stage 10 regression: the current, counted track includes all four junctions.
assert.equal(board.PERIMETER_SIZE, 68);
assert.equal(board.SAFE_SQUARES.size, 12);
assert.equal(board.HOME_R, 75);
for (const id of ['stoneTrack', 'homeLaneTiles']) assert(html.includes(`id="${id}"`));
for (const attribute of ['data-track-node=', 'data-home-index=']) assert(html.includes(attribute));
assert.match(html, /for\s*\(let node=1;node<=Board\.PERIMETER_SIZE;node\+\+\)/);
assert.match(html, /for\s*\(let hi=1;hi<=8;hi\+\+\)/);
// Each of the four coloured junctions must be an actual track node.
for (const junction of [17, 34, 51, 68]) {
  assert.equal(board.isSafeSquare(junction), false);
  assert.equal(board.PLAYERS.filter(p => board.ENTRY_NODE[p] === junction).length, 1);
}
const scripts = [...html.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/g)];
assert(scripts.length, 'Expected embedded game script');
new vm.Script(scripts.at(-1)[1], {filename:'LODU_Phase2I.html'});
console.log('PASS Stage 10: 68 track positions, 12 safe squares, four junctions, UI structure and embedded syntax');

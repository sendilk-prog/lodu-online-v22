'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const Board = require('./board.js');
const html = fs.readFileSync('LODU_Phase2I.html', 'utf8');

// Check the actual current board geometry rather than the obsolete 64-node
// standalone fixture. Extract the production layout code without running the UI.
const start = html.indexOf('const Layout = (() => {');
const end = html.indexOf('})();', start);
assert(start >= 0 && end > start, 'Production Layout definition must exist');
const layoutSource = html.slice(start, end + 5);
const Layout = vm.runInNewContext(layoutSource + '\nLayout;', {Board});

assert.equal(Board.PERIMETER_SIZE, 68);
assert.equal(Board.HOME_R, 75);
const perimeter = Array.from({length:Board.PERIMETER_SIZE}, (_,i) => Layout.perimeterXY(i+1));
assert(perimeter.every(p => Number.isFinite(p.x) && Number.isFinite(p.y)));
assert.equal(new Set(perimeter.map(p => `${p.x},${p.y}`)).size, 68, 'Every visible perimeter tile has a distinct position');
assert.equal(Board.SAFE_SQUARES.size, 12);
assert.equal(Board.START_SAFE_SQUARES.size, 4);

const expected = {
  NORTH: {deploy:1, entry:68}, EAST: {deploy:18, entry:17},
  SOUTH: {deploy:35, entry:34}, WEST: {deploy:52, entry:51},
};
for (const [owner, {deploy,entry}] of Object.entries(expected)) {
  assert.equal(Board.DEPLOY_NODE[owner], deploy);
  assert.equal(Board.ENTRY_NODE[owner], entry);
  assert.equal(Board.perimeterNodeFromR(owner, 67), entry);
  assert.equal(Board.describeR(owner, 67).state, 'PERIMETER');
  assert.equal(Board.describeR(owner, 68).homeIndex, 2);
  assert.equal(Board.describeR(owner, 74).homeIndex, 8);
  assert.equal(Board.describeR(owner, 75).state, 'HOME');
  assert.equal(Board.isSafeSquare(deploy), true);
  assert.equal(Board.isSafeSquare(entry), false);
  assert.deepEqual(
    {...Layout.perimeterXY(entry)}, {...Layout.homeLaneXY(owner,1)},
    `${owner} coloured H1 junction must share one visible tile with perimeter`
  );
  const homePositions = Array.from({length:8}, (_,i) => Layout.homeLaneXY(owner,i+1));
  assert.equal(new Set(homePositions.map(p => `${p.x},${p.y}`)).size, 8);
  // Private H2-H8 cannot duplicate any shared track tile.
  const perimeterCoords = new Set(perimeter.map(p => `${p.x},${p.y}`));
  for (const p of homePositions.slice(1)) assert(!perimeterCoords.has(`${p.x},${p.y}`));
}
console.log('PASS Stage 3 geometry: 68 distinct perimeter tiles, four shared H1 junctions, 28 private lane tiles, 12 safe squares');

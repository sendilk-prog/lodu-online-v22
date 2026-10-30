// LODU — Embedded-engine parity tests.
// Proves the engine extracted from the generated embed (same code the HTML
// ships) behaves IDENTICALLY to canonical board.js/rules.js for every gap
// identified in review: player-count validation, deployment-state
// validation, movement-state validation, unknown-action rejection, and
// injected-RNG support in rollDie(). Run: node build_embed.js first,
// then: node tests_embedded_parity.js
'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');

const Canon = { Board: require('./board'), Rules: require('./rules') };

// Extract the embedded engine straight from the generated build artifact —
// not a hand-copy — so this test is checking the actual generation output.
const generatedPath = path.join(__dirname, 'embedded_engine.generated.js');
if (!fs.existsSync(generatedPath)) {
  console.error('embedded_engine.generated.js not found — run `node build_embed.js` first.');
  process.exit(1);
}
const genSrc = fs.readFileSync(generatedPath, 'utf8')
  .replace(/\/\* === EMBEDDED-ENGINE-(START|END).*?=== \*\/\n?/g, '');
const moduleShim = { exports: {} };
// eslint-disable-next-line no-new-func
new Function('module', 'exports', `${genSrc}\nmodule.exports = { Board, Rules };`)(moduleShim, moduleShim.exports);
const Embedded = moduleShim.exports;

let passed = 0;
let failed = 0;
function test(name, fn) {
  try {
    fn();
    passed += 1;
    console.log(`  ok  - ${name}`);
  } catch (e) {
    failed += 1;
    console.log(`FAIL  - ${name}`);
    console.log(`        ${e.message}`);
  }
}

test('[Parity] invalid player count is rejected identically by both engines', () => {
  for (const engine of [Canon, Embedded]) {
    assert.throws(() => engine.Rules.createMatch(['NORTH']), /2-4 players/);
    assert.throws(() => engine.Rules.createMatch(['NORTH', 'EAST', 'SOUTH', 'WEST', 'EXTRA']), /2-4 players/);
  }
});

test('[Parity] invalid deployment (piece not in BASE) is rejected identically by both engines', () => {
  for (const engine of [Canon, Embedded]) {
    const m = engine.Rules.createMatch(['NORTH', 'EAST']);
    const piece = engine.Rules.pieceById(m, 'NORTH_SHIP_1');
    piece.state = 'PERIMETER'; piece.r = 5; // already deployed
    assert.throws(() => engine.Rules.applyMove(m, 'NORTH', { pieceId: piece.id, action: 'DEPLOY' }), /not in BASE/);
  }
});

test('[Parity] invalid movement state (piece not PERIMETER/HOMELANE) is rejected identically by both engines', () => {
  for (const engine of [Canon, Embedded]) {
    const m = engine.Rules.createMatch(['NORTH', 'EAST']);
    const piece = engine.Rules.pieceById(m, 'NORTH_SHIP_1'); // still BASE
    assert.throws(
      () => engine.Rules.applyMove(m, 'NORTH', { pieceId: piece.id, action: 'MOVE', newR: 3 }),
      /cannot move from its current state/,
    );
  }
});

test('[Parity] unknown action is rejected identically by both engines (not silently treated as MOVE)', () => {
  for (const engine of [Canon, Embedded]) {
    const m = engine.Rules.createMatch(['NORTH', 'EAST']);
    const piece = engine.Rules.pieceById(m, 'NORTH_SHIP_1');
    piece.state = 'PERIMETER'; piece.r = 5;
    assert.throws(
      () => engine.Rules.applyMove(m, 'NORTH', { pieceId: piece.id, action: 'TELEPORT', newR: 999 }),
      /unknown action/,
    );
  }
});

test('[Parity] rollDie() accepts an injected deterministic RNG identically in both engines', () => {
  for (const engine of [Canon, Embedded]) {
    const fixedRng = () => 0; // Math.random()-shaped: always returns 0 -> face 1
    assert.strictEqual(engine.Rules.rollDie(fixedRng), 1);
    const fixedHigh = () => 0.9999;
    assert.strictEqual(engine.Rules.rollDie(fixedHigh), 6);
  }
});

test('[Parity] getKamikazePreview footprint matches between canonical and embedded engines', () => {
  const results = [Canon, Embedded].map((engine) => {
    const m = engine.Rules.createMatch(['NORTH', 'EAST']);
    let r = null;
    for (let i = 0; i < 64; i++) if (engine.Board.perimeterNodeFromR('NORTH', i) === 22) { r = i; break; }
    const missile = engine.Rules.pieceById(m, 'NORTH_MISSILE');
    missile.state = 'PERIMETER'; missile.r = r;
    return engine.Rules.getKamikazePreview(m, 'NORTH');
  });
  assert.deepStrictEqual(results[0], results[1]);
});

test('[Parity] a full combat scenario (missile capture) produces identical events in both engines', () => {
  const results = [Canon, Embedded].map((engine) => {
    const m = engine.Rules.createMatch(['NORTH', 'EAST']);
    let nr = null; for (let i = 0; i < 64; i++) if (engine.Board.perimeterNodeFromR('NORTH', i) === 6) { nr = i; break; }
    let er = null; for (let i = 0; i < 64; i++) if (engine.Board.perimeterNodeFromR('EAST', i) === 6) { er = i; break; }
    const missile = engine.Rules.pieceById(m, 'NORTH_MISSILE');
    missile.state = 'PERIMETER'; missile.r = nr - 1;
    const enemy = engine.Rules.pieceById(m, 'EAST_SHIP_1');
    enemy.state = 'PERIMETER'; enemy.r = er;
    const events = engine.Rules.applyMove(m, 'NORTH', { pieceId: missile.id, action: 'MOVE', newR: nr });
    return events.map((e) => e.type);
  });
  assert.deepStrictEqual(results[0], results[1]);
});

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);

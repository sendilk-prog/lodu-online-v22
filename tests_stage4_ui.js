'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const html=fs.readFileSync(__dirname+'/LODU_Phase2I.html','utf8');
const tests={
  'fleet picker exists':()=>assert.match(html,/id="fleetPicker"/),
  'three cards derive from match pieces':()=>assert.match(html,/match\.pieces\.filter\(p => p\.owner === player\)/),
  'legal cards derive from rules-provided legalMoves':()=>assert.match(html,/new Set\(legalMoves\.map\(m => m\.pieceId\)\)/),
  'fleet cards invoke existing move selection':()=>assert.match(html,/card\.addEventListener\('click', \(\) => choosePiece\(piece\.id\)\)/),
  'fleet cards disabled when not legal':()=>assert.match(html,/card\.disabled = !legal/),
  'game stage is proportionally scaled':()=>assert.match(html,/Math\.min\(window\.innerWidth \/ 1920, window\.innerHeight \/ 1080\)/),
  'game menu confirms discard':()=>assert.match(html,/window\.confirm\('Leave this match/),
  'approved gameplay art not falsely installed as board':()=>assert.doesNotMatch(html,/background-image:\s*url\(['"]?assets\/approved_gameplay_reference/),
};
for(const [name,fn] of Object.entries(tests)){fn();console.log('PASS:',name)}
console.log(Object.keys(tests).length+' Stage 4 UI wiring checks passed (static checks; not browser E2E)');

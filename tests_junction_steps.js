'use strict';
const assert=require('node:assert/strict');
const B=require('./board');
const R=require('./rules');
assert.equal(B.PERIMETER_SIZE,68);
assert.equal(B.HOME_R,75);
const expected={NORTH:{entry:68,deploy:1},EAST:{entry:17,deploy:18},SOUTH:{entry:34,deploy:35},WEST:{entry:51,deploy:52}};
for(const [owner,{entry,deploy}] of Object.entries(expected)) {
  assert.equal(B.ENTRY_NODE[owner],entry);
  assert.equal(B.DEPLOY_NODE[owner],deploy);
  assert.equal(B.perimeterNodeFromR(owner,67),entry);
  assert.equal(B.describeR(owner,67).state,'PERIMETER');
  assert.equal(B.describeR(owner,68).homeIndex,2);
  assert.equal(B.describeR(owner,74).homeIndex,8);
  assert.equal(B.describeR(owner,75).state,'HOME');
  const match=R.createMatch(['NORTH','EAST','SOUTH','WEST']);
  const ship=match.pieces.find(p=>p.owner===owner&&p.type==='SHIP');
  ship.state='PERIMETER'; ship.r=66;
  const events=R.applyMove(match,owner,{pieceId:ship.id,action:'MOVE',newR:70});
  assert.equal(ship.state,'HOMELANE'); assert.equal(ship.r,70);
  assert.equal(B.describeR(owner,67).node,entry);
  assert.equal(B.describeR(owner,68).homeIndex,2);
  // All four junctions must be present in every navy's clockwise route.
  for(const junction of [17,34,51,68]) {
    assert.equal(Array.from({length:68},(_,r)=>B.perimeterNodeFromR(owner,r)).filter(n=>n===junction).length,1);
  }
  // Missiles move through own junction and continue along shared perimeter.
  const missile=match.pieces.find(p=>p.owner===owner&&p.type==='MISSILE');
  missile.state='PERIMETER'; missile.r=66;
  R.applyMove(match,owner,{pieceId:missile.id,action:'MOVE',newR:70});
  assert.equal(missile.state,'PERIMETER'); assert.equal(missile.r,2);
  assert.equal(B.perimeterNodeFromR(owner,67),entry);
  console.log('PASS',owner,'junction step, own lane, missile crossing');
}
assert.equal(B.SAFE_SQUARES.size,12);
for(const n of [17,34,51,68]) assert.equal(B.isSafeSquare(n),false);
console.log('PASS all junctions ordinary, twelve safe nodes');

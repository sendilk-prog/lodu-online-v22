'use strict';
const assert = require('assert');
const B = require('./board');
const R = require('./rules');
let count=0;
function check(name,fn){fn();count++;console.log('ok - '+name)}
function rFor(owner,node){for(let r=0;r<64;r++)if(B.perimeterNodeFromR(owner,r)===node)return r;throw Error('node')}
function place(m,id,node){const p=R.pieceById(m,id);p.state='PERIMETER';p.r=rFor(p.owner,node);return p}
function land(attacker,defender,node,extra=[]){const m=R.createMatch(['NORTH','EAST']); const victim=place(m,defender,node);for(const id of extra)place(m,id,node); const a=place(m,attacker,node===1?64:node-1); const dest=rFor(a.owner,node); const events=R.applyMove(m,a.owner,{pieceId:a.id,action:'MOVE',newR:dest});return {m,a,victim,events}}
const cases=[['NORTH_SHIP_1','EAST_SHIP_1'],['NORTH_MISSILE','EAST_SHIP_1'],['NORTH_SHIP_1','EAST_MISSILE'],['NORTH_MISSILE','EAST_MISSILE']];
for(const node of B.SAFE_SQUARES) for(const [a,v] of cases){check(`safe node ${node}: ${a} vs ${v}`,()=>{const x=land(a,v,node);assert.equal(x.a.state,'PERIMETER');assert.equal(x.victim.state,'PERIMETER');assert(x.events.some(e=>e.type==='CAPTURE_BLOCKED_SAFE_SQUARE'));assert(!x.events.some(e=>/CAPTURED|COLLISION|LOSS|DIRECT_HIT/.test(e.type)))});}
check('safe node mixed ship/missile stack survives',()=>{const x=land('NORTH_SHIP_1','EAST_SHIP_1',4,['EAST_MISSILE','EAST_SHIP_2']);assert(x.m.pieces.every(p=>p.state==='PERIMETER'||p.state==='BASE'));assert.equal(R.pieceById(x.m,'EAST_MISSILE').state,'PERIMETER');assert.equal(R.pieceById(x.m,'EAST_SHIP_2').state,'PERIMETER');});
for(const [a,v] of cases)check(`unsafe node 6 still resolves ${a} vs ${v}`,()=>{const x=land(a,v,6);assert(x.a.state!=='PERIMETER'||x.victim.state!=='PERIMETER')});
check('Kamikaze destroys ships on safe square and activating missile',()=>{const m=R.createMatch(['NORTH','EAST']);place(m,'NORTH_MISSILE',4);const victim=place(m,'EAST_SHIP_1',4);const side=place(m,'EAST_SHIP_2',6);const [e]=R.useKamikaze(m,'NORTH');assert.equal(e.type,'KAMIKAZE');assert(e.destroyedShipIds.includes(victim.id));assert(e.destroyedShipIds.includes(side.id));assert.equal(victim.state,'BASE');assert.equal(side.state,'BASE');assert.equal(R.pieceById(m,'NORTH_MISSILE').state,'BASE')});
console.log(`${count} safe-square regression tests passed`);

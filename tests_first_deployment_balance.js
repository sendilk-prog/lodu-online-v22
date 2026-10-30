'use strict';
const assert = require('assert');
const fs = require('fs');
const vm = require('vm');
const html = fs.readFileSync(__dirname + '/LODU_Phase2I.html','utf8');
const begin = html.indexOf('let firstDeployAssist = {}');
const end = html.indexOf('function ', html.indexOf('function noteOpeningRoll', begin) + 9);
// isolate until next function (or UI declaration) after noteOpeningRoll
const excerpt = html.slice(begin, html.indexOf('\n/*', begin));
const context = {players:['NORTH','EAST','SOUTH'], Rules:{rollDie:()=>3}, Math, match:{pieces:[]}};
vm.createContext(context);
vm.runInContext(excerpt + '\nthis.api = {resetFirstDeployAssist, noteFirstDeployment, balancedOpeningRoll, noteOpeningRoll, state:()=>firstDeployAssist};', context);
const a=context.api;
a.resetFirstDeployAssist();
assert.equal(a.balancedOpeningRoll('EAST'),3);
context.match.pieces=[{id:'NORTH_SHIP_1',state:'PERIMETER'}];
a.noteFirstDeployment('NORTH',{pieceId:'NORTH_SHIP_1'},{NORTH_SHIP_1:{state:'BASE'}});
assert.equal(a.state().NORTH.everDeployed,true);
for(let i=0;i<3;i++){assert.equal(a.balancedOpeningRoll('EAST'),3);a.noteOpeningRoll('EAST',3)}
assert.equal(a.state().EAST.failuresAfterOpponent,3);
// deterministic Math.random injection to verify four regions of weighted roll.
const original=context.Math;
for(const [random,face] of [[.1,1],[.3,6],[.51,2],[.64,3],[.76,4],[.99,5]]) {
  context.Math=Object.assign(Object.create(Math),{random:()=>random});
  assert.equal(a.balancedOpeningRoll('EAST'),face);
}
context.Math=original;
assert.equal(a.state().EAST.activated,true);
context.match.pieces.push({id:'EAST_SHIP_1',state:'PERIMETER'});
a.noteFirstDeployment('EAST',{pieceId:'EAST_SHIP_1'},{EAST_SHIP_1:{state:'BASE'}});
assert.equal(a.state().EAST.spent,true);
assert.equal(a.balancedOpeningRoll('EAST'),3);
console.log('PASS: opening balance eligibility, three failures, weighted faces, persistent boost, permanent reset');

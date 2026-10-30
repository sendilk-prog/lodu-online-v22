'use strict';
const fs=require('fs'),assert=require('assert');
const html=fs.readFileSync('LODU_Phase2I.html','utf8');
const tests=[
 ['optional per-player name inputs',/nameInput\.id = `pn\$\{i\}`/.test(html)&&/nameInput\.maxLength = 32/.test(html)],
 ['names associated with selected faction',/customCommanderNames\[select\.value\] = cleaned/.test(html)],
 ['names do not change engine player identities',/match = Rules\.createMatch\(players\)/.test(html)],
 ['commander portrait unchanged',/\$\{portraitName\}_portrait\.png/.test(html)],
 ['display name in commander panel',/cpCommander'\)\.textContent = displayCommander\(player\)/.test(html)],
 ['display name in ceremony',/playerName: customCommanderNames\[p\] \|\| FACTION\[p\]\.name/.test(html)],
 ['die displays real face pips',/PIP_LAYOUTS\[face\]/.test(html)],
 ['die tumble settles on final engine result',/renderDie\(i < frames \? cosmetic : finalFace\)/.test(html)],
 ['die has front-facing bevel and no competing side pips',/bevelIvory/.test(html)&&!/dieSide3d/.test(html)&&!/dieTop3d/.test(html)]
];
for (const [label,passed] of tests){assert(passed,label); console.log('PASS',label)}
console.log(`${tests.length} personalised UI checks passed`);

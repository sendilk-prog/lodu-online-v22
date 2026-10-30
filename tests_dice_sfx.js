const fs=require('fs'),assert=require('assert');
const html=fs.readFileSync('LODU_Phase2I.html','utf8');
assert(/function renderDie\(face\)/.test(html));
assert(!/rotate\(\$\{rot\}deg\)/.test(html),'die must not rotate into perspective');
assert(/playMovementSfx\(\);\s*const movingPiece/.test(html),'movement sound must play per hop');
assert(/window\.AudioContext \|\| window\.webkitAudioContext/.test(html),'Safari audio support');
assert(/function animateHops\(/.test(html));
assert(/const HOP_MS = 170/.test(html),'movement timing unchanged');
console.log('PASS: front-facing die, per-hop SFX, Safari audio and movement timing');

// LODU — Board Topology (Phase 1)
// Pure data/logic. NO screen coordinates, NO rendering concerns live here.
// Derived directly from LODU_Board_Cropped.png (canonical board reference)
// and LODU_Master_Game_Specification_v1.1_CLEAN.docx.
//
// Perimeter: 68 shared nodes, IDs 1..68, clockwise, 68 wraps to 1.
// The four coloured outermost home-lane squares are shared perimeter junctions.
// Each player has:
//   - a deploy node (where a piece enters the perimeter from Base)
//   - a home-entry node (the last shared perimeter node before turning
//     into that player's private 8-step Home Lane)
//   - a home lane of 7 private positions (H2..H8; H1 is shared), then HOME (terminal).
//
// Derivation (confirmed against the board diagram):
//   North: deploy = 1,  entry = 68
//   East:  deploy = 18, entry = 17
//   South: deploy = 35, entry = 34
//   West:  deploy = 52, entry = 51
// General rule: entry = deploy - 1 (mod 68, 0 -> 68)

'use strict';

const PERIMETER_SIZE = 68;

const PLAYERS = ['NORTH', 'EAST', 'SOUTH', 'WEST'];

const FACTIONS = {
  NORTH: { nation: 'Bearistan', commander: 'Admiral Boris Bear', colour: 'purple' },
  EAST: { nation: 'Aegionia', commander: 'Commander Eagle Sterling', colour: 'blue' },
  SOUTH: { nation: 'Dragonia', commander: 'General Long Dragonia', colour: 'green' },
  WEST: { nation: 'Rangapura', commander: 'Marshal Zari Fox', colour: 'orange' },
};

const DEPLOY_NODE = { NORTH: 1, EAST: 18, SOUTH: 35, WEST: 52 };

const ENTRY_NODE = {};
for (const p of PLAYERS) {
  const d = DEPLOY_NODE[p];
  ENTRY_NODE[p] = d === 1 ? PERIMETER_SIZE : d - 1;
}

// The 8 canonical numbered Safe Squares (spec section 9).
const NUMBERED_SAFE_SQUARES = new Set([4, 12, 21, 29, 38, 46, 55, 63]);

// Four deployment/start nodes are safe; the four home-entry nodes are ordinary.
// Preserve the legacy export name for compatibility with existing consumers.
const ENTRY_SAFE_SQUARES = new Set();
const START_SAFE_SQUARES = new Set(Object.values(DEPLOY_NODE));

const SAFE_SQUARES = new Set([...NUMBERED_SAFE_SQUARES, ...START_SAFE_SQUARES]);

// Current ruling: 8 gold-orb nodes + 4 deployment/start nodes = 12 total.
const SAFE_SQUARE_COUNT = 12;

function isSafeSquare(node) {
  return SAFE_SQUARES.has(node);
}

// Relative-distance model avoids modulo edge cases in movement math.
// r = 0            -> piece sits exactly on its own deploy node (just deployed)
// r = 0..67        -> shared perimeter node, including all four junction squares
// r = 67           -> own coloured junction square (visual H1, shared track)
// r = 68..74       -> private home lane H2..H8
// r = 75           -> HOME (terminal, locked, always safe)
const HOME_LANE_START_R = PERIMETER_SIZE; // 68
const HOME_R = PERIMETER_SIZE + 7; // 75

function perimeterNodeFromR(player, r) {
  if (r < 0) {
    throw new Error(`r=${r} cannot be negative`);
  }
  // Modulo here is what allows a Missile to complete unlimited laps:
  // r is NOT restricted to 0..67 for Missiles (see rules.js), only Ships
  // are capped by HOME_R. A Ship never calls this with r > HOME_R-8.
  const deploy = DEPLOY_NODE[player];
  return ((deploy - 1 + (r % PERIMETER_SIZE)) % PERIMETER_SIZE) + 1;
}

// Describe where relative distance r places a piece, in engine terms.
function describeR(player, r) {
  if (r < 0) throw new Error('r cannot be negative');
  if (r < HOME_LANE_START_R) {
    return { state: 'PERIMETER', node: perimeterNodeFromR(player, r), r };
  }
  if (r < HOME_R) {
    return { state: 'HOMELANE', homeIndex: r - HOME_LANE_START_R + 2, r }; // 2..8
  }
  if (r === HOME_R) {
    return { state: 'HOME', r };
  }
  throw new Error(`r=${r} overshoots HOME (max is ${HOME_R})`);
}

module.exports = {
  PERIMETER_SIZE,
  PLAYERS,
  FACTIONS,
  DEPLOY_NODE,
  ENTRY_NODE,
  NUMBERED_SAFE_SQUARES,
  ENTRY_SAFE_SQUARES,
  START_SAFE_SQUARES,
  SAFE_SQUARES,
  SAFE_SQUARE_COUNT,
  isSafeSquare,
  HOME_LANE_START_R,
  HOME_R,
  perimeterNodeFromR,
  describeR,
};

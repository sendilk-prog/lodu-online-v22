// LODU — Rules Engine (Phase 1)
// Pure, deterministic game logic. No DOM, no coordinates, no timers.
// Kamikaze IS implemented (see canUseKamikaze / getKamikazePreview / useKamikaze below).
//
// Current ruling (Stage 11): all 12 Safe Squares prevent ALL normal
// enemy-on-enemy landing combat: ship/ship, ship/missile, missile/ship,
// missile/missile, and mixed stacks. Pieces coexist unharmed there.
// EXCEPTION: Kamikaze blasts DO destroy pieces on Safe Squares.
// The earlier R1/R2 landing-combat rulings apply ONLY to unsafe squares.
// Safe Squares: nodes 4,12,20,28,36,44,52,60 and four home entries.

'use strict';

const Board = require('./board');

function createPiece(id, owner, type) {
  return {
    id,
    owner,
    type, // 'SHIP' | 'MISSILE'
    state: 'BASE', // BASE | PERIMETER | HOMELANE | HOME | DESTROYED
    r: null,
  };
}

function createMatch(playerList) {
  if (playerList.length < 2 || playerList.length > 4) {
    throw new Error('LODU supports 2-4 players');
  }
  const pieces = [];
  const players = {};
  for (const p of playerList) {
    players[p] = {
      color: p,
      rearmUsed: false, // consumed the first time this player's Missile is lost
      kamikazeUsed: false, // reserved for Phase 2
    };
    pieces.push(createPiece(`${p}_SHIP_1`, p, 'SHIP'));
    pieces.push(createPiece(`${p}_SHIP_2`, p, 'SHIP'));
    pieces.push(createPiece(`${p}_MISSILE`, p, 'MISSILE'));
  }
  return {
    playerOrder: [...playerList],
    players,
    pieces,
    currentPlayerIndex: 0,
    sixesStreak: 0,
    winner: null,
    finishOrder: [],
    eventLog: [],
  };
}

function currentPlayer(match) {
  return match.playerOrder[match.currentPlayerIndex];
}

function piecesOf(match, player) {
  return match.pieces.filter((p) => p.owner === player && p.state !== 'DESTROYED');
}

function pieceById(match, id) {
  return match.pieces.find((p) => p.id === id);
}

// All non-destroyed pieces (any owner) currently sitting on a given
// shared perimeter node.
function piecesOnNode(match, node) {
  return match.pieces.filter((p) => p.state === 'PERIMETER' && p.r !== null
    && Board.perimeterNodeFromR(p.owner, p.r) === node);
}

function log(match, event) {
  match.eventLog.push(event);
}

// ---------- Legal move computation ----------

function getLegalMoves(match, player, roll) {
  if (match.winner || match.finishOrder.includes(player)) return [];
  const moves = [];
  const canDeploy = roll === 1 || roll === 6;

  for (const piece of piecesOf(match, player)) {
    if (piece.state === 'BASE') {
      if (canDeploy) {
        moves.push({ pieceId: piece.id, action: 'DEPLOY' });
      }
      continue;
    }
    if (piece.state === 'HOME' || piece.state === 'DESTROYED') continue;

    if (piece.type === 'MISSILE') {
      // Missiles never enter a Home Lane and never reach HOME (Canonical
      // Rules v1.2, Sec.2). They loop the 68-node perimeter indefinitely,
      // so a Missile move is ALWAYS legal once deployed — there is no
      // overshoot ceiling and crossing its own Home-entry node is normal,
      // unremarkable travel, not a state transition.
      const newR = piece.r + roll;
      moves.push({ pieceId: piece.id, action: 'MOVE', newR });
      continue;
    }

    // Ship: PERIMETER or HOMELANE, capped at HOME_R (overshoot illegal).
    const newR = piece.r + roll;
    if (newR > Board.HOME_R) continue;
    moves.push({ pieceId: piece.id, action: 'MOVE', newR });
  }
  return moves;
}

// ---------- Combat resolution ----------
// Runs after a piece's position changes and lands on a shared perimeter node.
// Returns a list of capture/loss events; mutates `match` piece states.
function resolveLanding(match, movedPiece) {
  const events = [];
  if (movedPiece.state !== 'PERIMETER') return events; // no combat off-perimeter

  const node = Board.perimeterNodeFromR(movedPiece.owner, movedPiece.r);
  const safe = Board.isSafeSquare(node);
  const others = piecesOnNode(match, node).filter((p) => p.id !== movedPiece.id);
  const enemyMissile = others.find((p) => p.owner !== movedPiece.owner && p.type === 'MISSILE');
  const enemyShips = others.filter((p) => p.owner !== movedPiece.owner && p.type === 'SHIP');

  // Safe-square immunity applies to EVERY normal landing combination.
  // Kamikaze is resolved separately in useKamikaze and bypasses this guard.
  if (safe) {
    if (enemyMissile || enemyShips.length) {
      events.push({ type: 'CAPTURE_BLOCKED_SAFE_SQUARE', node });
    }
    return events;
  }

  function loseMissile(piece) {
    const owner = match.players[piece.owner];
    if (!owner.rearmUsed) {
      owner.rearmUsed = true;
      piece.state = 'BASE';
      piece.r = null;
      events.push({ type: 'MISSILE_LOST_REARMABLE', pieceId: piece.id, node });
    } else {
      piece.state = 'DESTROYED';
      piece.r = null;
      events.push({ type: 'MISSILE_LOST_PERMANENT', pieceId: piece.id, node });
    }
  }

  function sendShipToBase(piece) {
    piece.state = 'BASE';
    piece.r = null;
    events.push({ type: 'SHIP_CAPTURED', pieceId: piece.id, node });
  }

  if (movedPiece.type === 'MISSILE') {
    if (enemyMissile) {
      // Missile-vs-Missile: mutual destruction on UNSAFE squares only.
      loseMissile(movedPiece);
      loseMissile(enemyMissile);
      events.push({ type: 'MISSILE_COLLISION', node, pieces: [movedPiece.id, enemyMissile.id] });
    } else if (enemyShips.length > 0) {
      for (const s of enemyShips) sendShipToBase(s);
      events.push({
        type: enemyShips.length > 1 ? 'DOUBLE_HIT' : 'DIRECT_HIT',
        node,
        capturedPieceIds: enemyShips.map((s) => s.id),
      });
    }
  } else {
    // movedPiece is a SHIP
    if (enemyMissile && enemyShips.length > 0) {
      // R2: mixed landing — resolve all three outcomes simultaneously,
      // as a single event, not as two sequential capture steps.
      loseMissile(enemyMissile);
      for (const s of enemyShips) sendShipToBase(s);
      movedPiece.state = 'BASE';
      movedPiece.r = null;
      events.push({
        type: 'MIXED_LANDING_RESOLVED',
        node,
        movingShipId: movedPiece.id,
        destroyedMissileId: enemyMissile.id,
        capturedShipIds: enemyShips.map((s) => s.id),
      });
    } else if (enemyMissile) {
      // Ship landing on a lone enemy Missile -> mutual destruction.
      loseMissile(enemyMissile);
      movedPiece.state = 'BASE';
      movedPiece.r = null;
      events.push({ type: 'SHIP_VS_MISSILE_MUTUAL_LOSS', node, pieces: [movedPiece.id, enemyMissile.id] });
    } else if (enemyShips.length > 0) {
      // Ship-lands-on-enemy-Ship capture on UNSAFE squares only.
      for (const s of enemyShips) sendShipToBase(s);
      events.push({ type: 'SHIP_CAPTURE_ON_LANDING', node, capturedPieceIds: enemyShips.map((s) => s.id) });
    }
    // Friendly pieces already on the node: no effect, they stack.
  }

  return events;
}

// ---------- Applying a chosen move ----------

function applyMove(match, player, chosen) {
  if (match.winner) throw new Error('match already has a winner');
  if (match.finishOrder.includes(player)) throw new Error('player has already finished');
  const piece = pieceById(match, chosen.pieceId);
  if (!piece || piece.owner !== player) throw new Error('invalid piece for this player');

  const events = [];

  if (chosen.action === 'DEPLOY') {
    if (piece.state !== 'BASE') throw new Error('piece is not in BASE');
    piece.state = 'PERIMETER';
    piece.r = 0;
    events.push({ type: 'DEPLOY', pieceId: piece.id, node: Board.perimeterNodeFromR(player, 0) });
    events.push(...resolveLanding(match, piece));
  } else if (chosen.action === 'MOVE') {
    if (piece.state !== 'PERIMETER' && piece.state !== 'HOMELANE') {
      throw new Error('piece cannot move from its current state');
    }
    const before = piece.r;
    if (piece.type === 'MISSILE') {
      // Missiles: pure perimeter wrap, normalize r into 0..67 so the
      // number never grows unbounded across a long match with many laps.
      const normalizedR = chosen.newR % Board.PERIMETER_SIZE;
      piece.r = normalizedR;
      piece.state = 'PERIMETER';
      const node = Board.perimeterNodeFromR(player, normalizedR);
      events.push({ type: 'MOVE', pieceId: piece.id, fromR: before, toR: normalizedR, resultState: 'PERIMETER', node });
    } else {
      const desc = Board.describeR(player, chosen.newR);
      piece.r = chosen.newR;
      piece.state = desc.state;
      events.push({
        type: 'MOVE', pieceId: piece.id, fromR: before, toR: chosen.newR, resultState: desc.state,
        node: desc.state === 'PERIMETER' ? desc.node : undefined,
        homeIndex: desc.state === 'HOMELANE' ? desc.homeIndex : undefined,
      });
      if (desc.state === 'HOME') events.push({ type: 'REACHED_HOME', pieceId: piece.id });
    }
    events.push(...resolveLanding(match, piece));
  } else {
    throw new Error(`unknown action ${chosen.action}`);
  }

  // Victory check: both of this player's Ships in HOME.
  const ships = match.pieces.filter((p) => p.owner === player && p.type === 'SHIP');
  if (ships.every((s) => s.state === 'HOME')) {
    if (!match.finishOrder.includes(player)) {
      match.finishOrder.push(player);
      events.push({ type: 'PLACE_SECURED', player, place: match.finishOrder.length });
      if (match.finishOrder.length === match.playerOrder.length - 1) {
        const last = match.playerOrder.find(p => !match.finishOrder.includes(p));
        match.finishOrder.push(last);
        match.winner = match.finishOrder[0];
        events.push({ type: 'VICTORY', player: match.winner, standings: match.finishOrder.slice() });
      }
    }
  }

  for (const e of events) log(match, e);
  return events;
}

// ---------- Turn flow ----------
// Caller is expected to: rollDie() -> getLegalMoves() -> (if any) let the
// human pick one -> applyMove() -> advanceTurn(). This module never
// auto-picks a move for a human turn (spec Sec.5).

function rollDie(rngFn) {
  const rng = rngFn || Math.random;
  return 1 + Math.floor(rng() * 6);
}

// Returns { forfeited: bool, extraTurn: bool } and mutates sixesStreak.
// Call this once, right after a roll, BEFORE offering piece choices.
function registerRoll(match, roll) {
  if (roll === 6) {
    match.sixesStreak += 1;
    if (match.sixesStreak >= 3) {
      // 3-sixes-forfeits-turn house rule (ruling this conversation).
      log(match, { type: 'THREE_SIXES_FORFEIT', player: currentPlayer(match) });
      match.sixesStreak = 0;
      return { forfeited: true, extraTurn: false };
    }
    return { forfeited: false, extraTurn: true };
  }
  // Any non-6 roll resets the streak.
  match.sixesStreak = 0;
  return { forfeited: false, extraTurn: false };
}

// Advance to the next player's turn (used when: no legal move, forfeit,
// or a non-extra-turn move has been resolved).
function advanceTurn(match) {
  if (!match.winner) {
    let attempts = 0;
    do {
      match.currentPlayerIndex = (match.currentPlayerIndex + 1) % match.playerOrder.length;
      attempts++;
    } while (match.finishOrder.includes(currentPlayer(match)) && attempts < match.playerOrder.length);
  }
  match.sixesStreak = 0;
}

// ---------- Kamikaze ----------
// Used INSTEAD of rolling the die. Sacrifices the active Missile.
// Footprint = current node, ±1, ±2 (5 perimeter nodes), wrap-aware.
// The entire footprint is resolved as ONE atomic/simultaneous event:
// all five affected nodes are determined up front, before anything is
// mutated, so no node's resolution can influence another's.
function canUseKamikaze(match, player) {
  const state = match.players[player];
  if (!state || state.kamikazeUsed) return false;
  const missile = match.pieces.find((p) => p.owner === player && p.type === 'MISSILE');
  return !!missile && missile.state === 'PERIMETER';
}

// Non-mutating preview: returns the exact center node + 5-node footprint
// useKamikaze() would compute right now, without touching state. This is
// the single source of truth for the footprint — the UI must call this
// rather than recomputing the ±1/±2 math itself.
function getKamikazePreview(match, player) {
  if (!canUseKamikaze(match, player)) return null;
  const missile = match.pieces.find((p) => p.owner === player && p.type === 'MISSILE');
  const centerNode = Board.perimeterNodeFromR(player, missile.r);
  const footprintNodes = [-2, -1, 0, 1, 2].map(
    (offset) => (((centerNode - 1 + offset) % Board.PERIMETER_SIZE) + Board.PERIMETER_SIZE) % Board.PERIMETER_SIZE + 1,
  );
  return { centerNode, footprintNodes };
}

function useKamikaze(match, player) {
  if (match.winner) throw new Error('match already has a winner');
  if (match.finishOrder.includes(player)) throw new Error('player has already finished');
  const state = match.players[player];
  if (!state) throw new Error(`unknown player ${player}`);
  if (state.kamikazeUsed) throw new Error('Kamikaze already used by this player');

  const preview = getKamikazePreview(match, player);
  if (!preview) {
    throw new Error('Kamikaze requires an active (deployed, on-perimeter) Missile');
  }
  const { centerNode, footprintNodes } = preview; // single source of truth — see getKamikazePreview above
  const footprintSet = new Set(footprintNodes);

  // Snapshot every affected piece BEFORE any mutation, so the blast is
  // atomic — no piece's removal affects whether another is caught.
  // Intentional exception: Kamikaze affects Safe Squares too.
  const affected = match.pieces.filter(
    (p) => p.state === 'PERIMETER' && footprintSet.has(Board.perimeterNodeFromR(p.owner, p.r)),
  );
  const affectedShips = affected.filter((p) => p.type === 'SHIP');
  const affectedMissiles = affected.filter((p) => p.type === 'MISSILE'); // includes the activating Missile

  state.kamikazeUsed = true;

  const destroyedShipIds = [];
  for (const ship of affectedShips) {
    ship.state = 'BASE';
    ship.r = null;
    destroyedShipIds.push(ship.id);
  }

  // Each Missile in the footprint (including the activating one) is
  // processed through its OWN owner's Rearm state, independently.
  const missileOutcomes = [];
  for (const m of affectedMissiles) {
    const ownerState = match.players[m.owner];
    if (!ownerState.rearmUsed) {
      ownerState.rearmUsed = true;
      m.state = 'BASE';
      m.r = null;
      missileOutcomes.push({ pieceId: m.id, owner: m.owner, outcome: 'REARMABLE' });
    } else {
      m.state = 'DESTROYED';
      m.r = null;
      missileOutcomes.push({ pieceId: m.id, owner: m.owner, outcome: 'PERMANENT' });
    }
  }

  const event = {
    type: 'KAMIKAZE',
    player,
    centerNode,
    footprintNodes,
    destroyedShipIds,
    missileOutcomes,
  };
  log(match, event);
  return [event];
}

module.exports = {
  createMatch,
  currentPlayer,
  piecesOf,
  pieceById,
  piecesOnNode,
  getLegalMoves,
  applyMove,
  rollDie,
  registerRoll,
  advanceTurn,
  canUseKamikaze,
  getKamikazePreview,
  useKamikaze,
};

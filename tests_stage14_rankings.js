'use strict';
const assert=require('assert');
const Rules=require('./rules'),Board=require('./board');
function finish(m,p){
 const ships=m.pieces.filter(x=>x.owner===p&&x.type==='SHIP');
 ships[0].state='HOME';ships[0].r=Board.HOME_R;
 ships[1].state='HOMELANE';ships[1].r=Board.HOME_R-1;
 return Rules.applyMove(m,p,{pieceId:ships[1].id,action:'MOVE',newR:Board.HOME_R});
}
for(let n=2;n<=4;n++){
 const m=Rules.createMatch(Board.PLAYERS.slice(0,n));
 for(let i=0;i<n-1;i++){
  const p=m.playerOrder[i];const ev=finish(m,p);
  assert(ev.some(x=>x.type==='PLACE_SECURED'&&x.place===i+1));
  assert.deepStrictEqual(m.finishOrder.slice(0,i+1),m.playerOrder.slice(0,i+1));
  assert.deepStrictEqual(Rules.getLegalMoves(m,p,6),[]);
  if(i<n-2){assert.strictEqual(m.winner,null);m.currentPlayerIndex=i;Rules.advanceTurn(m);assert.strictEqual(Rules.currentPlayer(m),m.playerOrder[i+1]);}
 }
 assert.strictEqual(m.winner,m.playerOrder[0]);
 assert.deepStrictEqual(m.finishOrder,m.playerOrder);
 assert.throws(()=>finish(m,m.playerOrder[n-1]),/winner/);
 console.log(`PASS Stage14 ${n}-player rankings, skipped turns and final ceremony trigger`);
}

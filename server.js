
'use strict';
const http=require('http'),crypto=require('crypto'),fs=require('fs'),path=require('path');
const {WebSocketServer,WebSocket}=require('ws');
const {Rules,Board}=require('./engine');
const rooms=new Map(), F=Board.PLAYERS;
const send=(ws,data)=>{if(ws.readyState===WebSocket.OPEN)ws.send(JSON.stringify(data));};
const token=()=>crypto.randomBytes(20).toString('hex');
const code=()=>String(crypto.randomInt(0,1000000)).padStart(6,'0');
function roomState(r){return {code:r.code,phase:r.phase,host:r.host,players:r.players.map(p=>({id:p.id,name:p.name,faction:p.faction,connected:!!p.ws&&p.ws.readyState===WebSocket.OPEN})),match:r.match,roll:r.roll,lastRoll:r.lastRoll,legalMoves:r.legalMoves,version:r.version};}
function publish(r){r.version++;for(const p of r.players)if(p.ws)send(p.ws,{type:'state',state:roomState(r),you:p.id,token:p.token});}
function fail(ws,msg){send(ws,{type:'error',message:msg});}
function findPlayer(ws){for(const r of rooms.values()){const p=r.players.find(p=>p.ws===ws);if(p)return {r,p};}return null;}
function next(r){Rules.advanceTurn(r.match);r.roll=null;r.legalMoves=[];}
function action(ws,m){
 const found=findPlayer(ws);
 if(m.type==='create'){
  if(found)return fail(ws,'Already in a room');
  let c;do{c=code()}while(rooms.has(c));
  const p={id:crypto.randomUUID(),token:token(),name:String(m.name||'Host').slice(0,24),faction:null,ws};
  const r={code:c,host:p.id,players:[p],phase:'lobby',match:null,roll:null,lastRoll:null,rollSerial:0,legalMoves:[],version:0};
  rooms.set(c,r);publish(r);return;
 }
 if(m.type==='join'){
  if(found)return fail(ws,'Already in a room');
  const r=rooms.get(String(m.code||''));if(!r)return fail(ws,'Room not found');
  if(r.phase!=='lobby')return fail(ws,'Game already started; reconnect instead');
  if(r.players.length>=4)return fail(ws,'Room is full');
  const p={id:crypto.randomUUID(),token:token(),name:String(m.name||'Friend').slice(0,24),faction:null,ws};
  r.players.push(p);publish(r);return;
 }
 if(m.type==='reconnect'){
  const r=rooms.get(String(m.code||''));const p=r?.players.find(x=>x.token===m.token);
  if(!p)return fail(ws,'Invalid reconnect credentials');
  if(p.ws&&p.ws!==ws)p.ws.close();
  p.ws=ws;publish(r);return;
 }
 if(!found)return fail(ws,'Create or join a room first');
 const {r,p}=found;
 if(m.type==='faction'){
  if(r.phase!=='lobby')return fail(ws,'Game already started');
  if(!F.includes(m.faction))return fail(ws,'Unknown faction');
  if(r.players.some(x=>x!==p&&x.faction===m.faction))return fail(ws,'Faction already taken');
  p.faction=m.faction;publish(r);return;
 }
 if(m.type==='start'){
  if(p.id!==r.host)return fail(ws,'Only the host can start');
  if(r.phase!=='lobby'||r.players.length<2||r.players.some(x=>!x.faction))return fail(ws,'Need 2–4 players with unique factions');
  r.match=Rules.createMatch(r.players.map(x=>x.faction));r.phase='playing';r.lastRoll=null;r.rollSerial=0;publish(r);return;
 }
 if(r.phase!=='playing')return fail(ws,'Game not started');
 if(Rules.currentPlayer(r.match)!==p.faction)return fail(ws,'Not your turn');
 if(r.match.winner)return fail(ws,'Game finished');
 if(m.type==='roll'){
  if(r.roll!==null)return fail(ws,'Choose a move first');
  const roll=crypto.randomInt(1,7);
  const reg=Rules.registerRoll(r.match,roll);
  r.roll=roll;
  r.legalMoves=reg.forfeited?[]:Rules.getLegalMoves(r.match,p.faction,roll);
  r.lastRoll={id:++r.rollSerial,face:roll,player:p.faction,noMove:!!(reg.forfeited||!r.legalMoves.length)};
  if(r.lastRoll.noMove){next(r);}
  publish(r);return;
 }
 if(m.type==='move'){
  if(r.roll===null)return fail(ws,'Roll first');
  const move=r.legalMoves.find(x=>x.pieceId===m.pieceId);
  if(!move)return fail(ws,'Illegal piece');
  const roll=r.roll;
  Rules.applyMove(r.match,p.faction,move);
  r.roll=null;r.legalMoves=[];
  if(!r.match.winner&&!r.match.finishOrder.includes(p.faction)&&roll!==6)next(r);
  else if(r.match.finishOrder.includes(p.faction)&&!r.match.winner)next(r);
  if(r.match.winner)r.phase='finished';
  publish(r);return;
 }
 if(m.type==='kamikaze'){
  if(r.roll!==null)return fail(ws,'Kamikaze is instead of rolling');
  if(!Rules.canUseKamikaze(r.match,p.faction))return fail(ws,'Kamikaze unavailable');
  Rules.useKamikaze(r.match,p.faction);next(r);publish(r);return;
 }
 fail(ws,'Unknown action');
}
const server=http.createServer((req,res)=>{
 const pathname=new URL(req.url,'http://localhost').pathname;
 if(pathname==='/health'){res.writeHead(200,{'Content-Type':'application/json'});return res.end(JSON.stringify({ok:true,rooms:rooms.size}));}
 const rel=pathname==='/'?'index.html':decodeURIComponent(pathname).replace(/^\/+/, '');
 if(!/^(index\.html|assets\/|cinematics\/|homecoming\/|ceremony\/)/.test(rel)){res.writeHead(404);return res.end('Not found');}
 const filepath=path.resolve(__dirname,rel);
 if(!filepath.startsWith(__dirname+path.sep)){res.writeHead(403);return res.end('Forbidden');}
 fs.stat(filepath,(err,st)=>{if(err||!st.isFile()){res.writeHead(404);return res.end('Not found');}
 const ext=path.extname(filepath).toLowerCase();const types={'.html':'text/html; charset=utf-8','.js':'application/javascript','.css':'text/css','.png':'image/png','.jpg':'image/jpeg','.jpeg':'image/jpeg','.svg':'image/svg+xml','.mp4':'video/mp4','.webm':'video/webm','.mp3':'audio/mpeg','.wav':'audio/wav','.woff2':'font/woff2'};
 res.writeHead(200,{'Content-Type':types[ext]||'application/octet-stream','Cache-Control':'public, max-age=600'});fs.createReadStream(filepath).pipe(res);});
});
const wss=new WebSocketServer({server,maxPayload:8192});
wss.on('connection',ws=>{
 ws.on('message',buf=>{try{const m=JSON.parse(buf);if(!m||typeof m.type!=='string')return fail(ws,'Invalid request');action(ws,m);}catch(e){fail(ws,e.message||'Invalid request');}});
 ws.on('close',()=>{const found=findPlayer(ws);if(found){found.p.ws=null;publish(found.r);}});
});
const port=Number(process.env.PORT||3000);
if(require.main===module)server.listen(port,'0.0.0.0',()=>console.log('LODU Online prototype listening on '+port));
module.exports={server,rooms,action};

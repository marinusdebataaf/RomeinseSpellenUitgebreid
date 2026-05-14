const BOARD_WIDTH = 729;
const BOARD_HEIGHT = 729;
const BOARD_SIZE = 8;
const STONES_PER_PLAYER = 20;
const VARIANT_PISO = "piso";
const VARIANT_SENECA = "seneca";
const AI_DELAY_MS = 1200;
const AI_PREVIEW_MS = 350;

const nodes = [
  { x:55,y:57,r:38 },{ x:142,y:58,r:40 },{ x:230,y:57,r:40 },{ x:315,y:57,r:39 },{ x:405,y:58,r:42 },{ x:494,y:58,r:39 },{ x:582,y:58,r:41 },{ x:666,y:57,r:37 },
  { x:55,y:144,r:37 },{ x:142,y:144,r:41 },{ x:229,y:144,r:38 },{ x:315,y:144,r:41 },{ x:404,y:144,r:38 },{ x:493,y:144,r:39 },{ x:581,y:143,r:38 },{ x:666,y:143,r:38 },
  { x:54,y:232,r:38 },{ x:142,y:233,r:40 },{ x:229,y:232,r:39 },{ x:316,y:232,r:38 },{ x:404,y:232,r:41 },{ x:493,y:231,r:39 },{ x:580,y:233,r:39 },{ x:667,y:234,r:37 },
  { x:57,y:322,r:38 },{ x:143,y:322,r:41 },{ x:228,y:319,r:38 },{ x:315,y:320,r:40 },{ x:403,y:321,r:40 },{ x:492,y:321,r:39 },{ x:580,y:320,r:40 },{ x:666,y:322,r:38 },
  { x:54,y:409,r:39 },{ x:141,y:410,r:42 },{ x:229,y:409,r:40 },{ x:315,y:410,r:39 },{ x:403,y:409,r:40 },{ x:491,y:410,r:40 },{ x:580,y:409,r:40 },{ x:666,y:410,r:39 },
  { x:54,y:493,r:38 },{ x:142,y:495,r:39 },{ x:228,y:495,r:38 },{ x:314,y:496,r:39 },{ x:403,y:495,r:38 },{ x:492,y:495,r:39 },{ x:581,y:497,r:39 },{ x:666,y:497,r:36 },
  { x:52,y:582,r:39 },{ x:141,y:582,r:41 },{ x:229,y:584,r:39 },{ x:315,y:583,r:40 },{ x:403,y:582,r:40 },{ x:491,y:584,r:41 },{ x:580,y:583,r:41 },{ x:668,y:585,r:39 },
  { x:54,y:671,r:38 },{ x:140,y:670,r:38 },{ x:229,y:670,r:39 },{ x:314,y:670,r:38 },{ x:403,y:671,r:40 },{ x:493,y:670,r:38 },{ x:581,y:670,r:38 },{ x:666,y:672,r:38 }
];

let board = Array(64).fill(null);
let currentPlayer = 1;
let placed = { 1: 0, 2: 0 };
let selected = null;
let gameOver = false;
let variant = null;
let hintsEnabled = true;
let gameMode = "pvp";
let aiTurnTimer = null;
let inciti = new Set();
let pendingRemovals = { 1: [], 2: [] };
let lastMove = null;
let aiMoveHistory = { 1: {}, 2: {} };

const game = document.getElementById("game");
const holesContainer = document.getElementById("holes");
const piecesContainer = document.getElementById("pieces");
const variantText = document.getElementById("variantText");
const variantPicker = document.getElementById("variantPicker");
const choosePisoBtn = document.getElementById("choosePisoBtn");
const chooseSenecaBtn = document.getElementById("chooseSenecaBtn");
const turnText = document.getElementById("turnText");
const countP1Placed = document.getElementById("countP1Placed");
const countP2Placed = document.getElementById("countP2Placed");
const countP1Board = document.getElementById("countP1Board");
const countP2Board = document.getElementById("countP2Board");
const countP1Inciti = document.getElementById("countP1Inciti");
const countP2Inciti = document.getElementById("countP2Inciti");
const toggleHintsBtn = document.getElementById("toggleHintsBtn");
const gameModeSelect = document.getElementById("gameModeSelect");
const aiThinking = document.getElementById("aiThinking");
const resetBtn = document.getElementById("resetBtn");
const winModal = document.getElementById("winModal");
const winMessage = document.getElementById("winMessage");
const playAgainBtn = document.getElementById("playAgainBtn");

function scaleX(x){return (x/BOARD_WIDTH)*game.clientWidth;} function scaleY(y){return (y/BOARD_HEIGHT)*game.clientHeight;} function scaleR(r){return r*Math.min(game.clientWidth/BOARD_WIDTH,game.clientHeight/BOARD_HEIGHT);} function getNodePixel(i){return {x:scaleX(nodes[i].x),y:scaleY(nodes[i].y)};}
function rcToIndex(row,col){return row*BOARD_SIZE+col;} function indexToRC(i){return {row:Math.floor(i/BOARD_SIZE),col:i%BOARD_SIZE};} function inBounds(row,col){return row>=0&&row<BOARD_SIZE&&col>=0&&col<BOARD_SIZE;} function getOpponent(p){return p===1?2:1;} function isPlacementPhase(){return placed[1]<STONES_PER_PLAYER||placed[2]<STONES_PER_PLAYER;}
function getOrthogonalNeighbors(i){const {row,col}=indexToRC(i); const out=[]; if(row>0)out.push(rcToIndex(row-1,col)); if(row<7)out.push(rcToIndex(row+1,col)); if(col>0)out.push(rcToIndex(row,col-1)); if(col<7)out.push(rcToIndex(row,col+1)); return out;}
function getPlayerStoneCount(p){return board.filter(v=>v===p).length;} function getIncitiCount(p){let n=0; for(const i of inciti) if(board[i]===p)n++; return n;}
function updatePiecePosition(el,i){const p=getNodePixel(i); el.style.left=`${p.x}px`; el.style.top=`${p.y}px`; el.dataset.index=String(i);} function clearSelection(){document.querySelectorAll(".piece.selected").forEach(el=>el.classList.remove("selected")); selected=null;} function getPieceElementAt(i){return [...document.querySelectorAll(".piece")].find(el=>Number(el.dataset.index)===i);}
function isAiPlayer(p){return gameMode==="ai-both"||(gameMode==="ai-p1"&&p===1)||(gameMode==="ai-p2"&&p===2);} function setAiThinking(v){if(aiThinking) aiThinking.classList.toggle("hidden",!v);} function clearAiPreview(){document.querySelectorAll(".piece.ai-preview").forEach(p=>p.classList.remove("ai-preview"));}

function refreshPieceStates(){document.querySelectorAll(".piece").forEach(piece=>{const i=Number(piece.dataset.index), p=Number(piece.dataset.player), trapped=inciti.has(i); piece.classList.toggle("incitus",trapped); piece.src=trapped?(p===1?"stone1incinitus.png":"stone2incinitus.png"):(p===1?"stone1.png":"stone2.png");});}
function isLeapMove(from,to,p){const a=indexToRC(from),b=indexToRC(to),dr=b.row-a.row,dc=b.col-a.col; if(!((Math.abs(dr)===2&&dc===0)||(Math.abs(dc)===2&&dr===0)))return false; if(board[to]!==null)return false; const mid=rcToIndex(a.row+dr/2,a.col+dc/2); return board[mid]===p&&!inciti.has(mid);} function isStepMove(from,to){return board[to]===null&&getOrthogonalNeighbors(from).includes(to);} function repeatsBackAndForth(from,to,p){return !!lastMove&&lastMove.player===p&&lastMove.from===to&&lastMove.to===from;} function isLegalMove(from,to,p){return board[from]===p&&!inciti.has(from)&&!repeatsBackAndForth(from,to,p)&&(isStepMove(from,to)||isLeapMove(from,to,p));}
function getLegalMovesForPiece(i,p){const {row,col}=indexToRC(i); const candidates=[[row-1,col],[row+1,col],[row,col-1],[row,col+1],[row-2,col],[row+2,col],[row,col-2],[row,col+2]].filter(([r,c])=>inBounds(r,c)).map(([r,c])=>rcToIndex(r,c)); return candidates.filter(t=>isLegalMove(i,t,p));}
function refreshHoles(){document.querySelectorAll(".hole").forEach((h,i)=>{h.classList.remove("occupied","valid-target"); if(!variant||gameOver||board[i]!==null){h.classList.add("occupied"); return;} if(!hintsEnabled)return; if(isPlacementPhase()){h.classList.add("valid-target"); return;} if(selected){ if(isLegalMove(selected.from,i,currentPlayer)) h.classList.add("valid-target"); else h.classList.add("occupied"); }});}

function getValidPendingRemovals(p){const valid=[],seen=new Set(); for(const item of pendingRemovals[p]){if(!item||seen.has(item.victim))continue; seen.add(item.victim); if(board[item.victim]!==getOpponent(p))continue; if(!inciti.has(item.victim))continue; if(board[item.guardA]!==p||board[item.guardB]!==p)continue; if(inciti.has(item.guardA)||inciti.has(item.guardB))continue; valid.push(item);} return valid;} function canRemovePendingThisTurn(p){return variant===VARIANT_SENECA&&getValidPendingRemovals(p).length>0;}
function updateStatus(){countP1Placed.textContent=placed[1]; countP2Placed.textContent=placed[2]; countP1Board.textContent=getPlayerStoneCount(1); countP2Board.textContent=getPlayerStoneCount(2); countP1Inciti.textContent=getIncitiCount(1); countP2Inciti.textContent=getIncitiCount(2); variantText.textContent=variant===VARIANT_PISO?"Piso":variant===VARIANT_SENECA?"Seneca":"Nog niet gekozen"; if(!variant){turnText.textContent="Selecteer Piso of Seneca om te starten"; turnText.className="value"; return;} if(gameOver){turnText.textContent="Het spel is voorbij"; turnText.className="value"; return;} const actor=isAiPlayer(currentPlayer)?"AI":`Speler ${currentPlayer}`; if(canRemovePendingThisTurn(currentPlayer)){turnText.textContent=`${actor}: verwijder eerst 1 geldige incitus`; turnText.className=`value player-${currentPlayer}`; return;} if(isPlacementPhase())turnText.textContent=`${actor}: kies een leeg vak om een steen te plaatsen`; else turnText.textContent=!selected?`${actor}: kies een vrije steen om te verplaatsen of te springen`:`${actor}: verplaats 1 vak of spring over 1 eigen steen`; turnText.className=`value player-${currentPlayer}`;}
function showWinPopup(p){gameOver=true; clearSelection(); refreshHoles(); updateStatus(); winMessage.textContent=`Speler ${p} wint!`; winModal.classList.remove("hidden");} function hideWinPopup(){winModal.classList.add("hidden");}
function hasAnyLegalMove(p){if(!variant)return true; if(isPlacementPhase())return true; if(canRemovePendingThisTurn(p))return true; for(let i=0;i<64;i++) if(board[i]===p&&!inciti.has(i)&&getLegalMovesForPiece(i,p).length>0)return true; return false;}
function removeStoneAt(i){board[i]=null; inciti.delete(i); pendingRemovals[1]=pendingRemovals[1].filter(x=>x.victim!==i); pendingRemovals[2]=pendingRemovals[2].filter(x=>x.victim!==i); const piece=getPieceElementAt(i); if(piece)piece.remove();}
function freeIncitiWhoseGuardsFailed(){for(const p of [1,2]){const validVictims=new Set(getValidPendingRemovals(p).map(x=>x.victim)); for(const item of pendingRemovals[p]) if(board[item.victim]!==null&&!validVictims.has(item.victim)) inciti.delete(item.victim); pendingRemovals[p]=pendingRemovals[p].filter(x=>board[x.victim]!==null&&validVictims.has(x.victim));} refreshPieceStates();}
function getCaptureRecordsFromMove(toIndex,p){const enemy=getOpponent(p),found=[]; const {row,col}=indexToRC(toIndex); const checks=[[[row,col+1],[row,col+2]],[[row,col-1],[row,col-2]],[[row+1,col],[row+2,col]],[[row-1,col],[row-2,col]]]; for(const [mid,far] of checks){if(!inBounds(mid[0],mid[1])||!inBounds(far[0],far[1]))continue; const victim=rcToIndex(mid[0],mid[1]), guard=rcToIndex(far[0],far[1]); if(board[victim]===enemy&&!inciti.has(guard)&&board[guard]===p) found.push({victim,guardA:toIndex,guardB:guard});} for(const {corner,a,b} of [{corner:0,a:1,b:8},{corner:7,a:6,b:15},{corner:56,a:48,b:57},{corner:63,a:55,b:62}]){if(board[corner]!==enemy)continue; if(toIndex===a&&board[b]===p&&!inciti.has(b))found.push({victim:corner,guardA:a,guardB:b}); if(toIndex===b&&board[a]===p&&!inciti.has(a))found.push({victim:corner,guardA:a,guardB:b});} return [...new Map(found.map(x=>[x.victim,x])).values()];}
function applyPisoCaptures(records){for(const r of records)removeStoneAt(r.victim); refreshPieceStates();} function applySenecaTraps(records,p){for(const r of records){if(board[r.victim]!==getOpponent(p))continue; inciti.add(r.victim); if(!pendingRemovals[p].some(x=>x.victim===r.victim))pendingRemovals[p].push(r);} refreshPieceStates();}
function checkForEndOfGame(){if(!variant||isPlacementPhase())return false; const opp=getOpponent(currentPlayer); if(getPlayerStoneCount(opp)<=1||!hasAnyLegalMove(opp)){showWinPopup(currentPlayer); return true;} return false;}
function switchPlayer(){currentPlayer=getOpponent(currentPlayer); clearSelection(); freeIncitiWhoseGuardsFailed(); refreshHoles(); updateStatus(); if(!isPlacementPhase()&&!hasAnyLegalMove(currentPlayer))showWinPopup(getOpponent(currentPlayer)); maybeRunAiTurn();}
function finishTurnAfterAction(moveInfo,wasMove){if(wasMove){lastMove=moveInfo; const records=getCaptureRecordsFromMove(moveInfo.to,currentPlayer); if(variant===VARIANT_PISO)applyPisoCaptures(records); else applySenecaTraps(records,currentPlayer);} freeIncitiWhoseGuardsFailed(); refreshHoles(); updateStatus(); if(checkForEndOfGame())return; switchPlayer();}

function scoreBoardForPlayer(p){const opp=getOpponent(p); let score=(getPlayerStoneCount(p)-getPlayerStoneCount(opp))*80+(getIncitiCount(opp)-getIncitiCount(p))*45; for(let i=0;i<64;i++){if(board[i]===p&&!inciti.has(i))score+=getLegalMovesForPiece(i,p).length*3; if(board[i]===opp&&!inciti.has(i))score-=getLegalMovesForPiece(i,opp).length*2;} return score;}
function scorePlacement(i,p){const {row,col}=indexToRC(i); const center=7-(Math.abs(3.5-row)+Math.abs(3.5-col)); board[i]=p; const captures=getCaptureRecordsFromMove(i,p).length; const danger=getCaptureRecordsFromMove(i,getOpponent(p)).length; board[i]=null; return center*8+captures*250-danger*80+Math.random();}
function chooseAiPlacement(p){const empty=board.map((v,i)=>v===null?i:null).filter(i=>i!==null); return empty.reduce((best,i)=>scorePlacement(i,p)>scorePlacement(best,p)?i:best,empty[0]);}
function chooseAiRemoval(p){const valid=getValidPendingRemovals(p); if(!valid.length)return null; return valid.sort((a,b)=>scoreBoardForPlayer(p)-scoreBoardForPlayer(p))[0].victim;}
function getAiMoveKey(move){return [Math.min(move.from,move.to),Math.max(move.from,move.to)].join("-");}
function getAiMoveCount(p,move){return aiMoveHistory[p][getAiMoveKey(move)]||0;}
function rememberAiMove(p,move){const key=getAiMoveKey(move); aiMoveHistory[p][key]=(aiMoveHistory[p][key]||0)+1;}
function chooseAiMove(p){let moves=[]; for(let from=0;from<64;from++) if(board[from]===p&&!inciti.has(from)) getLegalMovesForPiece(from,p).forEach(to=>moves.push({from,to})); if(!moves.length)return null;
  const freshMoves=moves.filter(m=>getAiMoveCount(p,m)<2);
  const candidateMoves=freshMoves.length?freshMoves:moves;
  let best=candidateMoves[0],bestScore=-Infinity;
  for(const m of candidateMoves){const oldFrom=board[m.from], oldTo=board[m.to], oldLast=lastMove; board[m.from]=null; board[m.to]=p; lastMove={player:p,from:m.from,to:m.to}; const records=getCaptureRecordsFromMove(m.to,p); const repeatPenalty=getAiMoveCount(p,m)*220; let score=scoreBoardForPlayer(p)+records.length*300-repeatPenalty+Math.random(); board[m.from]=oldFrom; board[m.to]=oldTo; lastMove=oldLast; if(score>bestScore){bestScore=score; best=m;}} return best;}
function maybeRunAiTurn(){window.clearTimeout(aiTurnTimer); clearAiPreview(); if(!variant||gameOver||!isAiPlayer(currentPlayer)){setAiThinking(false); return;} setAiThinking(true); aiTurnTimer=window.setTimeout(runAiTurn,AI_DELAY_MS);}
function runAiTurn(){if(!variant||gameOver||!isAiPlayer(currentPlayer)){setAiThinking(false); return;} if(canRemovePendingThisTurn(currentPlayer)){const victim=chooseAiRemoval(currentPlayer); if(victim===null){setAiThinking(false); return;} const piece=getPieceElementAt(victim); if(piece)piece.classList.add("ai-preview"); window.setTimeout(()=>{if(piece)piece.classList.remove("ai-preview"); removeStoneAt(victim); pendingRemovals[currentPlayer]=pendingRemovals[currentPlayer].filter(x=>x.victim!==victim); freeIncitiWhoseGuardsFailed(); refreshHoles(); updateStatus(); setAiThinking(false); if(checkForEndOfGame())return; switchPlayer();},AI_PREVIEW_MS); return;} if(placed[currentPlayer]<STONES_PER_PLAYER){const target=chooseAiPlacement(currentPlayer); window.setTimeout(()=>{handleHoleClick(target,true); setAiThinking(false);},AI_PREVIEW_MS); return;} const move=chooseAiMove(currentPlayer); if(!move){setAiThinking(false); return;} const piece=getPieceElementAt(move.from); if(!piece){setAiThinking(false); return;} piece.classList.add("ai-preview"); window.setTimeout(()=>{piece.classList.remove("ai-preview"); selected={el:piece,from:move.from}; rememberAiMove(currentPlayer,move); handleHoleClick(move.to,true); setAiThinking(false);},AI_PREVIEW_MS);}

function createPiece(p,i){const el=document.createElement("img"); el.src=p===1?"stone1.png":"stone2.png"; el.className="piece"; el.dataset.player=String(p); el.draggable=false; updatePiecePosition(el,i); el.addEventListener("click",e=>{e.stopPropagation(); if(!variant||gameOver||isAiPlayer(currentPlayer))return; if(canRemovePendingThisTurn(currentPlayer)){const valid=getValidPendingRemovals(currentPlayer); const idx=Number(el.dataset.index); if(!valid.some(x=>x.victim===idx))return; removeStoneAt(idx); pendingRemovals[currentPlayer]=pendingRemovals[currentPlayer].filter(x=>x.victim!==idx); freeIncitiWhoseGuardsFailed(); refreshHoles(); updateStatus(); if(checkForEndOfGame())return; switchPlayer(); return;} if(isPlacementPhase())return; if(Number(el.dataset.player)!==currentPlayer)return; const idx=Number(el.dataset.index); if(inciti.has(idx))return; clearSelection(); el.classList.add("selected"); selected={el,from:idx}; refreshHoles(); updateStatus();}); piecesContainer.appendChild(el);}
function handleHoleClick(index,fromAi=false){if(!variant||gameOver)return; if(!fromAi&&isAiPlayer(currentPlayer))return; if(canRemovePendingThisTurn(currentPlayer))return; if(placed[currentPlayer]<STONES_PER_PLAYER){if(board[index]!==null)return; board[index]=currentPlayer; createPiece(currentPlayer,index); placed[currentPlayer]++; finishTurnAfterAction(null,false); return;} if(!selected)return; if(!isLegalMove(selected.from,index,currentPlayer))return; const from=selected.from; board[from]=null; board[index]=currentPlayer; updatePiecePosition(selected.el,index); selected.el.classList.remove("selected"); selected=null; finishTurnAfterAction({player:currentPlayer,from,to:index},true);}
function createHoles(){holesContainer.innerHTML=""; nodes.forEach((node,i)=>{const h=document.createElement("div"); const r=Math.max(scaleR(node.r),16); h.className="hole"; h.style.left=`${scaleX(node.x)}px`; h.style.top=`${scaleY(node.y)}px`; h.style.width=`${r*2}px`; h.style.height=`${r*2}px`; h.addEventListener("click",()=>handleHoleClick(i)); holesContainer.appendChild(h);}); refreshHoles();}
function repositionPieces(){document.querySelectorAll(".piece").forEach(el=>updatePiecePosition(el,Number(el.dataset.index))); refreshPieceStates();}
function chooseVariant(v){variant=v; variantPicker.style.display="none"; resetGameState();}
function resetGameState(){window.clearTimeout(aiTurnTimer); setAiThinking(false); clearAiPreview(); board=Array(64).fill(null); currentPlayer=1; placed={1:0,2:0}; selected=null; gameOver=false; inciti=new Set(); pendingRemovals={1:[],2:[]}; lastMove=null; aiMoveHistory={1:{},2:{}}; piecesContainer.innerHTML=""; hideWinPopup(); createHoles(); refreshPieceStates(); updateStatus(); maybeRunAiTurn();}
function resetAll(){if(!variant){board=Array(64).fill(null); currentPlayer=1; placed={1:0,2:0}; selected=null; gameOver=false; inciti=new Set(); pendingRemovals={1:[],2:[]}; lastMove=null; aiMoveHistory={1:{},2:{}}; piecesContainer.innerHTML=""; hideWinPopup(); createHoles(); updateStatus(); return;} resetGameState();}

choosePisoBtn.addEventListener("click",()=>chooseVariant(VARIANT_PISO)); chooseSenecaBtn.addEventListener("click",()=>chooseVariant(VARIANT_SENECA)); resetBtn.addEventListener("click",resetAll); playAgainBtn.addEventListener("click",resetAll);
window.addEventListener("load",()=>{createHoles(); updateStatus(); maybeRunAiTurn();}); window.addEventListener("resize",()=>{createHoles(); repositionPieces();});
if(gameModeSelect){gameModeSelect.addEventListener("change",()=>{gameMode=gameModeSelect.value; clearSelection(); refreshHoles(); updateStatus(); maybeRunAiTurn();});}
toggleHintsBtn.addEventListener("click",()=>{hintsEnabled=!hintsEnabled; toggleHintsBtn.textContent=hintsEnabled?"Zet hints uit":"Zet hints aan"; refreshHoles();});

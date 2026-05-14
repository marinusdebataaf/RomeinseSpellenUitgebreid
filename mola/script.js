const BOARD_WIDTH = 920;
const BOARD_HEIGHT = 690;
const STONES_PER_PLAYER = 9;
const AI_DELAY = 1200;

const nodes = [
  { x: 203, y: 150, r: 15 },
  { x: 464, y: 150, r: 16 },
  { x: 715, y: 148, r: 16 },
  { x: 465, y: 200, r: 16 },
  { x: 634, y: 198, r: 17 },
  { x: 284, y: 200, r: 16 },
  { x: 462, y: 252, r: 17 },
  { x: 550, y: 258, r: 17 },
  { x: 369, y: 255, r: 18 },
  { x: 275, y: 309, r: 18 },
  { x: 186, y: 305, r: 17 },
  { x: 365, y: 307, r: 17 },
  { x: 552, y: 312, r: 17 },
  { x: 647, y: 313, r: 18 },
  { x: 737, y: 310, r: 17 },
  { x: 361, y: 369, r: 17 },
  { x: 455, y: 372, r: 18 },
  { x: 555, y: 373, r: 17 },
  { x: 656, y: 433, r: 18 },
  { x: 265, y: 434, r: 19 },
  { x: 458, y: 435, r: 18 },
  { x: 163, y: 497, r: 18 },
  { x: 454, y: 497, r: 18 },
  { x: 762, y: 500, r: 18 }
];

const connections = {
  0: [1, 10], 1: [0, 2, 3], 2: [1, 14],
  3: [1, 4, 5, 6], 4: [3, 13], 5: [3, 9],
  6: [3, 7, 8], 7: [6, 12], 8: [6, 11],
  9: [5, 10, 11, 19], 10: [0, 9, 21], 11: [8, 9, 15],
  12: [7, 13, 17], 13: [4, 12, 14, 18], 14: [2, 13, 23],
  15: [11, 16], 16: [15, 17, 20], 17: [12, 16],
  18: [13, 20], 19: [9, 20], 20: [16, 18, 19, 22],
  21: [10, 22], 22: [20, 21, 23], 23: [14, 22]
};

const mills = [
  [0, 1, 2], [0, 10, 21], [21, 22, 23], [2, 14, 23],
  [5, 3, 4], [5, 9, 19], [19, 20, 18], [4, 13, 18],
  [8, 6, 7], [8, 11, 15], [15, 16, 17], [7, 12, 17],
  [1, 3, 6], [10, 9, 11], [22, 20, 16], [14, 13, 12]
];

let board = Array(24).fill(null);
let currentPlayer = 1;
let placed = { 1: 0, 2: 0 };
let selected = null;
let gameOver = false;
let removeMode = false;
let hintsEnabled = true;
let aiThinking = false;
let aiTimerIds = [];
let isPaused = false;
let gameMode = {
  p1: { type: "human", level: "beginner" },
  p2: { type: "human", level: "beginner" }
};

const game = document.getElementById("game");
const holesContainer = document.getElementById("holes");
const piecesContainer = document.getElementById("pieces");
const turnText = document.getElementById("turnText");
const aiThinkingText = document.getElementById("aiThinkingText");
const countP1Board = document.getElementById("countP1Board");
const countP2Board = document.getElementById("countP2Board");
const toggleHintsBtn = document.getElementById("toggleHintsBtn");
const resetBtn = document.getElementById("resetBtn");
const pauseBtn = document.getElementById("pauseBtn");
const player1ModeSelect = document.getElementById("player1ModeSelect");
const player2ModeSelect = document.getElementById("player2ModeSelect");
const player1LevelSelect = document.getElementById("player1LevelSelect");
const player2LevelSelect = document.getElementById("player2LevelSelect");
const winModal = document.getElementById("winModal");
const winMessage = document.getElementById("winMessage");
const playAgainBtn = document.getElementById("playAgainBtn");

function scaleX(x) { return (x / BOARD_WIDTH) * game.clientWidth; }
function scaleY(y) { return (y / BOARD_HEIGHT) * game.clientHeight; }
function scaleR(r) {
  return r * Math.min(game.clientWidth / BOARD_WIDTH, game.clientHeight / BOARD_HEIGHT);
}
function getNodePixel(index) { return { x: scaleX(nodes[index].x), y: scaleY(nodes[index].y) }; }
function getOpponent(player) { return player === 1 ? 2 : 1; }
function getPlayerConfig(player) { return player === 1 ? gameMode.p1 : gameMode.p2; }
function isAIPlayer(player) { return getPlayerConfig(player).type === "ai"; }
function getPlayerStoneCount(player, stateBoard = board) { return stateBoard.filter(v => v === player).length; }
function isPlacementPhase(statePlaced = placed) {
  return statePlaced[1] < STONES_PER_PLAYER || statePlaced[2] < STONES_PER_PLAYER;
}
function isMillAtState(stateBoard, index, player) {
  return mills.some(line => line.includes(index) && line.every(i => stateBoard[i] === player));
}
function isMillAt(index, player) { return isMillAtState(board, index, player); }
function formsMill(index, player) { return isMillAt(index, player); }
function getPieceElementAt(index) { return document.querySelector(`.piece[data-index="${index}"]`); }
function clearAITimers() { aiTimerIds.forEach(id => clearTimeout(id)); aiTimerIds = []; }
function setAIThinking(isThinking) {
  aiThinking = isThinking;
  if (aiThinkingText) aiThinkingText.classList.toggle("hidden", !isThinking);
}
function isHumanInteractionLocked() {
  return gameOver || aiThinking || isAIPlayer(currentPlayer) || isPaused;
}

function getRemovableOpponentNodesForState(stateBoard, player) {
  const opponent = getOpponent(player);
  const opponentNodes = stateBoard.map((value, index) => value === opponent ? index : null).filter(v => v !== null);
  const outsideMill = opponentNodes.filter(index => !isMillAtState(stateBoard, index, opponent));
  return outsideMill.length > 0 ? outsideMill : opponentNodes;
}
function getRemovableOpponentNodes(player) { return getRemovableOpponentNodesForState(board, player); }

function getValidPlacementTargets(stateBoard = board) {
  return stateBoard.map((value, index) => value === null ? index : null).filter(v => v !== null);
}
function getValidMovesFromState(stateBoard, statePlaced, player) {
  const moves = [];
  if (statePlaced[player] < STONES_PER_PLAYER) {
    getValidPlacementTargets(stateBoard).forEach(to => moves.push({ type: "place", to }));
    return moves;
  }
  stateBoard.forEach((occupant, from) => {
    if (occupant !== player) return;
    connections[from].forEach(to => {
      if (stateBoard[to] === null) moves.push({ type: "move", from, to });
    });
  });
  return moves;
}
function hasAnyLegalMove(player, stateBoard = board, statePlaced = placed) {
  if (isPlacementPhase(statePlaced)) return true;
  return getValidMovesFromState(stateBoard, statePlaced, player).length > 0;
}
function applyMoveToState(stateBoard, statePlaced, move, player) {
  const newBoard = [...stateBoard];
  const newPlaced = { 1: statePlaced[1], 2: statePlaced[2] };
  if (move.type === "place") {
    newBoard[move.to] = player;
    newPlaced[player]++;
  } else {
    newBoard[move.from] = null;
    newBoard[move.to] = player;
  }
  return { board: newBoard, placed: newPlaced };
}

function updatePiecePosition(pieceEl, index) {
  if (!pieceEl) return;
  const p = getNodePixel(index);
  pieceEl.style.left = `${p.x}px`;
  pieceEl.style.top = `${p.y}px`;
  pieceEl.dataset.index = String(index);
}
function clearHighlights() {
  document.querySelectorAll(".hole.valid-target").forEach(hole => hole.classList.remove("valid-target"));
}
function clearSelection() {
  document.querySelectorAll(".piece.selected, .piece.ai-preview").forEach(el => {
    el.classList.remove("selected", "ai-preview");
  });
  selected = null;
  clearHighlights();
}
function refreshHoles() {
  const placementTargets = hintsEnabled && isPlacementPhase() && !gameOver && !removeMode
    ? new Set(getValidPlacementTargets())
    : new Set();
  document.querySelectorAll(".hole").forEach((holeEl, index) => {
    holeEl.classList.remove("occupied", "valid-target");
    if (gameOver || removeMode || board[index] !== null) {
      holeEl.classList.add("occupied");
      return;
    }
    if (!hintsEnabled) return;
    if (isPlacementPhase()) {
      if (placementTargets.has(index)) holeEl.classList.add("valid-target");
      return;
    }
    if (selected && connections[selected.from].includes(index)) holeEl.classList.add("valid-target");
  });
}
function refreshPieceHighlights() {
  document.querySelectorAll(".piece").forEach(piece => piece.classList.remove("removable"));
  if (!removeMode || gameOver) return;
  const removable = new Set(getRemovableOpponentNodes(currentPlayer));
  document.querySelectorAll(".piece").forEach(piece => {
    if (removable.has(Number(piece.dataset.index))) piece.classList.add("removable");
  });
}
function updateStatus() {
  countP1Board.textContent = getPlayerStoneCount(1);
  countP2Board.textContent = getPlayerStoneCount(2);
  if (gameOver) {
    turnText.textContent = "Het spel is voorbij";
    turnText.className = "value";
    return;
  }
  const actor = isAIPlayer(currentPlayer) ? `AI speler ${currentPlayer}` : `Speler ${currentPlayer}`;
  if (removeMode) {
    turnText.textContent = `${actor}: neem 1 steen van je tegenstander weg`;
  } else if (isPlacementPhase()) {
    turnText.textContent = `${actor}: kies een lege plek en plaats je steen`;
  } else if (!selected) {
    turnText.textContent = `${actor}: kies een steen om te verplaatsen`;
  } else {
    turnText.textContent = `${actor}: kies een aangrenzende lege plek`;
  }
  turnText.className = `value player-${currentPlayer}`;
}

function showWinPopup(player) {
  gameOver = true;
  clearAITimers();
  setAIThinking(false);
  clearSelection();
  refreshHoles();
  refreshPieceHighlights();
  updateStatus();
  winMessage.textContent = `${isAIPlayer(player) ? "AI speler" : "Speler"} ${player} wint!`;
  winModal.classList.remove("hidden");
}
function showDrawPopup(message = "Gelijkspel.") {
  gameOver = true;
  clearAITimers();
  setAIThinking(false);
  clearSelection();
  refreshHoles();
  refreshPieceHighlights();
  updateStatus();
  winMessage.textContent = message;
  winModal.classList.remove("hidden");
}
function hideWinPopup() { winModal.classList.add("hidden"); }
function checkForEndOfGame() {
  const opponent = getOpponent(currentPlayer);
  if (!isPlacementPhase() && getPlayerStoneCount(opponent) < 3) {
    showWinPopup(currentPlayer);
    return true;
  }
  if (!isPlacementPhase() && !hasAnyLegalMove(opponent)) {
    showWinPopup(currentPlayer);
    return true;
  }
  return false;
}
function switchPlayer() {
  currentPlayer = getOpponent(currentPlayer);
  clearSelection();
  refreshHoles();
  refreshPieceHighlights();
  updateStatus();
  if (!isPlacementPhase() && !hasAnyLegalMove(currentPlayer)) {
    showWinPopup(getOpponent(currentPlayer));
    return;
  }
  queueAITurn();
}
function finishTurnAfterAction(targetIndex) {
  refreshHoles();
  refreshPieceHighlights();
  updateStatus();
  if (!isPlacementPhase() && formsMill(targetIndex, currentPlayer)) {
    removeMode = true;
    refreshHoles();
    refreshPieceHighlights();
    updateStatus();
    queueAIRemoval();
    return;
  }
  switchPlayer();
}

function createPiece(player, index) {
  const el = document.createElement("img");
  el.src = player === 1 ? "stone1.png" : "stone2.png";
  el.className = "piece";
  el.dataset.player = String(player);
  el.draggable = false;
  updatePiecePosition(el, index);
  el.addEventListener("click", event => {
    event.stopPropagation();
    if (gameOver || aiThinking) return;
    const piecePlayer = Number(el.dataset.player);
    const pieceIndex = Number(el.dataset.index);
    if (removeMode) {
      if (isAIPlayer(currentPlayer)) return;
      removeOpponentPiece(pieceIndex);
      return;
    }
    if (isHumanInteractionLocked() || isPlacementPhase() || piecePlayer !== currentPlayer) return;
    if (selected && selected.el === el) {
      clearSelection();
      refreshHoles();
      updateStatus();
      return;
    }
    clearSelection();
    el.classList.add("selected");
    selected = { el, from: pieceIndex };
    refreshHoles();
    updateStatus();
  });
  piecesContainer.appendChild(el);
}
function placePiece(index) {
  if (board[index] !== null || placed[currentPlayer] >= STONES_PER_PLAYER) return false;
  board[index] = currentPlayer;
  createPiece(currentPlayer, index);
  placed[currentPlayer]++;
  finishTurnAfterAction(index);
  return true;
}
function movePiece(toIndex) {
  if (!selected || board[toIndex] !== null || !connections[selected.from].includes(toIndex)) return false;
  const pieceEl = selected.el;
  board[selected.from] = null;
  board[toIndex] = currentPlayer;
  updatePiecePosition(pieceEl, toIndex);
  clearSelection();
  finishTurnAfterAction(toIndex);
  return true;
}
function removeOpponentPiece(index) {
  const pieceEl = getPieceElementAt(index);
  const removable = getRemovableOpponentNodes(currentPlayer);
  if (!pieceEl || board[index] !== getOpponent(currentPlayer) || !removable.includes(index)) return false;
  board[index] = null;
  pieceEl.remove();
  removeMode = false;
  clearSelection();
  refreshHoles();
  refreshPieceHighlights();
  updateStatus();
  if (checkForEndOfGame()) return true;
  switchPlayer();
  return true;
}
function handleHoleClick(index) {
  if (gameOver || removeMode || isHumanInteractionLocked()) return;
  if (placed[currentPlayer] < STONES_PER_PLAYER) {
    placePiece(index);
    return;
  }
  movePiece(index);
}

function createHoles() {
  holesContainer.innerHTML = "";
  nodes.forEach((node, index) => {
    const hole = document.createElement("div");
    const r = Math.max(scaleR(node.r), 14);
    hole.className = "hole";
    hole.dataset.index = String(index);
    hole.style.left = `${scaleX(node.x)}px`;
    hole.style.top = `${scaleY(node.y)}px`;
    hole.style.width = `${r * 2}px`;
    hole.style.height = `${r * 2}px`;
    hole.addEventListener("click", () => handleHoleClick(index));
    holesContainer.appendChild(hole);
  });
  refreshHoles();
}
function repositionPieces() {
  document.querySelectorAll(".piece").forEach(pieceEl => updatePiecePosition(pieceEl, Number(pieceEl.dataset.index)));
}
function applySettingsFromUI() {
  gameMode.p1.type = player1ModeSelect?.value || "human";
  gameMode.p2.type = player2ModeSelect?.value || "human";
  gameMode.p1.level = player1LevelSelect?.value || "beginner";
  gameMode.p2.level = player2LevelSelect?.value || "beginner";
}
function resetGame() {
  isPaused = false;
  pauseBtn.textContent = "Pauzeer";
  applySettingsFromUI();
  clearAITimers();
  setAIThinking(false);
  board = Array(24).fill(null);
  currentPlayer = 1;
  placed = { 1: 0, 2: 0 };
  selected = null;
  gameOver = false;
  removeMode = false;
  piecesContainer.innerHTML = "";
  hideWinPopup();
  createHoles();
  refreshPieceHighlights();
  updateStatus();
  queueAITurn();
}

function countPotentialMills(stateBoard, player) {
  return mills.reduce((total, line) => {
    const mine = line.filter(i => stateBoard[i] === player).length;
    const empty = line.filter(i => stateBoard[i] === null).length;
    return total + (mine === 2 && empty === 1 ? 1 : 0);
  }, 0);
}
function moveCreatesMill(stateBoard, statePlaced, move, player) {
  const next = applyMoveToState(stateBoard, statePlaced, move, player);
  return isMillAtState(next.board, move.to, player);
}
function evaluatePosition(stateBoard, statePlaced, player) {
  const opponent = getOpponent(player);
  if (!isPlacementPhase(statePlaced)) {
    if (getPlayerStoneCount(opponent, stateBoard) < 3 || !hasAnyLegalMove(opponent, stateBoard, statePlaced)) return 10000;
    if (getPlayerStoneCount(player, stateBoard) < 3 || !hasAnyLegalMove(player, stateBoard, statePlaced)) return -10000;
  }
  let score = 0;
  score += (getPlayerStoneCount(player, stateBoard) - getPlayerStoneCount(opponent, stateBoard)) * 120;
  score += (countPotentialMills(stateBoard, player) - countPotentialMills(stateBoard, opponent)) * 35;
  score += (getValidMovesFromState(stateBoard, statePlaced, player).length - getValidMovesFromState(stateBoard, statePlaced, opponent).length) * 4;
  for (const line of mills) {
    const mine = line.filter(i => stateBoard[i] === player).length;
    const theirs = line.filter(i => stateBoard[i] === opponent).length;
    const empty = line.filter(i => stateBoard[i] === null).length;
    if (mine === 3) score += 60;
    if (theirs === 3) score -= 60;
    if (mine === 2 && empty === 1) score += 30;
    if (theirs === 2 && empty === 1) score -= 34;
  }
  return score;
}
function chooseRemoval(player, level, stateBoard = board) {
  const removable = getRemovableOpponentNodesForState(stateBoard, player);
  if (removable.length === 0) return null;
  if (level === "beginner") return removable[Math.floor(Math.random() * removable.length)];
  const opponent = getOpponent(player);
  let best = removable[0];
  let bestScore = -Infinity;
  for (const index of removable) {
    const nextBoard = [...stateBoard];
    nextBoard[index] = null;
    let score = evaluatePosition(nextBoard, placed, player);
    if (isMillAtState(stateBoard, index, opponent)) score += 20;
    score += countPotentialMills(stateBoard, opponent) * 4 - countPotentialMills(nextBoard, opponent) * 8;
    if (score > bestScore) {
      bestScore = score;
      best = index;
    }
  }
  return best;
}
function scoreMoveWithRemoval(stateBoard, statePlaced, move, player) {
  const next = applyMoveToState(stateBoard, statePlaced, move, player);
  let score = evaluatePosition(next.board, next.placed, player);
  if (!isPlacementPhase(next.placed) && isMillAtState(next.board, move.to, player)) {
    const removeIndex = chooseRemoval(player, "advanced", next.board);
    if (removeIndex !== null) {
      next.board[removeIndex] = null;
      score += 180 + evaluatePosition(next.board, next.placed, player);
    }
  }
  return score;
}
function aiBeginner(player) {
  const moves = getValidMovesFromState(board, placed, player);
  const millMove = moves.find(move => moveCreatesMill(board, placed, move, player));
  if (millMove && Math.random() < 0.55) return millMove;
  return moves[Math.floor(Math.random() * moves.length)];
}
function aiAdvanced(player) {
  const opponent = getOpponent(player);
  const moves = getValidMovesFromState(board, placed, player);
  const millMove = moves.find(move => moveCreatesMill(board, placed, move, player));
  if (millMove) return millMove;
  const opponentMillTargets = new Set(
    getValidMovesFromState(board, placed, opponent)
      .filter(move => moveCreatesMill(board, placed, move, opponent))
      .map(move => move.to)
  );
  const blockMove = moves.find(move => opponentMillTargets.has(move.to));
  if (blockMove) return blockMove;
  return moves.reduce((best, move) => scoreMoveWithRemoval(board, placed, move, player) > scoreMoveWithRemoval(board, placed, best, player) ? move : best, moves[0]);
}
function minimax(stateBoard, statePlaced, turnPlayer, rootPlayer, depth, alpha, beta) {
  if (depth === 0) return evaluatePosition(stateBoard, statePlaced, rootPlayer);
  const moves = getValidMovesFromState(stateBoard, statePlaced, turnPlayer);
  if (moves.length === 0) return turnPlayer === rootPlayer ? -10000 : 10000;
  const maximizing = turnPlayer === rootPlayer;
  let best = maximizing ? -Infinity : Infinity;
  for (const move of moves) {
    const next = applyMoveToState(stateBoard, statePlaced, move, turnPlayer);
    if (!isPlacementPhase(next.placed) && isMillAtState(next.board, move.to, turnPlayer)) {
      const removeIndex = chooseRemoval(turnPlayer, "advanced", next.board);
      if (removeIndex !== null) next.board[removeIndex] = null;
    }
    const value = minimax(next.board, next.placed, getOpponent(turnPlayer), rootPlayer, depth - 1, alpha, beta);
    if (maximizing) {
      best = Math.max(best, value);
      alpha = Math.max(alpha, best);
    } else {
      best = Math.min(best, value);
      beta = Math.min(beta, best);
    }
    if (beta <= alpha) break;
  }
  return best;
}
function aiPro(player) {
  const moves = getValidMovesFromState(board, placed, player);
  const depth = isPlacementPhase() ? 2 : 3;
  let bestMove = moves[0];
  let bestScore = -Infinity;
  for (const move of moves) {
    const next = applyMoveToState(board, placed, move, player);
    if (!isPlacementPhase(next.placed) && isMillAtState(next.board, move.to, player)) {
      const removeIndex = chooseRemoval(player, "advanced", next.board);
      if (removeIndex !== null) next.board[removeIndex] = null;
    }
    const score = minimax(next.board, next.placed, getOpponent(player), player, depth - 1, -Infinity, Infinity);
    if (score > bestScore) {
      bestScore = score;
      bestMove = move;
    }
  }
  return bestMove;
}
function getAIMove(player) {
  const level = getPlayerConfig(player).level;
  if (level === "pro") return aiPro(player);
  if (level === "advanced") return aiAdvanced(player);
  return aiBeginner(player);
}
function executeAIMove(move) {
  if (gameOver || !move) return;
  if (move.type === "place") {
    setAIThinking(false);
    placePiece(move.to);
    return;
  }
  const pieceEl = getPieceElementAt(move.from);
  if (!pieceEl) {
    setAIThinking(false);
    return;
  }
  clearSelection();
  pieceEl.classList.add("ai-preview");
  selected = { el: pieceEl, from: move.from };
  refreshHoles();
  updateStatus();
  const timerId = setTimeout(() => {
    setAIThinking(false);
    movePiece(move.to);
  }, AI_DELAY);
  aiTimerIds.push(timerId);
}
function runAITurn() {
  if (gameOver || isPaused || removeMode || !isAIPlayer(currentPlayer) || aiThinking) return;
  const moves = getValidMovesFromState(board, placed, currentPlayer);
  if (moves.length === 0) {
    showWinPopup(getOpponent(currentPlayer));
    return;
  }
  setAIThinking(true);
  const timerId = setTimeout(() => {
    if (gameOver || isPaused) {
      setAIThinking(false);
      return;
    }
    executeAIMove(getAIMove(currentPlayer));
  }, AI_DELAY);
  aiTimerIds.push(timerId);
}
function queueAITurn() {
  if (gameOver || isPaused || removeMode || !isAIPlayer(currentPlayer)) return;
  clearAITimers();
  const timerId = setTimeout(runAITurn, 200);
  aiTimerIds.push(timerId);
}
function queueAIRemoval() {
  if (gameOver || isPaused || !removeMode || !isAIPlayer(currentPlayer)) return;
  clearAITimers();
  setAIThinking(true);
  const timerId = setTimeout(() => {
    if (gameOver || isPaused || !removeMode) {
      setAIThinking(false);
      return;
    }
    const removeIndex = chooseRemoval(currentPlayer, getPlayerConfig(currentPlayer).level);
    setAIThinking(false);
    if (removeIndex !== null) removeOpponentPiece(removeIndex);
  }, AI_DELAY);
  aiTimerIds.push(timerId);
}

resetBtn.addEventListener("click", resetGame);
playAgainBtn.addEventListener("click", resetGame);
toggleHintsBtn.addEventListener("click", () => {
  hintsEnabled = !hintsEnabled;
  toggleHintsBtn.textContent = hintsEnabled ? "Zet hints uit" : "Zet hints aan";
  refreshHoles();
});
[player1ModeSelect, player2ModeSelect, player1LevelSelect, player2LevelSelect].forEach(select => {
  select?.addEventListener("change", applySettingsFromUI);
});
pauseBtn.addEventListener("click", () => {
  isPaused = !isPaused;
  if (isPaused) {
    pauseBtn.textContent = "Hervatten";
    clearAITimers();
    setAIThinking(false);
  } else {
    pauseBtn.textContent = "Pauzeer";
    if (removeMode) queueAIRemoval();
    else queueAITurn();
  }
});
window.addEventListener("load", () => {
  applySettingsFromUI();
  createHoles();
  updateStatus();
  queueAITurn();
});
window.addEventListener("resize", () => {
  createHoles();
  repositionPieces();
  refreshPieceHighlights();
});

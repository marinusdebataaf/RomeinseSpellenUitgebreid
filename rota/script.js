const BOARD_WIDTH = 4032;
const BOARD_HEIGHT = 3024;

const nodes = [
  { x: 1633, y: 581,  r: 138 }, // 0 top
  { x: 2705, y: 648,  r: 132 }, // 1 top-right
  { x: 3251, y: 1110, r: 131 }, // 2 right
  { x: 3325, y: 1923, r: 130 }, // 3 bottom-right
  { x: 2506, y: 2636, r: 135 }, // 4 bottom
  { x: 1263, y: 2508, r: 139 }, // 5 bottom-left
  { x: 732,  y: 1752, r: 132 }, // 6 left
  { x: 935,  y: 1040, r: 132 }, // 7 top-left
  { x: 2064, y: 1519, r: 132 }  // 8 center
];

const connections = {
  0: [1, 7, 8],
  1: [0, 2, 8],
  2: [1, 3, 8],
  3: [2, 4, 8],
  4: [3, 5, 8],
  5: [4, 6, 8],
  6: [5, 7, 8],
  7: [6, 0, 8],
  8: [0, 1, 2, 3, 4, 5, 6, 7]
};

const winningLines = [
  [0, 8, 4],
  [1, 8, 5],
  [2, 8, 6],
  [3, 8, 7]
];

// =========================
// GAME STATE
// =========================
let board = Array(9).fill(null);
let currentPlayer = 1;
let placed = { 1: 0, 2: 0 };
let selected = null;
let gameOver = false;
let hintsEnabled = true;

let gameMode = {
  p1: { type: "human", level: "beginner" },
  p2: { type: "human", level: "beginner" }
};

let aiDelay = 1200;
let aiThinking = false;
let aiTimerIds = [];
let moveHistory = [];
let repetitionCounts = new Map();
let isPaused = false;

// =========================
// DOM
// =========================
const game = document.getElementById("game");
const holesContainer = document.getElementById("holes");
const piecesContainer = document.getElementById("pieces");

const turnText = document.getElementById("turnText");
const aiThinkingText = document.getElementById("aiThinkingText");
const countP1 = document.getElementById("countP1");
const countP2 = document.getElementById("countP2");
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

// =========================
// UTIL
// =========================
function scaleX(x) {
  return (x / BOARD_WIDTH) * game.clientWidth;
}

function scaleY(y) {
  return (y / BOARD_HEIGHT) * game.clientHeight;
}

function scaleR(r) {
  const sx = game.clientWidth / BOARD_WIDTH;
  const sy = game.clientHeight / BOARD_HEIGHT;
  return r * Math.min(sx, sy);
}

function getNodePixel(index) {
  const n = nodes[index];
  return {
    x: scaleX(n.x),
    y: scaleY(n.y)
  };
}

function updatePiecePosition(pieceEl, index) {
  if (!pieceEl) return;
  const p = getNodePixel(index);
  pieceEl.style.left = `${p.x}px`;
  pieceEl.style.top = `${p.y}px`;
  pieceEl.dataset.index = String(index);
}

function getPlayerConfig(player) {
  return player === 1 ? gameMode.p1 : gameMode.p2;
}

function isAIPlayer(player) {
  return getPlayerConfig(player).type === "ai";
}

function isPlacementPhaseForState(statePlaced) {
  return statePlaced[1] < 3 || statePlaced[2] < 3;
}

function isPlacementPhase() {
  return isPlacementPhaseForState(placed);
}

function checkWin(player) {
  return winningLines.some(line => line.every(i => board[i] === player));
}

function checkWinState(stateBoard, player) {
  return winningLines.some(line => line.every(i => stateBoard[i] === player));
}

function getOpponent(player) {
  return player === 1 ? 2 : 1;
}

function serializeState(stateBoard, statePlaced, playerToMove) {
  return `${stateBoard.join("")}|${statePlaced[1]}-${statePlaced[2]}|${playerToMove}`;
}

function clearAITimers() {
  aiTimerIds.forEach(id => clearTimeout(id));
  aiTimerIds = [];
}

function setAIThinking(isThinking) {
  aiThinking = isThinking;
  if (!aiThinkingText) return;
  aiThinkingText.classList.toggle("hidden", !isThinking);
}

function isHumanInteractionLocked() {
  return gameOver || aiThinking || isAIPlayer(currentPlayer);
}

function rememberPosition() {
  // Geen herhalingsdetectie tijdens de plaatsfase
  if (isPlacementPhase()) return;

  // Alleen automatische detectie als beide spelers AI zijn
  if (!(isAIPlayer(1) && isAIPlayer(2))) return;

  const key = serializeState(board, placed, currentPlayer);
  const count = (repetitionCounts.get(key) || 0) + 1;
  repetitionCounts.set(key, count);
  moveHistory.push(key);

  if (count >= 6 && !gameOver) {
    showDrawPopup("Gelijkspel door herhaling.");
  }
}

// =========================
// UI
// =========================
function clearHighlights() {
  document.querySelectorAll(".hole.valid-target").forEach(hole => {
    hole.classList.remove("valid-target");
  });
}

function getValidPlacementTargets() {
  const targets = [];
  for (let i = 0; i < board.length; i++) {
    if (board[i] === null) targets.push(i);
  }
  return targets;
}

function getValidMoves(fromIndex) {
  return connections[fromIndex].filter(index => board[index] === null);
}

function highlightValidMoves(fromIndex) {
  if (!hintsEnabled) return;
  clearHighlights();

  const validMoves = getValidMoves(fromIndex);
  validMoves.forEach(index => {
    const holeEl = document.querySelector(`.hole[data-index="${index}"]`);
    if (holeEl) holeEl.classList.add("valid-target");
  });
}

function clearSelection() {
  document.querySelectorAll(".piece.selected").forEach(el => {
    el.classList.remove("selected");
  });
  document.querySelectorAll(".piece.ai-preview").forEach(el => {
    el.classList.remove("ai-preview");
  });
  selected = null;
  clearHighlights();
}

function refreshHoles() {
  const placementTargets = hintsEnabled && isPlacementPhase() && !gameOver
    ? new Set(getValidPlacementTargets())
    : new Set();

  document.querySelectorAll(".hole").forEach((holeEl, index) => {
    holeEl.classList.remove("occupied", "valid-target");

    if (board[index] !== null || gameOver) {
      holeEl.classList.add("occupied");
      return;
    }

    if (!hintsEnabled) return;

    if (isPlacementPhase()) {
      if (placementTargets.has(index)) {
        holeEl.classList.add("valid-target");
      }
      return;
    }
  });

  if (selected && hintsEnabled && !isPlacementPhase()) {
    highlightValidMoves(selected.from);
  } else if (!isPlacementPhase()) {
    clearHighlights();
  }
}

function updateStatus() {
  countP1.textContent = placed[1];
  countP2.textContent = placed[2];

  if (gameOver) {
    turnText.textContent = "Het spel is voorbij";
    turnText.className = "value";
    return;
  }

  const currentConfig = getPlayerConfig(currentPlayer);
  const actor = currentConfig.type === "ai"
    ? `AI speler ${currentPlayer}`
    : `Speler ${currentPlayer}`;

  if (isPlacementPhase()) {
    turnText.textContent = `${actor}: kies een plek en plaats een steen`;
  } else {
    if (!selected) {
      turnText.textContent = `${actor}: kies een steen om te verplaatsen`;
    } else {
      turnText.textContent = `${actor}: kies een lege gemarkeerde plek`;
    }
  }

  turnText.className = `value player-${currentPlayer}`;
}

function showWinPopup(player) {
  gameOver = true;
  clearAITimers();
  setAIThinking(false);
  updateStatus();
  refreshHoles();
  clearSelection();

  const winnerConfig = getPlayerConfig(player);
  const winnerText = winnerConfig.type === "ai"
    ? `AI speler ${player} wint!`
    : `Speler ${player} wint!`;

  winMessage.textContent = winnerText;
  winModal.classList.remove("hidden");
}

function showDrawPopup(message = "Gelijkspel.") {
  gameOver = true;
  clearAITimers();
  setAIThinking(false);
  updateStatus();
  refreshHoles();
  clearSelection();

  winMessage.textContent = message;
  winModal.classList.remove("hidden");
}

function hideWinPopup() {
  winModal.classList.add("hidden");
}

function createPiece(player, index) {
  const el = document.createElement("img");
  el.src = player === 1 ? "stone1.png" : "stone2.png";
  el.className = "piece";
  el.dataset.player = String(player);
  el.dataset.index = String(index);
  el.draggable = false;

  updatePiecePosition(el, index);

  el.addEventListener("click", (event) => {
    event.stopPropagation();

    if (gameOver) return;
    if (aiThinking) return;
    if (isAIPlayer(currentPlayer)) return;
    if (isPlacementPhase()) return;
    if (player !== currentPlayer) return;

    const fromIndex = Number(el.dataset.index);

    if (selected && selected.el === el) {
      clearSelection();
      updateStatus();
      return;
    }

    clearSelection();
    el.classList.add("selected");
    selected = { el, from: fromIndex };

    highlightValidMoves(fromIndex);
    updateStatus();
  });

  piecesContainer.appendChild(el);
}

function getPieceElementAt(index) {
  return document.querySelector(`.piece[data-index="${index}"]`);
}

// =========================
// CORE MOVE EXECUTION
// =========================
function placePiece(index) {
  if (board[index] !== null) return false;

  board[index] = currentPlayer;
  createPiece(currentPlayer, index);
  placed[currentPlayer]++;

  refreshHoles();
  updateStatus();

  if (checkWin(currentPlayer)) {
    showWinPopup(currentPlayer);
    return true;
  }

  switchPlayer();
  return true;
}

function movePiece(toIndex) {
  if (!selected) return false;
  if (board[toIndex] !== null) return false;
  if (!connections[selected.from].includes(toIndex)) return false;

  const pieceEl = selected.el;

  board[selected.from] = null;
  board[toIndex] = currentPlayer;

  updatePiecePosition(pieceEl, toIndex);
  pieceEl.classList.remove("selected");
  pieceEl.classList.remove("ai-preview");
  selected = null;

  refreshHoles();
  updateStatus();

  if (checkWin(currentPlayer)) {
    showWinPopup(currentPlayer);
    return true;
  }

  switchPlayer();
  return true;
}

function handleHoleClick(index) {
  if (gameOver) return;
  if (aiThinking) return;
  if (isAIPlayer(currentPlayer)) return;

  if (placed[currentPlayer] < 3) {
    placePiece(index);
    return;
  }

  movePiece(index);
}

function switchPlayer() {
  currentPlayer = currentPlayer === 1 ? 2 : 1;
  clearSelection();
  refreshHoles();
  updateStatus();
  rememberPosition();
  queueAITurn();
}

// =========================
// BOARD RENDER
// =========================
function createHoles() {
  holesContainer.innerHTML = "";

  nodes.forEach((node, index) => {
    const hole = document.createElement("div");
    const x = scaleX(node.x);
    const y = scaleY(node.y);
    const r = scaleR(node.r);

    hole.className = "hole";
    hole.dataset.index = String(index);
    hole.style.left = `${x}px`;
    hole.style.top = `${y}px`;
    hole.style.width = `${r * 2}px`;
    hole.style.height = `${r * 2}px`;

    hole.addEventListener("click", () => handleHoleClick(index));
    holesContainer.appendChild(hole);
  });

  refreshHoles();
}

function repositionPieces() {
  document.querySelectorAll(".piece").forEach(pieceEl => {
    const index = Number(pieceEl.dataset.index);
    updatePiecePosition(pieceEl, index);
  });
}

// =========================
// GAME RESET / SETTINGS
// =========================
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

  board = Array(9).fill(null);
  currentPlayer = 1;
  placed = { 1: 0, 2: 0 };
  selected = null;
  gameOver = false;
  moveHistory = [];
  repetitionCounts = new Map();

  piecesContainer.innerHTML = "";
  hideWinPopup();
  createHoles();
  clearHighlights();
  updateStatus();
  rememberPosition();
  queueAITurn();
}

// =========================
// AI STATE HELPERS
// =========================
function getValidMovesFromState(stateBoard, statePlaced, player) {
  const moves = [];

  if (statePlaced[player] < 3) {
    for (let i = 0; i < stateBoard.length; i++) {
      if (stateBoard[i] === null) {
        moves.push({ type: "place", to: i });
      }
    }
  } else {
    for (let i = 0; i < stateBoard.length; i++) {
      if (stateBoard[i] === player) {
        for (const j of connections[i]) {
          if (stateBoard[j] === null) {
            moves.push({ type: "move", from: i, to: j });
          }
        }
      }
    }
  }

  return moves;
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

function countImmediateWins(stateBoard, statePlaced, player) {
  const moves = getValidMovesFromState(stateBoard, statePlaced, player);
  let count = 0;

  for (const move of moves) {
    const next = applyMoveToState(stateBoard, statePlaced, move, player);
    if (checkWinState(next.board, player)) count++;
  }

  return count;
}

function evaluatePosition(stateBoard, statePlaced, player) {
  const opponent = getOpponent(player);

  if (checkWinState(stateBoard, player)) return 10000;
  if (checkWinState(stateBoard, opponent)) return -10000;

  let score = 0;

  // center control
  if (stateBoard[8] === player) score += 18;
  if (stateBoard[8] === opponent) score -= 18;

  // potential lines
  for (const line of winningLines) {
    const mine = line.filter(i => stateBoard[i] === player).length;
    const theirs = line.filter(i => stateBoard[i] === opponent).length;
    const empty = line.filter(i => stateBoard[i] === null).length;

    if (mine === 2 && empty === 1) score += 30;
    if (theirs === 2 && empty === 1) score -= 34;
    if (mine === 1 && empty === 2) score += 6;
    if (theirs === 1 && empty === 2) score -= 6;
  }

  // mobility
  const myMoves = getValidMovesFromState(stateBoard, statePlaced, player).length;
  const oppMoves = getValidMovesFromState(stateBoard, statePlaced, opponent).length;
  score += (myMoves - oppMoves) * 2;

  // tactical threats
  score += countImmediateWins(stateBoard, statePlaced, player) * 20;
  score -= countImmediateWins(stateBoard, statePlaced, opponent) * 24;

  return score;
}

// =========================
// AI LEVELS
// =========================
function aiBeginner(player) {
  const moves = getValidMovesFromState(board, placed, player);

  // win if immediate
  for (const move of moves) {
    const next = applyMoveToState(board, placed, move, player);
    if (checkWinState(next.board, player)) return move;
  }

  // else random
  return moves[Math.floor(Math.random() * moves.length)];
}

function aiAdvanced(player) {
  const opponent = getOpponent(player);
  const moves = getValidMovesFromState(board, placed, player);

  // 1) immediate win
  for (const move of moves) {
    const next = applyMoveToState(board, placed, move, player);
    if (checkWinState(next.board, player)) return move;
  }

  // 2) block opponent immediate win if possible
  const oppMoves = getValidMovesFromState(board, placed, opponent);
  const oppWinningTargets = new Set();

  for (const oppMove of oppMoves) {
    const oppNext = applyMoveToState(board, placed, oppMove, opponent);
    if (checkWinState(oppNext.board, opponent)) {
      if (oppMove.type === "place") oppWinningTargets.add(oppMove.to);
      if (oppMove.type === "move") oppWinningTargets.add(oppMove.to);
    }
  }

  if (oppWinningTargets.size > 0) {
    for (const move of moves) {
      const next = applyMoveToState(board, placed, move, player);

      const oppAfter = getValidMovesFromState(next.board, next.placed, opponent);
      const stillLoses = oppAfter.some(oppMove => {
        const oppNext = applyMoveToState(next.board, next.placed, oppMove, opponent);
        return checkWinState(oppNext.board, opponent);
      });

      if (!stillLoses) return move;
    }
  }

  // 3) prefer center
  const centerMove = moves.find(m => m.to === 8);
  if (centerMove) return centerMove;

  // 4) best heuristic
  let bestMove = moves[0];
  let bestScore = -Infinity;

  for (const move of moves) {
    const next = applyMoveToState(board, placed, move, player);
    const score = evaluatePosition(next.board, next.placed, player);
    if (score > bestScore) {
      bestScore = score;
      bestMove = move;
    }
  }

  return bestMove;
}

function minimax(stateBoard, statePlaced, turnPlayer, rootPlayer, depth, alpha, beta) {
  const opponent = getOpponent(turnPlayer);

  if (checkWinState(stateBoard, rootPlayer)) return 10000 + depth;
  if (checkWinState(stateBoard, getOpponent(rootPlayer))) return -10000 - depth;
  if (depth === 0) return evaluatePosition(stateBoard, statePlaced, rootPlayer);

  const moves = getValidMovesFromState(stateBoard, statePlaced, turnPlayer);

  if (moves.length === 0) {
    return evaluatePosition(stateBoard, statePlaced, rootPlayer);
  }

  const maximizing = turnPlayer === rootPlayer;

  if (maximizing) {
    let best = -Infinity;
    for (const move of moves) {
      const next = applyMoveToState(stateBoard, statePlaced, move, turnPlayer);
      const score = minimax(
        next.board,
        next.placed,
        opponent,
        rootPlayer,
        depth - 1,
        alpha,
        beta
      );
      best = Math.max(best, score);
      alpha = Math.max(alpha, best);
      if (beta <= alpha) break;
    }
    return best;
  }

  let best = Infinity;
  for (const move of moves) {
    const next = applyMoveToState(stateBoard, statePlaced, move, turnPlayer);
    const score = minimax(
      next.board,
      next.placed,
      opponent,
      rootPlayer,
      depth - 1,
      alpha,
      beta
    );
    best = Math.min(best, score);
    beta = Math.min(beta, best);
    if (beta <= alpha) break;
  }
  return best;
}

function aiPro(player) {
  const moves = getValidMovesFromState(board, placed, player);

  // immediate win first
  for (const move of moves) {
    const next = applyMoveToState(board, placed, move, player);
    if (checkWinState(next.board, player)) return move;
  }

  let bestMove = moves[0];
  let bestScore = -Infinity;

  // Slightly deeper after placement phase
  const depth = isPlacementPhase() ? 4 : 6;

  for (const move of moves) {
    const next = applyMoveToState(board, placed, move, player);
    const score = minimax(
      next.board,
      next.placed,
      getOpponent(player),
      player,
      depth - 1,
      -Infinity,
      Infinity
    );

    if (score > bestScore) {
      bestScore = score;
      bestMove = move;
    }
  }

  return bestMove;
}

function getAIMove(player) {
  const level = getPlayerConfig(player).level;

  if (level === "beginner") return aiBeginner(player);
  if (level === "advanced") return aiAdvanced(player);
  if (level === "pro") return aiPro(player);

  return aiBeginner(player);
}

// =========================
// AI EXECUTION
// =========================
function executeAIMove(move) {
  if (gameOver) return;

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
  }, aiDelay);

  aiTimerIds.push(timerId);
}

function runAITurn() {
  if (gameOver || isPaused) return;
  if (!isAIPlayer(currentPlayer)) return;
  if (aiThinking) return;

  const possibleMoves = getValidMovesFromState(board, placed, currentPlayer);
  if (possibleMoves.length === 0) {
    showDrawPopup("Gelijkspel: geen geldige zetten.");
    return;
  }

  setAIThinking(true);

  const thinkTimer = setTimeout(() => {
    if (gameOver) {
      setAIThinking(false);
      return;
    }

    const move = getAIMove(currentPlayer);
    executeAIMove(move);
  }, aiDelay);

  aiTimerIds.push(thinkTimer);
}

function queueAITurn() {
  if (gameOver || isPaused) return;
  if (!isAIPlayer(currentPlayer)) return;

  clearAITimers();

  const timerId = setTimeout(() => {
    runAITurn();
  }, 200);

  aiTimerIds.push(timerId);
}

// =========================
// EVENTS
// =========================
resetBtn.addEventListener("click", resetGame);
playAgainBtn.addEventListener("click", resetGame);

toggleHintsBtn.addEventListener("click", () => {
  hintsEnabled = !hintsEnabled;
  toggleHintsBtn.textContent = hintsEnabled
    ? "Zet hints uit"
    : "Zet hints aan";

  if (!hintsEnabled) {
    clearHighlights();
  } else {
    refreshHoles();
  }
});

player1ModeSelect?.addEventListener("change", applySettingsFromUI);
player2ModeSelect?.addEventListener("change", applySettingsFromUI);
player1LevelSelect?.addEventListener("change", applySettingsFromUI);
player2LevelSelect?.addEventListener("change", applySettingsFromUI);

window.addEventListener("load", () => {
  applySettingsFromUI();
  createHoles();
  updateStatus();
  rememberPosition();
  queueAITurn();
});

window.addEventListener("resize", () => {
  createHoles();
  repositionPieces();
});

pauseBtn.addEventListener("click", () => {
  isPaused = !isPaused;

  if (isPaused) {
    pauseBtn.textContent = "Hervatten";
    clearAITimers();       // stopt AI meteen
    setAIThinking(false);  // verberg "AI denkt..."
  } else {
    pauseBtn.textContent = "Pauzeer";
    queueAITurn();         // start AI weer
  }
});

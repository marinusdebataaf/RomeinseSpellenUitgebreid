const BOARD_WIDTH = 1316;
const BOARD_HEIGHT = 883;

const PREY = 1;   // white
const HUNTER = 2; // black

const nodes = [
  { x: 668,  y: 66,  r: 27 }, // 0 top center
  { x: 957,  y: 66,  r: 26 }, // 1 top right-inner
  { x: 1251, y: 66,  r: 27 }, // 2 top right
  { x: 375,  y: 66,  r: 27 }, // 3 top left-inner
  { x: 84,   y: 66,  r: 26 }, // 4 top left
  { x: 1251, y: 367, r: 27 }, // 5 right upper-mid
  { x: 85,   y: 367, r: 26 }, // 6 left upper-mid
  { x: 82,   y: 518, r: 25 }, // 7 left lower-mid
  { x: 84,   y: 818, r: 28 }, // 8 bottom left
  { x: 375,  y: 818, r: 28 }, // 9 bottom left-inner
  { x: 669,  y: 817, r: 29 }, // 10 bottom center
  { x: 959,  y: 819, r: 27 }, // 11 bottom right-inner
  { x: 1250, y: 818, r: 26 }, // 12 bottom right
  { x: 1250, y: 518, r: 26 }  // 13 right lower-mid
];

// Graph from the line layout
const connections = {
  0:  [3, 1, 10],
  1:  [0, 2, 5],
  2:  [1, 5],
  3:  [4, 0, 6],
  4:  [3, 6],
  5:  [2, 1, 13],
  6:  [4, 3, 7],
  7:  [6, 8, 9],
  8:  [7, 9],
  9:  [8, 10, 7],
  10: [9, 11, 0],
  11: [10, 12, 13],
  12: [11, 13],
  13: [5, 12, 11]
};

// Starting setup
const START_BOARD = Array(14).fill(null);
START_BOARD[4] = PREY;
START_BOARD[8] = PREY;
START_BOARD[2] = HUNTER;
START_BOARD[5] = HUNTER;
START_BOARD[13] = HUNTER;
START_BOARD[12] = HUNTER;

let board = [...START_BOARD];
let currentPlayer = HUNTER;
let selected = null;
let gameOver = false;
let hunterMoveCount = 0;
let hintsEnabled = true;
let gameMode = "pvp";
let aiTurnTimer = null;

let round = 1;
let hunterOwner = "1"; // round 1: 1 hunts, round 2: 2 hunts
let scores = {
  1: null,
  2: null
};

const game = document.getElementById("game");
const holesContainer = document.getElementById("holes");
const piecesContainer = document.getElementById("pieces");

const roundText = document.getElementById("roundText");
const rolesText = document.getElementById("rolesText");
const turnText = document.getElementById("turnText");
const hunterMoves = document.getElementById("hunterMoves");
const freePreyCount = document.getElementById("freePreyCount");
const trappedPreyCount = document.getElementById("trappedPreyCount");
const scoreA = document.getElementById("scoreA");
const scoreB = document.getElementById("scoreB");
const toggleHintsBtn = document.getElementById("toggleHintsBtn");
const gameModeSelect = document.getElementById("gameModeSelect");
const aiThinking = document.getElementById("aiThinking");
const resetBtn = document.getElementById("resetBtn");

const roundModal = document.getElementById("roundModal");
const roundModalTitle = document.getElementById("roundModalTitle");
const roundModalMessage = document.getElementById("roundModalMessage");
const nextRoundBtn = document.getElementById("nextRoundBtn");

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
  const p = getNodePixel(index);
  pieceEl.style.left = `${p.x}px`;
  pieceEl.style.top = `${p.y}px`;
  pieceEl.dataset.index = String(index);
}

function clearSelection() {
  document.querySelectorAll(".piece.selected").forEach(el => {
    el.classList.remove("selected");
  });
  selected = null;
}

function getLegalMoves(index) {
  if (board[index] === null) return [];
  return connections[index].filter(next => board[next] === null);
}

function isTrappedPrey(index) {
  return board[index] === PREY && getLegalMoves(index).length === 0;
}

function countTrappedPrey() {
  let total = 0;
  for (let i = 0; i < board.length; i++) {
    if (isTrappedPrey(i)) total++;
  }
  return total;
}

function countFreePrey() {
  let total = 0;
  for (let i = 0; i < board.length; i++) {
    if (board[i] === PREY && !isTrappedPrey(i)) total++;
  }
  return total;
}

function getPlayerOwner(player) {
  if (player === HUNTER) return hunterOwner;
  return hunterOwner === "1" ? "2" : "1";
}

function isAiPlayer(player) {
  if (gameMode === "ai-both") return true;
  if (gameMode === "ai-hunter") return player === HUNTER;
  if (gameMode === "ai-prey") return player === PREY;
  return false;
}

function setAiThinking(isThinking) {
  if (!aiThinking) return;
  aiThinking.classList.toggle("hidden", !isThinking);
}

function getAllLegalMoves(player, boardState = board) {
  const moves = [];

  for (let from = 0; from < boardState.length; from++) {
    if (boardState[from] !== player) continue;
    if (player === PREY && isTrappedPreyOnBoard(from, boardState)) continue;

    connections[from].forEach(to => {
      if (boardState[to] === null) moves.push({ from, to });
    });
  }

  return moves;
}

function isTrappedPreyOnBoard(index, boardState) {
  if (boardState[index] !== PREY) return false;
  return connections[index].every(next => boardState[next] !== null);
}

function countTrappedPreyOnBoard(boardState) {
  let total = 0;
  for (let i = 0; i < boardState.length; i++) {
    if (isTrappedPreyOnBoard(i, boardState)) total++;
  }
  return total;
}

function getPreyMobility(boardState) {
  return getAllLegalMoves(PREY, boardState).length;
}

function getHunterPressure(boardState) {
  let pressure = 0;
  const preyPositions = [];
  const hunterPositions = [];

  boardState.forEach((player, index) => {
    if (player === PREY) preyPositions.push(index);
    if (player === HUNTER) hunterPositions.push(index);
  });

  preyPositions.forEach(preyIndex => {
    hunterPositions.forEach(hunterIndex => {
      if (connections[preyIndex].includes(hunterIndex)) pressure++;
    });
  });

  return pressure;
}

function simulateMove(move, player, boardState = board) {
  const nextBoard = [...boardState];
  nextBoard[move.from] = null;
  nextBoard[move.to] = player;
  return nextBoard;
}

function evaluateHunterMove(move) {
  const nextBoard = simulateMove(move, HUNTER);
  return (
    countTrappedPreyOnBoard(nextBoard) * 1000 +
    getHunterPressure(nextBoard) * 20 -
    getPreyMobility(nextBoard) * 25 +
    Math.random()
  );
}

function evaluatePreyMove(move) {
  const nextBoard = simulateMove(move, PREY);
  return (
    getPreyMobility(nextBoard) * 30 -
    countTrappedPreyOnBoard(nextBoard) * 1000 -
    getHunterPressure(nextBoard) * 18 +
    Math.random()
  );
}

function chooseAiMove(player) {
  const moves = getAllLegalMoves(player);
  if (moves.length === 0) return null;

  const evaluate = player === HUNTER ? evaluateHunterMove : evaluatePreyMove;
  return moves.reduce((best, move) => {
    return evaluate(move) > evaluate(best) ? move : best;
  }, moves[0]);
}

function getPieceAt(index) {
  return document.querySelector(`.piece[data-index="${index}"]`);
}

function clearAiPreview() {
  document.querySelectorAll(".piece.ai-preview").forEach(piece => {
    piece.classList.remove("ai-preview");
  });
}

function maybeRunAiTurn() {
  window.clearTimeout(aiTurnTimer);
  clearAiPreview();

  if (gameOver || !isAiPlayer(currentPlayer)) {
    setAiThinking(false);
    return;
  }

  setAiThinking(true);
  aiTurnTimer = window.setTimeout(() => {
    runAiTurn();
  }, 1200);
}

function runAiTurn() {
  if (gameOver || !isAiPlayer(currentPlayer)) {
    setAiThinking(false);
    return;
  }

  const move = chooseAiMove(currentPlayer);
  if (!move) {
    setAiThinking(false);
    return;
  }

  const piece = getPieceAt(move.from);
  if (!piece) {
    setAiThinking(false);
    return;
  }

  clearSelection();
  piece.classList.add("ai-preview");

  window.setTimeout(() => {
    piece.classList.remove("ai-preview");
    selected = { el: piece, from: move.from };
    handleHoleClick(move.to, true);
    setAiThinking(false);
  }, 350);
}

function refreshPieceStates() {
  document.querySelectorAll(".piece").forEach(piece => {
    const index = Number(piece.dataset.index);
    piece.classList.toggle("trapped", isTrappedPrey(index));
  });
}

function refreshHoles() {
  document.querySelectorAll(".hole").forEach((holeEl, index) => {
    holeEl.classList.remove("occupied", "valid-target");

    if (gameOver || board[index] !== null) {
      holeEl.classList.add("occupied");
      return;
    }

    if (!selected) return;
    if (!hintsEnabled) return;

    if (connections[selected.from].includes(index)) {
      holeEl.classList.add("valid-target");
    } else {
      holeEl.classList.add("occupied");
    }
  });
}

function updateStatus() {
  roundText.textContent = `Ronde ${round} van 2`;
  rolesText.textContent =
    hunterOwner === "1"
      ? "Speler 1 = Jager, Speler 2 = Prooi"
      : "Speler 2 = Jager, Speler 1 = Prooi";

  hunterMoves.textContent = hunterMoveCount;
  freePreyCount.textContent = countFreePrey();
  trappedPreyCount.textContent = countTrappedPrey();
  scoreA.textContent = scores[1] === null ? "—" : scores[1];
  scoreB.textContent = scores[2] === null ? "—" : scores[2];

  if (gameOver) {
    turnText.textContent = "De jacht is voorbij";
    turnText.className = "value";
    return;
  }

  if (!selected) {
    const owner = getPlayerOwner(currentPlayer);
    const aiLabel = isAiPlayer(currentPlayer) ? "AI" : `Speler ${owner}`;
    turnText.textContent =
      `${currentPlayer === HUNTER ? "Jager" : "Prooi"} (${currentPlayer === HUNTER ? "zwart" : "wit"}) is aan zet — ${aiLabel}`;
  } else {
    turnText.textContent =
      `${currentPlayer === HUNTER ? "Jager" : "Prooi"}: kies een aangrenzend leeg kruispunt`;
  }

  turnText.className = `value player-${currentPlayer}`;
}

function showRoundModal(title, message, buttonText = "Verder") {
  roundModalTitle.textContent = title;
  roundModalMessage.textContent = message;
  nextRoundBtn.textContent = buttonText;
  roundModal.classList.remove("hidden");
}

function hideRoundModal() {
  roundModal.classList.add("hidden");
}

function switchPlayer() {
  currentPlayer = currentPlayer === HUNTER ? PREY : HUNTER;
  clearSelection();
  refreshPieceStates();
  refreshHoles();
  updateStatus();
  maybeRunAiTurn();
}

function createPiece(player, index) {
  const el = document.createElement("img");
  el.src = player === PREY ? "stone1.png" : "stone2.png";
  el.className = "piece";
  el.dataset.player = String(player);
  el.draggable = false;

  updatePiecePosition(el, index);

  el.addEventListener("click", event => {
    event.stopPropagation();

    if (gameOver) return;
    if (isAiPlayer(currentPlayer)) return;
    if (player !== currentPlayer) return;
    if (player === PREY && isTrappedPrey(Number(el.dataset.index))) return;

    const pieceIndex = Number(el.dataset.index);

    if (selected && selected.el === el) {
      clearSelection();
      refreshHoles();
      updateStatus();
      return;
    }

    clearSelection();
    el.classList.add("selected");
    selected = {
      el,
      from: pieceIndex
    };

    refreshHoles();
    updateStatus();
  });

  piecesContainer.appendChild(el);
}

function handleHoleClick(index, fromAi = false) {
  if (gameOver) return;
  if (!fromAi && isAiPlayer(currentPlayer)) return;
  if (!selected) return;
  if (board[index] !== null) return;
  if (!connections[selected.from].includes(index)) return;

  board[selected.from] = null;
  board[index] = currentPlayer;

  updatePiecePosition(selected.el, index);
  selected.el.classList.remove("selected");
  selected = null;

  if (currentPlayer === HUNTER) {
    hunterMoveCount++;
  }

  refreshPieceStates();
  refreshHoles();
  updateStatus();

  if (countTrappedPrey() === 2) {
    finishRound();
    return;
  }

  switchPlayer();
}

function finishRound() {
  gameOver = true;
  clearSelection();
  refreshHoles();
  refreshPieceStates();
  updateStatus();

  scores[hunterOwner] = hunterMoveCount;

  if (round === 1) {
    showRoundModal(
      "Ronde 1 afgelopen",
      `Speler ${hunterOwner} sloot de prooi in ${hunterMoveCount} zetten in. Nu wisselen de rollen.`,
      "Start ronde 2"
    );
  } else {
    let result;
    if (scores[1] < scores[2]) {
      result = `Speler 1 wint met ${scores[1]} tegen ${scores[2]} jagerzetten.`;
    } else if (scores[2] < scores[1]) {
      result = `Speler 2 wint met ${scores[2]} tegen ${scores[1]} jagerzetten.`;
    } else {
      result = `Gelijkspel: beide spelers hadden ${scores[1]} jagerzetten nodig.`;
    }

    showRoundModal(
      "Wedstrijd afgelopen",
      result,
      "Opnieuw spelen"
    );
  }
}

function startNextRoundOrReset() {
  hideRoundModal();

  if (round === 1) {
    round = 2;
    hunterOwner = "2";
    resetBoardForRound();
  } else {
    resetMatch();
  }
}

function createHoles() {
  holesContainer.innerHTML = "";

  nodes.forEach((node, index) => {
    const hole = document.createElement("div");
    const x = scaleX(node.x);
    const y = scaleY(node.y);
    const r = Math.max(scaleR(node.r), 16);

    hole.className = "hole";
    hole.style.left = `${x}px`;
    hole.style.top = `${y}px`;
    hole.style.width = `${r * 2}px`;
    hole.style.height = `${r * 2}px`;

    hole.addEventListener("click", () => handleHoleClick(index));
    holesContainer.appendChild(hole);
  });

  refreshHoles();
}

function createAllPieces() {
  piecesContainer.innerHTML = "";

  board.forEach((player, index) => {
    if (player !== null) createPiece(player, index);
  });

  refreshPieceStates();
}

function repositionPieces() {
  document.querySelectorAll(".piece").forEach(pieceEl => {
    const index = Number(pieceEl.dataset.index);
    updatePiecePosition(pieceEl, index);
  });
}

function resetBoardForRound() {
  window.clearTimeout(aiTurnTimer);
  setAiThinking(false);
  clearAiPreview();
  board = [...START_BOARD];
  currentPlayer = HUNTER;
  selected = null;
  gameOver = false;
  hunterMoveCount = 0;

  createHoles();
  createAllPieces();
  updateStatus();
  maybeRunAiTurn();
}

function resetMatch() {
  round = 1;
  hunterOwner = "1";
  scores = { 1: null, 2: null };
  hideRoundModal();
  resetBoardForRound();
}

resetBtn.addEventListener("click", resetMatch);
nextRoundBtn.addEventListener("click", startNextRoundOrReset);

window.addEventListener("load", () => {
  createHoles();
  createAllPieces();
  updateStatus();
  maybeRunAiTurn();
});

window.addEventListener("resize", () => {
  createHoles();
  repositionPieces();
  refreshPieceStates();
});

gameModeSelect.addEventListener("change", () => {
  gameMode = gameModeSelect.value;
  clearSelection();
  refreshHoles();
  updateStatus();
  maybeRunAiTurn();
});

toggleHintsBtn.addEventListener("click", () => {
  hintsEnabled = !hintsEnabled;

  toggleHintsBtn.textContent = hintsEnabled
    ? "Zet hints uit"
    : "Zet hints aan";

  refreshHoles();
});

// Core Engine & Variant Variables
let solution = [];
let initialBoard = [];
let currentBoard = [];
let notesBoard = [];
let historyStack = [];
let selectedCell = null;
let timerInterval = null;
let secondsElapsed = 0;
let mistakes = 0;
let isPaused = false;
let isNotesMode = false;
let isZenMode = false;
let currentVariant = 'classic'; // 'classic', 'diagonal', 'mini', 'hyper'
let gridSize = 9;
let boxRows = 3, boxCols = 3;
const MAX_MISTAKES = 3;

let hintsRemaining = 2;
let undosRemaining = 2;

// Multiplayer Variables (PeerJS)
let peer = null;
let peerConn = null;
let isMultiplayer = false;
let myProgress = 0;
let oppProgress = 0;

let stats = { played: 0, won: 0 };
try {
  const savedStats = localStorage.getItem('sudoku_stats');
  if (savedStats) stats = JSON.parse(savedStats);
} catch (e) {}

function setVariantParameters(variant) {
  currentVariant = variant;
  if (variant === 'mini') {
    gridSize = 6; boxRows = 2; boxCols = 3;
  } else {
    gridSize = 9; boxRows = 3; boxCols = 3;
  }
}

function startNewGame(puzzleSeed = null) {
  if (timerInterval) clearInterval(timerInterval);

  const variantSelect = document.getElementById('variant-select');
  if (variantSelect) setVariantParameters(variantSelect.value);

  secondsElapsed = 0;
  mistakes = 0;
  isPaused = false;
  isNotesMode = false;

  const difficultyEl = document.getElementById('difficulty');
  const diff = difficultyEl ? difficultyEl.value : 'medium';
  hintsRemaining = diff === 'easy' ? 3 : diff === 'medium' ? 2 : 1;
  undosRemaining = hintsRemaining;

  generateSudokuVariant(puzzleSeed);
  historyStack = [];

  updateActionButtonLabels();
  updateMistakesDisplay();
  updateTimerDisplay();

  timerInterval = setInterval(() => {
    if (!isPaused && !isZenMode) {
      secondsElapsed++;
      updateTimerDisplay();
    }
  }, 1000);

  selectedCell = null;
  buildKeypad();
  renderBoard();
  updateKeypadCounts();

  if (isMultiplayer) {
    sendMultiplayerUpdate();
  }
}

function generateSudokuVariant(seed = null) {
  let base9 = [
    [1,2,3,4,5,6,7,8,9],[4,5,6,7,8,9,1,2,3],[7,8,9,1,2,3,4,5,6],
    [2,3,1,5,6,4,8,9,7],[5,6,4,8,9,7,2,3,1],[8,9,7,2,3,1,5,6,4],
    [3,1,2,6,4,5,9,7,8],[6,4,5,9,7,8,3,1,2],[9,7,8,3,1,2,6,4,5]
  ];

  let base6 = [
    [1,2,3,4,5,6],[4,5,6,1,2,3],
    [2,3,1,5,6,4],[5,6,4,2,3,1],
    [3,1,2,6,4,5],[6,4,5,3,1,2]
  ];

  let base = gridSize === 6 ? base6 : base9;

  // Simple shuffle
  solution = base.map(row => [...row]);

  initialBoard = solution.map(row => [...row]);
  const difficultyEl = document.getElementById('difficulty');
  const diff = difficultyEl ? difficultyEl.value : 'medium';

  let removeCount = gridSize === 6 ? (diff === 'easy' ? 12 : 18) : (diff === 'easy' ? 35 : diff === 'medium' ? 45 : 52);

  while (removeCount > 0) {
    const r = Math.floor(Math.random() * gridSize);
    const c = Math.floor(Math.random() * gridSize);
    if (initialBoard[r][c] !== 0) {
      initialBoard[r][c] = 0;
      removeCount--;
    }
  }

  currentBoard = initialBoard.map(row => [...row]);
  notesBoard = Array.from({ length: gridSize }, () => Array.from({ length: gridSize }, () => new Set()));
}

function isHyperCell(r, c) {
  if (currentVariant !== 'hyper') return false;
  const inRow = (r >= 1 && r <= 3) || (r >= 5 && r <= 7);
  const inCol = (c >= 1 && c <= 3) || (c >= 5 && c <= 7);
  return inRow && inCol;
}

function isDiagonalCell(r, c) {
  if (currentVariant !== 'diagonal') return false;
  return r === c || r + c === gridSize - 1;
}

function renderBoard() {
  const boardEl = document.getElementById('board');
  if (!boardEl) return;
  boardEl.innerHTML = '';
  boardEl.className = `board grid-${gridSize}`;

  for (let r = 0; r < gridSize; r++) {
    for (let c = 0; c < gridSize; c++) {
      const cell = document.createElement('div');
      cell.classList.add('cell');
      cell.dataset.row = r;
      cell.dataset.col = c;

      if (isHyperCell(r, c)) cell.classList.add('hyper-region');
      if (isDiagonalCell(r, c)) cell.classList.add('diagonal-cell');

      const val = currentBoard[r][c];
      const notes = notesBoard[r][c];

      if (val !== 0) {
        cell.textContent = val;
        if (initialBoard[r][c] !== 0) {
          cell.classList.add('given');
        } else {
          cell.classList.add('user-input');
          if (val !== solution[r][c] && !isZenMode) cell.classList.add('error');
        }
      } else if (notes && notes instanceof Set && notes.size > 0) {
        const notesGrid = document.createElement('div');
        notesGrid.classList.add('notes-grid');
        for (let i = 1; i <= gridSize; i++) {
          const noteSpan = document.createElement('span');
          noteSpan.classList.add('note-num');
          noteSpan.textContent = notes.has(i) ? i : '';
          notesGrid.appendChild(noteSpan);
        }
        cell.appendChild(notesGrid);
      }

      cell.addEventListener('click', () => {
        if (!isPaused) selectCell(r, c);
      });
      boardEl.appendChild(cell);
    }
  }
}

function selectCell(r, c) {
  selectedCell = { r, c };
  const cells = document.querySelectorAll('.cell');
  const selectedVal = currentBoard[r][c];

  cells.forEach(cell => {
    const cr = parseInt(cell.dataset.row);
    const cc = parseInt(cell.dataset.col);

    cell.classList.remove('selected', 'highlight', 'same-digit');

    if (cr === r && cc === c) {
      cell.classList.add('selected');
    } else if (selectedVal !== 0 && currentBoard[cr][cc] === selectedVal) {
      cell.classList.add('same-digit');
    } else if (
      cr === r || cc === c || 
      (Math.floor(cr / boxRows) === Math.floor(r / boxRows) && Math.floor(cc / boxCols) === Math.floor(c / boxCols))
    ) {
      cell.classList.add('highlight');
    }
  });
}

function buildKeypad() {
  const keypadEl = document.getElementById('keypad');
  if (!keypadEl) return;
  keypadEl.innerHTML = '';
  keypadEl.className = `keypad grid-${gridSize}`;

  for (let i = 1; i <= gridSize; i++) {
    const key = document.createElement('button');
    key.classList.add('key');
    key.id = `key-${i}`;
    key.innerHTML = `<span class="key-digit">${i}</span><span class="key-badge" id="key-badge-${i}">${gridSize}</span>`;
    key.addEventListener('click', () => handleInput(i));
    keypadEl.appendChild(key);
  }
}

function updateKeypadCounts() {
  const counts = Array(gridSize + 1).fill(0);
  for (let r = 0; r < gridSize; r++) {
    for (let c = 0; c < gridSize; c++) {
      const val = currentBoard[r][c];
      if (val !== 0 && val === solution[r][c]) counts[val]++;
    }
  }

  for (let i = 1; i <= gridSize; i++) {
    const remaining = gridSize - counts[i];
    const badge = document.getElementById(`key-badge-${i}`);
    const keyBtn = document.getElementById(`key-${i}`);
    if (badge) badge.textContent = remaining > 0 ? remaining : '✓';
    if (keyBtn) keyBtn.classList.toggle('key-completed', remaining === 0);
  }
}

function handleInput(num) {
  if (isPaused || !selectedCell) return;
  const { r, c } = selectedCell;
  if (initialBoard[r][c] !== 0) return;

  if (!(notesBoard[r][c] instanceof Set)) notesBoard[r][c] = new Set();

  if (isNotesMode) {
    if (currentBoard[r][c] === 0) {
      if (notesBoard[r][c].has(num)) notesBoard[r][c].delete(num);
      else notesBoard[r][c].add(num);
      renderBoard();
      selectCell(r, c);
    }
    return;
  }

  if (currentBoard[r][c] !== num) {
    historyStack.push({ r, c, prevVal: currentBoard[r][c], prevNotes: new Set(notesBoard[r][c]) });
    currentBoard[r][c] = num;
    notesBoard[r][c].clear();

    if (num !== solution[r][c]) {
      if (!isZenMode) {
        mistakes++;
        updateMistakesDisplay();
        if (mistakes >= MAX_MISTAKES) {
          endGame(false);
          return;
        }
      }
    }

    renderBoard();
    selectCell(r, c);
    updateKeypadCounts();
    calculateProgress();
    checkWinCondition();
  }
}

function calculateProgress() {
  let correct = 0;
  const total = gridSize * gridSize;
  for (let r = 0; r < gridSize; r++) {
    for (let c = 0; c < gridSize; c++) {
      if (currentBoard[r][c] === solution[r][c]) correct++;
    }
  }
  myProgress = Math.round((correct / total) * 100);
  const myBar = document.getElementById('my-bar');
  const myProgText = document.getElementById('my-progress');
  if (myBar) myBar.style.width = `${myProgress}%`;
  if (myProgText) myProgText.textContent = `${myProgress}%`;

  if (isMultiplayer && peerConn) {
    sendMultiplayerUpdate();
  }
}

/* PeerJS Multiplayer Setup */
function initMultiplayer() {
  peer = new Peer();

  peer.on('open', (id) => {
    const idEl = document.getElementById('my-peer-id');
    if (idEl) idEl.textContent = id;
  });

  peer.on('connection', (conn) => {
    peerConn = conn;
    setupConnectionListeners();
    alert("Opponent connected! Starting race...");
    document.getElementById('mp-modal').classList.remove('active');
    isMultiplayer = true;
    document.getElementById('multiplayer-bar').style.display = 'flex';
    startNewGame();
  });
}

function setupConnectionListeners() {
  peerConn.on('data', (data) => {
    if (data.type === 'progress') {
      oppProgress = data.progress;
      const oppBar = document.getElementById('opp-bar');
      const oppText = document.getElementById('opp-progress');
      if (oppBar) oppBar.style.width = `${oppProgress}%`;
      if (oppText) oppText.textContent = `${oppProgress}%`;
    } else if (data.type === 'win') {
      showEndModal("❌ Race Lost!", "Your opponent finished the puzzle first!");
    }
  });
}

function joinMultiplayerRoom(hostId) {
  if (!peer) return;
  peerConn = peer.connect(hostId);
  setupConnectionListeners();
  peerConn.on('open', () => {
    alert("Connected to host! Race starting...");
    document.getElementById('mp-modal').classList.remove('active');
    isMultiplayer = true;
    document.getElementById('multiplayer-bar').style.display = 'flex';
    startNewGame();
  });
}

function sendMultiplayerUpdate() {
  if (peerConn && peerConn.open) {
    peerConn.send({ type: 'progress', progress: myProgress });
  }
}

function checkWinCondition() {
  for (let r = 0; r < gridSize; r++) {
    for (let c = 0; c < gridSize; c++) {
      if (currentBoard[r][c] !== solution[r][c]) return;
    }
  }
  endGame(true);
}

function endGame(isWin) {
  if (timerInterval) clearInterval(timerInterval);
  stats.played++;

  if (isWin) {
    stats.won++;
    if (isMultiplayer && peerConn && peerConn.open) {
      peerConn.send({ type: 'win' });
    }
    showEndModal("🎉 Victory!", `Puzzle solved!`);
  } else {
    showEndModal("❌ Game Over", "3 mistakes reached!");
  }
  localStorage.setItem('sudoku_stats', JSON.stringify(stats));
}

function updateTimerDisplay() {
  const timerEl = document.getElementById('timer');
  if (timerEl) {
    const mins = String(Math.floor(secondsElapsed / 60)).padStart(2, '0');
    const secs = String(secondsElapsed % 60).padStart(2, '0');
    timerEl.textContent = `${mins}:${secs}`;
  }
}

function updateMistakesDisplay() {
  const mistakesEl = document.getElementById('mistakes-count');
  if (mistakesEl) mistakesEl.textContent = `${mistakes}/${MAX_MISTAKES}`;
}

function updateActionButtonLabels() {
  const btnUndo = document.getElementById('btn-undo');
  const btnHint = document.getElementById('btn-hint');
  if (btnUndo) btnUndo.textContent = `Undo (${undosRemaining})`;
  if (btnHint) btnHint.textContent = `Hint (${hintsRemaining})`;
}

function showEndModal(title, message) {
  const titleEl = document.getElementById('modal-title');
  const msgEl = document.getElementById('modal-message');
  const gameModal = document.getElementById('game-modal');
  if (titleEl) titleEl.textContent = title;
  if (msgEl) msgEl.textContent = message;
  if (gameModal) gameModal.classList.add('active');
}

document.addEventListener('DOMContentLoaded', () => {
  startNewGame();

  const variantSelect = document.getElementById('variant-select');
  if (variantSelect) {
    variantSelect.addEventListener('change', () => startNewGame());
  }

  document.getElementById('btn-new').addEventListener('click', () => startNewGame());
  document.getElementById('btn-multiplayer').addEventListener('click', () => {
    initMultiplayer();
    document.getElementById('mp-modal').classList.add('active');
  });

  document.getElementById('btn-copy-code').addEventListener('click', () => {
    const code = document.getElementById('my-peer-id').textContent;
    navigator.clipboard.writeText(code);
    alert("Room code copied to clipboard!");
  });

  document.getElementById('btn-join-room').addEventListener('click', () => {
    const roomCode = document.getElementById('join-room-input').value.trim();
    if (roomCode) joinMultiplayerRoom(roomCode);
  });

  document.getElementById('mp-close-btn').addEventListener('click', () => {
    document.getElementById('mp-modal').classList.remove('active');
  });

  document.getElementById('modal-close-btn').addEventListener('click', () => {
    document.getElementById('game-modal').classList.remove('active');
    startNewGame();
  });
});
  

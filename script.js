/* ==========================================================================
   SUDOKU MASTER ULTIMATE - UNIFIED ENGINE
   ========================================================================== */

// --- Core Game State Variables ---
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
let activeDateStr = null;
const MAX_MISTAKES = 3;

// --- Variant & Grid Settings ---
let currentVariant = 'classic'; // Options: 'classic', 'diagonal', 'mini', 'hyper'
let gridSize = 9;
let boxRows = 3;
let boxCols = 3;

// --- Gameplay Resources ---
let hintsRemaining = 2;
let undosRemaining = 2;

// --- Calendar & Trophy Settings ---
let calViewYear = new Date().getFullYear();
let calViewMonth = new Date().getMonth();

// --- PeerJS Multiplayer Variables ---
let peer = null;
let peerConn = null;
let isMultiplayer = false;
let myProgress = 0;
let oppProgress = 0;

// --- Local Storage Persistence ---
let stats = { played: 0, won: 0, losses: 0, bestTime: null };
try {
  const savedStats = localStorage.getItem('sudoku_stats');
  if (savedStats) stats = JSON.parse(savedStats);
} catch (e) {
  console.warn("Stats parse error:", e);
}

let completedDailies = [];
try {
  const savedDailies = localStorage.getItem('sudoku_completed_dailies');
  if (savedDailies) completedDailies = JSON.parse(savedDailies);
} catch (e) {
  console.warn("Completed dailies parse error:", e);
}

let rewards = [];
try {
  const savedRewards = localStorage.getItem('sudoku_rewards');
  if (savedRewards) rewards = JSON.parse(savedRewards);
} catch (e) {
  console.warn("Rewards parse error:", e);
}

/* ==========================================================================
   ENGINE INITIALIZATION & GAME LIFECYCLE
   ========================================================================== */

function setVariantParameters(variant) {
  currentVariant = variant;
  if (variant === 'mini') {
    gridSize = 6;
    boxRows = 2;
    boxCols = 3;
  } else {
    gridSize = 9;
    boxRows = 3;
    boxCols = 3;
  }
}

function startNewGame(dateStr = null, loadSaved = false, customBoardData = null) {
  if (timerInterval) clearInterval(timerInterval);

  let loaded = false;
  if (loadSaved && !customBoardData) {
    loaded = loadGameState();
  }

  if (customBoardData) {
    // Multiplayer board sync received from Host
    currentVariant = customBoardData.variant;
    setVariantParameters(currentVariant);
    solution = customBoardData.solution;
    initialBoard = customBoardData.initialBoard;
    currentBoard = initialBoard.map(row => [...row]);
    notesBoard = Array.from({ length: gridSize }, () => Array.from({ length: gridSize }, () => new Set()));
    secondsElapsed = 0;
    mistakes = 0;
    isPaused = false;
    isNotesMode = false;
    historyStack = [];
    loaded = true;
  }

  if (!loaded) {
    const variantSelect = document.getElementById('variant-select');
    if (variantSelect) setVariantParameters(variantSelect.value);

    secondsElapsed = 0;
    mistakes = 0;
    isPaused = false;
    isNotesMode = false;
    activeDateStr = dateStr;

    const difficultyEl = document.getElementById('difficulty');
    const diff = difficultyEl ? difficultyEl.value : 'medium';

    if (diff === 'easy') { hintsRemaining = 3; undosRemaining = 3; }
    else if (diff === 'medium') { hintsRemaining = 2; undosRemaining = 2; }
    else { hintsRemaining = 1; undosRemaining = 1; }

    generateSudokuVariant(activeDateStr);
    historyStack = [];
  }

  // UI Banner Update
  const gameModeBanner = document.getElementById('game-mode-banner');
  if (gameModeBanner) {
    if (isMultiplayer) {
      gameModeBanner.textContent = `⚔️ Multiplayer Race (${currentVariant.toUpperCase()})`;
    } else if (activeDateStr) {
      gameModeBanner.textContent = `📅 Daily Challenge: ${activeDateStr}`;
    } else {
      gameModeBanner.textContent = `Mode: ${currentVariant.toUpperCase()} Sudoku`;
    }
  }

  // Sync Dropdown Selector UI
  const variantSelect = document.getElementById('variant-select');
  if (variantSelect) variantSelect.value = currentVariant;

  // Reset Overlay Elements
  const btnPause = document.getElementById('btn-pause');
  const btnNotes = document.getElementById('btn-notes');
  const boardEl = document.getElementById('board');
  const pauseOverlay = document.getElementById('pause-overlay');

  if (btnPause) btnPause.textContent = "Pause";
  if (btnNotes) {
    btnNotes.textContent = "Notes (OFF)";
    btnNotes.classList.remove('btn-active-mode');
  }
  if (boardEl) boardEl.classList.remove('paused');
  if (pauseOverlay) pauseOverlay.classList.remove('active');

  updateActionButtonLabels();
  updateMistakesDisplay();
  updateTimerDisplay();
  updateStreakDisplay();
  applyZenModeUI();

  // Timer Interval
  timerInterval = setInterval(() => {
    if (!isPaused && !isZenMode) {
      secondsElapsed++;
      updateTimerDisplay();
      if (!isMultiplayer) saveGameState();
    }
  }, 1000);

  selectedCell = null;
  buildKeypad();
  renderBoard();
  updateKeypadCounts();
  calculateProgress();
  if (!isMultiplayer) saveGameState();
}

/* ==========================================================================
   HAPTIC & AUDIO-VISUAL FEEDBACK
   ========================================================================== */

function triggerHaptic(type = 'light') {
  if (navigator.vibrate) {
    if (type === 'light') navigator.vibrate(12);
    else if (type === 'error') navigator.vibrate([40, 60, 40]);
  }
}

function triggerConfetti() {
  const canvas = document.getElementById('confetti-canvas');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;

  const particles = Array.from({ length: 70 }, () => ({
    x: Math.random() * canvas.width,
    y: Math.random() * canvas.height - canvas.height,
    color: `hsl(${Math.random() * 360}, 100%, 50%)`,
    size: Math.random() * 8 + 4,
    speedY: Math.random() * 4 + 2,
    speedX: Math.random() * 2 - 1
  }));

  let frame = 0;
  function render() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    particles.forEach(p => {
      p.y += p.speedY;
      p.x += p.speedX;
      ctx.fillStyle = p.color;
      ctx.fillRect(p.x, p.y, p.size, p.size);
    });
    frame++;
    if (frame < 140) requestAnimationFrame(render);
    else ctx.clearRect(0, 0, canvas.width, canvas.height);
  }
  render();
}

/* ==========================================================================
   LOCAL STORAGE AUTO-SAVE SYSTEM
   ========================================================================== */

function saveGameState() {
  if (isMultiplayer) return; // Do not overwrite local save during multiplayer race
  try {
    const gameState = {
      solution, initialBoard, currentBoard,
      notesBoard: notesBoard.map(row => row.map(set => (set instanceof Set ? Array.from(set) : []))),
      secondsElapsed, mistakes, activeDateStr, hintsRemaining, undosRemaining, isZenMode,
      currentVariant, gridSize, boxRows, boxCols
    };
    localStorage.setItem('sudoku_saved_state', JSON.stringify(gameState));
  } catch (e) {
    console.error("Save state error:", e);
  }
}

function loadGameState() {
  const saved = localStorage.getItem('sudoku_saved_state');
  if (!saved) return false;
  try {
    const data = JSON.parse(saved);
    if (!data.solution || !data.currentBoard || !data.notesBoard) return false;

    currentVariant = data.currentVariant || 'classic';
    setVariantParameters(currentVariant);

    solution = data.solution;
    initialBoard = data.initialBoard;
    currentBoard = data.currentBoard;
    notesBoard = data.notesBoard.map(row => 
      row.map(arr => new Set(Array.isArray(arr) ? arr : []))
    );
    secondsElapsed = data.secondsElapsed || 0;
    mistakes = data.mistakes || 0;
    activeDateStr = data.activeDateStr || null;
    hintsRemaining = data.hintsRemaining ?? 2;
    undosRemaining = data.undosRemaining ?? 2;
    isZenMode = !!data.isZenMode;
    return true;
  } catch (e) {
    console.warn("Corrupted save, starting fresh:", e);
    localStorage.removeItem('sudoku_saved_state');
    return false;
  }
}

/* ==========================================================================
   SUDOKU GENERATOR (CLASSIC, MINI, DIAGONAL, HYPER)
   ========================================================================== */

function seededRandom(seed) {
  const x = Math.sin(seed++) * 10000;
  return x - Math.floor(x);
}

function shuffle(array, seed = null) {
  let arr = [...array];
  for (let i = arr.length - 1; i > 0; i--) {
    const rand = seed ? seededRandom(seed + i) : Math.random();
    const j = Math.floor(rand * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

function generateSudokuVariant(dateStr = null) {
  let seed = dateStr ? parseInt(dateStr.replace(/-/g, ''), 10) : null;

  if (gridSize === 6) {
    const base6 = [
      [1, 2, 3, 4, 5, 6], [4, 5, 6, 1, 2, 3],
      [2, 3, 1, 5, 6, 4], [5, 6, 4, 2, 3, 1],
      [3, 1, 2, 6, 4, 5], [6, 4, 5, 3, 1, 2]
    ];
    const nums = shuffle([1, 2, 3, 4, 5, 6], seed);
    const map = {};
    for (let i = 1; i <= 6; i++) map[i] = nums[i - 1];
    solution = base6.map(row => row.map(val => map[val]));
  } else {
    const base9 = [
      [1, 2, 3, 4, 5, 6, 7, 8, 9], [4, 5, 6, 7, 8, 9, 1, 2, 3], [7, 8, 9, 1, 2, 3, 4, 5, 6],
      [2, 3, 1, 5, 6, 4, 8, 9, 7], [5, 6, 4, 8, 9, 7, 2, 3, 1], [8, 9, 7, 2, 3, 1, 5, 6, 4],
      [3, 1, 2, 6, 4, 5, 9, 7, 8], [6, 4, 5, 9, 7, 8, 3, 1, 2], [9, 7, 8, 3, 1, 2, 6, 4, 5]
    ];
    const nums = shuffle([1, 2, 3, 4, 5, 6, 7, 8, 9], seed);
    const map = {};
    for (let i = 1; i <= 9; i++) map[i] = nums[i - 1];
    solution = base9.map(row => row.map(val => map[val]));

    for (let b = 0; b < 3; b++) {
      const r = shuffle([0, 1, 2], seed ? seed + b : null);
      const sub = r.map(idx => solution[b * 3 + idx]);
      for (let i = 0; i < 3; i++) solution[b * 3 + i] = sub[i];
    }
  }

  initialBoard = solution.map(row => [...row]);
  const difficultyEl = document.getElementById('difficulty');
  const diff = difficultyEl ? difficultyEl.value : 'medium';

  let removeCount;
  if (gridSize === 6) {
    removeCount = diff === 'easy' ? 12 : diff === 'medium' ? 16 : 20;
  } else {
    removeCount = diff === 'easy' ? 35 : diff === 'medium' ? 45 : 54;
  }

  let step = 0;
  while (removeCount > 0) {
    step++;
    const r = Math.floor((seed ? seededRandom(seed + step) : Math.random()) * gridSize);
    const c = Math.floor((seed ? seededRandom(seed + step + 100) : Math.random()) * gridSize);
    if (initialBoard[r][c] !== 0) {
      initialBoard[r][c] = 0;
      removeCount--;
    }
  }

  currentBoard = initialBoard.map(row => [...row]);
  notesBoard = Array.from({ length: gridSize }, () => Array.from({ length: gridSize }, () => new Set()));
}

/* ==========================================================================
   RULE VALIDATION & VARIANT HELPERS
   ========================================================================== */

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

function isValidPlacement(r, c, num) {
  // Check Row and Column
  for (let i = 0; i < gridSize; i++) {
    if (currentBoard[r][i] === num || currentBoard[i][c] === num) return false;
  }

  // Check Sub-Box
  const boxR = Math.floor(r / boxRows) * boxRows;
  const boxC = Math.floor(c / boxCols) * boxCols;
  for (let br = 0; br < boxRows; br++) {
    for (let bc = 0; bc < boxCols; bc++) {
      if (currentBoard[boxR + br][boxC + bc] === num) return false;
    }
  }

  // Check Diagonal Rules
  if (currentVariant === 'diagonal') {
    if (r === c) {
      for (let i = 0; i < gridSize; i++) if (currentBoard[i][i] === num) return false;
    }
    if (r + c === gridSize - 1) {
      for (let i = 0; i < gridSize; i++) if (currentBoard[i][gridSize - 1 - i] === num) return false;
    }
  }

  // Check Windoku/Hyper Regions
  if (currentVariant === 'hyper' && isHyperCell(r, c)) {
    const hBoxR = r <= 3 ? 1 : 5;
    const hBoxC = c <= 3 ? 1 : 5;
    for (let hr = 0; hr < 3; hr++) {
      for (let hc = 0; hc < 3; hc++) {
        if (currentBoard[hBoxR + hr][hBoxC + hc] === num) return false;
      }
    }
  }

  return true;
}

/* ==========================================================================
   AUTO-NOTES (MAGIC PENCIL) & NOTE CLEARING
   ========================================================================== */

function autoFillNotes() {
  if (isPaused) return;
  triggerHaptic('light');

  for (let r = 0; r < gridSize; r++) {
    for (let c = 0; c < gridSize; c++) {
      if (currentBoard[r][c] === 0) {
        if (!(notesBoard[r][c] instanceof Set)) notesBoard[r][c] = new Set();
        notesBoard[r][c].clear();
        for (let num = 1; num <= gridSize; num++) {
          if (isValidPlacement(r, c, num)) {
            notesBoard[r][c].add(num);
          }
        }
      }
    }
  }
  renderBoard();
  if (selectedCell) selectCell(selectedCell.r, selectedCell.c);
  if (!isMultiplayer) saveGameState();
}

function autoClearNotes(r, c, num) {
  for (let i = 0; i < gridSize; i++) {
    if (notesBoard[r][i] instanceof Set) notesBoard[r][i].delete(num);
    if (notesBoard[i][c] instanceof Set) notesBoard[i][c].delete(num);
  }

  const boxR = Math.floor(r / boxRows) * boxRows;
  const boxC = Math.floor(c / boxCols) * boxCols;
  for (let br = 0; br < boxRows; br++) {
    for (let bc = 0; bc < boxCols; bc++) {
      const target = notesBoard[boxR + br][boxC + bc];
      if (target instanceof Set) target.delete(num);
    }
  }

  if (currentVariant === 'diagonal') {
    if (r === c) {
      for (let i = 0; i < gridSize; i++) if (notesBoard[i][i] instanceof Set) notesBoard[i][i].delete(num);
    }
    if (r + c === gridSize - 1) {
      for (let i = 0; i < gridSize; i++) if (notesBoard[i][gridSize - 1 - i] instanceof Set) notesBoard[i][gridSize - 1 - i].delete(num);
    }
  }

  if (currentVariant === 'hyper' && isHyperCell(r, c)) {
    const hBoxR = r <= 3 ? 1 : 5;
    const hBoxC = c <= 3 ? 1 : 5;
    for (let hr = 0; hr < 3; hr++) {
      for (let hc = 0; hc < 3; hc++) {
        const target = notesBoard[hBoxR + hr][hBoxC + hc];
        if (target instanceof Set) target.delete(num);
      }
    }
  }
}

/* ==========================================================================
   BOARD RENDERING & KEYPAD INTERACTION
   ========================================================================== */

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
  triggerHaptic('light');
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
    key.innerHTML = `
      <span class="key-digit">${i}</span>
      <span class="key-badge" id="key-badge-${i}">${gridSize}</span>
    `;
    key.addEventListener('click', () => handleInput(i));
    keypadEl.appendChild(key);
  }
}

function updateKeypadCounts() {
  if (!solution || solution.length < gridSize) return;
  const counts = Array(gridSize + 1).fill(0);
  for (let r = 0; r < gridSize; r++) {
    for (let c = 0; c < gridSize; c++) {
      const val = currentBoard[r][c];
      if (val !== 0 && val === solution[r][c]) {
        counts[val]++;
      }
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

/* ==========================================================================
   INPUT HANDLING, ERASE, UNDO, AND HINT
   ========================================================================== */

function handleInput(num) {
  if (isPaused || !selectedCell) return;
  const { r, c } = selectedCell;

  if (initialBoard[r][c] !== 0) return;

  if (!(notesBoard[r][c] instanceof Set)) notesBoard[r][c] = new Set();

  if (isNotesMode) {
    if (currentBoard[r][c] === 0) {
      triggerHaptic('light');
      if (notesBoard[r][c].has(num)) {
        notesBoard[r][c].delete(num);
      } else {
        notesBoard[r][c].add(num);
      }
      renderBoard();
      selectCell(r, c);
      if (!isMultiplayer) saveGameState();
    }
    return;
  }

  if (currentBoard[r][c] !== num) {
    historyStack.push({ 
      r, c, 
      prevVal: currentBoard[r][c],
      prevNotes: new Set(notesBoard[r][c])
    });

    currentBoard[r][c] = num;
    notesBoard[r][c].clear();

    if (num !== solution[r][c]) {
      triggerHaptic('error');
      if (!isZenMode) {
        mistakes++;
        updateMistakesDisplay();
        if (mistakes >= MAX_MISTAKES) {
          endGame(false);
          return;
        }
      }
    } else {
      triggerHaptic('light');
      autoClearNotes(r, c, num);
      checkLineCompletions(r, c);
    }

    renderBoard();
    selectCell(r, c);
    updateKeypadCounts();
    calculateProgress();
    if (!isMultiplayer) saveGameState();
    checkWinCondition();
  }
}

function checkLineCompletions(r, c) {
  let rowComplete = true;
  for (let col = 0; col < gridSize; col++) {
    if (currentBoard[r][col] !== solution[r][col]) rowComplete = false;
  }

  let colComplete = true;
  for (let row = 0; row < gridSize; row++) {
    if (currentBoard[row][c] !== solution[row][c]) colComplete = false;
  }

  if (rowComplete || colComplete) {
    const cells = document.querySelectorAll('.cell');
    cells.forEach(cell => {
      const cr = parseInt(cell.dataset.row);
      const cc = parseInt(cell.dataset.col);
      if ((rowComplete && cr === r) || (colComplete && cc === c)) {
        cell.classList.add('flash-complete');
        setTimeout(() => cell.classList.remove('flash-complete'), 600);
      }
    });
  }
}

function eraseInput() {
  if (isPaused || !selectedCell) return;
  const { r, c } = selectedCell;
  if (initialBoard[r][c] !== 0) return;

  if (currentBoard[r][c] !== 0 || (notesBoard[r][c] instanceof Set && notesBoard[r][c].size > 0)) {
    triggerHaptic('light');
    historyStack.push({ 
      r, c, 
      prevVal: currentBoard[r][c],
      prevNotes: new Set(notesBoard[r][c] instanceof Set ? notesBoard[r][c] : [])
    });
    currentBoard[r][c] = 0;
    if (notesBoard[r][c] instanceof Set) notesBoard[r][c].clear();
    renderBoard();
    selectCell(r, c);
    updateKeypadCounts();
    calculateProgress();
    if (!isMultiplayer) saveGameState();
  }
}

function undoMove() {
  if (isPaused || historyStack.length === 0 || undosRemaining <= 0) return;

  triggerHaptic('light');
  const lastMove = historyStack.pop();
  currentBoard[lastMove.r][lastMove.c] = lastMove.prevVal;
  notesBoard[lastMove.r][lastMove.c] = lastMove.prevNotes;

  undosRemaining--;
  updateActionButtonLabels();

  renderBoard();
  selectCell(lastMove.r, lastMove.c);
  updateKeypadCounts();
  calculateProgress();
  if (!isMultiplayer) saveGameState();
}

function giveHint() {
  if (isPaused || !selectedCell || hintsRemaining <= 0) return;
  const { r, c } = selectedCell;

  if (initialBoard[r][c] !== 0 || currentBoard[r][c] === solution[r][c]) return;

  triggerHaptic('light');
  historyStack.push({ 
    r, c, 
    prevVal: currentBoard[r][c],
    prevNotes: new Set(notesBoard[r][c] instanceof Set ? notesBoard[r][c] : [])
  });

  currentBoard[r][c] = solution[r][c];
  if (notesBoard[r][c] instanceof Set) notesBoard[r][c].clear();
  autoClearNotes(r, c, solution[r][c]);

  hintsRemaining--;
  updateActionButtonLabels();

  renderBoard();
  selectCell(r, c);
  updateKeypadCounts();
  calculateProgress();
  if (!isMultiplayer) saveGameState();
  checkWinCondition();
}

/* ==========================================================================
   MULTIPLAYER ENGINE (PEERJS REAL-TIME 1v1 RACE)
   ========================================================================== */

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

function initMultiplayer() {
  if (peer) return;
  peer = new Peer();

  peer.on('open', (id) => {
    const idEl = document.getElementById('my-peer-id');
    if (idEl) idEl.textContent = id;
  });

  peer.on('connection', (conn) => {
    peerConn = conn;
    setupConnectionListeners();
    alert("Opponent connected! Sending board data...");

    isMultiplayer = true;
    document.getElementById('mp-modal').classList.remove('active');
    document.getElementById('multiplayer-bar').style.display = 'flex';

    startNewGame();
    // Send Board seed to Guest
    if (peerConn && peerConn.open) {
      peerConn.send({
        type: 'init_board',
        boardData: { variant: currentVariant, solution, initialBoard }
      });
    }
  });
}

function setupConnectionListeners() {
  peerConn.on('data', (data) => {
    if (data.type === 'init_board') {
      isMultiplayer = true;
      document.getElementById('mp-modal').classList.remove('active');
      document.getElementById('multiplayer-bar').style.display = 'flex';
      startNewGame(null, false, data.boardData);
    } else if (data.type === 'progress') {
      oppProgress = data.progress;
      const oppBar = document.getElementById('opp-bar');
      const oppText = document.getElementById('opp-progress');
      if (oppBar) oppBar.style.width = `${oppProgress}%`;
      if (oppText) oppText.textContent = `${oppProgress}%`;
    } else if (data.type === 'win') {
      showEndModal("❌ Race Lost!", "Your opponent finished the puzzle before you!");
    }
  });
}

function joinMultiplayerRoom(hostId) {
  if (!peer) initMultiplayer();
  peerConn = peer.connect(hostId);
  setupConnectionListeners();
}

function sendMultiplayerUpdate() {
  if (peerConn && peerConn.open) {
    peerConn.send({ type: 'progress', progress: myProgress });
  }
}
/* ==========================================================================
   GAME COMPLETION & STATISTICS
   ========================================================================== */

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
  localStorage.removeItem('sudoku_saved_state');

  if (isWin) {
    triggerConfetti();
    stats.won++;
    if (!stats.bestTime || secondsElapsed < stats.bestTime) {
      stats.bestTime = secondsElapsed;
    }

    if (activeDateStr) {
      if (!completedDailies.includes(activeDateStr)) {
        completedDailies.push(activeDateStr);
        localStorage.setItem('sudoku_completed_dailies', JSON.stringify(completedDailies));
      }
      checkMonthTrophy(activeDateStr);
    }

    if (isMultiplayer && peerConn && peerConn.open) {
      peerConn.send({ type: 'win' });
    }

    updateStreakDisplay();
    const timerEl = document.getElementById('timer');
    showEndModal("🎉 Victory!", isZenMode ? "Puzzle solved!" : `Solved in ${timerEl ? timerEl.textContent : ''}!`);
  } else {
    stats.losses++;
    showEndModal("❌ Game Over", "3 mistakes reached!");
  }

  localStorage.setItem('sudoku_stats', JSON.stringify(stats));
}

function calculateStreak() {
  if (!Array.isArray(completedDailies) || completedDailies.length === 0) return 0;
  const sorted = [...new Set(completedDailies)].sort().reverse();
  const today = new Date().toISOString().slice(0, 10);
  const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);

  let streak = 0;
  let checkDate = sorted.includes(today) ? new Date() : sorted.includes(yesterday) ? new Date(Date.now() - 86400000) : null;

  if (!checkDate) return 0;

  while (true) {
    const dateStr = checkDate.toISOString().slice(0, 10);
    if (sorted.includes(dateStr)) {
      streak++;
      checkDate.setDate(checkDate.getDate() - 1);
    } else {
      break;
    }
  }
  return streak;
}

function updateStreakDisplay() {
  const streakEl = document.getElementById('streak-display');
  if (streakEl) {
    const streak = calculateStreak();
    streakEl.textContent = `🔥 ${streak}`;
  }
}

function checkMonthTrophy(dateStr) {
  const [year, month] = dateStr.split('-').map(Number);
  const totalDaysInMonth = new Date(year, month, 0).getDate();
  const monthKey = `${year}-${String(month).padStart(2, '0')}`;

  let daysCompleted = 0;
  for (let d = 1; d <= totalDaysInMonth; d++) {
    const checkDateStr = `${monthKey}-${String(d).padStart(2, '0')}`;
    if (completedDailies.includes(checkDateStr)) daysCompleted++;
  }

  if (daysCompleted >= totalDaysInMonth) {
    if (!rewards.some(r => r.monthKey === monthKey)) {
      const monthNames = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
      rewards.push({
        monthKey: monthKey,
        title: `${monthNames[month - 1]} ${year}`,
        icon: "🏆"
      });
      localStorage.setItem('sudoku_rewards', JSON.stringify(rewards));
    }
  }
}

/* ==========================================================================
   MODALS, CALENDAR, & UI TOGGLES
   ========================================================================== */

function toggleZenMode() {
  isZenMode = !isZenMode;
  applyZenModeUI();
  if (!isMultiplayer) saveGameState();
}

function applyZenModeUI() {
  const btnZen = document.getElementById('btn-zen');
  const timerWrp = document.getElementById('timer-wrapper');
  const mistakeWrp = document.getElementById('mistakes-wrapper');

  if (btnZen) {
    btnZen.textContent = `🧘 Zen (${isZenMode ? 'ON' : 'OFF'})`;
    btnZen.classList.toggle('btn-active-mode', isZenMode);
  }
  if (timerWrp) timerWrp.style.display = isZenMode ? 'none' : 'flex';
  if (mistakeWrp) mistakeWrp.style.display = isZenMode ? 'none' : 'flex';
}

function togglePause() {
  isPaused = !isPaused;
  const btnPause = document.getElementById('btn-pause');
  const boardEl = document.getElementById('board');
  const pauseOverlay = document.getElementById('pause-overlay');

  if (isPaused) {
    if (btnPause) btnPause.textContent = "Resume";
    if (boardEl) boardEl.classList.add('paused');
    if (pauseOverlay) pauseOverlay.classList.add('active');
  } else {
    if (btnPause) btnPause.textContent = "Pause";
    if (boardEl) boardEl.classList.remove('paused');
    if (pauseOverlay) pauseOverlay.classList.remove('active');
  }
}

function toggleNotesMode() {
  isNotesMode = !isNotesMode;
  const btnNotes = document.getElementById('btn-notes');
  if (btnNotes) {
    btnNotes.textContent = `Notes (${isNotesMode ? 'ON' : 'OFF'})`;
    btnNotes.classList.toggle('btn-active-mode', isNotesMode);
  }
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
  if (mistakesEl) {
    mistakesEl.textContent = `${mistakes}/${MAX_MISTAKES}`;
  }
}

function updateActionButtonLabels() {
  const btnUndo = document.getElementById('btn-undo');
  const btnHint = document.getElementById('btn-hint');
  if (btnUndo) {
    btnUndo.textContent = `Undo (${undosRemaining})`;
    btnUndo.disabled = undosRemaining <= 0;
  }
  if (btnHint) {
    btnHint.textContent = `Hint (${hintsRemaining})`;
    btnHint.disabled = hintsRemaining <= 0;
  }
}

function openCalendarModal() {
  renderCalendar(calViewYear, calViewMonth);
  const calendarModal = document.getElementById('calendar-modal');
  if (calendarModal) calendarModal.classList.add('active');
}

function renderCalendar(year, month) {
  const monthNames = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
  const titleEl = document.getElementById('calendar-month-title');
  if (titleEl) titleEl.textContent = `${monthNames[month]} ${year}`;

  const calGrid = document.getElementById('calendar-grid');
  if (!calGrid) return;
  calGrid.innerHTML = '';

  const firstDayIndex = new Date(year, month, 1).getDay();
  const totalDays = new Date(year, month + 1, 0).getDate();
  const todayStr = new Date().toISOString().slice(0, 10);

  for (let i = 0; i < firstDayIndex; i++) {
    const emptyDiv = document.createElement('div');
    emptyDiv.classList.add('cal-day', 'empty');
    calGrid.appendChild(emptyDiv);
  }

  for (let day = 1; day <= totalDays; day++) {
    const dayBtn = document.createElement('div');
    dayBtn.classList.add('cal-day');
    dayBtn.textContent = day;

    const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;

    if (completedDailies.includes(dateStr)) dayBtn.classList.add('completed');
    if (dateStr === todayStr) dayBtn.classList.add('today');

    dayBtn.addEventListener('click', () => {
      const calendarModal = document.getElementById('calendar-modal');
      if (calendarModal) calendarModal.classList.remove('active');
      startNewGame(dateStr);
    });

    calGrid.appendChild(dayBtn);
  }
}

function showEndModal(title, message) {
  const titleEl = document.getElementById('modal-title');
  const msgEl = document.getElementById('modal-message');
  const gameModal = document.getElementById('game-modal');
  if (titleEl) titleEl.textContent = title;
  if (msgEl) msgEl.textContent = message;
  if (gameModal) gameModal.classList.add('active');
}

function openStatsModal() {
  const playedEl = document.getElementById('stat-played');
  const wonEl = document.getElementById('stat-won');
  if (playedEl) playedEl.textContent = stats.played;
  if (wonEl) wonEl.textContent = stats.won;

  const statsModal = document.getElementById('stats-modal');
  if (statsModal) statsModal.classList.add('active');
}

/* ==========================================================================
   EVENT LISTENERS & KEYBOARD BINDINGS
   ========================================================================== */

document.addEventListener('DOMContentLoaded', () => {
  startNewGame(null, true);

  const variantSelect = document.getElementById('variant-select');
  if (variantSelect) {
    variantSelect.addEventListener('change', () => startNewGame(activeDateStr));
  }

  const btnPause = document.getElementById('btn-pause');
  const btnNotes = document.getElementById('btn-notes');
  const btnAutoNotes = document.getElementById('btn-auto-notes');
  const btnZen = document.getElementById('btn-zen');
  const btnNew = document.getElementById('btn-new');
  const btnDaily = document.getElementById('btn-daily');
  const btnErase = document.getElementById('btn-erase');
  const btnUndo = document.getElementById('btn-undo');
  const btnHint = document.getElementById('btn-hint');
  const btnStats = document.getElementById('btn-stats');
  const difficultyEl = document.getElementById('difficulty');
  const themeToggle = document.getElementById('theme-toggle');

  if (btnPause) btnPause.addEventListener('click', togglePause);
  if (btnNotes) btnNotes.addEventListener('click', toggleNotesMode);
  if (btnAutoNotes) btnAutoNotes.addEventListener('click', autoFillNotes);
  if (btnZen) btnZen.addEventListener('click', toggleZenMode);
  if (btnNew) btnNew.addEventListener('click', () => startNewGame(null));
  if (btnDaily) btnDaily.addEventListener('click', openCalendarModal);
  if (btnErase) btnErase.addEventListener('click', eraseInput);
  if (btnUndo) btnUndo.addEventListener('click', undoMove);
  if (btnHint) btnHint.addEventListener('click', giveHint);
  if (btnStats) btnStats.addEventListener('click', openStatsModal);
  if (difficultyEl) difficultyEl.addEventListener('change', () => startNewGame(activeDateStr));

  // Multiplayer Listeners
  const btnMulti = document.getElementById('btn-multiplayer');
  if (btnMulti) {
    btnMulti.addEventListener('click', () => {
      initMultiplayer();
      document.getElementById('mp-modal').classList.add('active');
    });
  }

  const btnCopyCode = document.getElementById('btn-copy-code');
  if (btnCopyCode) {
    btnCopyCode.addEventListener('click', () => {
      const code = document.getElementById('my-peer-id').textContent;
      navigator.clipboard.writeText(code);
      alert("Room code copied to clipboard!");
    });
  }

  const btnJoinRoom = document.getElementById('btn-join-room');
  if (btnJoinRoom) {
    btnJoinRoom.addEventListener('click', () => {
      const roomCode = document.getElementById('join-room-input').value.trim();
      if (roomCode) joinMultiplayerRoom(roomCode);
    });
  }

  const mpClose = document.getElementById('mp-close-btn');
  if (mpClose) mpClose.addEventListener('click', () => {
    document.getElementById('mp-modal').classList.remove('active');
  });

  const calClose = document.getElementById('calendar-close-btn');
  if (calClose) calClose.addEventListener('click', () => {
    document.getElementById('calendar-modal').classList.remove('active');
  });

  const modalClose = document.getElementById('modal-close-btn');
  if (modalClose) modalClose.addEventListener('click', () => {
    document.getElementById('game-modal').classList.remove('active');
    startNewGame(null);
  });

  const statsClose = document.getElementById('stats-close-btn');
  if (statsClose) statsClose.addEventListener('click', () => {
    document.getElementById('stats-modal').classList.remove('active');
  });

  if (themeToggle) {
    themeToggle.addEventListener('click', () => {
      const isDark = document.body.getAttribute('data-theme') === 'dark';
      if (isDark) {
        document.body.removeAttribute('data-theme');
        themeToggle.textContent = '🌙 Dark';
      } else {
        document.body.setAttribute('data-theme', 'dark');
        themeToggle.textContent = '☀️ Light';
      }
    });
  }

  // Keyboard Navigation Controls
  document.addEventListener('keydown', (e) => {
    if (isPaused) return;
    if (e.key >= '1' && e.key <= String(gridSize)) {
      handleInput(parseInt(e.key));
    } else if (e.key === 'Backspace' || e.key === 'Delete') {
      eraseInput();
    } else if (e.key.toLowerCase() === 'n') {
      toggleNotesMode();
    } else if (e.key === ' ') {
      e.preventDefault();
      togglePause();
    } else if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key)) {
      e.preventDefault();
      let r = selectedCell ? selectedCell.r : 0;
      let c = selectedCell ? selectedCell.c : 0;
      if (e.key === 'ArrowUp') r = (r - 1 + gridSize) % gridSize;
      if (e.key === 'ArrowDown') r = (r + 1) % gridSize;
      if (e.key === 'ArrowLeft') c = (c - 1 + gridSize) % gridSize;
      if (e.key === 'ArrowRight') c = (c + 1) % gridSize;
      selectCell(r, c);
    }
  });
});

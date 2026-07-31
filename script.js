// Game State
let solution = [];
let initialBoard = [];
let currentBoard = [];
let historyStack = [];
let selectedCell = null;
let timerInterval = null;
let secondsElapsed = 0;
let mistakes = 0;
let isPaused = false;
const MAX_MISTAKES = 3;

// Difficulty Limits
let hintsRemaining = 3;
let undosRemaining = 3;

// Lifetime Statistics
let stats = JSON.parse(localStorage.getItem('sudoku_stats')) || {
  played: 0,
  won: 0,
  losses: 0,
  bestTime: null
};

// DOM Elements
const boardEl = document.getElementById('board');
const keypadEl = document.getElementById('keypad');
const timerEl = document.getElementById('timer');
const mistakesEl = document.getElementById('mistakes-count');
const difficultyEl = document.getElementById('difficulty');
const themeToggle = document.getElementById('theme-toggle');
const btnPause = document.getElementById('btn-pause');
const btnUndo = document.getElementById('btn-undo');
const btnHint = document.getElementById('btn-hint');
const pauseOverlay = document.getElementById('pause-overlay');

// Modals
const gameModal = document.getElementById('game-modal');
const statsModal = document.getElementById('stats-modal');

window.onload = () => {
  buildKeypad();
  startNewGame();
  setupEventListeners();
};

function startNewGame() {
  clearInterval(timerInterval);
  secondsElapsed = 0;
  mistakes = 0;
  isPaused = false;

  btnPause.textContent = "Pause";
  boardEl.classList.remove('paused');
  pauseOverlay.classList.remove('active');

  // Set limits based on selected difficulty
  const diff = difficultyEl.value;
  if (diff === 'easy') {
    hintsRemaining = 3;
    undosRemaining = 3;
  } else if (diff === 'medium') {
    hintsRemaining = 2;
    undosRemaining = 2;
  } else {
    hintsRemaining = 1;
    undosRemaining = 1;
  }

  updateActionButtonLabels();
  updateMistakesDisplay();
  updateTimerDisplay();

  timerInterval = setInterval(() => {
    if (!isPaused) {
      secondsElapsed++;
      updateTimerDisplay();
    }
  }, 1000);

  generateSudoku();
  historyStack = [];
  selectedCell = null;
  renderBoard();
}

function updateActionButtonLabels() {
  btnUndo.textContent = `Undo (${undosRemaining})`;
  btnHint.textContent = `Hint (${hintsRemaining})`;

  btnUndo.disabled = undosRemaining <= 0;
  btnHint.disabled = hintsRemaining <= 0;
}

function togglePause() {
  isPaused = !isPaused;

  if (isPaused) {
    btnPause.textContent = "Resume";
    boardEl.classList.add('paused');
    pauseOverlay.classList.add('active');
  } else {
    btnPause.textContent = "Pause";
    boardEl.classList.remove('paused');
    pauseOverlay.classList.remove('active');
  }
}

function updateTimerDisplay() {
  const mins = String(Math.floor(secondsElapsed / 60)).padStart(2, '0');
  const secs = String(secondsElapsed % 60).padStart(2, '0');
  timerEl.textContent = `${mins}:${secs}`;
}

function updateMistakesDisplay() {
  mistakesEl.textContent = `${mistakes}/${MAX_MISTAKES}`;
}

function shuffle(array) {
  let arr = [...array];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

// Fast Generator
function generateSudoku() {
  const base = [
    [1, 2, 3, 4, 5, 6, 7, 8, 9],
    [4, 5, 6, 7, 8, 9, 1, 2, 3],
    [7, 8, 9, 1, 2, 3, 4, 5, 6],
    [2, 3, 1, 5, 6, 4, 8, 9, 7],
    [5, 6, 4, 8, 9, 7, 2, 3, 1],
    [8, 9, 7, 2, 3, 1, 5, 6, 4],
    [3, 1, 2, 6, 4, 5, 9, 7, 8],
    [6, 4, 5, 9, 7, 8, 3, 1, 2],
    [9, 7, 8, 3, 1, 2, 6, 4, 5]
  ];

  const nums = shuffle([1, 2, 3, 4, 5, 6, 7, 8, 9]);
  const map = {};
  for (let i = 1; i <= 9; i++) map[i] = nums[i - 1];

  solution = base.map(row => row.map(val => map[val]));

  for (let b = 0; b < 3; b++) {
    const r = shuffle([0, 1, 2]);
    const sub = r.map(idx => solution[b * 3 + idx]);
    for (let i = 0; i < 3; i++) solution[b * 3 + i] = sub[i];
  }

  for (let b = 0; b < 3; b++) {
    const c = shuffle([0, 1, 2]);
    for (let r = 0; r < 9; r++) {
      const sub = c.map(idx => solution[r][b * 3 + idx]);
      for (let i = 0; i < 3; i++) solution[r][b * 3 + i] = sub[i];
    }
  }

  initialBoard = solution.map(row => [...row]);
  const diff = difficultyEl.value;
  let removeCount = diff === 'easy' ? 35 : diff === 'medium' ? 45 : 54;

  while (removeCount > 0) {
    const r = Math.floor(Math.random() * 9);
    const c = Math.floor(Math.random() * 9);
    if (initialBoard[r][c] !== 0) {
      initialBoard[r][c] = 0;
      removeCount--;
    }
  }

  currentBoard = initialBoard.map(row => [...row]);
}

function renderBoard() {
  boardEl.innerHTML = '';
  for (let r = 0; r < 9; r++) {
    for (let c = 0; c < 9; c++) {
      const cell = document.createElement('div');
      cell.classList.add('cell');
      cell.dataset.row = r;
      cell.dataset.col = c;

      const val = currentBoard[r][c];
      if (val !== 0) {
        cell.textContent = val;
        if (initialBoard[r][c] !== 0) {
          cell.classList.add('given');
        } else {
          cell.classList.add('user-input');
          if (val !== solution[r][c]) {
            cell.classList.add('error');
          }
        }
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

    cell.classList.remove('selected', 'highlight');

    if (cr === r && cc === c) {
      cell.classList.add('selected');
    } else if (
      cr === r || 
      cc === c || 
      (Math.floor(cr / 3) === Math.floor(r / 3) && Math.floor(cc / 3) === Math.floor(c / 3)) ||
      (selectedVal !== 0 && currentBoard[cr][cc] === selectedVal)
    ) {
      cell.classList.add('highlight');
    }
  });
}

function buildKeypad() {
  keypadEl.innerHTML = '';
  for (let i = 1; i <= 9; i++) {
    const key = document.createElement('button');
    key.classList.add('key');
    key.textContent = i;
    key.addEventListener('click', () => handleInput(i));
    keypadEl.appendChild(key);
  }
}

function handleInput(num) {
  if (isPaused || !selectedCell) return;
  const { r, c } = selectedCell;

  if (initialBoard[r][c] !== 0) return;

  if (currentBoard[r][c] !== num) {
    historyStack.push({ r, c, prevVal: currentBoard[r][c] });
    currentBoard[r][c] = num;

    if (num !== solution[r][c]) {
      mistakes++;
      updateMistakesDisplay();
      if (mistakes >= MAX_MISTAKES) {
        endGame(false);
        return;
      }
    }

    renderBoard();
    selectCell(r, c);
    checkWinCondition();
  }
}

function eraseInput() {
  if (isPaused || !selectedCell) return;
  const { r, c } = selectedCell;
  if (initialBoard[r][c] !== 0) return;

  if (currentBoard[r][c] !== 0) {
    historyStack.push({ r, c, prevVal: currentBoard[r][c] });
    currentBoard[r][c] = 0;
    renderBoard();
    selectCell(r, c);
  }
}

function undoMove() {
  if (isPaused || historyStack.length === 0 || undosRemaining <= 0) return;

  const lastMove = historyStack.pop();
  currentBoard[lastMove.r][lastMove.c] = lastMove.prevVal;
  
  undosRemaining--;
  updateActionButtonLabels();

  renderBoard();
  selectCell(lastMove.r, lastMove.c);
}

function giveHint() {
  if (isPaused || !selectedCell || hintsRemaining <= 0) return;
  const { r, c } = selectedCell;

  if (initialBoard[r][c] !== 0 || currentBoard[r][c] === solution[r][c]) return;

  historyStack.push({ r, c, prevVal: currentBoard[r][c] });
  currentBoard[r][c] = solution[r][c];

  hintsRemaining--;
  updateActionButtonLabels();

  renderBoard();
  selectCell(r, c);
  checkWinCondition();
}

function checkWinCondition() {
  for (let r = 0; r < 9; r++) {
    for (let c = 0; c < 9; c++) {
      if (currentBoard[r][c] !== solution[r][c]) return;
    }
  }
  endGame(true);
}

function endGame(isWin) {
  clearInterval(timerInterval);
  stats.played++;

  if (isWin) {
    stats.won++;
    if (!stats.bestTime || secondsElapsed < stats.bestTime) {
      stats.bestTime = secondsElapsed;
    }
    showEndModal("🎉 Victory!", `You solved the puzzle in ${timerEl.textContent}!`);
  } else {
    stats.losses++;
    showEndModal("❌ Game Over", "You made 3 mistakes and lost.");
  }

  localStorage.setItem('sudoku_stats', JSON.stringify(stats));
}

function showEndModal(title, message) {
  document.getElementById('modal-title').textContent = title;
  document.getElementById('modal-message').textContent = message;
  gameModal.classList.add('active');
}

function openStatsModal() {
  document.getElementById('stat-played').textContent = stats.played;
  document.getElementById('stat-won').textContent = stats.won;
  
  const winRate = stats.played > 0 ? Math.round((stats.won / stats.played) * 100) : 0;
  document.getElementById('stat-winrate').textContent = `${winRate}%`;

  if (stats.bestTime) {
    const mins = String(Math.floor(stats.bestTime / 60)).padStart(2, '0');
    const secs = String(stats.bestTime % 60).padStart(2, '0');
    document.getElementById('stat-besttime').textContent = `${mins}:${secs}`;
  } else {
    document.getElementById('stat-besttime').textContent = '--:--';
  }

  statsModal.classList.add('active');
}

function setupEventListeners() {
  btnPause.addEventListener('click', togglePause);
  document.getElementById('btn-new').addEventListener('click', startNewGame);
  document.getElementById('btn-erase').addEventListener('click', eraseInput);
  btnUndo.addEventListener('click', undoMove);
  btnHint.addEventListener('click', giveHint);
  document.getElementById('btn-stats').addEventListener('click', openStatsModal);
  difficultyEl.addEventListener('change', startNewGame);

  document.getElementById('modal-close-btn').addEventListener('click', () => {
    gameModal.classList.remove('active');
    startNewGame();
  });

  document.getElementById('stats-close-btn').addEventListener('click', () => {
    statsModal.classList.remove('active');
  });

  document.addEventListener('keydown', (e) => {
    if (isPaused || !selectedCell) return;
    if (e.key >= '1' && e.key <= '9') {
      handleInput(parseInt(e.key));
    } else if (e.key === 'Backspace' || e.key === 'Delete') {
      eraseInput();
    } else if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key)) {
      let { r, c } = selectedCell;
      if (e.key === 'ArrowUp') r = (r - 1 + 9) % 9;
      if (e.key === 'ArrowDown') r = (r + 1) % 9;
      if (e.key === 'ArrowLeft') c = (c - 1 + 9) % 9;
      if (e.key === 'ArrowRight') c = (c + 1) % 9;
      selectCell(r, c);
    }
  });

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
    

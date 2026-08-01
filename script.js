// Game State Variables
let solution = [];
let initialBoard = [];
let currentBoard = [];
let notesBoard = []; // 9x9 array containing Sets of candidate numbers
let historyStack = [];
let selectedCell = null;
let timerInterval = null;
let secondsElapsed = 0;
let mistakes = 0;
let isPaused = false;
let isNotesMode = false;
let isDailyChallenge = false;
const MAX_MISTAKES = 3;

// Limits per difficulty
let hintsRemaining = 2;
let undosRemaining = 2;

// Performance Statistics Storage
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
const btnNotes = document.getElementById('btn-notes');
const btnUndo = document.getElementById('btn-undo');
const btnHint = document.getElementById('btn-hint');
const btnDaily = document.getElementById('btn-daily');
const btnPrint = document.getElementById('btn-print');
const pauseOverlay = document.getElementById('pause-overlay');
const confettiCanvas = document.getElementById('confetti-canvas');

const gameModal = document.getElementById('game-modal');
const statsModal = document.getElementById('stats-modal');

// Audio Synthesizer via Web Audio API
const audioCtx = new (window.AudioContext || window.webkitAudioContext)();

function playSound(type) {
  if (audioCtx.state === 'suspended') audioCtx.resume();
  const osc = audioCtx.createOscillator();
  const gain = audioCtx.createGain();
  osc.connect(gain);
  gain.connect(audioCtx.destination);

  if (type === 'click') {
    osc.frequency.setValueAtTime(400, audioCtx.currentTime);
    gain.gain.setValueAtTime(0.05, audioCtx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.08);
    osc.start();
    osc.stop(audioCtx.currentTime + 0.08);
  } else if (type === 'error') {
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(150, audioCtx.currentTime);
    gain.gain.setValueAtTime(0.1, audioCtx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.2);
    osc.start();
    osc.stop(audioCtx.currentTime + 0.2);
  } else if (type === 'win') {
    const notes = [261.63, 329.63, 392.00, 523.25];
    notes.forEach((freq, idx) => {
      const subOsc = audioCtx.createOscillator();
      const subGain = audioCtx.createGain();
      subOsc.connect(subGain);
      subGain.connect(audioCtx.destination);
      subOsc.frequency.setValueAtTime(freq, audioCtx.currentTime + idx * 0.12);
      subGain.gain.setValueAtTime(0.08, audioCtx.currentTime + idx * 0.12);
      subGain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + idx * 0.12 + 0.25);
      subOsc.start(audioCtx.currentTime + idx * 0.12);
      subOsc.stop(audioCtx.currentTime + idx * 0.12 + 0.25);
    });
  }
}

window.onload = () => {
  buildKeypad();
  startNewGame(false);
  setupEventListeners();
};

function startNewGame(daily = false) {
  clearInterval(timerInterval);
  secondsElapsed = 0;
  mistakes = 0;
  isPaused = false;
  isNotesMode = false;
  isDailyChallenge = daily;

  btnPause.textContent = "Pause";
  btnNotes.textContent = "Notes (OFF)";
  btnNotes.classList.remove('btn-active-mode');
  boardEl.classList.remove('paused');
  pauseOverlay.classList.remove('active');

  const diff = difficultyEl.value;
  if (diff === 'easy') { hintsRemaining = 3; undosRemaining = 3; }
  else if (diff === 'medium') { hintsRemaining = 2; undosRemaining = 2; }
  else { hintsRemaining = 1; undosRemaining = 1; }

  updateActionButtonLabels();
  updateMistakesDisplay();
  updateTimerDisplay();

  timerInterval = setInterval(() => {
    if (!isPaused) {
      secondsElapsed++;
      updateTimerDisplay();
    }
  }, 1000);

  generateSudoku(daily);
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
  playSound('click');
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

function toggleNotesMode() {
  playSound('click');
  isNotesMode = !isNotesMode;
  btnNotes.textContent = `Notes (${isNotesMode ? 'ON' : 'OFF'})`;
  btnNotes.classList.toggle('btn-active-mode', isNotesMode);
}

function updateTimerDisplay() {
  const mins = String(Math.floor(secondsElapsed / 60)).padStart(2, '0');
  const secs = String(secondsElapsed % 60).padStart(2, '0');
  timerEl.textContent = `${mins}:${secs}`;
}

function updateMistakesDisplay() {
  mistakesEl.textContent = `${mistakes}/${MAX_MISTAKES}`;
}

// Pseudo Random Number Generator for Daily Challenge
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

function generateSudoku(daily = false) {
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

  let seed = null;
  if (daily) {
    const today = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    seed = parseInt(today, 10);
  }

  const nums = shuffle([1, 2, 3, 4, 5, 6, 7, 8, 9], seed);
  const map = {};
  for (let i = 1; i <= 9; i++) map[i] = nums[i - 1];

  solution = base.map(row => row.map(val => map[val]));

  for (let b = 0; b < 3; b++) {
    const r = shuffle([0, 1, 2], seed ? seed + b : null);
    const sub = r.map(idx => solution[b * 3 + idx]);
    for (let i = 0; i < 3; i++) solution[b * 3 + i] = sub[i];
  }

  initialBoard = solution.map(row => [...row]);
  const diff = difficultyEl.value;
  let removeCount = diff === 'easy' ? 35 : diff === 'medium' ? 45 : 54;

  let step = 0;
  while (removeCount > 0) {
    step++;
    const r = Math.floor((seed ? seededRandom(seed + step) : Math.random()) * 9);
    const c = Math.floor((seed ? seededRandom(seed + step + 100) : Math.random()) * 9);
    if (initialBoard[r][c] !== 0) {
      initialBoard[r][c] = 0;
      removeCount--;
    }
  }

  currentBoard = initialBoard.map(row => [...row]);
  notesBoard = Array.from({ length: 9 }, () => Array.from({ length: 9 }, () => new Set()));
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
      const notes = notesBoard[r][c];

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
      } else if (notes.size > 0) {
        const notesGrid = document.createElement('div');
        notesGrid.classList.add('notes-grid');
        for (let i = 1; i <= 9; i++) {
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
  playSound('click');
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

  if (isNotesMode) {
    if (currentBoard[r][c] === 0) {
      playSound('click');
      if (notesBoard[r][c].has(num)) {
        notesBoard[r][c].delete(num);
      } else {
        notesBoard[r][c].add(num);
      }
      renderBoard();
      selectCell(r, c);
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
      playSound('error');
      mistakes++;
      updateMistakesDisplay();
      if (mistakes >= MAX_MISTAKES) {
        endGame(false);
        return;
      }
    } else {
      playSound('click');
      autoClearNotes(r, c, num);
    }

    renderBoard();
    selectCell(r, c);
    checkWinCondition();
  }
}

// Smart Auto-Clear Notes in Row, Column, and Box
function autoClearNotes(r, c, num) {
  for (let i = 0; i < 9; i++) {
    notesBoard[r][i].delete(num);
    notesBoard[i][c].delete(num);
  }

  const boxStartRow = Math.floor(r / 3) * 3;
  const boxStartCol = Math.floor(c / 3) * 3;
  for (let br = 0; br < 3; br++) {
    for (let bc = 0; bc < 3; bc++) {
      notesBoard[boxStartRow + br][boxStartCol + bc].delete(num);
    }
  }
}

function eraseInput() {
  if (isPaused || !selectedCell) return;
  playSound('click');
  const { r, c } = selectedCell;
  if (initialBoard[r][c] !== 0) return;

  if (currentBoard[r][c] !== 0 || notesBoard[r][c].size > 0) {
    historyStack.push({ 
      r, c, 
      prevVal: currentBoard[r][c],
      prevNotes: new Set(notesBoard[r][c])
    });
    currentBoard[r][c] = 0;
    notesBoard[r][c].clear();
    renderBoard();
    selectCell(r, c);
  }
}

function undoMove() {
  if (isPaused || historyStack.length === 0 || undosRemaining <= 0) return;
  playSound('click');

  const lastMove = historyStack.pop();
  currentBoard[lastMove.r][lastMove.c] = lastMove.prevVal;
  notesBoard[lastMove.r][lastMove.c] = lastMove.prevNotes;
  
  undosRemaining--;
  updateActionButtonLabels();

  renderBoard();
  selectCell(lastMove.r, lastMove.c);
}

function giveHint() {
  if (isPaused || !selectedCell || hintsRemaining <= 0) return;
  const { r, c } = selectedCell;

  if (initialBoard[r][c] !== 0 || currentBoard[r][c] === solution[r][c]) return;
  playSound('click');

  historyStack.push({ 
    r, c, 
    prevVal: currentBoard[r][c],
    prevNotes: new Set(notesBoard[r][c])
  });

  currentBoard[r][c] = solution[r][c];
  notesBoard[r][c].clear();
  autoClearNotes(r, c, solution[r][c]);

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
    playSound('win');
    triggerConfetti();
    stats.won++;
    if (!stats.bestTime || secondsElapsed < stats.bestTime) {
      stats.bestTime = secondsElapsed;
    }
    showEndModal("🎉 Victory!", `You solved the puzzle in ${timerEl.textContent}!`);
  } else {
    stats.losses++;
    showEndModal("❌ Game Over", "You reached 3 mistakes and lost.");
  }

  localStorage.setItem('sudoku_stats', JSON.stringify(stats));
}

function triggerConfetti() {
  const ctx = confettiCanvas.getContext('2d');
  confettiCanvas.width = window.innerWidth;
  confettiCanvas.height = window.innerHeight;

  const particles = Array.from({ length: 80 }, () => ({
    x: Math.random() * confettiCanvas.width,
    y: Math.random() * confettiCanvas.height - confettiCanvas.height,
    color: `hsl(${Math.random() * 360}, 100%, 50%)`,
    size: Math.random() * 8 + 4,
    speedY: Math.random() * 4 + 2,
    speedX: Math.random() * 2 - 1
  }));

  let frame = 0;
  function render() {
    ctx.clearRect(0, 0, confettiCanvas.width, confettiCanvas.height);
    particles.forEach(p => {
      p.y += p.speedY;
      p.x += p.speedX;
      ctx.fillStyle = p.color;
      ctx.fillRect(p.x, p.y, p.size, p.size);
    });
    frame++;
    if (frame < 160) requestAnimationFrame(render);
    else ctx.clearRect(0, 0, confettiCanvas.width, confettiCanvas.height);
  }
  render();
}

function showEndModal(title, message) {
  document.getElementById('modal-title').textContent = title;
  document.getElementById('modal-message').textContent = message;
  gameModal.classList.add('active');
}

function openStatsModal() {
  playSound('click');
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
  btnNotes.addEventListener('click', toggleNotesMode);
  document.getElementById('btn-new').addEventListener('click', () => startNewGame(false));
  btnDaily.addEventListener('click', () => startNewGame(true));
  btnPrint.addEventListener('click', () => window.print());
  document.getElementById('btn-erase').addEventListener('click', eraseInput);
  btnUndo.addEventListener('click', undoMove);
  btnHint.addEventListener('click', giveHint);
  document.getElementById('btn-stats').addEventListener('click', openStatsModal);
  difficultyEl.addEventListener('change', () => startNewGame(isDailyChallenge));

  document.getElementById('modal-close-btn').addEventListener('click', () => {
    gameModal.classList.remove('active');
    startNewGame(false);
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
    } else if (e.key.toLowerCase() === 'n') {
      toggleNotesMode();
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
    playSound('click');
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

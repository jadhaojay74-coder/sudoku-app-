let timerInterval = null;
let secondsElapsed = 0;
let isPaused = false;
let isNoteMode = false;
let selectedIndex = 0;
let hintsRemaining = 3;
let mistakesCount = 0;
let maxMistakes = 3;
let gridDimension = 9;
let performanceChart = null;

let soundEnabled = true;
let vibeEnabled = true;

const hintRules = { simple: 3, medium: 2, hard: 1, expert: 0 };

const base9x9 = [
  [5,3,4,6,7,8,9,1,2],[6,7,2,1,9,5,3,4,8],[1,9,8,3,4,2,5,6,7],
  [8,5,9,7,6,1,4,2,3],[4,2,6,8,5,3,7,9,1],[7,1,3,9,2,4,8,5,6],
  [9,6,1,5,3,7,2,8,4],[2,8,7,4,1,9,6,3,5],[3,4,5,2,8,6,1,7,9]
];

const base3x3 = [
  [1,2,3],
  [2,3,1],
  [3,1,2]
];

let currentSolution = [];
let currentBoard = [];
let initialMask = [];
let cellNotes = [];

// Audio Synthesizer
const audioCtx = new (window.AudioContext || window.webkitAudioContext)();

function playSound(type) {
  if (!soundEnabled) return;
  if (audioCtx.state === 'suspended') audioCtx.resume();

  const osc = audioCtx.createOscillator();
  const gain = audioCtx.createGain();
  osc.connect(gain);
  gain.connect(audioCtx.destination);

  const now = audioCtx.currentTime;

  if (type === 'click') {
    osc.frequency.setValueAtTime(600, now);
    gain.gain.setValueAtTime(0.1, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.05);
    osc.start(now);
    osc.stop(now + 0.05);
  } else if (type === 'error') {
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(150, now);
    gain.gain.setValueAtTime(0.2, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.25);
    osc.start(now);
    osc.stop(now + 0.25);
  } else if (type === 'gameover') {
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(200, now);
    osc.frequency.exponentialRampToValueAtTime(80, now + 0.5);
    gain.gain.setValueAtTime(0.3, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.5);
    osc.start(now);
    osc.stop(now + 0.5);
  } else if (type === 'win') {
    osc.frequency.setValueAtTime(440, now);
    osc.frequency.setValueAtTime(554.37, now + 0.1);
    osc.frequency.setValueAtTime(659.25, now + 0.2);
    gain.gain.setValueAtTime(0.2, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.4);
    osc.start(now);
    osc.stop(now + 0.4);
  }
}

function triggerVibrate(ms = 30) {
  if (vibeEnabled && navigator.vibrate) {
    navigator.vibrate(ms);
  }
}

document.addEventListener('DOMContentLoaded', () => {
  setupKeyboardListeners();
  if (!loadGameState()) {
    startNewGame();
  }
});

function switchTab(tabId, btn) {
  document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
  document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
  document.getElementById(tabId).classList.add('active');
  btn.classList.add('active');

  if (tabId === 'status-view') {
    setTimeout(() => {
      if (!performanceChart) initChart();
      else { performanceChart.resize(); updateChart(); }
    }, 50);
  }
}

function toggleTheme() {
  const current = document.body.getAttribute('data-theme');
  const next = current === 'dark' ? 'light' : 'dark';
  document.body.setAttribute('data-theme', next);
  document.getElementById('theme-btn').innerText = next === 'dark' ? '☀️ Light' : '🌙 Dark';
  saveGameState();
}

function toggleSoundSetting(val) { soundEnabled = val; saveGameState(); }
function toggleVibeSetting(val) { vibeEnabled = val; saveGameState(); }

function changeGridMode() {
  const mode = document.getElementById('grid-size').value;
  gridDimension = mode === '3x3' ? 3 : 9;
  startNewGame();
}

function startNewGame() {
  const diff = document.getElementById('difficulty').value;
  hintsRemaining = hintRules[diff];
  maxMistakes = diff === 'expert' ? 2 : 3;
  mistakesCount = 0;

  document.getElementById('hint-count').innerText = hintsRemaining;
  document.getElementById('mistake-count').innerText = `0/${maxMistakes}`;

  secondsElapsed = 0;
  isPaused = false;
  
  const overlay = document.getElementById('game-overlay');
  overlay.classList.remove('active');

  generateLevel(diff);
  initBoardUI();
  renderBoard();
  renderNumpad();
  startTimer();
  saveGameState();
}

function generateLevel(diff) {
  if (gridDimension === 9) {
    currentSolution = JSON.parse(JSON.stringify(base9x9));
    const map = [1,2,3,4,5,6,7,8,9].sort(() => Math.random() - 0.5);
    for(let r=0; r<9; r++) {
      for(let c=0; c<9; c++) {
        currentSolution[r][c] = map[currentSolution[r][c] - 1];
      }
    }
    const hiddenCounts = { simple: 25, medium: 40, hard: 50, expert: 58 };
    hideCells(hiddenCounts[diff] || 40);
  } else {
    currentSolution = JSON.parse(JSON.stringify(base3x3));
    const map = [1,2,3].sort(() => Math.random() - 0.5);
    for(let r=0; r<3; r++) {
      for(let c=0; c<3; c++) {
        currentSolution[r][c] = map[currentSolution[r][c] - 1];
      }
    }
    const hiddenCounts = { simple: 3, medium: 4, hard: 5, expert: 6 };
    hideCells(hiddenCounts[diff] || 4);
  }
  cellNotes = Array.from({ length: gridDimension * gridDimension }, () => new Set());
}

function hideCells(count) {
  currentBoard = JSON.parse(JSON.stringify(currentSolution));
  initialMask = Array.from({ length: gridDimension }, () => Array(gridDimension).fill(true));
  let hidden = 0;
  while (hidden < count) {
    let r = Math.floor(Math.random() * gridDimension);
    let c = Math.floor(Math.random() * gridDimension);
    if (currentBoard[r][c] !== 0) {
      currentBoard[r][c] = 0;
      initialMask[r][c] = false;
      hidden++;
    }
  }
}

function initBoardUI() {
  const container = document.getElementById('board-container');
  container.className = `board-container grid-${gridDimension}x${gridDimension}`;
  container.innerHTML = '<div class="overlay-screen" id="game-overlay"></div>';

  const totalCells = gridDimension * gridDimension;
  for (let i = 0; i < totalCells; i++) {
    const row = Math.floor(i / gridDimension);
    const col = i % gridDimension;
    
    const cell = document.createElement('div');
    cell.className = 'cell';

    if (gridDimension === 9) {
      if ((col + 1) % 3 === 0 && col !== 8) cell.classList.add('box-right');
      if ((row + 1) % 3 === 0 && row !== 8) cell.classList.add('box-bottom');
    }

    cell.dataset.index = i;
    cell.onclick = () => selectCell(i);
    container.appendChild(cell);
  }
  selectedIndex = 0;
}

function renderNumpad() {
  const container = document.getElementById('numpad');
  container.innerHTML = '';

  for (let num = 1; num <= gridDimension; num++) {
    const btn = document.createElement('button');
    btn.className = 'btn';
    btn.id = `numpad-${num}`;
    btn.innerText = num;
    btn.onclick = () => inputNumber(num);
    container.appendChild(btn);
  }
  updateNumpadState();
}

// Block completed numbers and add checkmark (✓)
function updateNumpadState() {
  for (let num = 1; num <= gridDimension; num++) {
    let count = 0;
    for (let r = 0; r < gridDimension; r++) {
      for (let c = 0; c < gridDimension; c++) {
        if (currentBoard[r][c] === num && currentSolution[r][c] === num) {
          count++;
        }
      }
    }
    const btn = document.getElementById(`numpad-${num}`);
    if (btn) {
      if (count === gridDimension) {
        btn.innerHTML = `${num} ✓`;
        btn.classList.add('completed');
      } else {
        btn.innerText = num;
        btn.classList.remove('completed');
      }
    }
  }
}

function renderBoard() {
  const cells = document.querySelectorAll('#board-container .cell');
  cells.forEach((cell, i) => {
    const r = Math.floor(i / gridDimension);
    const c = i % gridDimension;
    const val = currentBoard[r][c];

    cell.className = 'cell';
    if (gridDimension === 9) {
      if ((c + 1) % 3 === 0 && c !== 8) cell.classList.add('box-right');
      if ((r + 1) % 3 === 0 && r !== 8) cell.classList.add('box-bottom');
    }
    cell.innerHTML = '';

    if (val !== 0) {
      cell.innerText = val;
      if (initialMask[r][c]) {
        cell.classList.add('given');
      } else if (val !== currentSolution[r][c]) {
        cell.classList.add('invalid');
      } else {
        cell.classList.add('user-entered');
      }
    } else if (cellNotes[i] && cellNotes[i].size > 0) {
      const noteGrid = document.createElement('div');
      noteGrid.className = 'notes-grid';
      for (let n = 1; n <= gridDimension; n++) {
        const sub = document.createElement('div');
        sub.innerText = cellNotes[i].has(n) ? n : '';
        noteGrid.appendChild(sub);
      }
      cell.appendChild(noteGrid);
    }
  });
  highlightGrid();
  updateNumpadState();
}

function selectCell(index) {
  if (isPaused) return;
  playSound('click');
  triggerVibrate(15);
  selectedIndex = index;
  highlightGrid();
}

function highlightGrid() {
  const cells = document.querySelectorAll('#board-container .cell');
  if (!cells.length) return;

  const r = Math.floor(selectedIndex / gridDimension);
  const c = selectedIndex % gridDimension;
  const val = currentBoard[r]?.[c];

  cells.forEach((cell, i) => {
    cell.classList.remove('selected', 'related', 'same-val');
    const cr = Math.floor(i / gridDimension);
    const cc = i % gridDimension;
    const cVal = currentBoard[cr][cc];

    if (i === selectedIndex) {
      cell.classList.add('selected');
    } else if (cr === r || cc === c || (gridDimension === 9 && Math.floor(cr/3) === Math.floor(r/3) && Math.floor(cc/3) === Math.floor(c/3))) {
      cell.classList.add('related');
    }

    if (val !== 0 && cVal === val) {
      cell.classList.add('same-val');
    }
  });
}

function inputNumber(num) {
  if (isPaused) return;
  const r = Math.floor(selectedIndex / gridDimension);
  const c = selectedIndex % gridDimension;

  if (initialMask[r][c]) return;

  if (isNoteMode) {
    playSound('click');
    triggerVibrate(15);
    if (cellNotes[selectedIndex].has(num)) cellNotes[selectedIndex].delete(num);
    else cellNotes[selectedIndex].add(num);
  } else {
    currentBoard[r][c] = num;
    cellNotes[selectedIndex].clear();

    if (num !== currentSolution[r][c]) {
      mistakesCount++;
      playSound('error');
      triggerVibrate([50, 50, 100]);
      document.getElementById('mistake-count').innerText = `${mistakesCount}/${maxMistakes}`;

      if (mistakesCount >= maxMistakes) {
        triggerGameOver();
        return;
      }
    } else {
      playSound('click');
      triggerVibrate(20);
      checkWinCondition();
    }
  }
  renderBoard();
  saveGameState();
}

function triggerGameOver() {
  clearInterval(timerInterval);
  playSound('gameover');
  
  const diff = document.getElementById('difficulty').value;
  recordGameOutcome(diff, 'loss');

  const overlay = document.getElementById('game-overlay');
  overlay.innerHTML = `<div>Game Over ❌</div><div style="font-size: 0.9rem; margin-top: 10px;">Too many mistakes made!</div>`;
  overlay.classList.add('active');

  setTimeout(() => {
    startNewGame();
  }, 2200);
}

function checkWinCondition() {
  for (let r = 0; r < gridDimension; r++) {
    for (let c = 0; c < gridDimension; c++) {
      if (currentBoard[r][c] !== currentSolution[r][c]) return;
    }
  }
  
  clearInterval(timerInterval);
  playSound('win');
  
  const diff = document.getElementById('difficulty').value;
  recordGameOutcome(diff, 'win');

  const overlay = document.getElementById('game-overlay');
  overlay.innerHTML = `<div>Victory! 🎉</div><div style="font-size: 0.9rem; margin-top: 10px;">Solved in ${secondsElapsed} seconds!</div>`;
  overlay.classList.add('active');
}

function eraseCell() {
  if (isPaused) return;
  const r = Math.floor(selectedIndex / gridDimension);
  const c = selectedIndex % gridDimension;

  if (initialMask[r][c]) return;

  playSound('click');
  triggerVibrate(15);
  currentBoard[r][c] = 0;
  cellNotes[selectedIndex].clear();
  renderBoard();
  saveGameState();
}

function toggleNoteMode() {
  playSound('click');
  isNoteMode = !isNoteMode;
  const btn = document.getElementById('note-btn');
  btn.innerText = `Note ✏️ (${isNoteMode ? 'ON' : 'OFF'})`;
  btn.classList.toggle('active', isNoteMode);
}

function useHint() {
  if (isPaused || hintsRemaining <= 0) return;
  const r = Math.floor(selectedIndex / gridDimension);
  const c = selectedIndex % gridDimension;

  if (currentBoard[r][c] !== 0 && currentBoard[r][c] === currentSolution[r][c]) return;

  playSound('click');
  currentBoard[r][c] = currentSolution[r][c];
  hintsRemaining--;
  document.getElementById('hint-count').innerText = hintsRemaining;
  renderBoard();
  checkWinCondition();
  saveGameState();
}

function startTimer() {
  clearInterval(timerInterval);
  timerInterval = setInterval(() => {
    if (!isPaused) {
      secondsElapsed++;
      const mins = String(Math.floor(secondsElapsed / 60)).padStart(2, '0');
      const secs = String(secondsElapsed % 60).padStart(2, '0');
      document.getElementById('timer').innerText = `${mins}:${secs}`;
    }
  }, 1000);
}

function togglePause() {
  playSound('click');
  isPaused = !isPaused;
  const overlay = document.getElementById('game-overlay');
  const btn = document.getElementById('pause-btn');

  if (isPaused) {
    overlay.innerText = 'Game Paused ⏸️';
    overlay.classList.add('active');
    btn.innerText = 'Resume ▶️';
  } else {
    overlay.classList.remove('active');
    btn.innerText = 'Pause ⏸️';
  }
  saveGameState();
}

function setupKeyboardListeners() {
  document.addEventListener('keydown', (e) => {
    if (isPaused) return;

    const row = Math.floor(selectedIndex / gridDimension);
    const col = selectedIndex % gridDimension;

    if (e.key === 'ArrowUp' && row > 0) selectedIndex -= gridDimension;
    else if (e.key === 'ArrowDown' && row < gridDimension - 1) selectedIndex += gridDimension;
    else if (e.key === 'ArrowLeft' && col > 0) selectedIndex -= 1;
    else if (e.key === 'ArrowRight' && col < gridDimension - 1) selectedIndex += 1;
    else if (e.key >= '1' && e.key <= String(gridDimension)) inputNumber(parseInt(e.key));
    else if (e.key === 'Backspace' || e.key === 'Delete') eraseCell();
    else if (e.key.toLowerCase() === 'n') toggleNoteMode();
    else if (e.key.toLowerCase() === 'p') togglePause();

    highlightGrid();
  });
}

// Win/Loss Rating Tracking Logic per Difficulty
function recordGameOutcome(difficulty, result) {
  const ratings = JSON.parse(localStorage.getItem('sudoku_ratings') || '{}');
  if (!ratings[difficulty]) {
    ratings[difficulty] = [1000];
  }
  
  const currentDiffRatings = ratings[difficulty];
  const lastScore = currentDiffRatings[currentDiffRatings.length - 1];

  let newScore = lastScore;
  if (result === 'win') {
    newScore += 100;
  } else if (result === 'loss') {
    newScore = Math.max(0, lastScore - 50);
  }

  currentDiffRatings.push(newScore);
  ratings[difficulty] = currentDiffRatings;
  localStorage.setItem('sudoku_ratings', JSON.stringify(ratings));

  if (performanceChart) updateChart();
}

function saveGameState() {
  const state = {
    gridDimension,
    secondsElapsed,
    isPaused,
    hintsRemaining,
    mistakesCount,
    maxMistakes,
    currentBoard,
    currentSolution,
    initialMask,
    soundEnabled,
    vibeEnabled,
    difficulty: document.getElementById('difficulty').value,
    theme: document.body.getAttribute('data-theme') || 'light',
    cellNotes: cellNotes.map(set => Array.from(set))
  };
  localStorage.setItem('sudoku_master_state', JSON.stringify(state));
}

function loadGameState() {
  const saved = localStorage.getItem('sudoku_master_state');
  if (!saved) return false;

  try {
    const state = JSON.parse(saved);
    gridDimension = state.gridDimension || 9;
    secondsElapsed = state.secondsElapsed || 0;
    hintsRemaining = state.hintsRemaining ?? 3;
    mistakesCount = state.mistakesCount || 0;
    maxMistakes = state.maxMistakes || (state.difficulty === 'expert' ? 2 : 3);
    currentBoard = state.currentBoard;
    currentSolution = state.currentSolution;
    initialMask = state.initialMask || Array.from({ length: gridDimension }, () => Array(gridDimension).fill(false));
    cellNotes = state.cellNotes.map(arr => new Set(arr));
    soundEnabled = state.soundEnabled ?? true;
    vibeEnabled = state.vibeEnabled ?? true;

    document.getElementById('sound-toggle').checked = soundEnabled;
    document.getElementById('vibe-toggle').checked = vibeEnabled;
    document.getElementById('grid-size').value = `${gridDimension}x${gridDimension}`;
    document.getElementById('difficulty').value = state.difficulty || 'medium';
    document.getElementById('hint-count').innerText = hintsRemaining;
    document.getElementById('mistake-count').innerText = `${mistakesCount}/${maxMistakes}`;

    if (state.theme === 'dark') {
      document.body.setAttribute('data-theme', 'dark');
      document.getElementById('theme-btn').innerText = '☀️ Light';
    }

    initBoardUI();
    renderBoard();
    renderNumpad();
    startTimer();
    return true;
  } catch (e) {
    return false;
  }
}

function clearSavedData() {
  localStorage.removeItem('sudoku_master_state');
  localStorage.removeItem('sudoku_ratings');
  alert('Game ratings and history reset!');
  startNewGame();
}

// Chart.js initialization with Difficulty Level Switch support
function initChart() {
  const ctx = document.getElementById('performanceChart').getContext('2d');
  
  performanceChart = new Chart(ctx, {
    type: 'line',
    data: {
      labels: [],
      datasets: [{
        label: 'Skill Score Rating',
        data: [],
        borderColor: '#3498db',
        borderWidth: 3,
        tension: 0.3,
        fill: true,
        backgroundColor: 'rgba(52, 152, 219, 0.15)'
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false
    }
  });

  updateChart();
}

function updateChart() {
  if (!performanceChart) return;

  const diff = document.getElementById('chart-difficulty').value;
  const ratings = JSON.parse(localStorage.getItem('sudoku_ratings') || '{}');
  const diffData = ratings[diff] || [1000];

  const labels = diffData.map((_, i) => i === 0 ? 'Start' : `Game #${i}`);

  performanceChart.data.labels = labels;
  performanceChart.data.datasets[0].data = diffData;
  performanceChart.update();
}

// State Management
let gridDim = 9;
let solutionGrid = [];
let initialGrid = [];
let userGrid = [];
let notesGrid = [];

let selectedCell = null;
let noteMode = false;
let isPaused = false;
let timerInterval = null;
let secondsElapsed = 0;
let mistakes = 0;
let maxMistakes = 3;
let hintsRemaining = 3;
let analyticsChart = null;

// Initialization
document.addEventListener("DOMContentLoaded", () => {
  loadSettings();
  initNumpad();
  startNewGame();
  setupAnalyticsChart();
  setupDifficultyListener();
});

// Tab Switching (Works with both status-view and status-tab)
function switchTab(tabId, btnElement) {
  document.querySelectorAll('.nav-btn').forEach(btn => btn.classList.remove('active'));
  if (btnElement) btnElement.classList.add('active');

  document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
  document.querySelectorAll('.tab-content').forEach(t => t.style.display = 'none');

  if (tabId === 'game-view') {
    document.getElementById('game-view').classList.add('active');
  } else if (tabId === 'status-view' || tabId === 'status-tab') {
    const statusTab = document.getElementById('status-tab');
    if (statusTab) statusTab.style.display = 'block';
    renderAnalytics();
  } else if (tabId === 'settings-view') {
    document.getElementById('settings-view').classList.add('active');
  }
}

// Mode & Difficulty Handlers
function changeGridMode() {
  const mode = document.getElementById("grid-size").value;
  gridDim = mode === "3x3" ? 3 : 9;
  initNumpad();
  startNewGame();
}

function startNewGame() {
  const diff = document.getElementById("difficulty").value;
  maxMistakes = diff === "expert" ? 2 : 3;
  mistakes = 0;
  hintsRemaining = 3;
  secondsElapsed = 0;
  isPaused = false;
  selectedCell = null;

  document.getElementById("mistake-count").innerText = `${mistakes}/${maxMistakes}`;
  document.getElementById("hint-count").innerText = hintsRemaining;
  document.getElementById("game-overlay").classList.remove("active");

  generatePuzzle(diff);
  renderBoard();
  resetTimer();
}

// Sudoku Board Generation & Solvers
function generatePuzzle(diff) {
  solutionGrid = Array.from({ length: gridDim }, () => Array(gridDim).fill(0));
  fillGrid(solutionGrid);

  initialGrid = solutionGrid.map(row => [...row]);
  userGrid = solutionGrid.map(row => [...row]);
  notesGrid = Array.from({ length: gridDim }, () => Array.from({ length: gridDim }, () => []));

  let holes = gridDim === 3 ? 3 : diff === "simple" ? 30 : diff === "medium" ? 42 : diff === "hard" ? 50 : 56;
  while (holes > 0) {
    let r = Math.floor(Math.random() * gridDim);
    let c = Math.floor(Math.random() * gridDim);
    if (initialGrid[r][c] !== 0) {
      initialGrid[r][c] = 0;
      userGrid[r][c] = 0;
      holes--;
    }
  }
}

function fillGrid(grid) {
  for (let r = 0; r < gridDim; r++) {
    for (let c = 0; c < gridDim; c++) {
      if (grid[r][c] === 0) {
        let nums = shuffle(Array.from({ length: gridDim }, (_, i) => i + 1));
        for (let num of nums) {
          if (isValidPlacement(grid, r, c, num)) {
            grid[r][c] = num;
            if (fillGrid(grid)) return true;
            grid[r][c] = 0;
          }
        }
        return false;
      }
    }
  }
  return true;
}

function isValidPlacement(grid, row, col, num) {
  for (let i = 0; i < gridDim; i++) {
    if (grid[row][i] === num || grid[i][col] === num) return false;
  }
  if (gridDim === 9) {
    let startR = Math.floor(row / 3) * 3;
    let startC = Math.floor(col / 3) * 3;
    for (let r = 0; r < 3; r++) {
      for (let c = 0; c < 3; c++) {
        if (grid[startR + r][startC + c] === num) return false;
      }
    }
  }
  return true;
}

function shuffle(arr) {
  return arr.sort(() => Math.random() - 0.5);
}

// Rendering Logic
function renderBoard() {
  const container = document.getElementById("board-container");
  container.className = `board-container grid-${gridDim}x${gridDim}`;
  container.innerHTML = `<div class="overlay-screen" id="game-overlay"></div>`;

  for (let r = 0; r < gridDim; r++) {
    for (let c = 0; c < gridDim; c++) {
      const cell = document.createElement("div");
      cell.className = "cell";
      cell.dataset.row = r;
      cell.dataset.col = c;

      if (initialGrid[r][c] !== 0) {
        cell.classList.add("given");
        cell.innerText = initialGrid[r][c];
      } else if (userGrid[r][c] !== 0) {
        cell.innerText = userGrid[r][c];
        if (userGrid[r][c] !== solutionGrid[r][c]) cell.classList.add("invalid");
      } else if (notesGrid[r][c].length > 0) {
        const notesContainer = document.createElement("div");
        notesContainer.className = "cell-notes";
        for (let i = 1; i <= gridDim; i++) {
          const noteItem = document.createElement("span");
          noteItem.innerText = notesGrid[r][c].includes(i) ? i : "";
          notesContainer.appendChild(noteItem);
        }
        cell.appendChild(notesContainer);
      }

      cell.addEventListener("click", () => selectCell(r, c));
      container.appendChild(cell);
    }
  }
}

function initNumpad() {
  const numpad = document.getElementById("numpad");
  numpad.innerHTML = "";
  for (let i = 1; i <= gridDim; i++) {
    const btn = document.createElement("button");
    btn.className = "num-btn";
    btn.innerText = i;
    btn.onclick = () => handleInput(i);
    numpad.appendChild(btn);
  }
}

function selectCell(r, c) {
  selectedCell = { r, c };
  const val = userGrid[r][c];

  document.querySelectorAll(".cell").forEach(cell => {
    const row = parseInt(cell.dataset.row);
    const col = parseInt(cell.dataset.col);
    cell.classList.remove("selected", "related", "same-val");

    if (row === r && col === c) {
      cell.classList.add("selected");
    } else if (row === r || col === c || (gridDim === 9 && Math.floor(row/3) === Math.floor(r/3) && Math.floor(col/3) === Math.floor(c/3))) {
      cell.classList.add("related");
    }
    if (val !== 0 && userGrid[row][col] === val) {
      cell.classList.add("same-val");
    }
  });
}

// User Actions
function handleInput(num) {
  if (!selectedCell || isPaused) return;
  const { r, c } = selectedCell;
  if (initialGrid[r][c] !== 0) return;

  if (noteMode) {
    userGrid[r][c] = 0;
    const idx = notesGrid[r][c].indexOf(num);
    if (idx > -1) notesGrid[r][c].splice(idx, 1);
    else notesGrid[r][c].push(num);
  } else {
    notesGrid[r][c] = [];
    userGrid[r][c] = num;

    if (num !== solutionGrid[r][c]) {
      mistakes++;
      document.getElementById("mistake-count").innerText = `${mistakes}/${maxMistakes}`;
      triggerVibration();
      if (mistakes >= maxMistakes) {
        endGame(false);
        return;
      }
    }
  }
  renderBoard();
  selectCell(r, c);
  checkWin();
}

function toggleNoteMode() {
  noteMode = !noteMode;
  const noteBtn = document.getElementById("note-btn");
  noteBtn.innerText = `Note ✏️ (${noteMode ? "ON" : "OFF"})`;
}

function eraseCell() {
  if (!selectedCell || isPaused) return;
  const { r, c } = selectedCell;
  if (initialGrid[r][c] !== 0) return;

  userGrid[r][c] = 0;
  notesGrid[r][c] = [];
  renderBoard();
  selectCell(r, c);
}

function useHint() {
  if (!selectedCell || hintsRemaining <= 0 || isPaused) return;
  const { r, c } = selectedCell;
  if (initialGrid[r][c] !== 0 || userGrid[r][c] === solutionGrid[r][c]) return;

  userGrid[r][c] = solutionGrid[r][c];
  notesGrid[r][c] = [];
  hintsRemaining--;
  document.getElementById("hint-count").innerText = hintsRemaining;
  renderBoard();
  selectCell(r, c);
  checkWin();
}

// Timer & Game Flow Controls
function resetTimer() {
  clearInterval(timerInterval);
  timerInterval = setInterval(() => {
    if (!isPaused) {
      secondsElapsed++;
      const mins = String(Math.floor(secondsElapsed / 60)).padStart(2, "0");
      const secs = String(secondsElapsed % 60).padStart(2, "0");
      document.getElementById("timer").innerText = `${mins}:${secs}`;
    }
  }, 1000);
}

function togglePause() {
  isPaused = !isPaused;
  const overlay = document.getElementById("game-overlay");
  const pauseBtn = document.getElementById("pause-btn");

  if (isPaused) {
    overlay.innerText = "Game Paused ⏸️";
    overlay.classList.add("active");
    pauseBtn.innerText = "Resume ▶️";
  } else {
    overlay.classList.remove("active");
    pauseBtn.innerText = "Pause ⏸️";
  }
}

function checkWin() {
  for (let r = 0; r < gridDim; r++) {
    for (let c = 0; c < gridDim; c++) {
      if (userGrid[r][c] !== solutionGrid[r][c]) return;
    }
  }
  endGame(true);
}

function endGame(isWin) {
  clearInterval(timerInterval);
  const overlay = document.getElementById("game-overlay");
  overlay.innerText = isWin ? "You Won! 🎉" : "Game Over ❌";
  overlay.classList.add("active");

  saveGameScore(isWin);
}

// Analytics, Memory & Graph Logic (Starts from 0, Tracks Actual Games Played)
function saveGameScore(isWin) {
  const diffSelect = document.getElementById("difficulty").value;
  const diffKey = diffSelect.charAt(0).toUpperCase() + diffSelect.slice(1);
  const today = new Date().toISOString().split('T')[0];

  let history = JSON.parse(localStorage.getItem("sudoku_analytics_data")) || [];
  
  // Calculate score: Score starts from 0 based on wins (+100) and losses (-50)
  const prevScore = history.length > 0 ? history[history.length - 1].score : 0;
  const newScore = Math.max(0, prevScore + (isWin ? 100 : -50));

  history.push({
    gameNum: history.length + 1,
    date: today,
    difficulty: diffKey,
    score: newScore
  });

  localStorage.setItem("sudoku_analytics_data", JSON.stringify(history));
}

function setupAnalyticsChart() {
  const ctx = document.getElementById("analyticsChart");
  if (!ctx) return;

  analyticsChart = new Chart(ctx, {
    type: "line",
    data: {
      labels: [],
      datasets: [{
        label: "Rating",
        data: [],
        borderColor: "#3b82f6",
        backgroundColor: "rgba(59, 130, 246, 0.1)",
        borderWidth: 2,
        fill: true,
        tension: 0.3
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      scales: {
        y: { beginAtZero: true },
        x: { title: { display: true, text: 'Games Played' } }
      }
    }
  });
}

function setupDifficultyListener() {
  const diffSelect = document.getElementById("difficulty-select");
  if (diffSelect) {
    diffSelect.addEventListener("change", renderAnalytics);
  }
}

function renderAnalytics() {
  if (!analyticsChart) return;

  const selectedDiff = document.getElementById("difficulty-select").value;
  const history = JSON.parse(localStorage.getItem("sudoku_analytics_data")) || [];
  
  const filtered = history.filter(item => item.difficulty.toLowerCase() === selectedDiff.toLowerCase());

  // Chart starts accurately with played games (1, 2, 3...) starting from baseline 0
  const labels = filtered.map((item, idx) => `Game ${idx + 1} (${item.date})`);
  const dataPoints = filtered.map(item => item.score);

  analyticsChart.data.labels = labels.length > 0 ? labels : ["No Games Played"];
  analyticsChart.data.datasets[0].data = dataPoints.length > 0 ? dataPoints : [0];
  analyticsChart.update();
}

function clearSavedData() {
  if (confirm("Reset all statistics and saved memory?")) {
    localStorage.removeItem("sudoku_analytics_data");
    renderAnalytics();
  }
}

// Utility Features (Keyboard, Theme, Vibrations)
document.addEventListener("keydown", (e) => {
  if (!selectedCell || isPaused) return;
  if (e.key >= "1" && e.key <= String(gridDim)) handleInput(parseInt(e.key));
  else if (e.key === "Backspace" || e.key === "Delete") eraseCell();
  else if (e.key.toLowerCase() === "n") toggleNoteMode();
  else if (e.key.toLowerCase() === "p") togglePause();
  else if (e.key.startsWith("Arrow")) {
    let { r, c } = selectedCell;
    if (e.key === "ArrowUp") r = Math.max(0, r - 1);
    if (e.key === "ArrowDown") r = Math.min(gridDim - 1, r + 1);
    if (e.key === "ArrowLeft") c = Math.max(0, c - 1);
    if (e.key === "ArrowRight") c = Math.min(gridDim - 1, c + 1);
    selectCell(r, c);
  }
});

function toggleTheme() {
  document.body.classList.toggle("dark-theme");
  const isDark = document.body.classList.contains("dark-theme");
  document.getElementById("theme-btn").innerText = isDark ? "☀️ Light" : "🌙 Dark";
  localStorage.setItem("sudoku_theme", isDark ? "dark" : "light");
}

function loadSettings() {
  if (localStorage.getItem("sudoku_theme") === "dark") {
    document.body.classList.add("dark-theme");
    document.getElementById("theme-btn").innerText = "☀️ Light";
  }
}

function triggerVibration() {
  const vibeEnabled = document.getElementById("vibe-toggle")?.checked;
  if (vibeEnabled && navigator.vibrate) navigator.vibrate(200);
}

function installPWA() {}
  

let gridDim = 9;
let boxRows = 3;
let boxCols = 3;
let currentVariant = "classic";
let currentDifficulty = "medium";

let solutionGrid = [];
let initialGrid = [];
let userGrid = [];
let notesGrid = [];

let symbols = [];
let selectedCell = null;
let activeNumber = null;
let isNoteMode = false;
let isPaused = false;

let mistakes = 0;
let maxMistakes = 3;
let hintsRemaining = 3;
let timerSeconds = 0;
let timerInterval = null;
let analyticsChartInstance = null;

const ALPHABET = ["A", "B", "C", "D", "E", "F", "G", "H", "I", "J", "K", "L", "M", "N", "O", "P"];

document.addEventListener("DOMContentLoaded", () => {
  setupNavigation();
  setupEventListeners();
  startNewGame();
  initAnalyticsChart();
});

/* --- Setup Handlers --- */

function setupNavigation() {
  const navBtns = document.querySelectorAll(".nav-btn");
  const views = document.querySelectorAll(".view");

  navBtns.forEach(btn => {
    btn.addEventListener("click", () => {
      const targetId = btn.getAttribute("data-target");
      navBtns.forEach(b => b.classList.remove("active"));
      views.forEach(v => v.classList.remove("active"));

      btn.classList.add("active");
      const targetView = document.getElementById(targetId);
      if (targetView) targetView.classList.add("active");
    });
  });
}

function setupEventListeners() {
  document.getElementById("grid-size")?.addEventListener("change", changeGridMode);
  document.getElementById("variant-type")?.addEventListener("change", changeVariantMode);
  document.getElementById("difficulty")?.addEventListener("change", changeDifficulty);

  document.getElementById("new-game-btn")?.addEventListener("click", startNewGame);
  document.getElementById("pause-btn")?.addEventListener("click", togglePause);
  document.getElementById("note-btn")?.addEventListener("click", toggleNoteMode);
  document.getElementById("hint-btn")?.addEventListener("click", getHint);
  document.getElementById("erase-btn")?.addEventListener("click", eraseCell);

  document.getElementById("theme-btn")?.addEventListener("click", toggleTheme);
  document.getElementById("theme-switch")?.addEventListener("change", (e) => {
    setTheme(e.target.checked);
  });

  document.getElementById("reset-data-btn")?.addEventListener("click", resetData);

  setupKeyboardInput();
}

/* --- Theme Management --- */

function toggleTheme() {
  const isDark = !document.body.classList.contains("dark-theme");
  setTheme(isDark);
}

function setTheme(isDark) {
  document.body.classList.toggle("dark-theme", isDark);
  const themeBtn = document.getElementById("theme-btn");
  const themeSwitch = document.getElementById("theme-switch");
  
  if (themeBtn) themeBtn.innerText = isDark ? "☀️" : "🌙";
  if (themeSwitch) themeSwitch.checked = isDark;
}

/* --- Modes & Config --- */

function changeGridMode() {
  const mode = document.getElementById("grid-size").value;
  if (mode === "4x4") { gridDim = 4; boxRows = 2; boxCols = 2; }
  else if (mode === "6x6") { gridDim = 6; boxRows = 2; boxCols = 3; }
  else if (mode === "9x9") { gridDim = 9; boxRows = 3; boxCols = 3; }
  else if (mode === "12x12") { gridDim = 12; boxRows = 3; boxCols = 4; }
  else if (mode === "16x16") { gridDim = 16; boxRows = 4; boxCols = 4; }

  updateSymbols();
  startNewGame();
}

function changeVariantMode() {
  currentVariant = document.getElementById("variant-type").value;
  updateSymbols();
  startNewGame();
}

function changeDifficulty() {
  currentDifficulty = document.getElementById("difficulty").value;
  startNewGame();
}

function updateSymbols() {
  symbols = currentVariant === "alphabet" 
    ? ALPHABET.slice(0, gridDim) 
    : Array.from({ length: gridDim }, (_, i) => String(i + 1));
}

/* --- Game Control --- */

function startNewGame() {
  selectedCell = null;
  activeNumber = null;
  isNoteMode = false;
  isPaused = false;
  mistakes = 0;
  hintsRemaining = 3;

  maxMistakes = currentDifficulty === "expert" ? 2 : 3;

  const noteBtn = document.getElementById("note-btn");
  if (noteBtn) {
    noteBtn.innerText = "Notes OFF";
    noteBtn.classList.remove("active-mode");
  }

  const pauseBtn = document.getElementById("pause-btn");
  if (pauseBtn) pauseBtn.innerText = "Pause ⏸️";

  updateMistakesDisplay();
  updateHintsDisplay();
  resetTimer();
  updateSymbols();
  generatePuzzle();
  renderBoard();
  renderNumpad();
  hideOverlay();
}

function resetTimer() {
  clearInterval(timerInterval);
  timerSeconds = 0;
  updateTimerDisplay();
  timerInterval = setInterval(() => {
    if (!isPaused) {
      timerSeconds++;
      updateTimerDisplay();
    }
  }, 1000);
}

function updateTimerDisplay() {
  const timerElem = document.getElementById("timer");
  if (!timerElem) return;
  const mins = String(Math.floor(timerSeconds / 60)).padStart(2, "0");
  const secs = String(timerSeconds % 60).padStart(2, "0");
  timerElem.innerText = `${mins}:${secs}`;
}

function updateMistakesDisplay() {
  const mistakeElem = document.getElementById("mistakes");
  if (mistakeElem) mistakeElem.innerText = `${mistakes}/${maxMistakes}`;
}

function updateHintsDisplay() {
  const hintElem = document.getElementById("hint-count");
  if (hintElem) hintElem.innerText = `${hintsRemaining}`;
}

/* --- Generator & Logic --- */

function generatePuzzle() {
  solutionGrid = Array.from({ length: gridDim }, () => Array(gridDim).fill(0));
  fillGrid(solutionGrid);

  initialGrid = solutionGrid.map(row => [...row]);
  userGrid = solutionGrid.map(row => [...row]);
  notesGrid = Array.from({ length: gridDim }, () => Array.from({ length: gridDim }, () => new Set()));

  let removeRatio = 0.45;
  if (currentDifficulty === "simple") removeRatio = 0.35;
  if (currentDifficulty === "medium") removeRatio = 0.50;
  if (currentDifficulty === "hard") removeRatio = 0.62;
  if (currentDifficulty === "expert") removeRatio = 0.72;

  let holes = Math.floor(gridDim * gridDim * removeRatio);
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
        let shuffleSyms = [...symbols].sort(() => Math.random() - 0.5);
        for (let sym of shuffleSyms) {
          if (isValidPlacement(grid, r, c, sym)) {
            grid[r][c] = sym;
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

function isValidPlacement(grid, row, col, val) {
  for (let i = 0; i < gridDim; i++) {
    if (grid[row][i] === val || grid[i][col] === val) return false;
  }
  let startR = Math.floor(row / boxRows) * boxRows;
  let startC = Math.floor(col / boxCols) * boxCols;
  for (let r = 0; r < boxRows; r++) {
    for (let c = 0; c < boxCols; c++) {
      if (grid[startR + r][startC + c] === val) return false;
    }
  }
  return true;
}

/* --- Rendering --- */

function renderBoard() {
  const container = document.getElementById("board-container");
  if (!container) return;

  container.className = `board-container grid-${gridDim}x${gridDim}`;
  container.innerHTML = "";

  for (let r = 0; r < gridDim; r++) {
    for (let c = 0; c < gridDim; c++) {
      const cell = document.createElement("div");
      cell.className = "cell";

      if ((c + 1) % boxCols === 0 && c !== gridDim - 1) cell.classList.add("box-border-right");
      if ((r + 1) % boxRows === 0 && r !== gridDim - 1) cell.classList.add("box-border-bottom");

      const val = userGrid[r][c];

      if (initialGrid[r][c] !== 0) {
        cell.classList.add("given");
        cell.innerText = initialGrid[r][c];
      } else if (val !== 0) {
        cell.innerText = val;
        if (val !== solutionGrid[r][c]) {
          cell.classList.add("invalid");
        }
      } else if (notesGrid[r][c].size > 0) {
        const notesContainer = document.createElement("div");
        notesContainer.className = "cell-notes";
        const sortedNotes = Array.from(notesGrid[r][c]).sort();
        sortedNotes.forEach(note => {
          const noteSpan = document.createElement("span");
          noteSpan.innerText = note;
          notesContainer.appendChild(noteSpan);
        });
        cell.appendChild(notesContainer);
      }

      if (selectedCell) {
        if (selectedCell.r === r && selectedCell.c === c) {
          cell.classList.add("selected");
        } else if (selectedCell.r === r || selectedCell.c === c) {
          cell.classList.add("related");
        }
      }

      const activeVal = activeNumber || (selectedCell ? userGrid[selectedCell.r][selectedCell.c] : null);
      if (activeVal && val === activeVal && val !== 0) {
        cell.classList.add("same-val");
      }

      cell.addEventListener("click", () => handleCellClick(r, c));
      container.appendChild(cell);
    }
  }
}

function renderNumpad() {
  const numpad = document.getElementById("numpad");
  if (!numpad) return;
  numpad.innerHTML = "";

  symbols.forEach(sym => {
    let placedCount = 0;
    for (let r = 0; r < gridDim; r++) {
      for (let c = 0; c < gridDim; c++) {
        if (userGrid[r][c] === sym && userGrid[r][c] === solutionGrid[r][c]) {
          placedCount++;
        }
      }
    }

    let remaining = gridDim - placedCount;
    if (remaining <= 0 && activeNumber === sym) {
      activeNumber = null;
    }

    const btn = document.createElement("button");
    btn.className = "num-btn";
    if (remaining <= 0) btn.classList.add("completed");
    if (activeNumber === sym) btn.classList.add("active-number");

    btn.innerHTML = `
      <span class="num-label">${sym}</span>
      <span class="num-count">${remaining > 0 ? remaining : "✓"}</span>
    `;

    btn.onclick = () => handleNumpadClick(sym, remaining);
    numpad.appendChild(btn);
  });
}

/* --- Input Logic --- */

function handleCellClick(r, c) {
  if (isPaused) return;

  selectedCell = { r, c };

  if (activeNumber !== null && initialGrid[r][c] === 0) {
    handleInput(activeNumber);
  } else {
    renderBoard();
  }
}

function handleNumpadClick(sym, remaining) {
  if (isPaused || remaining <= 0) return;

  if (selectedCell && initialGrid[selectedCell.r][selectedCell.c] === 0) {
    handleInput(sym);
    return;
  }

  activeNumber = activeNumber === sym ? null : sym;
  renderNumpad();
  renderBoard();
}

function handleInput(sym) {
  if (!selectedCell) return;
  const { r, c } = selectedCell;
  if (initialGrid[r][c] !== 0) return;

  if (isNoteMode) {
    if (notesGrid[r][c].has(sym)) {
      notesGrid[r][c].delete(sym);
    } else {
      notesGrid[r][c].add(sym);
    }
    userGrid[r][c] = 0;
  } else {
    notesGrid[r][c].clear();
    userGrid[r][c] = sym;

    if (sym !== solutionGrid[r][c]) {
      mistakes++;
      updateMistakesDisplay();
      if (mistakes >= maxMistakes) {
        showOverlay("Game Over!", "Maximum mistakes reached.");
      }
    } else {
      checkWinCondition();
    }
  }

  renderBoard();
  renderNumpad();
}

function eraseCell() {
  if (!selectedCell || isPaused) return;
  const { r, c } = selectedCell;
  if (initialGrid[r][c] !== 0) return;

  userGrid[r][c] = 0;
  notesGrid[r][c].clear();

  renderBoard();
  renderNumpad();
}

function toggleNoteMode() {
  isNoteMode = !isNoteMode;
  const noteBtn = document.getElementById("note-btn");
  if (noteBtn) {
    noteBtn.innerText = isNoteMode ? "Notes ON" : "Notes OFF";
    noteBtn.classList.toggle("active-mode", isNoteMode);
  }
}

function getHint() {
  if (!selectedCell || isPaused || hintsRemaining <= 0) return;
  const { r, c } = selectedCell;
  if (initialGrid[r][c] !== 0 || userGrid[r][c] === solutionGrid[r][c]) return;

  userGrid[r][c] = solutionGrid[r][c];
  notesGrid[r][c].clear();
  hintsRemaining--;

  updateHintsDisplay();
  renderBoard();
  renderNumpad();
  checkWinCondition();
}

function togglePause() {
  isPaused = !isPaused;
  const pauseBtn = document.getElementById("pause-btn");

  if (isPaused) {
    if (pauseBtn) pauseBtn.innerText = "Resume ▶️";
    showOverlay("Paused", "Game is currently paused.");
  } else {
    if (pauseBtn) pauseBtn.innerText = "Pause ⏸️";
    hideOverlay();
  }
}

function checkWinCondition() {
  for (let r = 0; r < gridDim; r++) {
    for (let c = 0; c < gridDim; c++) {
      if (userGrid[r][c] !== solutionGrid[r][c]) return;
    }
  }
  clearInterval(timerInterval);
  showOverlay("Congratulations!", `Solved in ${document.getElementById("timer")?.innerText || ""}`);
}

/* --- Keyboard Input --- */

function setupKeyboardInput() {
  document.addEventListener("keydown", (e) => {
    if (isPaused || !selectedCell) return;

    const key = e.key.toUpperCase();

    if (symbols.includes(key)) {
      handleInput(key);
    } else if (e.key === "Backspace" || e.key === "Delete") {
      eraseCell();
    } else if (e.key === "n" || e.key === "N") {
      toggleNoteMode();
    } else if (e.key.startsWith("Arrow")) {
      moveSelection(e.key);
    }
  });
}

function moveSelection(direction) {
  if (!selectedCell) {
    selectedCell = { r: 0, c: 0 };
  } else {
    let { r, c } = selectedCell;
    if (direction === "ArrowUp") r = Math.max(0, r - 1);
    if (direction === "ArrowDown") r = Math.min(gridDim - 1, r + 1);
    if (direction === "ArrowLeft") c = Math.max(0, c - 1);
    if (direction === "ArrowRight") c = Math.min(gridDim - 1, c + 1);
    selectedCell = { r, c };
  }
  renderBoard();
}

/* --- Overlay Logic --- */

function showOverlay(title, subtitle) {
  let overlay = document.querySelector(".overlay-screen");
  if (!overlay) {
    overlay = document.createElement("div");
    overlay.className = "overlay-screen";
    const boardWrapper = document.querySelector(".board-wrapper");
    if (boardWrapper) boardWrapper.appendChild(overlay);
  }

  overlay.innerHTML = `
    <div>${title}</div>
    <div style="font-size: 0.9rem; font-weight: 500; opacity: 0.8;">${subtitle}</div>
    <button class="overlay-btn" id="overlay-play-btn">Play Again</button>
  `;

  document.getElementById("overlay-play-btn")?.addEventListener("click", startNewGame);
  overlay.classList.add("active");
}

function hideOverlay() {
  const overlay = document.querySelector(".overlay-screen");
  if (overlay) overlay.classList.remove("active");
}

function resetData() {
  if (confirm("Reset current game session and statistics?")) {
    startNewGame();
  }
}

/* --- Analytics Chart --- */

function initAnalyticsChart() {
  const ctx = document.getElementById("analyticsChart");
  if (!ctx || typeof Chart === "undefined") return;

  if (analyticsChartInstance) {
    analyticsChartInstance.destroy();
  }

  analyticsChartInstance = new Chart(ctx, {
    type: "bar",
    data: {
      labels: ["Simple", "Medium", "Hard", "Expert"],
      datasets: [{
        label: "Best Time (Seconds)",
        data: [120, 240, 480, 720],
        backgroundColor: ["#10b981", "#3b82f6", "#f59e0b", "#ef4444"],
        borderRadius: 6
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false }
      },
      scales: {
        y: { beginAtZero: true }
      }
    }
  });
  }
                                       

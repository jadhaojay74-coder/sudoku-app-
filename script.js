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

// Persistent Real Game Stats - Average completion times
let gameStats = JSON.parse(localStorage.getItem("sudoku_avg_times")) || {
  "4x4": { simple: [], medium: [], hard: [], expert: [] },
  "6x6": { simple: [], medium: [], hard: [], expert: [] },
  "9x9": { simple: [], medium: [], hard: [], expert: [] },
  "12x12": { simple: [], medium: [], hard: [], expert: [] },
  "16x16": { simple: [], medium: [], hard: [], expert: [] }
};

const ALPHABET = ["A", "B", "C", "D", "E", "F", "G", "H", "I", "J", "K", "L", "M", "N", "O", "P"];

document.addEventListener("DOMContentLoaded", () => {
  setupNavigation();
  setupEventListeners();
  startNewGame();
});

function saveStats() {
  localStorage.setItem("sudoku_avg_times", JSON.stringify(gameStats));
}

/* --- Sound & Haptic Feedback System --- */

function playSound(type) {
  const soundOn = document.getElementById("sound-toggle")?.checked;
  if (!soundOn) return;

  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);

    if (type === "click") {
      osc.type = "sine";
      osc.frequency.setValueAtTime(400, ctx.currentTime);
      gain.gain.setValueAtTime(0.05, ctx.currentTime);
      osc.start();
      osc.stop(ctx.currentTime + 0.05);
    } else if (type === "error") {
      osc.type = "sawtooth";
      osc.frequency.setValueAtTime(180, ctx.currentTime);
      gain.gain.setValueAtTime(0.1, ctx.currentTime);
      osc.start();
      osc.stop(ctx.currentTime + 0.2);
    } else if (type === "win") {
      osc.type = "triangle";
      osc.frequency.setValueAtTime(523.25, ctx.currentTime);
      gain.gain.setValueAtTime(0.1, ctx.currentTime);
      osc.start();
      osc.stop(ctx.currentTime + 0.3);
    }
  } catch (e) {}
}

function triggerVibration(pattern) {
  const vibeOn = document.getElementById("vibe-toggle")?.checked;
  if (vibeOn && navigator.vibrate) {
    navigator.vibrate(pattern);
  }
}

/* --- Navigation & Analytics --- */

function setupNavigation() {
  const navBtns = document.querySelectorAll(".nav-btn");
  const views = document.querySelectorAll(".view");

  navBtns.forEach(btn => {
    btn.addEventListener("click", () => {
      playSound("click");
      triggerVibration(10);
      const targetId = btn.getAttribute("data-target");
      navBtns.forEach(b => b.classList.remove("active"));
      views.forEach(v => v.classList.remove("active"));

      btn.classList.add("active");
      const targetView = document.getElementById(targetId);
      if (targetView) {
        targetView.classList.add("active");
        if (targetId === "status-view") {
          setTimeout(initAnalyticsChart, 50);
        }
      }
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
  document.getElementById("theme-switch")?.addEventListener("change", (e) => setTheme(e.target.checked));
  document.getElementById("reset-data-btn")?.addEventListener("click", resetData);

  const statusFilter = document.querySelector("#status-view select");
  if (statusFilter) {
    statusFilter.addEventListener("change", initAnalyticsChart);
  }

  setupKeyboardInput();
}

/* --- Theme Management --- */

function toggleTheme() {
  playSound("click");
  triggerVibration(10);
  setTheme(!document.body.classList.contains("dark-theme"));
}

function setTheme(isDark) {
  document.body.classList.toggle("dark-theme", isDark);
  const themeBtn = document.getElementById("theme-btn");
  const themeSwitch = document.getElementById("theme-switch");
  
  if (themeBtn) themeBtn.innerText = isDark ? "☀️" : "🌙";
  if (themeSwitch) themeSwitch.checked = isDark;
}

/* --- Game Configuration & Difficulty --- */

function changeGridMode() {
  const modeSelect = document.getElementById("grid-size");
  if (!modeSelect) return;
  const mode = modeSelect.value;

  if (mode === "4x4") { gridDim = 4; boxRows = 2; boxCols = 2; }
  else if (mode === "6x6") { gridDim = 6; boxRows = 2; boxCols = 3; }
  else if (mode === "9x9") { gridDim = 9; boxRows = 3; boxCols = 3; }
  else if (mode === "12x12") { gridDim = 12; boxRows = 3; boxCols = 4; }
  else if (mode === "16x16") { gridDim = 16; boxRows = 4; boxCols = 4; }

  updateSymbols();
  startNewGame();
}

function changeVariantMode() {
  const variantSelect = document.getElementById("variant-type");
  if (variantSelect) currentVariant = variantSelect.value;
  updateSymbols();
  startNewGame();
}

function changeDifficulty() {
  const diffSelect = document.getElementById("difficulty");
  if (diffSelect) currentDifficulty = diffSelect.value;
  startNewGame();
}

function updateSymbols() {
  symbols = currentVariant === "alphabet" 
    ? ALPHABET.slice(0, gridDim) 
    : Array.from({ length: gridDim }, (_, i) => String(i + 1));
}

function updateDifficultyDisplay() {
  const diffSelect = document.getElementById("difficulty");
  if (diffSelect) {
    diffSelect.value = currentDifficulty;
  }
}

/* --- Game Control --- */

function startNewGame() {
  const diffSelect = document.getElementById("difficulty");
  if (diffSelect) currentDifficulty = diffSelect.value;

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

  updateDifficultyDisplay();
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
  const hintBtn = document.getElementById("hint-btn");
  if (hintElem) hintElem.innerText = `${hintsRemaining}`;

  if (hintBtn) {
    if (hintsRemaining <= 0) {
      hintBtn.style.opacity = "0.4";
      hintBtn.style.cursor = "not-allowed";
    } else {
      hintBtn.style.opacity = "1";
      hintBtn.style.cursor = "pointer";
    }
  }
}

/* --- Instant Fast Generator (No recursion lag) --- */

function generatePuzzle() {
  solutionGrid = Array.from({ length: gridDim }, () => Array(gridDim).fill(0));

  let symList = [...symbols].sort(() => Math.random() - 0.5);
  for (let r = 0; r < gridDim; r++) {
    for (let c = 0; c < gridDim; c++) {
      let idx = (r * boxCols + Math.floor(r / boxRows) + c) % gridDim;
      solutionGrid[r][c] = symList[idx];
    }
  }

  for (let b = 0; b < gridDim; b += boxRows) {
    for (let i = 0; i < boxRows; i++) {
      let r1 = b + i;
      let r2 = b + Math.floor(Math.random() * boxRows);
      [solutionGrid[r1], solutionGrid[r2]] = [solutionGrid[r2], solutionGrid[r1]];
    }
  }

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

/* --- Rendering & Highlighting --- */

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
        Array.from(notesGrid[r][c]).sort().forEach(note => {
          const noteSpan = document.createElement("span");
          noteSpan.innerText = note;
          notesContainer.appendChild(noteSpan);
        });
        cell.appendChild(notesContainer);
      }

      if (selectedCell) {
        const isSameRow = selectedCell.r === r;
        const isSameCol = selectedCell.c === c;
        const isSameBox = Math.floor(selectedCell.r / boxRows) === Math.floor(r / boxRows) &&
                          Math.floor(selectedCell.c / boxCols) === Math.floor(c / boxCols);

        if (isSameRow && isSameCol) {
          cell.classList.add("selected");
        } else if (isSameRow || isSameCol || isSameBox) {
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
        if (userGrid[r][c] === sym && userGrid[r][c] === solutionGrid[r][c]) placedCount++;
      }
    }

    let remaining = gridDim - placedCount;
    if (remaining <= 0 && activeNumber === sym) activeNumber = null;

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

/* --- Input & Actions --- */

function handleCellClick(r, c) {
  if (isPaused) return;
  playSound("click");
  triggerVibration(10);
  selectedCell = { r, c };

  if (activeNumber !== null && initialGrid[r][c] === 0) {
    handleInput(activeNumber);
  } else {
    renderBoard();
  }
}

function handleNumpadClick(sym, remaining) {
  if (isPaused || remaining <= 0) return;
  playSound("click");
  triggerVibration(10);

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
    if (notesGrid[r][c].has(sym)) notesGrid[r][c].delete(sym);
    else notesGrid[r][c].add(sym);
    userGrid[r][c] = 0;
  } else {
    notesGrid[r][c].clear();
    userGrid[r][c] = sym;

    if (sym !== solutionGrid[r][c]) {
      mistakes++;
      playSound("error");
      triggerVibration([50, 50, 50]);
      updateMistakesDisplay();
      if (mistakes >= maxMistakes) {
        showOverlay("Game Over!", "Maximum mistakes reached.");
      }
    } else {
      playSound("click");
      triggerVibration(15);
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

  playSound("click");
  triggerVibration(10);
  userGrid[r][c] = 0;
  notesGrid[r][c].clear();

  renderBoard();
  renderNumpad();
}

function toggleNoteMode() {
  playSound("click");
  triggerVibration(10);
  isNoteMode = !isNoteMode;
  const noteBtn = document.getElementById("note-btn");
  if (noteBtn) {
    noteBtn.innerText = isNoteMode ? "Notes ON" : "Notes OFF";
    noteBtn.classList.toggle("active-mode", isNoteMode);
  }
}

function getHint() {
  if (isPaused || hintsRemaining <= 0) return;

  let targetR = selectedCell?.r;
  let targetC = selectedCell?.c;

  if (targetR === undefined || initialGrid[targetR][targetC] !== 0 || userGrid[targetR][targetC] === solutionGrid[targetR][targetC]) {
    let found = false;
    for (let r = 0; r < gridDim; r++) {
      for (let c = 0; c < gridDim; c++) {
        if (initialGrid[r][c] === 0 && userGrid[r][c] !== solutionGrid[r][c]) {
          targetR = r;
          targetC = c;
          found = true;
          break;
        }
      }
      if (found) break;
    }
    if (!found) return;
  }

  playSound("click");
  triggerVibration(20);

  selectedCell = { r: targetR, c: targetC };
  userGrid[targetR][targetC] = solutionGrid[targetR][targetC];
  notesGrid[targetR][targetC].clear();
  
  hintsRemaining--;

  updateHintsDisplay();
  renderBoard();
  renderNumpad();
  checkWinCondition();
}

function togglePause() {
  playSound("click");
  triggerVibration(10);
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
  playSound("win");
  triggerVibration([100, 50, 100, 50, 200]);

  const modeKey = `${gridDim}x${gridDim}`;
  if (!gameStats[modeKey]) {
    gameStats[modeKey] = { simple: [], medium: [], hard: [], expert: [] };
  }
  if (!Array.isArray(gameStats[modeKey][currentDifficulty])) {
    gameStats[modeKey][currentDifficulty] = [];
  }
  
  gameStats[modeKey][currentDifficulty].push(timerSeconds);
  saveStats();

  showOverlay("Congratulations!", `Solved in ${document.getElementById("timer")?.innerText || ""}`);
}

/* --- Keyboard Input --- */

function setupKeyboardInput() {
  document.addEventListener("keydown", (e) => {
    if (isPaused || !selectedCell) return;
    const key = e.key.toUpperCase();

    if (symbols.includes(key)) handleInput(key);
    else if (e.key === "Backspace" || e.key === "Delete") eraseCell();
    else if (e.key === "n" || e.key === "N") toggleNoteMode();
    else if (e.key.startsWith("Arrow")) moveSelection(e.key);
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

/* --- Overlays & Reset --- */

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

  document.getElementById("overlay-play-btn")?.addEventListener("click", () => {
    playSound("click");
    startNewGame();
  });
  overlay.classList.add("active");
}

function hideOverlay() {
  const overlay = document.querySelector(".overlay-screen");
  if (overlay) overlay.classList.remove("active");
}

function resetData() {
  if (confirm("Reset current game session and statistics?")) {
    playSound("click");
    localStorage.removeItem("sudoku_avg_times");
    gameStats = {
      "4x4": { simple: [], medium: [], hard: [], expert: [] },
      "6x6": { simple: [], medium: [], hard: [], expert: [] },
      "9x9": { simple: [], medium: [], hard: [], expert: [] },
      "12x12": { simple: [], medium: [], hard: [], expert: [] },
      "16x16": { simple: [], medium: [], hard: [], expert: [] }
    };
    initAnalyticsChart();
    startNewGame();
  }
}

/* --- Real Analytics Chart Initialization --- */

function initAnalyticsChart() {
  const ctx = document.getElementById("analyticsChart");
  if (!ctx || typeof Chart === "undefined") return;

  if (analyticsChartInstance) {
    analyticsChartInstance.destroy();
  }

  const statusFilter = document.querySelector("#status-view select");
  let filterVal = statusFilter ? statusFilter.value : `${gridDim}x${gridDim}`;
  
  if (filterVal.includes("4x4")) filterVal = "4x4";
  else if (filterVal.includes("6x6")) filterVal = "6x6";
  else if (filterVal.includes("9x9")) filterVal = "9x9";
  else if (filterVal.includes("12x12")) filterVal = "12x12";
  else if (filterVal.includes("16x16")) filterVal = "16x16";

  const modeData = gameStats[filterVal] || { simple: [], medium: [], hard: [], expert: [] };

  const getAverage = (timeArray) => {
    if (!Array.isArray(timeArray) || timeArray.length === 0) return 0;
    const total = timeArray.reduce((sum, time) => sum + time, 0);
    return Math.round(total / timeArray.length);
  };

  const chartData = [

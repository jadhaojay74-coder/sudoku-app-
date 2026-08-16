let gridDim = 9;
let boxRows = 3;
let boxCols = 3;
let currentVariant = "classic";

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
const MAX_MISTAKES = 3;
let timerSeconds = 0;
let timerInterval = null;

const ALPHABET = ["A", "B", "C", "D", "E", "F", "G", "H", "I", "J", "K", "L", "M", "N", "O", "P"];

document.addEventListener("DOMContentLoaded", () => {
  setupNavigation();
  setupVariantControls();
  setupActionButtons();
  setupThemeToggle();
  setupKeyboardInput();
  startNewGame();
});

/* --- UI Navigation & Setup --- */

function setupNavigation() {
  const navBtns = document.querySelectorAll(".nav-btn");
  const views = document.querySelectorAll(".view");

  navBtns.forEach(btn => {
    btn.addEventListener("click", () => {
      const targetView = btn.dataset.target;
      navBtns.forEach(b => b.classList.remove("active"));
      views.forEach(v => v.classList.remove("active"));

      btn.classList.add("active");
      const activeView = document.getElementById(targetView);
      if (activeView) activeView.classList.add("active");
    });
  });
}

function setupVariantControls() {
  const selectGroup = document.querySelector(".select-group");
  if (!selectGroup) return;

  selectGroup.innerHTML = `
    <select id="grid-size" onchange="changeGridMode()">
      <option value="4x4">4×4 Mini</option>
      <option value="6x6">6×6 Medium</option>
      <option value="9x9" selected>9×9 Classic</option>
      <option value="12x12">12×12 Giant</option>
      <option value="16x16">16×16 Monster</option>
    </select>

    <select id="variant-type" onchange="changeVariantMode()">
      <option value="classic" selected>Standard Numbers</option>
      <option value="alphabet">Alphabet</option>
    </select>
  `;
}

function setupActionButtons() {
  const controlsGrid = document.querySelector(".controls-grid");
  if (!controlsGrid) return;

  controlsGrid.innerHTML = `
    <button class="btn" onclick="startNewGame()">New</button>
    <button class="btn" id="pause-btn" onclick="togglePause()">Pause</button>
    <button class="btn" id="note-btn" onclick="toggleNoteMode()">Notes OFF</button>
    <button class="btn" onclick="getHint()">Hint</button>
    <button class="btn" onclick="eraseCell()">Erase</button>
  `;
}

function setupThemeToggle() {
  const toggleBtn = document.querySelector(".theme-toggle");
  if (toggleBtn) {
    toggleBtn.addEventListener("click", () => {
      document.body.classList.toggle("dark-theme");
      toggleBtn.innerText = document.body.classList.contains("dark-theme") ? "☀️" : "🌙";
    });
  }
}

/* --- Mode Switchers --- */

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

function updateSymbols() {
  symbols = currentVariant === "alphabet" 
    ? ALPHABET.slice(0, gridDim) 
    : Array.from({ length: gridDim }, (_, i) => String(i + 1));
}

/* --- Core Game Initialization --- */

function startNewGame() {
  selectedCell = null;
  activeNumber = null;
  isNoteMode = false;
  isPaused = false;
  mistakes = 0;

  const noteBtn = document.getElementById("note-btn");
  if (noteBtn) {
    noteBtn.innerText = "Notes OFF";
    noteBtn.classList.remove("active-mode");
  }

  updateMistakesDisplay();
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
  if (mistakeElem) {
    mistakeElem.innerText = `${mistakes}/${MAX_MISTAKES}`;
  }
}

/* --- Puzzle Generator & Solver --- */

function generatePuzzle() {
  solutionGrid = Array.from({ length: gridDim }, () => Array(gridDim).fill(0));
  fillGrid(solutionGrid);

  initialGrid = solutionGrid.map(row => [...row]);
  userGrid = solutionGrid.map(row => [...row]);
  notesGrid = Array.from({ length: gridDim }, () => Array.from({ length: gridDim }, () => new Set()));

  let holes = Math.floor(gridDim * gridDim * 0.52);
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
      cell.dataset.row = r;
      cell.dataset.col = c;

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

/* --- Gameplay Logic & Input Handling --- */

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
      if (mistakes >= MAX_MISTAKES) {
        showOverlay("Game Over!", "You made 3 mistakes.");
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
  if (!selectedCell || isPaused) return;
  const { r, c } = selectedCell;
  if (initialGrid[r][c] !== 0 || userGrid[r][c] === solutionGrid[r][c]) return;

  userGrid[r][c] = solutionGrid[r][c];
  notesGrid[r][c].clear();

  renderBoard();
  renderNumpad();
  checkWinCondition();
}

function togglePause() {
  isPaused = !isPaused;
  const pauseBtn = document.getElementById("pause-btn");

  if (isPaused) {
    if (pauseBtn) pauseBtn.innerText = "Resume";
    showOverlay("Paused", "Take a breath!");
  } else {
    if (pauseBtn) pauseBtn.innerText = "Pause";
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

/* --- Keyboard Support --- */

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
    <div style="font-size: 0.9rem; font-weight: 500; opacity: 0.8; margin-bottom: 8px;">${subtitle}</div>
    <button class="overlay-btn" onclick="startNewGame()">Play Again</button>
  `;
  overlay.classList.add("active");
}

function hideOverlay() {
  const overlay = document.querySelector(".overlay-screen");
  if (overlay) overlay.classList.remove("active");
}

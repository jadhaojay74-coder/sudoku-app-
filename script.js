let gridDim = 9;
let boxRows = 3;
let boxCols = 3;
let currentVariant = "classic";

let solutionGrid = [];
let initialGrid = [];
let userGrid = [];
let notesGrid = [];
let evenOddMask = [];

let symbols = [];
let selectedCell = null;
let activeNumber = null; // Stores number selected from keypad first
let noteMode = false;
let isPaused = false;
let timerInterval = null;
let secondsElapsed = 0;
let mistakes = 0;
let maxMistakes = 3;
let hintsRemaining = 3;

const ALPHABET = ["A", "B", "C", "D", "E", "F", "G", "H", "I", "J", "K", "L", "M", "N", "O", "P"];

document.addEventListener("DOMContentLoaded", () => {
  loadSettings();
  setupVariantControls();
  startNewGame();
});

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
      <option value="classic" selected>Standard</option>
      <option value="diagonal">Diagonal (Sudoku X)</option>
      <option value="hyper">Hyper (Windoku)</option>
      <option value="non-consecutive">Non-Consecutive</option>
      <option value="even-odd">Even / Odd</option>
      <option value="alphabet">Alphabet</option>
    </select>

    <select id="difficulty" onchange="startNewGame()">
      <option value="simple">Simple</option>
      <option value="medium" selected>Medium</option>
      <option value="hard">Hard</option>
      <option value="expert">Expert</option>
    </select>
  `;
}

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
  if (currentVariant === "alphabet") {
    symbols = ALPHABET.slice(0, gridDim);
  } else {
    symbols = Array.from({ length: gridDim }, (_, i) => i + 1);
  }
  updateKeyboardGuide();
}

function updateKeyboardGuide() {
  const guide = document.getElementById("keyboard-info");
  if (!guide) return;
  const symRange = currentVariant === "alphabet" ? `A-${symbols[symbols.length - 1]}` : `1-${gridDim}`;
  guide.innerHTML = `💡 <b>Keyboard:</b> Direct click number first or select cell | <kbd>${symRange}</kbd> Input | <kbd>N</kbd> Notes`;
}

function startNewGame() {
  const diff = document.getElementById("difficulty").value;
  maxMistakes = diff === "expert" ? 2 : 3;
  mistakes = 0;
  hintsRemaining = 3;
  secondsElapsed = 0;
  isPaused = false;
  selectedCell = null;
  activeNumber = null;

  document.getElementById("mistake-count").innerText = `${mistakes}/${maxMistakes}`;
  document.getElementById("hint-count").innerText = hintsRemaining;
  document.getElementById("game-overlay").classList.remove("active");

  updateSymbols();
  generatePuzzle(diff);
  renderBoard();
  renderNumpad();
  resetTimer();
}

function generatePuzzle(diff) {
  solutionGrid = Array.from({ length: gridDim }, () => Array(gridDim).fill(0));
  evenOddMask = Array.from({ length: gridDim }, () => Array(gridDim).fill(0));

  fillGrid(solutionGrid);

  for (let r = 0; r < gridDim; r++) {
    for (let c = 0; c < gridDim; c++) {
      if (typeof solutionGrid[r][c] === "number") {
        evenOddMask[r][c] = solutionGrid[r][c] % 2 === 0 ? "E" : "O";
      }
    }
  }

  initialGrid = solutionGrid.map(row => [...row]);
  userGrid = solutionGrid.map(row => [...row]);
  notesGrid = Array.from({ length: gridDim }, () => Array.from({ length: gridDim }, () => []));

  let removalRatio = diff === "simple" ? 0.35 : diff === "medium" ? 0.5 : diff === "hard" ? 0.62 : 0.7;
  let holes = Math.floor(gridDim * gridDim * removalRatio);

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
        let shuffleSyms = shuffle([...symbols]);
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

  if (currentVariant === "diagonal") {
    if (row === col) {
      for (let i = 0; i < gridDim; i++) if (grid[i][i] === val) return false;
    }
    if (row + col === gridDim - 1) {
      for (let i = 0; i < gridDim; i++) if (grid[i][gridDim - 1 - i] === val) return false;
    }
  }

  if (currentVariant === "hyper" && gridDim === 9) {
    const hyperRegions = [[1, 1], [1, 5], [5, 1], [5, 5]];
    for (let [hr, hc] of hyperRegions) {
      if (row >= hr && row < hr + 3 && col >= hc && col < hc + 3) {
        for (let r = hr; r < hr + 3; r++) {
          for (let c = hc; c < hc + 3; c++) {
            if (grid[r][c] === val) return false;
          }
        }
      }
    }
  }

  return true;
}

// Inner Subgrid Borders Calculation
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

      // Draw Inner Box Borders
      if ((c + 1) % boxCols === 0 && c !== gridDim - 1) {
        cell.classList.add("box-border-right");
      }
      if ((r + 1) % boxRows === 0 && r !== gridDim - 1) {
        cell.classList.add("box-border-bottom");
      }

      if (currentVariant === "diagonal" && (r === c || r + c === gridDim - 1)) {
        cell.classList.add("diagonal-cell");
      }
      if (currentVariant === "hyper" && gridDim === 9) {
        if ((r >= 1 && r <= 3 && c >= 1 && c <= 3) || (r >= 1 && r <= 3 && c >= 5 && c <= 7) ||
            (r >= 5 && r <= 7 && c >= 1 && c <= 3) || (r >= 5 && r <= 7 && c >= 5 && c <= 7)) {
          cell.classList.add("hyper-region");
        }
      }
      if (currentVariant === "even-odd") {
        cell.classList.add(evenOddMask[r][c] === "E" ? "even-cell" : "odd-cell");
      }

      if (initialGrid[r][c] !== 0) {
        cell.classList.add("given");
        cell.innerText = initialGrid[r][c];
      } else if (userGrid[r][c] !== 0) {
        cell.innerText = userGrid[r][c];
        if (userGrid[r][c] !== solutionGrid[r][c]) cell.classList.add("invalid");
      } else if (notesGrid[r][c].length > 0) {
        const notesContainer = document.createElement("div");
        notesContainer.className = "cell-notes";
        symbols.forEach(sym => {
          const noteItem = document.createElement("span");
          noteItem.innerText = notesGrid[r][c].includes(sym) ? sym : "";
          notesContainer.appendChild(noteItem);
        });
        cell.appendChild(notesContainer);
      }

      cell.addEventListener("click", () => handleCellClick(r, c));
      container.appendChild(cell);
    }
  }
}

// Number Completion Tracking & Dynamic Keypad
function renderNumpad() {
  const numpad = document.getElementById("numpad");
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

    const btn = document.createElement("button");
    btn.className = "num-btn";
    if (remaining <= 0) btn.classList.add("completed");
    if (activeNumber === sym) btn.classList.add("active-number");

    btn.innerHTML = `
      <span class="num-label">${sym}</span>
      <span class="num-count">${remaining > 0 ? remaining : "✓"}</span>
    `;

    btn.onclick = () => selectNumpadSymbol(sym, remaining);
    numpad.appendChild(btn);
  });
}

function selectNumpadSymbol(sym, remaining) {
  if (remaining <= 0 || isPaused) return;

  if (selectedCell) {
    const { r, c } = selectedCell;
    if (initialGrid[r][c] === 0) {
      handleInput(sym);
      return;
    }
  }

  // Toggle Number-First active selection mode
  activeNumber = activeNumber === sym ? null : sym;
  renderNumpad();
}

function handleCellClick(r, c) {
  selectCell(r, c);

  // Auto-fit active symbol when cell clicked
  if (activeNumber !== null && initialGrid[r][c] === 0) {
    handleInput(activeNumber);
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
    } else if (row === r || col === c) {
      cell.classList.add("related");
    }
    if (val !== 0 && userGrid[row][col] === val) {
      cell.classList.add("same-val");
    }
  });
}

function handleInput(sym) {
  if (!selectedCell || isPaused) return;
  const { r, c } = selectedCell;
  if (initialGrid[r][c] !== 0) return;

  if (noteMode) {
    userGrid[r][c] = 0;
    const idx = notesGrid[r][c].indexOf(sym);
    if (idx > -1) notesGrid[r][c].splice(idx, 1);
    else notesGrid[r][c].push(sym);
  } else {
    notesGrid[r][c] = [];
    userGrid[r][c] = sym;

    if (sym !== solutionGrid[r][c]) {
      mistakes++;
      document.getElementById("mistake-count").innerText = `${mistakes}/${maxMistakes}`;
      if (mistakes >= maxMistakes) {
        endGame(false);
        return;
      }
    }
  }

  renderBoard();
  renderNumpad();
  selectCell(r, c);
  checkWin();
}

function toggleNoteMode() {
  noteMode = !noteMode;
  document.getElementById("note-btn").innerText = `Note ✏️ (${noteMode ? "ON" : "OFF"})`;
}

function eraseCell() {
  if (!selectedCell || isPaused) return;
  const { r, c } = selectedCell;
  if (initialGrid[r][c] !== 0) return;

  userGrid[r][c] = 0;
  notesGrid[r][c] = [];
  renderBoard();
  renderNumpad();
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
  renderNumpad();
  selectCell(r, c);
  checkWin();
}

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
}

document.addEventListener("keydown", e => {
  if (!selectedCell || isPaused) return;

  let keyUpper = e.key.toUpperCase();
  if (symbols.map(String).includes(keyUpper)) {
    handleInput(isNaN(keyUpper) ? keyUpper : parseInt(keyUpper));
  } else if (e.key === "Backspace" || e.key === "Delete") {
    eraseCell();
  } else if (e.key.toLowerCase() === "n") {
    toggleNoteMode();
  } else if (e.key.toLowerCase() === "p") {
    togglePause();
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

function shuffle(arr) {
  return arr.sort(() => Math.random() - 0.5);
    }
    

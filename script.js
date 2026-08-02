// Game State Variables
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

let hintsRemaining = 2;
let undosRemaining = 2;

let calViewYear = new Date().getFullYear();
let calViewMonth = new Date().getMonth();

let stats = { played: 0, won: 0, losses: 0, bestTime: null };
try {
  const savedStats = localStorage.getItem('sudoku_stats');
  if (savedStats) stats = JSON.parse(savedStats);
} catch (e) {
  console.warn("Failed to parse stats from localStorage:", e);
}

let completedDailies = [];
try {
  const savedDailies = localStorage.getItem('sudoku_completed_dailies');
  if (savedDailies) completedDailies = JSON.parse(savedDailies);
} catch (e) {
  console.warn("Failed to parse completed dailies:", e);
}

let rewards = [];
try {
  const savedRewards = localStorage.getItem('sudoku_rewards');
  if (savedRewards) rewards = JSON.parse(savedRewards);
} catch (e) {
  console.warn("Failed to parse rewards:", e);
}

function startNewGame(dateStr = null, loadSaved = false) {
  if (timerInterval) clearInterval(timerInterval);
  
  let loaded = false;
  if (loadSaved) {
    loaded = loadGameState();
  }

  if (!loaded) {
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

    generateSudoku(activeDateStr);
    historyStack = [];
  }

  const gameModeBanner = document.getElementById('game-mode-banner');
  if (gameModeBanner) {
    gameModeBanner.textContent = activeDateStr ? `📅 Daily Challenge: ${activeDateStr}` : `Standard Practice Game`;
  }

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

  timerInterval = setInterval(() => {
    if (!isPaused && !isZenMode) {
      secondsElapsed++;
      updateTimerDisplay();
      saveGameState();
    }
  }, 1000);

  selectedCell = null;
  renderBoard();
  updateKeypadCounts();
  saveGameState();
}

function triggerHaptic(type = 'light') {
  if (navigator.vibrate) {
    if (type === 'light') navigator.vibrate(12);
    else if (type === 'error') navigator.vibrate([40, 60, 40]);
  }
}

function saveGameState() {
  try {
    const gameState = {
      solution, initialBoard, currentBoard,
      notesBoard: notesBoard.map(row => row.map(set => (set instanceof Set ? Array.from(set) : []))),
      secondsElapsed, mistakes, activeDateStr, hintsRemaining, undosRemaining, isZenMode
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
    applyZenModeUI();
    return true;
  } catch (e) {
    console.warn("Failed to load saved state, starting fresh board:", e);
    localStorage.removeItem('sudoku_saved_state');
    return false;
  }
}

function toggleZenMode() {
  isZenMode = !isZenMode;
  applyZenModeUI();
  saveGameState();
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

function autoFillNotes() {
  if (isPaused) return;
  triggerHaptic('light');

  for (let r = 0; r < 9; r++) {
    for (let c = 0; c < 9; c++) {
      if (currentBoard[r][c] === 0) {
        if (!(notesBoard[r][c] instanceof Set)) notesBoard[r][c] = new Set();
        notesBoard[r][c].clear();
        for (let num = 1; num <= 9; num++) {
          if (isValidPlacement(r, c, num)) {
            notesBoard[r][c].add(num);
          }
        }
      }
    }
  }
  renderBoard();
  if (selectedCell) selectCell(selectedCell.r, selectedCell.c);
  saveGameState();
}

function isValidPlacement(r, c, num) {
  for (let i = 0; i < 9; i++) {
    if (currentBoard[r][i] === num || currentBoard[i][c] === num) return false;
  }
  const boxR = Math.floor(r / 3) * 3;
  const boxC = Math.floor(c / 3) * 3;
  for (let br = 0; br < 3; br++) {
    for (let bc = 0; bc < 3; bc++) {
      if (currentBoard[boxR + br][boxC + bc] === num) return false;
    }
  }
  return true;
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

function generateSudoku(dateStr = null) {
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

  let seed = dateStr ? parseInt(dateStr.replace(/-/g, ''), 10) : null;
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
  const difficultyEl = document.getElementById('difficulty');
  const diff = difficultyEl ? difficultyEl.value : 'medium';
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
  const boardEl = document.getElementById('board');
  if (!boardEl) return;
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
          if (val !== solution[r][c] && !isZenMode) {
            cell.classList.add('error');
          }
        }
      } else if (notes && notes instanceof Set && notes.size > 0) {
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
      cr === r || 
      cc === c || 
      (Math.floor(cr / 3) === Math.floor(r / 3) && Math.floor(cc / 3) === Math.floor(c / 3))
    ) {
      cell.classList.add('highlight');
    }
  });
}

function buildKeypad() {
  const keypadEl = document.getElementById('keypad');
  if (!keypadEl) return;
  keypadEl.innerHTML = '';
  for (let i = 1; i <= 9; i++) {
    const key = document.createElement('button');
    key.classList.add('key');
    key.id = `key-${i}`;
    key.innerHTML = `
      <span class="key-digit">${i}</span>
      <span class="key-badge" id="key-badge-${i}">9</span>
    `;
    key.addEventListener('click', () => handleInput(i));
    keypadEl.appendChild(key);
  }
}

function updateKeypadCounts() {
  if (!solution || solution.length < 9) return;
  const counts = Array(10).fill(0);
  for (let r = 0; r < 9; r++) {
    for (let c = 0; c < 9; c++) {
      const val = currentBoard[r][c];
      if (val !== 0 && val === solution[r][c]) {
        counts[val]++;
      }
    }
  }

  for (let i = 1; i <= 9; i++) {
    const remaining = 9 - counts[i];
    const badge = document.getElementById(`key-badge-${i}`);
    const keyBtn = document.getElementById(`key-${i}`);

    if (badge) badge.textContent = remaining > 0 ? remaining : '✓';
    if (keyBtn) {
      keyBtn.classList.toggle('key-completed', remaining === 0);
    }
  }
}

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
      saveGameState();
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
    saveGameState();
    checkWinCondition();
  }
}

function checkLineCompletions(r, c) {
  let rowComplete = true;
  for (let col = 0; col < 9; col++) {
    if (currentBoard[r][col] !== solution[r][col]) rowComplete = false;
  }

  let colComplete = true;
  for (let row = 0; row < 9; row++) {
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

function autoClearNotes(r, c, num) {
  for (let i = 0; i < 9; i++) {
    if (notesBoard[r][i] instanceof Set) notesBoard[r][i].delete(num);
    if (notesBoard[i][c] instanceof Set) notesBoard[i][c].delete(num);
  }

  const boxStartRow = Math.floor(r / 3) * 3;
  const boxStartCol = Math.floor(c / 3) * 3;
  for (let br = 0; br < 3; br++) {
    for (let bc = 0; bc < 3; bc++) {
      const target = notesBoard[boxStartRow + br][boxStartCol + bc];
      if (target instanceof Set) target.delete(num);
    }
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
    saveGameState();
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
  saveGameState();
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
  saveGameState();
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

    updateStreakDisplay();
    const timerEl = document.getElementById('timer');
    showEndModal("🎉 Victory!", isZenMode ? "You successfully completed the puzzle!" : `You solved the puzzle in ${timerEl ? timerEl.textContent : ''}!`);
  } else {
    stats.losses++;
    showEndModal("❌ Game Over", "You reached 3 mistakes and lost.");
  }

  localStorage.setItem('sudoku_stats', JSON.stringify(stats));
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

function shareResult() {
  const timerEl = document.getElementById('timer');
  const difficultyEl = document.getElementById('difficulty');
  const mode = activeDateStr ? `Daily Challenge (${activeDateStr})` : `Practice (${difficultyEl ? difficultyEl.value : ''})`;
  const streak = calculateStreak();

  const shareText = `🧩 Sudoku Master Pro\n🎮 Mode: ${mode}\n⏱️ Time: ${isZenMode ? 'Zen Mode' : (timerEl ? timerEl.textContent : '00:00')}\n❌ Mistakes: ${isZenMode ? 'Disabled' : `${mistakes}/${MAX_MISTAKES}`}\n🔥 Streak: ${streak} Days`;

  if (navigator.clipboard) {
    navigator.clipboard.writeText(shareText).then(() => {
      alert("Result copied to clipboard!");
    });
  } else {
    alert(shareText);
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

function openRewardsModal() {
  const trophyGrid = document.getElementById('trophy-grid');
  if (!trophyGrid) return;
  trophyGrid.innerHTML = '';

  if (rewards.length === 0) {
    trophyGrid.innerHTML = `<p style="grid-column: span 2; opacity:0.6;">No trophies earned yet.<br>Complete all days in a month to unlock one!</p>`;
  } else {
    rewards.forEach(reward => {
      const card = document.createElement('div');
      card.classList.add('trophy-card');
      card.innerHTML = `
        <div class="trophy-icon">${reward.icon}</div>
        <div class="trophy-title">${reward.title}</div>
      `;
      trophyGrid.appendChild(card);
    });
  }

  const rewardsModal = document.getElementById('rewards-modal');
  if (rewardsModal) rewardsModal.classList.add('active');
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
  const winrateEl = document.getElementById('stat-winrate');
  const besttimeEl = document.getElementById('stat-besttime');

  if (playedEl) playedEl.textContent = stats.played;
  if (wonEl) wonEl.textContent = stats.won;
  
  const winRate = stats.played > 0 ? Math.round((stats.won / stats.played) * 100) : 0;
  if (winrateEl) winrateEl.textContent = `${winRate}%`;

  if (besttimeEl) {
    if (stats.bestTime) {
      const mins = String(Math.floor(stats.bestTime / 60)).padStart(2, '0');
      const secs = String(stats.bestTime % 60).padStart(2, '0');
      besttimeEl.textContent = `${mins}:${secs}`;
    } else {
      besttimeEl.textContent = '--:--';
    }
  }

  const statsModal = document.getElementById('stats-modal');
  if (statsModal) statsModal.classList.add('active');
}

document.addEventListener('DOMContentLoaded', () => {
  buildKeypad();
  startNewGame(null, true);

  const btnPause = document.getElementById('btn-pause');
  const btnNotes = document.getElementById('btn-notes');
  const btnAutoNotes = document.getElementById('btn-auto-notes');
  const btnZen = document.getElementById('btn-zen');
  const btnNew = document.getElementById('btn-new');
  const btnDaily = document.getElementById('btn-daily');
  const btnRewards = document.getElementById('btn-rewards');
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
  if (btnRewards) btnRewards.addEventListener('click', openRewardsModal);
  if (btnErase) btnErase.addEventListener('click', eraseInput);
  if (btnUndo) btnUndo.addEventListener('click', undoMove);
  if (btnHint) btnHint.addEventListener('click', giveHint);
  if (btnStats) btnStats.addEventListener('click', openStatsModal);
  if (difficultyEl) difficultyEl.addEventListener('change', () => startNewGame(activeDateStr));

  const calPrev = document.getElementById('cal-prev-month');
  const calNext = document.getElementById('cal-next-month');
  const calClose = document.getElementById('calendar-close-btn');
  const rewardsClose = document.getElementById('rewards-close-btn');
  const modalClose = document.getElementById('modal-close-btn');
  const shareBtn = document.getElementById('modal-share-btn');
  const statsClose = document.getElementById('stats-close-btn');

  if (calPrev) calPrev.addEventListener('click', () => {
    calViewMonth--;
    if (calViewMonth < 0) { calViewMonth = 11; calViewYear--; }
    renderCalendar(calViewYear, calViewMonth);
  });

  if (calNext) calNext.addEventListener('click', () => {
    calViewMonth++;
    if (calViewMonth > 11) { calViewMonth = 0; calViewYear++; }
    renderCalendar(calViewYear, calViewMonth);
  });

  if (calClose) calClose.addEventListener('click', () => {
    const calendarModal = document.getElementById('calendar-modal');
    if (calendarModal) calendarModal.classList.remove('active');
  });

  if (rewardsClose) rewardsClose.addEventListener('click', () => {
    const rewardsModal = document.getElementById('rewards-modal');
    if (rewardsModal) rewardsModal.classList.remove('active');
  });

  if (modalClose) modalClose.addEventListener('click', () => {
    const gameModal = document.getElementById('game-modal');
    if (gameModal) gameModal.classList.remove('active');
    startNewGame(null);
  });

  if (shareBtn) shareBtn.addEventListener('click', shareResult);

  if (statsClose) statsClose.addEventListener('click', () => {
    const statsModal = document.getElementById('stats-modal');
    if (statsModal) statsModal.classList.remove('active');
  });

  if (themeToggle) themeToggle.addEventListener('click', () => {
    const isDark = document.body.getAttribute('data-theme') === 'dark';
    if (isDark) {
      document.body.removeAttribute('data-theme');
      themeToggle.textContent = '🌙 Dark';
    } else {
      document.body.setAttribute('data-theme', 'dark');
      themeToggle.textContent = '☀️ Light';
    }
  });

  document.addEventListener('keydown', (e) => {
    if (isPaused) return;
    if (e.key >= '1' && e.key <= '9') {
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
      if (e.key === 'ArrowUp') r = (r - 1 + 9) % 9;
      if (e.key === 'ArrowDown') r = (r + 1) % 9;
      if (e.key === 'ArrowLeft') c = (c - 1 + 9) % 9;
      if (e.key === 'ArrowRight') c = (c + 1) % 9;
      selectCell(r, c);
    }
  });
});

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
let activeDateStr = null;
const MAX_MISTAKES = 3;

let hintsRemaining = 2;
let undosRemaining = 2;

let calViewYear = new Date().getFullYear();
let calViewMonth = new Date().getMonth();

let stats = JSON.parse(localStorage.getItem('sudoku_stats')) || {
  played: 0, won: 0, losses: 0, bestTime: null
};

let completedDailies = JSON.parse(localStorage.getItem('sudoku_completed_dailies')) || [];
let rewards = JSON.parse(localStorage.getItem('sudoku_rewards')) || [];

function startNewGame(dateStr = null) {
  if (timerInterval) clearInterval(timerInterval);
  secondsElapsed = 0;
  mistakes = 0;
  isPaused = false;
  isNotesMode = false;
  activeDateStr = dateStr;

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

  const difficultyEl = document.getElementById('difficulty');
  const diff = difficultyEl ? difficultyEl.value : 'medium';
  
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

  generateSudoku(activeDateStr);
  historyStack = [];
  selectedCell = null;
  renderBoard();
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
          if (val !== solution[r][c]) {
            cell.classList.add('error');
          }
        }
      } else if (notes && notes.size > 0) {
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
  const keypadEl = document.getElementById('keypad');
  if (!keypadEl) return;
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
      mistakes++;
      updateMistakesDisplay();
      if (mistakes >= MAX_MISTAKES) {
        endGame(false);
        return;
      }
    } else {
      autoClearNotes(r, c, num);
    }

    renderBoard();
    selectCell(r, c);
    checkWinCondition();
  }
}

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
  if (timerInterval) clearInterval(timerInterval);
  stats.played++;

  if (isWin) {
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

    const timerEl = document.getElementById('timer');
    showEndModal("🎉 Victory!", `You solved the puzzle in ${timerEl ? timerEl.textContent : ''}!`);
  } else {
    stats.losses++;
    showEndModal("❌ Game Over", "You reached 3 mistakes and lost.");
  }

  localStorage.setItem('sudoku_stats', JSON.stringify(stats));
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
  startNewGame(null);

  const btnPause = document.getElementById('btn-pause');
  const btnNotes = document.getElementById('btn-notes');
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
});
  

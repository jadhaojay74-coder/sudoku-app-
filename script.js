let currentPuzzle = { initial: [], solved: [] };
let selectedCell = null;
let activeNumber = null;
let secondsElapsed = 0;
let timerInterval = null;
let mistakes = 0;

function isValid(board, row, col, num) {
    for (let i = 0; i < 9; i++) {
        if (board[row][i] === num || board[i][col] === num) return false;
        
        const boxRow = Math.floor(row / 3) * 3 + Math.floor(i / 3);
        const boxCol = Math.floor(col / 3) * 3 + (i % 3);
        if (board[boxRow][boxCol] === num) return false;
    }
    return true;
}

function fillBoard(board) {
    for (let row = 0; row < 9; row++) {
        for (let col = 0; col < 9; col++) {
            if (board[row][col] === 0) {
                const nums = [1, 2, 3, 4, 5, 6, 7, 8, 9].sort(() => Math.random() - 0.5);
                
                for (let num of nums) {
                    if (isValid(board, row, col, num)) {
                        board[row][col] = num;
                        if (fillBoard(board)) return true;
                        board[row][col] = 0;
                    }
                }
                return false;
            }
        }
    }
    return true;
}

function generatePuzzle(cluesToRemove = 40) {
    const solvedBoard = Array.from({ length: 9 }, () => Array(9).fill(0));
    fillBoard(solvedBoard);
    const initialBoard = solvedBoard.map(row => [...row]);
    
    let removed = 0;
    while (removed < cluesToRemove) {
        const row = Math.floor(Math.random() * 9);
        const col = Math.floor(Math.random() * 9);
        
        if (initialBoard[row][col] !== 0) {
            initialBoard[row][col] = 0;
            removed++;
        }
    }
    
    return {
        initial: initialBoard,
        solved: solvedBoard
    };
}

function createBoard() {
    currentPuzzle = generatePuzzle(40);
    const boardContainer = document.getElementById("sudoku-board");
    boardContainer.innerHTML = "";
    selectedCell = null;
    activeNumber = null;
    document.querySelectorAll(".num-btn").forEach(btn => btn.classList.remove("active-num"));

    for (let row = 0; row < 9; row++) {
        for (let col = 0; col < 9; col++) {
            const cellValue = currentPuzzle.initial[row][col];
            const cell = document.createElement("div");
            cell.classList.add("cell");
            
            cell.dataset.row = row;
            cell.dataset.col = col;
            
            if (row === 2 || row === 5) {
                cell.classList.add(`cell-row-${row}`);
            }

            if (cellValue !== 0) {
                cell.innerText = cellValue;
                cell.classList.add("prefilled");
            }

            cell.addEventListener("click", () => selectCell(cell));
            boardContainer.appendChild(cell);
        }
    }
}

function selectCell(cell) {
    const cells = document.querySelectorAll(".cell");
    
    cells.forEach(c => {
        c.classList.remove("selected", "related");
    });

    selectedCell = cell;
    const selectedRow = parseInt(cell.dataset.row);
    const selectedCol = parseInt(cell.dataset.col);
    const selectedBoxRow = Math.floor(selectedRow / 3);
    const selectedBoxCol = Math.floor(selectedCol / 3);

    cells.forEach(c => {
        const row = parseInt(c.dataset.row);
        const col = parseInt(c.dataset.col);
        const boxRow = Math.floor(row / 3);
        const boxCol = Math.floor(col / 3);

        if (row === selectedRow || col === selectedCol || (boxRow === selectedBoxRow && boxCol === selectedBoxCol)) {
            c.classList.add("related");
        }
    });

    selectedCell.classList.add("selected");

    if (activeNumber !== null && !cell.classList.contains("prefilled")) {
        applyNumberToCell(activeNumber);
    }
}

function selectInputNumber(num) {
    const buttons = document.querySelectorAll(".num-btn");
    buttons.forEach(btn => btn.classList.remove("active-num"));

    if (activeNumber === num) {
        activeNumber = null;
    } else {
        activeNumber = num;
        event.target.classList.add("active-num");
    }

    if (selectedCell && !selectedCell.classList.contains("prefilled")) {
        applyNumberToCell(activeNumber);
    }
}

function applyNumberToCell(num) {
    if (num === "") {
        selectedCell.innerText = "";
        selectedCell.classList.remove("user-input", "error");
        return;
    }

    const row = parseInt(selectedCell.dataset.row);
    const col = parseInt(selectedCell.dataset.col);
    const correctValue = currentPuzzle.solved[row][col];

    selectedCell.innerText = num;
    selectedCell.classList.add("user-input");

    if (num !== correctValue) {
        selectedCell.classList.add("error");
        mistakes++;
        updateMistakesDisplay();

        if ("vibrate" in navigator) {
            navigator.vibrate(200);
        }

        if (mistakes >= 3) {
            clearInterval(timerInterval);
            showLoseModal();
        }
    } else {
        selectedCell.classList.remove("error");
        checkWinCondition();
    }
}

function updateMistakesDisplay() {
    const display = document.getElementById("mistakes-display");
    display.innerText = `Mistakes: ${mistakes}/3`;
}

function checkWinCondition() {
    const cells = document.querySelectorAll(".cell");
    let isComplete = true;
    let hasError = false;

    cells.forEach(cell => {
        const row = parseInt(cell.dataset.row);
        const col = parseInt(cell.dataset.col);
        const cellValue = parseInt(cell.innerText);

        if (cell.innerText === "") {
            isComplete = false;
        } else if (cellValue !== currentPuzzle.solved[row][col]) {
            hasError = true;
        }
    });

    if (isComplete && !hasError) {
        clearInterval(timerInterval);
        showWinModal();
    }
}

function showWinModal() {
    const modal = document.getElementById("win-modal");
    const winTimeText = document.getElementById("win-time-text");
    const timerText = document.getElementById("timer").innerText.replace("Time: ", "");
    
    winTimeText.innerText = `You solved it in ${timerText}!`;
    modal.classList.remove("hidden");
}

function showLoseModal() {
    const modal = document.getElementById("lose-modal");
    modal.classList.remove("hidden");
}

function startTimer() {
    if (timerInterval) clearInterval(timerInterval);
    
    secondsElapsed = 0;
    const timerDisplay = document.getElementById("timer");
    timerDisplay.innerText = "Time: 00:00";

    timerInterval = setInterval(() => {
        secondsElapsed++;
        const minutes = Math.floor(secondsElapsed / 60);
        const seconds = secondsElapsed % 60;
        
        const formattedMin = String(minutes).padStart(2, "0");
        const formattedSec = String(seconds).padStart(2, "0");
        
        timerDisplay.innerText = `Time: ${formattedMin}:${formattedSec}`;
    }, 1000);
}

function startNewGame() {
    document.getElementById("win-modal").classList.add("hidden");
    document.getElementById("lose-modal").classList.add("hidden");
    
    mistakes = 0;
    updateMistakesDisplay();
    
    createBoard();
    startTimer();
}

function toggleDarkMode() {
    const body = document.body;
    const themeBtn = document.getElementById("theme-toggle-btn");
    
    body.classList.toggle("dark-mode");
    
    if (body.classList.contains("dark-mode")) {
        themeBtn.innerText = "☀️";
    } else {
        themeBtn.innerText = "🌙";
    }
}

// Get the dropdown element
const difficultySelect = document.getElementById('difficulty');
const newGameBtn = document.getElementById('new-game-btn');

newGameBtn.addEventListener('click', () => {
    const selectedDifficulty = difficultySelect.value;
    
    // Call your game generator function and pass the difficulty
    startNewGame(selectedDifficulty);
});

function startNewGame(difficulty) {
    let cellsToRemove = 40; // default medium

    if (difficulty === 'easy') {
        cellsToRemove = 30;
    } else if (difficulty === 'hard') {
        cellsToRemove = 55;
    }

    console.log(`Starting a ${difficulty} game by removing ${cellsToRemove} cells.`);
    // TODO: Add your logic here to generate the puzzle and fill the grid
}


startNewGame();
              

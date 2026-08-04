# 🧩 Sudoku Master Ultimate & 1v1 Multiplayer

[![HTML5](https://img.shields.io/badge/HTML5-E34F26?style=flat&logo=html5&logoColor=white)](https://developer.mozilla.org/en-US/docs/Web/HTML)
[![CSS3](https://img.shields.io/badge/CSS3-1572B6?style=flat&logo=css3&logoColor=white)](https://developer.mozilla.org/en-US/docs/Web/CSS)
[![JavaScript](https://img.shields.io/badge/JavaScript-F7DF1E?style=flat&logo=javascript&logoColor=black)](https://developer.mozilla.org/en-US/docs/Web/JavaScript)
[![WebRTC](https://img.shields.io/badge/WebRTC-PeerJS-333333?style=flat&logo=webrtc&logoColor=white)](https://peerjs.com/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

**Sudoku Master Ultimate** is a feature-packed, responsive, web-based Sudoku application. It features **4 Sudoku Game Variants**, a **Real-Time 1v1 Peer-to-Peer Multiplayer Mode**, Daily Challenges with streak tracking, persistent auto-save, and desktop keyboard shortcuts.

---

## ✨ Features

### 🎮 Multiplayer 1v1 Race Mode
* **Peer-to-Peer Connection:** Uses [PeerJS](https://peerjs.com/) (WebRTC) for zero-backend serverless 1v1 connections.
* **Room Codes:** Host a room to generate a unique code or enter a code to join a friend's room.
* **Seed Syncing:** Both players receive the exact same puzzle board and rules.
* **Live Progress Tracker:** Track your opponent's completion percentage in real time.

---

### 🧩 4 Sudoku Game Variants
1. **Classic 9x9:** Standard Sudoku rules with $3 \times 3$ sub-grids.
2. **Sudoku X (Diagonal):** Standard rules, plus both main diagonals ($\mathbf{\backslash}$ and $\mathbf{/}$) must contain unique numbers from $1$ to $9$.
3. **Mini 6x6:** Fast-paced $6 \times 6$ grid with $2 \times 3$ sub-boxes for quick casual sessions.
4. **Hyper Sudoku (Windoku):** Standard rules, plus 4 additional shaded $3 \times 3$ regions that must contain unique numbers.

---

### 🧠 Smart Gameplay & Assistance
* **🪄 Auto-Notes (Magic Pencil):** Automatically computes and places all logical candidate notes into empty cells.
* **Candidate Vision (Digit Highlighting):** Highlights all matching digits across the board upon selection.
* **Smart Note Clearing:** Automatically removes pencil notes from rows, columns, and boxes upon digit placement.
* **Remaining Keypad Badges:** Keypad buttons (1–9) show remaining digits to place and dim when complete.
* **Line Completion Flash:** Rows and columns briefly flash green upon correct completion.

---

### 🧘 Modes & Quality-of-Life Controls
* **🧘 Zen Mode:** Play without timer pressure, mistake counters, or instant error highlighting.
* **📅 Daily Challenges & Streak Tracker:** Integrated calendar with daily puzzles, daily streak tracking (🔥), and monthly trophy unlocks.
* **💾 Persistent Auto-Save:** Auto-saves board state to `localStorage` so refreshing or closing the browser never loses progress.
* **🌙 Dark / ☀️ Light Themes:** Persistent dark mode toggle.
* **📱 Haptic Feedback:** Mobile vibration API for tap and error notifications.
* **📋 Share Results:** Copy game completion summaries to the clipboard.

---

## ⌨️ Desktop Keyboard Shortcuts

| Shortcut Key | Action |
| :--- | :--- |
| **`1` – `9`** | Input number or toggle candidate note in selected cell |
| **Arrow Keys ($\leftarrow \uparrow \rightarrow \downarrow$)** | Move board cell selection |
| **`N`** | Toggle Notes mode ON/OFF |
| **`Spacebar`** | Pause / Resume timer |
| **`Backspace` / `Delete`** | Erase selected cell |

---

## 🛠️ Project File Structure

```text
sudoku-master-ultimate/
│
├── index.html       # Application markup and modals
├── styles.css       # Complete layout, themes, and CSS grid styles
├── script.js       # Core game engine, variant logic, and PeerJS WebRTC multiplayer
└── README.md        # Documentation

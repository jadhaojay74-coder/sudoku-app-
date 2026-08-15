# 🧩 Sudoku Master Pro

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://opensource.org/licenses/MIT)
[![HTML5](https://img.shields.io/badge/HTML5-E34F26?style=flat&logo=html5&logoColor=white)](https://developer.mozilla.org/en-US/docs/Web/HTML)
[![CSS3](https://img.shields.io/badge/CSS3-1572B6?style=flat&logo=css3&logoColor=white)](https://developer.mozilla.org/en-US/docs/Web/CSS)
[![JavaScript](https://img.shields.io/badge/JavaScript-F7DF1E?style=flat&logo=javascript&logoColor=black)](https://developer.mozilla.org/en-US/docs/Web/JavaScript)
[![PWA Ready](https://img.shields.io/badge/PWA-Ready-5A0FC8?style=flat&logo=pwa&logoColor=white)](https://web.dev/progressive-web-apps/)

**Sudoku Master Pro** is a modern, responsive, single-page Sudoku application built with vanilla HTML5, CSS3, and JavaScript. It features mini (3×3) and classic (9×9) grid modes, a dynamic mistake/lives engine, real-time Chart.js analytics tracking rating graphs per difficulty, synthesized Web Audio sound effects, haptic vibration, and offline PWA support.

---

## 🌟 Key Features

* 📐 **Multi-Grid Modes**
  * **9×9 Classic Mode:** Standard 81-cell Sudoku grid divided into 9 3×3 sub-grids.
  * **3×3 Mini Mode:** Quick 9-cell grid utilizing digits 1–3 for casual/fast play.

* ❌ **Dynamic Mistake & Lives System**
  * **Expert Mode:** Maximum of **2 mistakes** allowed per game.
  * **Simple / Medium / Hard Modes:** Maximum of **3 mistakes** allowed per game.
  * **Visual & Audio Feedback:** Incorrect number placements trigger a vibrant red error animation, decrease remaining lives, play an error chime, and vibrate the device.
  * **Game Over:** Exceeding the mistake threshold triggers a Game Over overlay and auto-restarts a new game.

* ✅ **Numpad Completion & Locking**
  * When all instances of a digit (e.g., all nine `5`s on a 9×9 board) are correctly placed, the corresponding numpad button locks automatically, turns green, and displays a checkmark (`✓`).

* 📈 **Skill Rating Analytics Graph (Chart.js)**
  * **Performance Tracking:** Ratings increase on victory (**+100 pts**) and decrease on defeat (**-50 pts**).
  * **Difficulty Filtering:** Separate interactive rating graphs for Simple, Medium, Hard, and Expert levels.

* 🔊 **Web Audio Synthesizer & Haptic Vibration**
  * **Synthesized SFX:** Custom sound effects generated programmatically via the native **Web Audio API** (Click, Mistake, Victory, Game Over)—no external `.mp3` assets required.
  * **Haptic Touch:** Vibration feedback for touch devices.
  * **Settings Toggles:** On/Off switches for sound and vibration in the Settings menu.

* ✏️ **Pencil Notes & Assist Tools**
  * Integrated 3×3 note sub-grid inside cells to track candidate numbers.
  * Dynamic hint allocation based on difficulty (Simple: 3, Medium: 2, Hard: 1, Expert: 0).
  * Auto-highlighting of selected cell, identical numbers, and connected row/column/3×3 block.

* 💾 **State Persistence & Offline PWA**
  * Full game state (board grid, notes, timer, lives, settings, theme) saved automatically to `localStorage`.
  * Web App Manifest support for installation to home screens and 100% offline play.

---

## 🛠️ Tech Stack

| Component | Technology | Description |
| :--- | :--- | :--- |
| **Frontend Layout** | HTML5 | Semantic SPA structure with tabbed navigation |
| **Styling & Theme** | CSS3 | Responsive Grid, CSS Variables, Animations, Dark/Light Mode |
| **Logic Engine** | Vanilla JS (ES6+) | Game state machine, board generation, input validation |
| **Analytics Chart** | Chart.js (CDN) | Real-time performance graphing |
| **Audio Engine** | Web Audio API | Programmatic sound synthesis |
| **Storage & PWA** | Web Storage & Manifest | Local state persistence & Web App Manifest |

---

## 📁 Directory Structure

```text
sudoku-master-pro/
├── index.html       # Single Page Application structure and markup
├── style.css        # Responsive layouts, themes, animations, grid borders
├── script.js        # Game engine, Web Audio synth, chart renderer, storage
└── README.md        # Technical documentation and project overview

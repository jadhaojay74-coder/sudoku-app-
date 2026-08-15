🧩 Sudoku Master Pro
A feature-packed, fully responsive Web-based Sudoku game built with HTML5, CSS3, and JavaScript. It features customizable grid sizes, dynamic difficulty levels, mistake enforcement, real-time performance analytics, synthesized Web Audio sound effects, and haptic vibration feedback.
✨ Key Features
Dual Grid Modes: * 9×9 Classic: Standard Sudoku grid with sub-boxes and digits 1–9.
3×3 Mini: Compact mini-board for fast-paced practice.
Dynamic Mistake & Life System:
Expert Mode: Maximum of 2 mistakes allowed.
Simple / Medium / Hard: Maximum of 3 mistakes allowed.
Wrong entries trigger a vibrant red error animation, update the counter, and play sound/haptic feedback. Exceeding the allowed mistakes results in a Game Over screen and resets the board.
Numpad Completion Indicators:
When all instances of a digit (e.g., all nine 5s) are correctly placed, the corresponding numpad button automatically locks and displays a checkmark (✓).
Difficulty-Based Performance Analytics Graph:
Built with Chart.js.
Tracks skill rating over time: +100 points for a win, -50 points for a loss.
Includes a dropdown filter to view separate progress graphs for Simple, Medium, Hard, and Expert difficulties.
Audio & Haptic Feedback Engine:
Synthesized sound effects generated dynamically via the Web Audio API (Click, Error, Win, Game Over)—no external .mp3 assets required.
Haptic vibration feedback for mobile devices.
Independent Sound and Vibration toggles in the Settings menu.
Dark / Light Theme: Seamless toggle with persistent theme selection saved to localStorage.
PWA Ready: Web App Manifest support for installation as a progressive web app on mobile and desktop devices.

// =========================================
//   SUPER JEOPARDY - GAME ENGINE
// =========================================

const PLAYER_COLORS = [
  '#FF2D9B', '#00EEFF', '#FFD700', '#00FF88',
  '#FF6B00', '#C77DFF', '#FF6B6B', '#4ECDC4',
  '#FF4500', '#39FF14', '#FF69B4', '#00CED1'
];

const PLAYER_EMOJIS = [
  '😀','😎','🤩','🥳','🦄','🐉','🦊','🐸',
  '🐼','🐯','🦁','🐺','🐻','🦋','🌟','⭐',
  '🚀','🎮','🎨','🏆','🌈','🔥','💎','🎸',
  '🍕','🍦','🎂','🍩','🌺','🌸','💫','✨',
  '🎯','🎪','🎠','🎡','🌊','🏄','🌙','☀️',
  '🦸','🧙','🧜','🧚','🦹','🤖','👾','🎭',
  '🐋','🦈','🦅','🦚','🦜','🐬','🦩','🦒'
];

const FINAL_VALUE = 1000; // Final Jeopardy is worth a flat $1000; nothing lost when wrong

let state = {
  players: [],
  board: [],
  currentQuestion: null,
  activePlayerIdx: 0,
  finalJeopardy: null,      // the one chosen Final Jeopardy question (or null)
  finalCorrect: new Set()   // player indices marked correct in Final Jeopardy
};

// ======= NAVIGATION =======
function showScreen(id) {
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  document.getElementById(id).classList.add('active');
}

// ======= LANDING =======
function goToSetup() {
  showScreen('screen-setup');
  // Start with 8 blank slots — game starts once any one has a name
  if (state.players.length === 0) {
    for (let i = 0; i < 8; i++) addPlayerSlot(true);
    renderPlayerSlots();
    updateStartButton();
  }
}

const MAX_PLAYERS = 12;

// ======= PLAYER SETUP =======
// silent=true skips re-rendering (used when bulk-adding initial slots)
function addPlayerSlot(silent = false) {
  if (state.players.length >= MAX_PLAYERS) return;

  const idx = state.players.length;
  state.players.push({
    id: idx,
    name: '',
    emoji: PLAYER_EMOJIS[idx % PLAYER_EMOJIS.length],
    color: PLAYER_COLORS[idx % PLAYER_COLORS.length],
    score: 0
  });

  if (!silent) {
    renderPlayerSlots();
    updateStartButton();
  }

  const btn = document.getElementById('btn-add-player');
  if (btn) btn.style.display = state.players.length >= MAX_PLAYERS ? 'none' : '';
}

function removePlayer(idx) {
  state.players.splice(idx, 1);
  state.players.forEach((p, i) => { p.id = i; p.color = PLAYER_COLORS[i % PLAYER_COLORS.length]; });
  renderPlayerSlots();
  document.getElementById('btn-add-player').style.display = '';
  updateStartButton();
}

function renderPlayerSlots() {
  const grid = document.getElementById('players-grid');
  grid.innerHTML = '';

  state.players.forEach((player, idx) => {
    const slot = document.createElement('div');
    slot.className = 'player-slot';
    slot.innerHTML = `
      <div class="player-color-strip" style="--player-color: ${player.color}"></div>
      <div class="player-slot-top">
        <div class="emoji-display" onclick="openEmojiPicker(${idx})" title="Pick emoji">${player.emoji}</div>
        <input
          class="player-name-input"
          type="text"
          placeholder="Player ${idx + 1} name"
          maxlength="20"
          value="${player.name}"
          oninput="updatePlayerName(${idx}, this.value)"
        >
      </div>
      ${state.players.length > 1 ? `<button class="btn-remove-player" onclick="removePlayer(${idx})">✕</button>` : ''}
    `;
    grid.appendChild(slot);
  });
}

function updatePlayerName(idx, value) {
  state.players[idx].name = value;
  updateStartButton();
}

function updateStartButton() {
  const btn = document.getElementById('btn-start-game');
  const hasNames = state.players.some(p => p.name.trim().length > 0);
  btn.disabled = !hasNames || state.players.length === 0;
}

// ======= EMOJI PICKER =======
let emojiTargetIdx = -1;

function openEmojiPicker(playerIdx) {
  emojiTargetIdx = playerIdx;
  const picker = document.getElementById('emoji-picker');
  const grid = document.getElementById('emoji-grid');
  grid.innerHTML = '';

  PLAYER_EMOJIS.forEach(emoji => {
    const btn = document.createElement('button');
    btn.className = 'emoji-btn';
    btn.textContent = emoji;
    btn.onclick = () => selectEmoji(emoji);
    grid.appendChild(btn);
  });

  picker.classList.remove('hidden');

  // Close on outside click
  setTimeout(() => {
    document.addEventListener('click', closePicker, { once: true, capture: true });
  }, 10);
}

function closePicker(e) {
  const picker = document.getElementById('emoji-picker');
  if (!picker.contains(e.target)) {
    picker.classList.add('hidden');
  }
}

function selectEmoji(emoji) {
  if (emojiTargetIdx >= 0) {
    state.players[emojiTargetIdx].emoji = emoji;
    renderPlayerSlots();
  }
  document.getElementById('emoji-picker').classList.add('hidden');
}

// ======= GAME START =======
async function startGame() {
  // Drop any slots left blank — only named players join the game
  state.players = state.players.filter(p => p.name.trim().length > 0);
  // Re-assign colors sequentially after filtering
  state.players.forEach((p, i) => { p.id = i; p.color = PLAYER_COLORS[i % PLAYER_COLORS.length]; });

  if (state.players.length === 0) return; // shouldn't happen (button is disabled)

  try {
    const res = await fetch('/api/game');
    const data = await res.json();
    state.board = data.board;
    state.finalJeopardy = data.finalJeopardy;
  } catch (err) {
    alert('Could not load questions. Is the server running?');
    return;
  }

  state.players.forEach(p => { p.score = 0; });
  state.activePlayerIdx = 0;
  state.finalCorrect = new Set();

  renderBoard();
  renderScoreboard();
  showScreen('screen-board');
  animateBoardEntrance();
}

// ======= SCOREBOARD =======
function renderScoreboard() {
  const sb = document.getElementById('scoreboard');
  sb.innerHTML = '';

  state.players.forEach((player, idx) => {
    const card = document.createElement('div');
    card.className = 'score-card' + (idx === state.activePlayerIdx ? ' active-player' : '');
    card.id = `score-card-${idx}`;
    // Clicking the card body (emoji/name) selects the active player
    card.onclick = () => setActivePlayer(idx);
    card.innerHTML = `
      <div class="score-emoji">${player.emoji}</div>
      <div class="score-name">${player.name}</div>
      <div class="score-points" id="score-pts-${idx}" title="Tap to fix the score">${player.score}</div>
    `;
    card.style.background = `linear-gradient(180deg, ${player.color}22, transparent)`;
    card.style.borderColor = idx === state.activePlayerIdx ? player.color : 'transparent';

    // Clicking the points number opens an inline editor (brings up the keyboard
    // on tablets) so a mis-click when awarding points can be corrected.
    const ptsEl = card.querySelector(`#score-pts-${idx}`);
    ptsEl.onclick = (e) => {
      e.stopPropagation(); // don't also trigger setActivePlayer
      openScoreEditor(idx);
    };

    sb.appendChild(card);
  });
}

function setActivePlayer(idx) {
  state.activePlayerIdx = idx;
  renderScoreboard();
}

// Inline-edit a player's score to fix mistakes mid-game
function openScoreEditor(idx) {
  const ptsEl = document.getElementById(`score-pts-${idx}`);
  if (!ptsEl || ptsEl.querySelector('input')) return; // already editing

  const current = state.players[idx].score;
  ptsEl.innerHTML = `
    <input class="score-edit-input" type="number" inputmode="numeric"
           value="${current}" />
  `;
  const input = ptsEl.querySelector('input');
  input.focus();
  input.select();

  const commit = () => {
    const val = parseInt(input.value, 10);
    if (!Number.isNaN(val)) state.players[idx].score = val;
    renderScoreboard();
  };
  const cancel = () => renderScoreboard();

  input.onclick = (e) => e.stopPropagation();
  input.onblur = commit;
  input.onkeydown = (e) => {
    if (e.key === 'Enter') { e.preventDefault(); input.blur(); }
    else if (e.key === 'Escape') { input.onblur = null; cancel(); }
  };
}

function animateScoreChange(playerIdx, delta) {
  const el = document.getElementById(`score-pts-${playerIdx}`);
  if (!el) return;

  el.classList.remove('animating');
  void el.offsetWidth; // reflow
  el.classList.add('animating');
  el.textContent = state.players[playerIdx].score;

  // Float particle
  const card = document.getElementById(`score-card-${playerIdx}`);
  if (card) {
    const rect = card.getBoundingClientRect();
    spawnFloatParticle(
      rect.left + rect.width / 2,
      rect.top,
      delta > 0 ? `+${delta}` : `${delta}`,
      delta > 0 ? '#00FF88' : '#FF4444'
    );
  }
}

function spawnFloatParticle(x, y, text, color) {
  const el = document.createElement('div');
  el.className = 'float-particle';
  el.style.left = x + 'px';
  el.style.top = y + 'px';
  el.style.color = color;
  el.style.fontFamily = "'Fredoka One', cursive";
  el.style.fontSize = '28px';
  el.style.fontWeight = 'bold';
  el.style.textShadow = `0 0 10px ${color}`;
  el.textContent = text;
  document.body.appendChild(el);
  setTimeout(() => el.remove(), 3000);
}

// ======= HELPERS =======
function darkenHex(hex, factor = 0.45) {
  const h = hex.replace('#', '');
  const r = Math.round(parseInt(h.slice(0, 2), 16) * factor);
  const g = Math.round(parseInt(h.slice(2, 4), 16) * factor);
  const b = Math.round(parseInt(h.slice(4, 6), 16) * factor);
  return `rgb(${r},${g},${b})`;
}

// ======= GAME BOARD =======
function renderBoard() {
  const board = document.getElementById('game-board');
  board.innerHTML = '';

  // 6 rows: 1 header + 5 question rows
  board.style.gridTemplateRows = `auto repeat(5, 1fr)`;

  // Headers
  state.board.forEach((cat, catIdx) => {
    const header = document.createElement('div');
    header.className = 'board-header';
    header.style.background = `linear-gradient(160deg, ${cat.color}, ${darkenHex(cat.color, 0.5)})`;
    header.style.borderColor = 'rgba(255,255,255,0.45)';
    header.style.boxShadow = `0 0 20px ${cat.color}88, inset 0 1px 0 rgba(255,255,255,0.25)`;
    header.style.animationDelay = `${catIdx * 0.1}s`;
    header.innerHTML = `
      <div class="header-icon">${cat.icon}</div>
      <div class="header-name">${cat.name}</div>
    `;
    board.appendChild(header);
  });

  // Question cells (row by row: 100, 200, 300, 400, 500)
  for (let row = 0; row < 5; row++) {
    state.board.forEach((cat, catIdx) => {
      const q = cat.questions[row];
      const cell = document.createElement('div');
      cell.className = 'board-cell' + (q.answered ? ' answered' : '');
      cell.id = `cell-${catIdx}-${row}`;
      cell.style.animationDelay = `${(catIdx + row * 5) * 0.05}s`;
      cell.innerHTML = `<div class="cell-value">$${q.points}</div>`;

      if (!q.answered) {
        cell.onclick = () => openQuestion(catIdx, row);
      }

      board.appendChild(cell);
    });
  }
}

function animateBoardEntrance() {
  // Cells animate in via CSS animation-delay
}

function updateCell(catIdx, row) {
  const cell = document.getElementById(`cell-${catIdx}-${row}`);
  if (cell) {
    cell.classList.add('answered');
    cell.onclick = null;
    cell.style.animation = 'cell-answered 0.4s ease-out';
  }
}

// ======= QUESTION FLOW =======
function openQuestion(catIdx, rowIdx) {
  const cat = state.board[catIdx];
  const q = cat.questions[rowIdx];

  state.currentQuestion = { catIdx, rowIdx, q, cat };

  // Set up question screen
  document.getElementById('q-category-badge').textContent = `${cat.icon} ${cat.name}`;
  document.getElementById('q-points-badge').textContent = `$${q.points}`;
  document.getElementById('question-text').textContent = q.question;
  document.getElementById('answer-text').textContent = q.answer;
  document.getElementById('hint-text').textContent = q.hint ? `💡 Hint: ${q.hint}` : '';

  // Reset state
  document.getElementById('answer-reveal').classList.add('hidden');
  document.getElementById('question-actions').style.display = 'flex';

  // Build scoring buttons
  const scoringBtns = document.getElementById('scoring-buttons');
  scoringBtns.innerHTML = '';
  state.players.forEach((player, idx) => {
    const btn = document.createElement('button');
    btn.className = 'btn-score-player';
    btn.style.borderColor = player.color;
    btn.style.color = player.color;
    btn.innerHTML = `
      <span class="p-emoji">${player.emoji}</span>
      <span class="p-name">${player.name}</span>
    `;
    btn.onclick = () => awardPoints(idx, q.points);
    scoringBtns.appendChild(btn);
  });

  showScreen('screen-question');
}

function revealAnswer() {
  document.getElementById('question-actions').style.display = 'none';
  document.getElementById('answer-reveal').classList.remove('hidden');
}

function awardPoints(playerIdx, points) {
  state.players[playerIdx].score += points;

  // Mark question answered
  const { catIdx, rowIdx } = state.currentQuestion;
  state.board[catIdx].questions[rowIdx].answered = true;

  // Show celebration
  showCelebration(state.players[playerIdx], points);

  // Move to next player
  state.activePlayerIdx = (playerIdx + 1) % state.players.length;

  setTimeout(() => {
    hideCelebration();
    returnToBoard();
  }, 2000);
}

function nobodyGotIt() {
  const { catIdx, rowIdx } = state.currentQuestion;
  state.board[catIdx].questions[rowIdx].answered = true;

  showWrongOverlay();
  setTimeout(() => {
    hideWrongOverlay();
    returnToBoard();
  }, 1500);
}

function returnToBoard() {
  const { catIdx, rowIdx } = state.currentQuestion;
  updateCell(catIdx, rowIdx);
  renderScoreboard();

  showScreen('screen-board');

  // Check if all answered → Final Jeopardy (if there's a question), else winner
  const allDone = state.board.every(cat => cat.questions.every(q => q.answered));
  if (allDone) {
    setTimeout(() => {
      if (state.finalJeopardy) startFinalJeopardy();
      else showWinner();
    }, 800);
  }
}

// ======= FINAL JEOPARDY =======
function startFinalJeopardy() {
  const fj = state.finalJeopardy;
  state.finalCorrect = new Set();

  // Phase reset
  document.getElementById('final-intro').classList.remove('hidden');
  document.getElementById('final-question-phase').classList.add('hidden');
  document.getElementById('final-answer-reveal').classList.add('hidden');
  document.getElementById('final-q-actions').style.display = 'flex';

  // Category label
  const catLabel = fj.category && fj.category.trim() ? fj.category : 'Final Jeopardy';
  document.getElementById('final-category').textContent = `📋 ${catLabel}`;

  // Standings (sorted high → low)
  const standings = document.getElementById('final-standings');
  standings.innerHTML = '';
  [...state.players]
    .sort((a, b) => b.score - a.score)
    .forEach(p => {
      const row = document.createElement('div');
      row.className = 'final-standing-row';
      row.innerHTML = `
        <span class="fst-emoji">${p.emoji}</span>
        <span class="fst-name">${p.name}</span>
        <span class="fst-pts">$${p.score}</span>
      `;
      standings.appendChild(row);
    });

  showScreen('screen-final');
  setTimeout(() => Confetti.burst(window.innerWidth / 2, window.innerHeight / 3, 60, 18), 300);
}

function finalRevealQuestion() {
  const fj = state.finalJeopardy;
  document.getElementById('final-intro').classList.add('hidden');
  document.getElementById('final-question-phase').classList.remove('hidden');

  const catLabel = fj.category && fj.category.trim() ? fj.category : 'Final Jeopardy';
  document.getElementById('final-q-category').textContent = `📋 ${catLabel}`;
  document.getElementById('final-question-text').textContent = fj.question;
  document.getElementById('final-answer-text').textContent = fj.answer;
  document.getElementById('final-hint-text').textContent = fj.hint ? `💡 Hint: ${fj.hint}` : '';

  document.getElementById('final-answer-reveal').classList.add('hidden');
  document.getElementById('final-q-actions').style.display = 'flex';
}

function finalRevealAnswer() {
  document.getElementById('final-q-actions').style.display = 'none';
  document.getElementById('final-answer-reveal').classList.remove('hidden');

  // Build a toggle button per player — tap everyone who got it right
  const btns = document.getElementById('final-scoring-buttons');
  btns.innerHTML = '';
  state.players.forEach((player, idx) => {
    const btn = document.createElement('button');
    btn.className = 'btn-score-player final-pick';
    btn.id = `final-pick-${idx}`;
    btn.style.borderColor = player.color;
    btn.style.color = player.color;
    btn.innerHTML = `
      <span class="p-emoji">${player.emoji}</span>
      <span class="p-name">${player.name}</span>
      <span class="p-check">＋$${FINAL_VALUE}</span>
    `;
    btn.onclick = () => toggleFinalCorrect(idx);
    btns.appendChild(btn);
  });
}

function toggleFinalCorrect(idx) {
  const btn = document.getElementById(`final-pick-${idx}`);
  if (state.finalCorrect.has(idx)) {
    state.finalCorrect.delete(idx);
    btn.classList.remove('picked');
  } else {
    state.finalCorrect.add(idx);
    btn.classList.add('picked');
  }
}

function finalApplyAndFinish() {
  state.finalCorrect.forEach(idx => {
    state.players[idx].score += FINAL_VALUE;
  });
  showWinner();
}

// ======= CELEBRATION EFFECTS =======
function showCelebration(player, points) {
  const overlay = document.getElementById('celebration-overlay');
  document.getElementById('celebration-emoji').textContent = player.emoji;
  document.getElementById('celebration-text').textContent = `${player.name.toUpperCase()}!`;
  document.getElementById('celebration-points').textContent = `+$${points}`;

  overlay.classList.remove('hidden');

  // Confetti burst
  Confetti.burst(window.innerWidth / 2, window.innerHeight / 2, 100, 22);
}

function hideCelebration() {
  document.getElementById('celebration-overlay').classList.add('hidden');
}

function showWrongOverlay() {
  document.getElementById('wrong-overlay').classList.remove('hidden');
}
function hideWrongOverlay() {
  document.getElementById('wrong-overlay').classList.add('hidden');
}

// ======= WINNER SCREEN =======
function showWinner() {
  const sorted = [...state.players].sort((a, b) => b.score - a.score);
  const maxScore = sorted[0].score;
  const winners = sorted.filter(p => p.score === maxScore);

  // Winner display
  const winnerDisplay = document.getElementById('winner-display');
  winnerDisplay.innerHTML = '';

  const ranks = ['🥇', '🥈', '🥉'];
  let rankIdx = 0;
  let prevScore = null;

  sorted.forEach((player, i) => {
    if (prevScore !== null && player.score < prevScore) rankIdx = Math.min(rankIdx + 1, 2);
    prevScore = player.score;

    if (i === 0) {
      // Main winner card
      const card = document.createElement('div');
      card.className = 'winner-card';
      card.style.animationDelay = `${i * 0.15}s`;
      card.innerHTML = `
        <div class="w-rank">${ranks[rankIdx]}</div>
        <div class="w-emoji">${player.emoji}</div>
        <div class="w-name">${player.name}</div>
        <div class="w-points">$${player.score}</div>
      `;
      winnerDisplay.appendChild(card);
    }
  });

  // Final scores list
  const finalScores = document.getElementById('final-scores');
  finalScores.innerHTML = '';
  sorted.forEach((player, i) => {
    const item = document.createElement('div');
    item.className = 'final-score-item';
    item.innerHTML = `
      <span>${ranks[Math.min(i, 2)] || '🎖️'}</span>
      <span class="fs-emoji">${player.emoji}</span>
      <span>${player.name}</span>
      <span class="fs-points">$${player.score}</span>
    `;
    finalScores.appendChild(item);
  });

  showScreen('screen-winner');

  // BIG celebration!
  setTimeout(() => Confetti.megaBurst(), 300);
  setTimeout(() => Confetti.rain(5000), 800);
}

// ======= INIT =======
document.addEventListener('DOMContentLoaded', () => {
  // Show landing with stars
  showScreen('screen-landing');
  const landing = document.getElementById('screen-landing');
  const starsDiv = document.createElement('div');
  starsDiv.className = 'stars-bg';
  landing.prepend(starsDiv);
});

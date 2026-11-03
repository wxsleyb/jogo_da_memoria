'use strict';

/* Jogo da Memória — pares de fotografias de Picsum Photos. */

const $ = (selector) => document.querySelector(selector);
const ui = {
  board: $('#game-board'), hint: $('#board-hint'), stage: $('#board-stage'),
  input: $('#numPairs'), presets: document.querySelectorAll('.preset'),
  start: $('#start-button'), startLabel: $('#start-button-label'),
  previewStart: $('#preview-start'), status: $('#setup-message'),
  attempts: $('#attempts-value'), time: $('#time-value'), pairs: $('#pairs-value'),
  level: $('#level-label'), progress: $('#progress-fill'), progressText: $('#progress-text'),
  progressTrack: $('#progress-track'), best: $('#best-record'),
  pause: $('#pause-button'), pauseOverlay: $('#pause-overlay'), resume: $('#resume-button'),
  zoomIn: $('#zoom-in'), zoomOut: $('#zoom-out'), zoomLabel: $('#zoom-label'),
  sound: $('#sound-toggle'), soundIcon: $('#sound-icon'),
  dialog: $('#win-dialog'), winTime: $('#win-time'), winAttempts: $('#win-attempts'),
  winPairs: $('#win-pairs'), winStars: $('#win-stars'), winRecord: $('#win-record'),
  closeWin: $('#close-win'), playAgain: $('#play-again')
};

const game = {
  pairs: 16, attempts: 0, matches: 0, first: null, second: null,
  locked: false, running: false, paused: false, finished: false,
  startedAt: 0, elapsedMs: 0, timerId: null, flipTimeout: null,
  version: 0, zoom: 1, soundEnabled: false
};

function shuffle(items) {
  for (let i = items.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [items[i], items[j]] = [items[j], items[i]];
  }
  return items;
}

function readPairs() {
  const number = Number(ui.input.value);
  return Number.isInteger(number) && number >= 2 && number <= 32 ? number : null;
}

function difficultyLabel(pairs) {
  if (pairs === 6) return 'CASUAL';
  if (pairs === 12) return 'INTERMEDIÁRIO';
  if (pairs === 16) return 'INSANO';
  return 'PERSONALIZADO';
}

function setMessage(text, isError = false) {
  ui.status.textContent = text;
  ui.status.classList.toggle('is-error', isError);
}

function updatePresetSelection() {
  const pairs = readPairs();
  ui.presets.forEach((button) => {
    const selected = Number(button.dataset.pairs) === pairs;
    button.classList.toggle('is-selected', selected);
    button.setAttribute('aria-pressed', String(selected));
  });
  if (pairs !== null && !game.running) {
    game.pairs = pairs;
    game.matches = 0;
    game.attempts = 0;
    previewBoard(pairs);
    updateLevel(pairs);
    updateStatistics();
  }
}

function setBoardColumns(pairs, preview = false) {
  const count = preview ? 16 : pairs * 2;
  const columns = preview ? 4 : count <= 16 ? 4 : count <= 24 ? 6 : 8;
  const tablet = Math.min(columns, 6);
  const mobile = Math.min(columns, 4);
  ui.board.style.setProperty('--cols-desktop', columns);
  ui.board.style.setProperty('--cols-tablet', tablet);
  ui.board.style.setProperty('--cols-mobile', mobile);
  ui.board.style.setProperty('--board-base-width', `${columns * 108 + (columns - 1) * 10}px`);
  ui.board.style.setProperty('--board-scale', game.zoom);
}

function previewBoard(pairs = 16) {
  ui.board.classList.add('is-preview');
  ui.board.replaceChildren();
  setBoardColumns(pairs, true);
  const fragment = document.createDocumentFragment();
  for (let index = 0; index < 16; index++) {
    const card = document.createElement('div');
    card.className = 'preview-card';
    fragment.appendChild(card);
  }
  ui.board.appendChild(fragment);
  ui.hint.hidden = false;
}

function updateLevel(pairs = game.pairs) {
  ui.level.textContent = `${difficultyLabel(pairs)} · ${pairs} PARES`;
}

function formatTime(milliseconds) {
  const seconds = Math.floor(milliseconds / 1000);
  const minutes = Math.floor(seconds / 60);
  return `${String(minutes).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`;
}

function elapsedTime() {
  if (game.running && !game.paused && !game.finished) {
    return game.elapsedMs + performance.now() - game.startedAt;
  }
  return game.elapsedMs;
}

function updateTimer() {
  ui.time.textContent = formatTime(elapsedTime());
}

function updateStatistics() {
  ui.attempts.textContent = String(game.attempts);
  ui.pairs.innerHTML = `${game.matches} <span class="stat-total">/ ${game.pairs}</span>`;
  const percent = game.matches / game.pairs * 100;
  ui.progress.style.width = `${percent}%`;
  ui.progressText.textContent = `${Math.round(percent)}% concluído`;
  ui.progressTrack.setAttribute('aria-valuemax', String(game.pairs));
  ui.progressTrack.setAttribute('aria-valuenow', String(game.matches));
  updateTimer();
}

function getRecordKey() {
  return `jogo-memoria-best-${game.pairs}`;
}

function readRecord() {
  try {
    const data = JSON.parse(localStorage.getItem(getRecordKey()) || 'null');
    if (data && Number.isFinite(data.attempts) && Number.isFinite(data.timeMs)) return data;
  } catch (_error) { /* Navegação privada ou armazenamento bloqueado. */ }
  return null;
}

function updateBestRecord() {
  const previousPairs = game.pairs;
  const inputPairs = readPairs();
  if (!game.running && inputPairs !== null) game.pairs = inputPairs;
  const record = readRecord();
  ui.best.textContent = record ? `${record.attempts} tent. · ${formatTime(record.timeMs)}` : '—';
  game.pairs = previousPairs;
}

function saveRecord(timeMs) {
  const previous = readRecord();
  const isBetter = !previous || game.attempts < previous.attempts ||
    (game.attempts === previous.attempts && timeMs < previous.timeMs);
  if (isBetter) {
    try { localStorage.setItem(getRecordKey(), JSON.stringify({attempts: game.attempts, timeMs})); }
    catch (_error) { /* O jogo continua funcionando sem armazenamento. */ }
  }
  return isBetter;
}

let audioContext;
function sound(type) {
  if (!game.soundEnabled) return;
  try {
    audioContext ||= new (window.AudioContext || window.webkitAudioContext)();
    if (audioContext.state === 'suspended') audioContext.resume();
    const tones = type === 'win' ? [523, 659, 784] : type === 'match' ? [560, 760] :
      type === 'wrong' ? [280, 220] : [480];
    const start = audioContext.currentTime;
    tones.forEach((frequency, index) => {
      const oscillator = audioContext.createOscillator();
      const gain = audioContext.createGain();
      const at = start + index * .085;
      oscillator.type = type === 'wrong' ? 'triangle' : 'sine';
      oscillator.frequency.value = frequency;
      gain.gain.setValueAtTime(.0001, at);
      gain.gain.exponentialRampToValueAtTime(.085, at + .015);
      gain.gain.exponentialRampToValueAtTime(.0001, at + .12);
      oscillator.connect(gain).connect(audioContext.destination);
      oscillator.start(at);
      oscillator.stop(at + .13);
    });
  } catch (_error) { /* Som opcional não deve interromper o jogo. */ }
}

function cancelActiveTimers() {
  clearInterval(game.timerId);
  clearTimeout(game.flipTimeout);
  game.timerId = null;
  game.flipTimeout = null;
}

function photoUrl(seed, id, retry = 0) {
  // Mesmo endereço para as duas cartas de cada par.
  return `https://picsum.photos/seed/memoria-${seed}-${id}-${retry}/320/400`;
}

function createCard(item, position, photoSeed, version) {
  const card = document.createElement('button');
  card.type = 'button';
  card.className = 'card';
  card.dataset.pair = String(item.id);
  card.setAttribute('aria-label', `Carta ${position + 1}, virada para baixo`);
  card.setAttribute('aria-pressed', 'false');

  const inner = document.createElement('span');
  inner.className = 'card-inner';
  const back = document.createElement('span');
  back.className = 'card-face card-back';
  const front = document.createElement('span');
  front.className = 'card-face card-front';

  const image = document.createElement('img');
  image.className = 'front-image';
  image.alt = '';
  image.loading = 'eager';
  image.decoding = 'async';
  image.src = photoUrl(photoSeed, item.id);
  let retries = 0;
  image.addEventListener('error', () => {
    if (version !== game.version) return;
    if (retries < 2) {
      retries += 1;
      image.src = photoUrl(photoSeed, item.id, retries);
    } else {
      card.classList.add('photo-error');
      setMessage('Algumas fotos não carregaram. Verifique sua conexão e reinicie a partida.', true);
    }
  });

  front.appendChild(image);
  inner.append(back, front);
  card.appendChild(inner);
  card.addEventListener('click', () => flipCard(card, item, position, version));
  return card;
}

function startGame() {
  const pairs = readPairs();
  if (pairs === null) {
    setMessage('Informe um número inteiro de 2 a 32 pares.', true);
    ui.input.focus();
    return;
  }
  if (ui.dialog.open) ui.dialog.close();
  cancelActiveTimers();
  game.version += 1;
  game.pairs = pairs;
  game.attempts = 0;
  game.matches = 0;
  game.first = null;
  game.second = null;
  game.locked = false;
  game.running = true;
  game.paused = false;
  game.finished = false;
  game.elapsedMs = 0;
  game.startedAt = performance.now();
  const version = game.version;
  const items = shuffle(Array.from({length: pairs}, (_unused, index) => [
    {id: index}, {id: index}
  ]).flat());
  const photoSeed = Math.floor(Math.random() * 100000000);
  const fragment = document.createDocumentFragment();
  items.forEach((item, position) => fragment.appendChild(createCard(item, position, photoSeed, version)));
  ui.board.replaceChildren(fragment);
  ui.board.classList.remove('is-preview');
  setBoardColumns(pairs);
  ui.hint.hidden = true;
  ui.pauseOverlay.hidden = true;
  ui.pause.disabled = false;
  ui.pause.innerHTML = '<span aria-hidden="true">Ⅱ</span> Pausar';
  ui.startLabel.textContent = 'Reiniciar partida';
  updateLevel();
  updateStatistics();
  updateBestRecord();
  updatePresetSelection();
  game.timerId = setInterval(updateTimer, 200);
  setMessage('Partida em andamento. Encontre duas fotografias iguais!');
  sound('flip');
}

function flipCard(card, item, position, version) {
  if (version !== game.version || !game.running || game.finished || game.paused || game.locked ||
      card.classList.contains('is-flipped') || card.classList.contains('is-matched')) return;
  card.classList.add('is-flipped');
  card.setAttribute('aria-label', `Carta ${position + 1}: fotografia revelada`);
  card.setAttribute('aria-pressed', 'true');
  sound('flip');
  if (!game.first) {
    game.first = {card, item, position};
    return;
  }
  game.second = {card, item, position};
  game.attempts++;
  game.locked = true;
  updateStatistics();
  const first = game.first;
  const second = game.second;
  if (first.item.id === second.item.id) {
    sound('match');
    game.flipTimeout = setTimeout(() => {
      if (version !== game.version) return;
      first.card.classList.add('is-matched');
      second.card.classList.add('is-matched');
      first.card.disabled = true;
      second.card.disabled = true;
      first.card.setAttribute('aria-label', `Par encontrado: carta ${first.position + 1}`);
      second.card.setAttribute('aria-label', `Par encontrado: carta ${second.position + 1}`);
      game.matches++;
      game.first = game.second = null;
      game.locked = false;
      updateStatistics();
      if (game.matches === game.pairs) finishGame();
    }, 380);
  } else {
    first.card.classList.add('is-wrong');
    second.card.classList.add('is-wrong');
    sound('wrong');
    game.flipTimeout = setTimeout(() => {
      if (version !== game.version) return;
      [first, second].forEach(({card: c, position: p}) => {
        c.classList.remove('is-flipped','is-wrong');
        c.setAttribute('aria-label', `Carta ${p + 1}, virada para baixo`);
        c.setAttribute('aria-pressed', 'false');
      });
      game.first = game.second = null;
      game.locked = false;
    }, 960);
  }
}

function pauseGame() {
  if (!game.running || game.finished) return;
  if (game.paused) {
    game.startedAt = performance.now();
    game.paused = false;
    ui.pauseOverlay.hidden = true;
    ui.pause.innerHTML = '<span aria-hidden="true">Ⅱ</span> Pausar';
    game.timerId = setInterval(updateTimer, 200);
    setMessage('Partida retomada. Boa sorte!');
  } else {
    game.elapsedMs = elapsedTime();
    game.paused = true;
    clearInterval(game.timerId);
    ui.pauseOverlay.hidden = false;
    ui.pause.innerHTML = '<span aria-hidden="true">▶</span> Retomar';
    updateTimer();
    setMessage('Partida pausada. O cronômetro está parado.');
  }
}

function finishGame() {
  game.elapsedMs = elapsedTime();
  game.finished = true;
  game.running = false;
  cancelActiveTimers();
  ui.pause.disabled = true;
  ui.startLabel.textContent = 'Nova partida';
  updateStatistics();
  const newRecord = saveRecord(game.elapsedMs);
  updateBestRecord();
  ui.winTime.textContent = formatTime(game.elapsedMs);
  ui.winAttempts.textContent = String(game.attempts);
  ui.winPairs.textContent = String(game.pairs);
  const stars = game.attempts <= game.pairs * 1.5 ? 3 : game.attempts <= game.pairs * 2.3 ? 2 : 1;
  ui.winStars.textContent = '★'.repeat(stars) + '☆'.repeat(3 - stars);
  ui.winStars.setAttribute('aria-label', `${stars} de 3 estrelas`);
  ui.winRecord.textContent = newRecord ? 'Novo recorde pessoal!' : 'Muito bem! Tente superar seu recorde.';
  setMessage('Vitória! Você encontrou todos os pares.');
  sound('win');
  if (typeof ui.dialog.showModal === 'function') ui.dialog.showModal();
  else ui.dialog.setAttribute('open', '');
}

function setZoom(next) {
  game.zoom = Math.max(.7, Math.min(1.3, Math.round(next * 10) / 10));
  ui.board.style.setProperty('--board-scale', game.zoom);
  ui.zoomLabel.textContent = `${Math.round(game.zoom * 100)}%`;
  ui.zoomIn.disabled = game.zoom >= 1.3;
  ui.zoomOut.disabled = game.zoom <= .7;
}

ui.presets.forEach((button) => button.addEventListener('click', () => {
  ui.input.value = button.dataset.pairs;
  updatePresetSelection();
  updateBestRecord();
  if (game.running) setMessage('Quantidade alterada. Clique em Reiniciar para aplicar.');
}));
ui.input.addEventListener('input', () => {
  updatePresetSelection();
  updateBestRecord();
  if (game.running) setMessage('Quantidade alterada. Clique em Reiniciar para aplicar.');
});
ui.start.addEventListener('click', startGame);
ui.previewStart.addEventListener('click', startGame);
ui.playAgain.addEventListener('click', startGame);
ui.closeWin.addEventListener('click', () => ui.dialog.close());
ui.pause.addEventListener('click', pauseGame);
ui.resume.addEventListener('click', pauseGame);
ui.zoomIn.addEventListener('click', () => setZoom(game.zoom + .1));
ui.zoomOut.addEventListener('click', () => setZoom(game.zoom - .1));
ui.sound.addEventListener('click', () => {
  game.soundEnabled = !game.soundEnabled;
  ui.sound.setAttribute('aria-pressed', String(game.soundEnabled));
  const label = game.soundEnabled ? 'Desativar efeitos sonoros' : 'Ativar efeitos sonoros';
  ui.sound.setAttribute('aria-label', label);
  ui.sound.title = label;
  ui.soundIcon.innerHTML = game.soundEnabled
    ? '<path d="M11 5 6 9H3v6h3l5 4V5Z"/><path d="M15 9a4 4 0 0 1 0 6"/><path d="M18 6a8 8 0 0 1 0 12"/>'
    : '<path d="M11 5 6 9H3v6h3l5 4V5Z"/><path d="m16 9 5 6m0-6-5 6"/>';
  if (game.soundEnabled) sound('match');
});
document.addEventListener('visibilitychange', () => {
  if (document.hidden && game.running && !game.paused) pauseGame();
});

// Carrega apenas uma prévia; o cronômetro começa após clicar em Iniciar.
previewBoard();
updateLevel();
updateStatistics();
updateBestRecord();
setZoom(1);

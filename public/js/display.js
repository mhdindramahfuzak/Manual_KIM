const socket = io();

const lastNumberDisplay = document.getElementById('last-number-display');
// const numberBoard = document.getElementById('number-board'); // DIHAPUS
const winnerToast = document.getElementById('winner-toast');
const gameStatusDisplay = document.getElementById('game-status-display');
const winConditionDisplay = document.getElementById('win-condition-display');
const winnerCountDisplay = document.getElementById('winner-count-display');
const winnerList = document.getElementById('winner-list');

// FUNGSI initBoard() DIHAPUS
// FUNGSI markNumberOnBoard(number) DIHAPUS

function showWinnerToast(winData) {
  winnerToast.innerHTML = `SELAMAT!<br><strong>${winData.name}</strong><br>Menang ${winData.description}!`;
  winnerToast.classList.add('show');
  setTimeout(() => winnerToast.classList.remove('show'), 5000);
}

function updateGameInfo(gameState) {
    // Status
    let statusText = 'Status: ' + gameState.status.toUpperCase();
    if(gameState.isPaused) statusText = 'Status: DIJEDA';
    gameStatusDisplay.textContent = statusText;

    // Kondisi Menang
    const conditionText = gameState.winCondition ? gameState.winCondition.replace('_', ' ') : '-';
    winConditionDisplay.textContent = `Target: ${conditionText}`;

    // Jumlah Pemenang
    winnerCountDisplay.textContent = `Pemenang: ${gameState.winners.length} / ${gameState.maxWinners}`;

    // Daftar Pemenang
    winnerList.innerHTML = gameState.winners.map(w =>
        `<li>[${w.time}] <strong>${w.name}</strong> (${w.description})</li>`
    ).join('');
}

// --- Event Listener Server ---
socket.on('connect', () => {
  socket.emit('GET_GAME_STATE');
});

socket.on('GAME_STATE_UPDATE', (gameState) => {
  lastNumberDisplay.innerText = gameState.lastNumber || '-';
  updateGameInfo(gameState); // Update info game
  // initBoard(); // DIHAPUS
  // gameState.calledNumbers.forEach(markNumberOnBoard); // DIHAPUS
});

socket.on('NEW_NUMBER', (number) => {
  lastNumberDisplay.innerText = number;
  // markNumberOnBoard(number); // DIHAPUS
});

socket.on('WINNER_ANNOUNCEMENT', (winData) => {
  showWinnerToast(winData);
  // Update daftar pemenang (langsung dari data atau tunggu GAME_STATE_UPDATE)
   const li = document.createElement('li');
   li.innerHTML = `[${winData.time}] <strong>${winData.name}</strong> (${winData.description})`;
   winnerList.prepend(li); // Tambah ke atas
   // Update count juga
   const currentCount = parseInt(winnerCountDisplay.textContent.split(':')[1].split('/')[0].trim());
   const maxWinners = parseInt(winnerCountDisplay.textContent.split('/')[1].trim());
   winnerCountDisplay.textContent = `Pemenang: ${currentCount + 1} / ${maxWinners}`;
});

socket.on('GAME_START', (data) => {
  lastNumberDisplay.innerText = '-';
  gameStatusDisplay.textContent = 'Status: RUNNING';
  winConditionDisplay.textContent = `Target: ${data.winCondition.replace('_', ' ')}`;
  winnerCountDisplay.textContent = 'Pemenang: 0 / ?'; // Max belum tahu
  winnerList.innerHTML = '';
  // initBoard(); // DIHAPUS
});

socket.on('GAME_STOP', (data) => {
  lastNumberDisplay.innerText = 'STOP';
  gameStatusDisplay.textContent = `Status: STOPPED - ${data.message}`;
});

socket.on('GAME_PAUSE_TOGGLE', (isPaused) => {
    gameStatusDisplay.textContent = isPaused ? 'Status: DIJEDA' : 'Status: RUNNING';
});

// --- Inisialisasi ---
// initBoard(); // DIHAPUS
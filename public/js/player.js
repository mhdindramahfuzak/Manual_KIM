const socket = io();

const playerId = localStorage.getItem('kim_player_id');
const playerName = localStorage.getItem('kim_player_name');

// --- Elemen DOM ---
const playerNameDisplay = document.getElementById('player-name');
const statusBar = document.getElementById('status-bar');
const lastNumberDisplay = document.getElementById('last-number');
const ticketsContainer = document.getElementById('tickets-container');
const winConditionDisplay = document.getElementById('win-condition-display');

// --- State Klien ---
let myTickets = []; // Tetap array, tapi isinya 1 tiket
let clientCalledNumbers = new Set(); // Ini adalah "kebenaran" (angka yg sudah dipanggil Admin)
let playerMarkedNumbers = new Set(); // Ini adalah "catatan" (angka yg sudah diklik Pemain)
let currentWinCondition = '';

// --- Fungsi ---

// (FUNGSI BARU) Muat tanda dari localStorage
function loadPlayerMarks() {
    // Kita pakai ID pemain agar unik
    const marks = localStorage.getItem(`kim_marks_${playerId}`);
    if (marks) {
        playerMarkedNumbers = new Set(JSON.parse(marks));
    }
}

// (FUNGSI BARU) Simpan tanda ke localStorage
function savePlayerMarks() {
    localStorage.setItem(`kim_marks_${playerId}`, JSON.stringify(Array.from(playerMarkedNumbers)));
}


function renderTickets(tickets) {
  if (tickets.length === 0) return;
  
  const ticket = tickets[0];
  myTickets = tickets;

  ticketsContainer.innerHTML = ''; // Kosongkan kontainer

  const ticketEl = document.createElement('div');
  ticketEl.classList.add('ticket-section', 'ticket-single'); 
  ticketEl.dataset.ticketId = ticket.id;

  let ticketHTML = `<h3>Tiket Utama</h3>`;
  ticketHTML += `<div class="ticket-grid-5x6">`;

  ticket.cols.forEach(column => {
    column.forEach(number => {
      ticketHTML += `<div class="number-cell"
                         data-number="${number}"
                         data-ticket-id="${ticket.id}">
                       ${number}
                     </div>`;
    });
  });
  ticketHTML += `</div>`; 

  ticketHTML += `<div class="prize-buttons">
      <button class="claim-button" data-ticket-id="${ticket.id}">Klaim Hadiah!</button>
    </div>`;

  ticketEl.innerHTML = ticketHTML;
  ticketsContainer.appendChild(ticketEl);
  
  document.querySelectorAll('.number-cell').forEach(cell => {
    cell.addEventListener('click', handleNumberClick);
  });

  document.querySelector('.claim-button').addEventListener('click', handleClaimClick);

  // Tandai angka yg sudah dipanggil saat render awal
  updateCalledNumbersOnTickets();
}

// Fungsi ini SEKARANG HANYA menandai berdasarkan apa yg DIKLIK pemain
function updateCalledNumbersOnTickets() {
    document.querySelectorAll('.number-cell').forEach(cell => {
        // DIGANTI: Cek ke 'playerMarkedNumbers', bukan 'clientCalledNumbers'
        if (playerMarkedNumbers.has(parseInt(cell.dataset.number))) {
            cell.classList.add('marked');
        } else {
             cell.classList.remove('marked');
        }
    });
    // Aktifkan tombol klaim (logika ini tetap cek ke "kebenaran"/clientCalledNumbers)
    if (myTickets.length > 0) {
      checkWinConditionOnTicket(myTickets[0].id);
    }
}

function handleNumberClick(e) {
  const cell = e.target;
  const number = parseInt(cell.dataset.number);
  const ticketId = cell.dataset.ticketId;

  // Cek ke "kebenaran" (clientCalledNumbers)
  if (clientCalledNumbers.has(number)) {
    // Jika benar, tandai
    cell.classList.add('marked');
    // (BARU) Catat di "catatan" pemain
    playerMarkedNumbers.add(number); 
    // (BARU) Simpan catatan
    savePlayerMarks(); 
    
    // Cek kondisi menang (tetap pakai "kebenaran")
    checkWinConditionOnTicket(ticketId);
  } else {
    // Jika salah (angka belum dipanggil), goyang
    cell.classList.add('shake');
    setTimeout(() => cell.classList.remove('shake'), 300);
  }
}

// Fungsi ini TIDAK BERUBAH. Tombol klaim aktif berdasarkan "kebenaran" (clientCalledNumbers),
// BUKAN berdasarkan apa yg dicentang pemain. Ini mencegah pemain curang.
function checkWinConditionOnTicket(ticketId) {
    if (myTickets.length === 0) return;
    const ticket = myTickets[0];
    if (!ticket) return;

    const claimButton = document.querySelector(`.claim-button[data-ticket-id="${ticketId}"]`);
    if (!claimButton || claimButton.innerText === 'KLAIM SUKSES') return;

    let canClaim = false;
    let completedRowsCount = 0;
    
    // Cek 6 baris berdasarkan "kebenaran" (angka yg dipanggil Admin)
    ticket.rows.forEach(row => {
        if (row.every(num => clientCalledNumbers.has(num))) {
            completedRowsCount++;
        }
    });
    
    let isFullHouse = ticket.allNumbers.every(num => clientCalledNumbers.has(num));

    if (currentWinCondition === '1_row' && completedRowsCount === 1) {
        canClaim = true;
    } else if (currentWinCondition === '2_rows' && completedRowsCount === 2) {
        canClaim = true;
    } else if (currentWinCondition === '3_rows' && completedRowsCount === 3) {
        canClaim = true;
    } else if (currentWinCondition === '4_rows' && completedRowsCount === 4) {
        canClaim = true;
    } else if (currentWinCondition === '5_rows' && completedRowsCount === 5) {
        canClaim = true;
    } else if (currentWinCondition === 'full_house' && isFullHouse) {
        // Full house adalah pengecualian, tetap >= 30 (atau 'isFullHouse')
        canClaim = true;
    }
  
    claimButton.disabled = !canClaim;
}


function handleClaimClick(e) {
  const button = e.target;
  const ticketId = button.dataset.ticketId;

  socket.emit('CLAIM_WIN', ticketId);
  button.disabled = true;
  button.innerText = 'Memvalidasi...';
}

function updateGameStatusUI(status, message = '', winCondition = '') {
  statusBar.className = `status-${status}`;
  let statusText = message;
  currentWinCondition = winCondition; 

  if (status === 'running' || status === 'paused') {
      const conditionText = winCondition.replace('_', ' ');
      winConditionDisplay.textContent = conditionText;
      statusText = status === 'paused' ? 'Permainan Dijeda Admin...' : 'Permainan Berlangsung...';
  } else {
      winConditionDisplay.textContent = '?';
  }
  statusBar.textContent = statusText + (winCondition ? ` | Target: ${winCondition.replace('_', ' ')}` : '');
}

// --- Logika Utama Saat Halaman Dimuat ---
if (!playerId || !playerName) {
  window.location.href = '/';
} else {
  playerNameDisplay.innerText = playerName;
  loadPlayerMarks(); // (BARU) Muat "catatan" pemain dulu
  socket.emit('GET_PLAYER_DATA', playerId); // Baru minta data tiket
}

// --- Event Listener dari Server ---

socket.on('PLAYER_DATA', (player) => {
  renderTickets(player.tickets);
});

socket.on('GAME_STATE_UPDATE', (gameState) => {
  clientCalledNumbers = new Set(gameState.calledNumbers); // Update "kebenaran"
  lastNumberDisplay.innerText = gameState.lastNumber || '-';
  updateGameStatusUI(gameState.status, '', gameState.winCondition);
  // (DIUBAH) Ini sekarang aman, hanya update visual berdasarkan "catatan" pemain
  updateCalledNumbersOnTickets(); 
});

socket.on('NEW_NUMBER', (number) => {
  clientCalledNumbers.add(number); // Update "kebenaran"
  lastNumberDisplay.innerText = number;
  
  // (DIUBAH) Kita TIDAK panggil 'updateCalledNumbersOnTickets' di sini.
  // Kita HANYA cek apakah tombol Klaim bisa diaktifkan.
  if (myTickets.length > 0) {
    checkWinConditionOnTicket(myTickets[0].id);
  }
});

socket.on('CLAIM_APPROVED', (winData) => {
  alert(`SELAMAT! Klaim Anda untuk ${winData.description} di tiket ${winData.ticketId} DISAHKAN!`);
  const button = document.querySelector(`.claim-button[data-ticket-id="${winData.ticketId}"]`);
  if (button) {
    button.innerText = 'KLAIM SUKSES';
    button.style.backgroundColor = '#28a745';
    button.disabled = true;
  }
});

socket.on('CLAIM_DENIED', (message) => {
  alert(message);
  const button = document.querySelector(`.claim-button`);
  if (button && button.innerText !== 'KLAIM SUKSES') {
    button.disabled = false;
    button.innerText = 'Klaim Hadiah!';
    checkWinConditionOnTicket(button.dataset.ticketId);
  }
});

socket.on('ERROR_REDIRECT', (message) => {
  alert(message);
  // (BARU) Hapus "catatan" pemain jika error
  localStorage.removeItem(`kim_marks_${playerId}`); 
  localStorage.clear();
  window.location.href = '/';
});

socket.on('GAME_START', (data) => {
  updateGameStatusUI('running', 'Permainan dimulai!', data.winCondition);
  const button = document.querySelector('.claim-button');
  if (button) {
      button.disabled = true;
      button.innerText = 'Klaim Hadiah!';
      button.style.backgroundColor = '';
  }
  clientCalledNumbers.clear(); // Hapus "kebenaran"
  playerMarkedNumbers.clear(); // (BARU) Hapus "catatan" pemain
  savePlayerMarks(); // (BARU) Simpan "catatan" yg kosong
  updateCalledNumbersOnTickets(); // Update visual (hapus semua centang)
});

socket.on('GAME_STOP', (data) => {
  updateGameStatusUI('stopped', data.message);
  const button = document.querySelector('.claim-button');
  if (button) button.disabled = true;
});

socket.on('GAME_PAUSE_TOGGLE', (isPaused) => {
    updateGameStatusUI(isPaused ? 'paused' : 'running', '', currentWinCondition);
});
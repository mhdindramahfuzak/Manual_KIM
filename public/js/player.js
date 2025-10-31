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
let myTickets = []; 
let clientCalledNumbers = new Set(); // "Kebenaran" dari Server
let playerMarkedNumbers = new Set(); // "Catatan" klik dari Pemain

// --- Fungsi ---
function loadPlayerMarks() {
    const marks = localStorage.getItem(`kim_marks_${playerId}`);
    if (marks) {
        playerMarkedNumbers = new Set(JSON.parse(marks));
    }
}

function savePlayerMarks() {
    localStorage.setItem(`kim_marks_${playerId}`, JSON.stringify(Array.from(playerMarkedNumbers)));
}


function renderTickets(tickets) {
  if (tickets.length === 0) return;
  
  const ticket = tickets[0];
  myTickets = tickets;

  ticketsContainer.innerHTML = '';
  const ticketEl = document.createElement('div');
  ticketEl.classList.add('ticket-section', 'ticket-single'); 
  ticketEl.dataset.ticketId = ticket.id;

  let ticketHTML = `<h3>Tiket Utama</h3>`;
  ticketHTML += `<div class="ticket-layout-container">`;

  // Render grid berdasarkan TICKET.ROWS
  ticketHTML += `<div class="ticket-grid-5x6">`;
  ticket.rows.forEach(row => { 
    row.forEach(number => { 
      ticketHTML += `<div class="number-cell"
                         data-number="${number}"
                         data-ticket-id="${ticket.id}">
                       ${number}
                     </div>`;
    });
  });
  ticketHTML += `</div>`; 

  // Buat 6 Tombol Klaim
  ticketHTML += `<div class="prize-buttons">`;
  for (let i = 0; i < 6; i++) {
      ticketHTML += `<button class="claim-button" 
                         data-ticket-id="${ticket.id}" 
                         data-row-index="${i}" 
                         disabled>
                     Klaim Baris ${i + 1}
                     </button>`;
  }
  ticketHTML += `</div>`;
  ticketHTML += `</div>`; 

  ticketEl.innerHTML = ticketHTML;
  ticketsContainer.appendChild(ticketEl);
  
  document.querySelectorAll('.number-cell').forEach(cell => {
    cell.addEventListener('click', handleNumberClick);
  });

  document.querySelectorAll('.claim-button').forEach(button => {
    button.addEventListener('click', handleClaimClick);
  });

  updateTicketVisuals();
}

function updateTicketVisuals() {
    
    // TUGAS 1: Tandai Sel berdasarkan "Catatan" Pemain
    document.querySelectorAll('.number-cell').forEach(cell => {
        const number = parseInt(cell.dataset.number);
        if (playerMarkedNumbers.has(number)) {
            cell.classList.add('marked'); 
            cell.style.cursor = 'default'; 
        } else {
             cell.classList.remove('marked');
             cell.style.cursor = 'pointer'; 
        }
    });

    // --- PERUBAHAN LOGIKA DI SINI ---
    // TUGAS 2: Cek Tombol Klaim 
    if (myTickets.length === 0) return;
    const ticket = myTickets[0];

    for (let i = 0; i < 6; i++) {
        const button = document.querySelector(`.claim-button[data-row-index="${i}"]`);
        if (!button || button.innerText === 'KLAIM SUKSES') continue;
        
        const row = ticket.rows[i];
        
        // Syarat 1: Cek apakah SEMUA angka di baris ini sudah dipanggil server
        const isServerValid = row.every(num => clientCalledNumbers.has(num));
        
        // Syarat 2: Cek apakah SEMUA angka di baris ini sudah diklik pemain
        const isPlayerMarked = row.every(num => playerMarkedNumbers.has(num));
        
        // Tombol HANYA aktif jika KEDUA syarat terpenuhi
        button.disabled = !(isServerValid && isPlayerMarked);
    }
    // --- AKHIR PERUBAHAN LOGIKA ---
}

function handleNumberClick(e) {
  const cell = e.target;
  const number = parseInt(cell.dataset.number);

  if (clientCalledNumbers.has(number)) {
    cell.classList.add('marked');
    cell.style.cursor = 'default';
    
    playerMarkedNumbers.add(number); 
    savePlayerMarks(); 
    
    // --- TAMBAHAN PENTING ---
    // Setelah klik, cek ulang semua tombol
    updateTicketVisuals(); 
    // --- AKHIR TAMBAHAN ---

  } else {
    cell.classList.add('shake');
    setTimeout(() => cell.classList.remove('shake'), 300);
  }
}


function handleClaimClick(e) {
  const button = e.target;
  const ticketId = button.dataset.ticketId;
  const rowIndex = parseInt(button.dataset.rowIndex); 
  socket.emit('CLAIM_ROW', { ticketId, rowIndex });
  button.disabled = true;
  button.innerText = 'Memvalidasi...';
}

function updateGameStatusUI(status, message = '', winCondition = '') {
  statusBar.className = `status-${status}`;
  let statusText = message;
  currentWinCondition = winCondition; 

  if (status === 'running' || status === 'paused') {
      let conditionText = winCondition.replace('_', ' ');
      if (winCondition === 'full_house') conditionText = '6 Baris (Full House)';
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
  loadPlayerMarks(); 
  socket.emit('GET_PLAYER_DATA', playerId); 
}

// --- Event Listener dari Server ---

socket.on('PLAYER_DATA', (player) => {
  renderTickets(player.tickets);
  updateTicketVisuals();
});

socket.on('GAME_STATE_UPDATE', (gameState) => {
  clientCalledNumbers = new Set(gameState.calledNumbers); 
  lastNumberDisplay.innerText = gameState.lastNumber || '-';
  updateGameStatusUI(gameState.status, '', gameState.winCondition);
  updateTicketVisuals(); 
});

socket.on('NEW_NUMBER', (number) => {
  clientCalledNumbers.add(number); 
  lastNumberDisplay.innerText = number;
  // Ini akan cek tombol, tapi tombol tidak akan nyala
  // sampai pemain mengklik angkanya
  updateTicketVisuals();
});

socket.on('ROW_CLAIM_APPROVED', (data) => {
    const button = document.querySelector(`.claim-button[data-row-index="${data.rowIndex}"]`);
    if (button) {
        button.innerText = 'KLAIM SUKSES';
        button.style.backgroundColor = '#28a745';
        button.disabled = true;
    }
});

socket.on('WINNER_ANNOUNCEMENT', (winData) => {
    if (winData.playerId === playerId) {
         alert(`SELAMAT! Anda memenangkan target: ${winData.description}!`);
    }
});

socket.on('CLAIM_DENIED', (data) => {
  alert(data.message);
  const button = document.querySelector(`.claim-button[data-row-index="${data.rowIndex}"]`);
  if (button && button.innerText !== 'KLAIM SUKSES') {
    updateTicketVisuals(); 
  }
});

socket.on('ERROR_REDIRECT', (message) => {
  alert(message);
  localStorage.removeItem(`kim_marks_${playerId}`);
  localStorage.clear();
  window.location.href = '/';
});

socket.on('GAME_START', (data) => {
  updateGameStatusUI('running', 'Permainan dimulai!', data.winCondition);
  document.querySelectorAll('.claim-button').forEach((button, i) => {
      button.disabled = true;
      button.innerText = `Klaim Baris ${i + 1}`;
      button.style.backgroundColor = '';
  });
  
  clientCalledNumbers.clear();
  playerMarkedNumbers.clear(); 
  savePlayerMarks(); 
  updateTicketVisuals();
});

socket.on('GAME_STOP', (data) => {
  updateGameStatusUI('stopped', data.message);
  document.querySelectorAll('.claim-button').forEach(button => {
      button.disabled = true;
  });
});

socket.on('GAME_PAUSE_TOGGLE', (isPaused) => {
    updateGameStatusUI(isPaused ? 'paused' : 'running', '', currentWinCondition);
});
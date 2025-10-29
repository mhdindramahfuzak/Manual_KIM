import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import path from 'path';
import { fileURLToPath } from 'url';

// --- Setup Server ---
const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer);

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

app.use(express.static(path.join(__dirname, 'public')));

// --- Routing Halaman ---
app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'public', 'index.html')));
app.get('/game', (req, res) => res.sendFile(path.join(__dirname, 'public', 'game.html')));
app.get('/display', (req, res) => res.sendFile(path.join(__dirname, 'public', 'display.html')));
app.get('/admin', (req, res) => res.sendFile(path.join(__dirname, 'public', 'admin.html')));
app.get('/monitor', (req, res) => res.sendFile(path.join(__dirname, 'public', 'monitor.html')));

// --- State Management Game ---
const ADMIN_PASSWORD = 'admin123';
let gameState = {
  status: 'idle', // idle, running, paused, stopped
  calledNumbers: new Set(), // Tetap Set untuk logika server
  lastNumber: null,
  winners: [],
  maxWinners: 10,
  winCondition: '1_row', // (1_row, 2_rows, 3_rows, 5_rows, full_house)
  isPaused: false,
};
let players = new Map(); // playerId -> { id, name, tickets: [ ... ], socketId }

// --- Fungsi Helper Game ---

// *** FUNGSI BARU UNTUK MEMPERBAIKI ERROR ***
// Ini mengubah state internal (dengan Set) menjadi state yang aman dikirim (dengan Array)
function getEmitSafeGameState() {
  return {
    ...gameState, // Salin semua properti lain
    calledNumbers: Array.from(gameState.calledNumbers) // UBAH Set jadi Array
  };
}

// MEMBUAT TIKET BARU (5 Kolom x 6 Baris = 30 Angka)
function generateTicket() {
  const numbers = new Set();
  while (numbers.size < 30) {
    numbers.add(Math.floor(Math.random() * 90) + 1);
  }
  const arr = Array.from(numbers);
  
  const cols = [];
  for (let i = 0; i < 5; i++) {
      cols.push(arr.slice(i * 6, (i + 1) * 6).sort((a,b)=>a-b));
  }

  const rows = [];
  for (let i = 0; i < 6; i++) {
      rows.push([
          cols[0][i], 
          cols[1][i], 
          cols[2][i], 
          cols[3][i], 
          cols[4][i]
      ].sort((a,b)=>a-b));
  }

  return {
    id: `T-${Math.random().toString(36).substr(2, 9)}`,
    rows: rows,
    cols: cols,
    allNumbers: arr,
    wonRows: [false, false, false, false, false, false],
    isComplete: false,
  };
}


// Fungsi memulai permainan
function startGame(settings) {
  if (gameState.status === 'running' || gameState.status === 'paused') return;

  console.log('Permainan dimulai oleh Admin!', settings);
  gameState.status = 'running';
  gameState.calledNumbers.clear();
  gameState.winners = [];
  gameState.lastNumber = null;
  gameState.isPaused = false;
  gameState.maxWinners = settings.maxWinners || 10;
  gameState.winCondition = settings.winCondition || '1_row';

   players.forEach(player => {
    player.tickets.forEach(ticket => {
      ticket.wonRows = [false, false, false, false, false, false];
      ticket.isComplete = false;
    });
   });

  io.emit('GAME_START', { winCondition: gameState.winCondition });
  io.emit('GAME_STATE_UPDATE', getEmitSafeGameState());
}

// Fungsi menghentikan permainan
function stopGame(message = 'Permainan dihentikan oleh Admin.') {
  if (gameState.status === 'idle' || gameState.status === 'stopped') return;

  gameState.status = 'stopped';
  gameState.isPaused = false;
  io.emit('GAME_STOP', { message });
  io.emit('GAME_STATE_UPDATE', getEmitSafeGameState());
  console.log(message);
}

// Fungsi Pause/Resume
function togglePauseGame() {
    if (gameState.status !== 'running' && gameState.status !== 'paused') return;

    gameState.isPaused = !gameState.isPaused;
    gameState.status = gameState.isPaused ? 'paused' : 'running';
    io.emit('GAME_PAUSE_TOGGLE', gameState.isPaused);
    io.emit('GAME_STATE_UPDATE', getEmitSafeGameState());
    console.log(`Permainan ${gameState.isPaused ? 'dipause' : 'dilanjutkan'}.`);
}


// --- Logika Koneksi Socket.IO ---
io.on('connection', (socket) => {
  console.log(`Klien baru terhubung: ${socket.id}`);

  // --- Event Login Pemain ---
  socket.on('PLAYER_LOGIN', (name) => {
    let nameExists = false;
    for (const player of players.values()) {
      if (player.name.toLowerCase() === name.toLowerCase()) {
        nameExists = true;
        break;
      }
    }
    if (nameExists) {
      return socket.emit('LOGIN_FAILED', 'Nama ini sudah digunakan pemain lain.');
    }

    const ticket = generateTicket();
    const playerId = `P-${socket.id}`;
    players.set(playerId, { id: playerId, name: name, tickets: [ticket], socketId: socket.id }); 
    socket.data.playerId = playerId;

    socket.emit('LOGIN_SUCCESS', { id: playerId, name: name });
    console.log(`Pemain ${name} (ID: ${playerId}) telah login.`);
  });

  // --- Event Halaman Game Pemain ---
  socket.on('GET_PLAYER_DATA', (playerId) => {
    const player = players.get(playerId);
    if (player) {
      player.socketId = socket.id;
      socket.data.playerId = playerId;
      socket.emit('PLAYER_DATA', player);
      socket.emit('GAME_STATE_UPDATE', getEmitSafeGameState());
    } else {
      socket.emit('ERROR_REDIRECT', 'Data pemain tidak ditemukan, silakan login kembali.');
    }
  });

  // --- Event Halaman Admin, Display, Monitor ---
  socket.on('GET_GAME_STATE', () => {
    socket.emit('GAME_STATE_UPDATE', getEmitSafeGameState());
  });

  // --- Event Admin ---
  socket.on('ADMIN_LOGIN', (password) => {
    if (password === ADMIN_PASSWORD) {
      socket.emit('ADMIN_AUTHORIZED');
      socket.data.isAdmin = true;
      console.log('Admin telah login.');
    } else {
      socket.emit('ADMIN_DENIED');
    }
  });

  socket.on('ADMIN_START_GAME', (settings) => {
    if (socket.data.isAdmin) startGame(settings);
  });

  socket.on('ADMIN_STOP_GAME', () => {
    if (socket.data.isAdmin) stopGame();
  });

  socket.on('ADMIN_TOGGLE_PAUSE', () => {
      if (socket.data.isAdmin) togglePauseGame();
  });

  socket.on('ADMIN_CALL_NUMBER', (number) => {
    if (!socket.data.isAdmin) return;
    if (gameState.status !== 'running') return;
    if (gameState.calledNumbers.has(number)) return;

    console.log(`Admin memanggil angka: ${number}`);
    gameState.calledNumbers.add(number); // Server tetap pakai Set
    gameState.lastNumber = number;

    io.emit('NEW_NUMBER', number);
    io.emit('GAME_STATE_UPDATE', getEmitSafeGameState());
  });

  // --- Event Klaim Kemenangan dari Pemain ---
  socket.on('CLAIM_WIN', (ticketId) => {
    const playerId = socket.data.playerId;
    const player = players.get(playerId);

    if (!player || (gameState.status !== 'running' && gameState.status !== 'paused')) {
      return socket.emit('CLAIM_DENIED', 'Gagal klaim: Permainan tidak sedang/sedang dijeda.');
    }
    if (gameState.winners.length >= gameState.maxWinners) {
       return socket.emit('CLAIM_DENIED', 'Maaf, kuota pemenang sudah terpenuhi.');
    }

    const ticket = player.tickets.find(t => t.id === ticketId);
    if (!ticket) return socket.emit('CLAIM_DENIED', 'Tiket tidak ditemukan.');

    let isWinner = false;
    let winDescription = '';

    let newlyCompletedRows = [];
    ticket.rows.forEach((row, index) => {
        if (!ticket.wonRows[index] && row.every(num => gameState.calledNumbers.has(num))) {
            newlyCompletedRows.push(index);
        }
    });

    let isFullHouse = ticket.allNumbers.every(num => gameState.calledNumbers.has(num));

    // --- BLOK VALIDASI YANG DIPERBARUI ---
    if (gameState.winCondition === '1_row') {
        if (newlyCompletedRows.length >= 1) {
            let winningRowIndex = newlyCompletedRows[0];
            isWinner = true;
            winDescription = `Baris ${winningRowIndex + 1}`;
            ticket.wonRows[winningRowIndex] = true;
        }
    } else if (gameState.winCondition === '2_rows') {
        if (newlyCompletedRows.length >= 2) {
             isWinner = true;
             winDescription = `2 Baris (Baris ${newlyCompletedRows[0]+1} & ${newlyCompletedRows[1]+1})`;
             ticket.wonRows[newlyCompletedRows[0]] = true;
             ticket.wonRows[newlyCompletedRows[1]] = true;
        }
    } else if (gameState.winCondition === '3_rows') { // <-- Logika 3 Baris
        if (newlyCompletedRows.length >= 3) {
             isWinner = true;
             winDescription = `3 Baris (Baris ${newlyCompletedRows[0]+1}, ${newlyCompletedRows[1]+1} & ${newlyCompletedRows[2]+1})`;
             ticket.wonRows[newlyCompletedRows[0]] = true; 
             ticket.wonRows[newlyCompletedRows[1]] = true;
             ticket.wonRows[newlyCompletedRows[2]] = true;
        }
    } else if (gameState.winCondition === '4_rows') { // <-- LOGIKA BARU 4 BARIS
        if (newlyCompletedRows.length >= 4) {
             isWinner = true;
             winDescription = `4 Baris (Baris ${newlyCompletedRows[0]+1}, ${newlyCompletedRows[1]+1}, ${newlyCompletedRows[2]+1}, ${newlyCompletedRows[3]+1})`;
             // Tandai 4 baris
             ticket.wonRows[newlyCompletedRows[0]] = true; 
             ticket.wonRows[newlyCompletedRows[1]] = true;
             ticket.wonRows[newlyCompletedRows[2]] = true;
             ticket.wonRows[newlyCompletedRows[3]] = true;
        }
    } else if (gameState.winCondition === '5_rows') { // <-- LOGIKA BARU 5 BARIS
        if (newlyCompletedRows.length >= 5) {
             isWinner = true;
             winDescription = `5 Baris (Baris ${newlyCompletedRows[0]+1}, ${newlyCompletedRows[1]+1}, ${newlyCompletedRows[2]+1}, ${newlyCompletedRows[3]+1}, ${newlyCompletedRows[4]+1})`;
             // Tandai 5 baris
             ticket.wonRows[newlyCompletedRows[0]] = true; 
             ticket.wonRows[newlyCompletedRows[1]] = true;
             ticket.wonRows[newlyCompletedRows[2]] = true;
             ticket.wonRows[newlyCompletedRows[3]] = true;
             ticket.wonRows[newlyCompletedRows[4]] = true;
        }
    } else if (gameState.winCondition === 'full_house') {
        if (!ticket.isComplete && isFullHouse) {
            isWinner = true;
            winDescription = 'Full House';
            ticket.isComplete = true;
        }
    }
    // --- AKHIR BLOK VALIDASI ---

    if (isWinner) {
      const winData = {
        name: player.name,
        ticketId: ticket.id,
        description: winDescription,
        time: new Date().toLocaleTimeString('id-ID')
      };
      gameState.winners.push(winData);
      console.log(`KLAIM SUKSES: ${player.name} menang ${winDescription}.`);
      socket.emit('CLAIM_APPROVED', winData);
      io.emit('WINNER_ANNOUNCEMENT', winData);
      io.emit('GAME_STATE_UPDATE', getEmitSafeGameState());

      if (gameState.winners.length >= gameState.maxWinners) {
        setTimeout(() => {
             if(gameState.status === 'running' || gameState.status === 'paused'){
                 stopGame('Kuota pemenang telah tercapai!');
             }
        }, 1000);
      }
    } else {
      console.log(`KLAIM GAGAL/PALSU: ${player.name} di tiket ${ticketId}`);
      socket.emit('CLAIM_DENIED', `Klaim Anda tidak valid untuk kondisi "${gameState.winCondition.replace('_', ' ')}"!`);
    }
  });

  // --- Disconnect ---
  socket.on('disconnect', () => {
    console.log(`Klien terputus: ${socket.id}`);
  });
});

// --- Jalankan Server ---
const PORT = process.env.PORT || 3000;
httpServer.listen(PORT, () => {
  console.log(`Server game KIM (v3 - Mod 1 Tiket) berjalan di:`);
  console.log(`  Halaman Login  : http://localhost:${PORT}/`);
  console.log(`  Halaman Display: http://localhost:${PORT}/display`);
  console.log(`  Halaman Admin  : http://localhost:${PORT}/admin`);
  console.log(`  Halaman Monitor: http://localhost:${PORT}/monitor`);
});
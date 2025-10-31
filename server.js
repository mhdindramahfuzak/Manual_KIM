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
  status: 'idle',
  calledNumbers: new Set(),
  lastNumber: null,
  winners: [],
  maxWinners: 10,
  winCondition: '1_row',
  isPaused: false,
};
let players = new Map();

// --- Fungsi Helper Game ---

function getEmitSafeGameState() {
  return {
    ...gameState,
    calledNumbers: Array.from(gameState.calledNumbers) 
  };
}

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
      // --- PERBAIKAN DI SINI ---
      // Kita HAPUS .sort() agar data baris = data visual
      rows.push([
          cols[0][i], 
          cols[1][i], 
          cols[2][i], 
          cols[3][i], 
          cols[4][i]
      ]);
      // --- AKHIR PERBAIKAN ---
  }

  return {
    id: `T-${Math.random().toString(36).substr(2, 9)}`,
    rows: rows, // Sekarang berisi data baris visual (tidak diurut)
    cols: cols, // Ini masih dipakai untuk membuat tiket, tidak apa-apa
    allNumbers: arr,
    claimedRowIndices: new Set(),
    winClaims: new Set() 
  };
}


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
      ticket.claimedRowIndices.clear();
      ticket.winClaims.clear();
    });
   });

  io.emit('GAME_START', { winCondition: gameState.winCondition });
  io.emit('GAME_STATE_UPDATE', getEmitSafeGameState());
}

function stopGame(message = 'Permainan dihentikan oleh Admin.') {
  if (gameState.status === 'idle' || gameState.status === 'stopped') return;
  gameState.status = 'stopped';
  gameState.isPaused = false;
  io.emit('GAME_STOP', { message });
  io.emit('GAME_STATE_UPDATE', getEmitSafeGameState());
  console.log(message);
}

function togglePauseGame() {
    if (gameState.status !== 'running' && gameState.status !== 'paused') return;
    gameState.isPaused = !gameState.isPaused;
    gameState.status = gameState.isPaused ? 'paused' : 'running';
    io.emit('GAME_PAUSE_TOGGLE', gameState.isPaused);
    io.emit('GAME_STATE_UPDATE', getEmitSafeGameState());
    console.log(`Permainan ${gameState.isPaused ? 'dipause' : 'dilanjutkan'}.`);
}

// --- Fungsi Helper untuk Cek Menang ---
function checkMainWin(player, ticket) {
    const totalClaims = ticket.claimedRowIndices.size; 
    const condition = gameState.winCondition; 

    let targetCount = 0;
    if (condition === 'full_house') {
        targetCount = 6; 
    } else {
        targetCount = parseInt(condition.split('_')[0]) || 1;
    }

    if (totalClaims >= targetCount && !ticket.winClaims.has(condition)) {
        
        ticket.winClaims.add(condition);

        const winData = {
            playerId: player.id, 
            name: player.name,
            ticketId: ticket.id,
            description: condition.replace('_', ' '),
            time: new Date().toLocaleTimeString('id-ID')
        };
        gameState.winners.push(winData);
        console.log(`KLAIM UTAMA SUKSES: ${player.name} menang ${winData.description}.`);
        
        io.emit('WINNER_ANNOUNCEMENT', winData); 
        io.emit('GAME_STATE_UPDATE', getEmitSafeGameState()); 

        if (gameState.winners.length >= gameState.maxWinners) {
            setTimeout(() => {
                if(gameState.status === 'running' || gameState.status === 'paused'){
                    stopGame('Kuota pemenang telah tercapai!');
                }
            }, 1000);
        }
    }
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
    gameState.calledNumbers.add(number); 
    gameState.lastNumber = number;

    io.emit('NEW_NUMBER', number);
    io.emit('GAME_STATE_UPDATE', getEmitSafeGameState());
  });


  // --- (PERUBAHAN BESAR) Event Klaim BARIS dari Pemain ---
  socket.on('CLAIM_ROW', (data) => {
    const { ticketId, rowIndex } = data;
    const playerId = socket.data.playerId;
    const player = players.get(playerId);
    
    const deny = (message) => {
        socket.emit('CLAIM_DENIED', { rowIndex, message });
    };

    if (!player || (gameState.status !== 'running' && gameState.status !== 'paused')) {
      return deny('Gagal klaim: Permainan tidak sedang/sedang dijeda.');
    }
    if (gameState.winners.length >= gameState.maxWinners) {
       return deny('Maaf, kuota pemenang sudah terpenuhi.');
    }

    const ticket = player.tickets.find(t => t.id === ticketId);
    if (!ticket) return deny('Tiket tidak ditemukan.');

    if (ticket.claimedRowIndices.has(rowIndex)) {
        return deny(`Anda sudah pernah klaim Baris ${rowIndex + 1}!`);
    }

    const row = ticket.rows[rowIndex]; // Ambil data baris (sekarang sudah tidak di-sort)
    const isRowComplete = row.every(num => gameState.calledNumbers.has(num));

    if (isRowComplete) {
      console.log(`KLAIM BARIS: ${player.name} sukses klaim Baris ${rowIndex + 1}.`);
      ticket.claimedRowIndices.add(rowIndex);

      socket.emit('ROW_CLAIM_APPROVED', { 
          rowIndex: rowIndex, 
          description: `Baris ${rowIndex + 1}`
      });

      checkMainWin(player, ticket);

    } else {
      console.log(`KLAIM GAGAL: ${player.name} di Baris ${rowIndex + 1} (belum lengkap)`);
      return deny(`Klaim Baris ${rowIndex + 1} tidak valid! Angka belum lengkap.`);
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
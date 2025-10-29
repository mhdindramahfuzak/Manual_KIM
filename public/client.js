// Inisialisasi koneksi ke server
const socket = io();

// --- Variabel Global Sisi Klien ---
let myCard = []; // Menyimpan angka di kupon kita
let myMarkedNumbers = new Set(); // Menyimpan angka yang sudah kita tandai

// --- Ambil Elemen DOM ---
const cardContainer = document.getElementById('card-container');
const kimButton = document.getElementById('kim-button');
const startButton = document.getElementById('start-button');
const gameStatus = document.getElementById('game-status');
const currentNumber = document.getElementById('current-number');

// --- Fungsi Helper ---

// Fungsi untuk menampilkan kupon di layar
function renderCard(cardNumbers) {
  cardContainer.innerHTML = ''; // Kosongkan dulu
  cardNumbers.sort((a, b) => a - b); // Urutkan angka
  
  for (const number of cardNumbers) {
    const cell = document.createElement('div');
    cell.classList.add('number-cell');
    cell.id = `cell-${number}`; // Beri ID agar mudah dicari
    cell.innerText = number;
    cardContainer.appendChild(cell);
  }
}

// Fungsi untuk menandai angka di UI
function markNumberOnUI(number) {
  const cell = document.getElementById(`cell-${number}`);
  if (cell) {
    cell.classList.add('marked');
  }
}

// Fungsi untuk cek apakah kita sudah menang
function checkWinCondition() {
  if (myMarkedNumbers.size === myCard.length) {
    kimButton.disabled = false; // Aktifkan tombol KIM!
    gameStatus.innerText = "KUPON ANDA LENGKAP! SEGERA TEKAN KIM!";
  }
}

// --- Event Listener Tombol ---

startButton.addEventListener('click', () => {
  // Minta server untuk memulai permainan
  socket.emit('START_GAME_REQUEST');
  startButton.disabled = true;
  startButton.innerText = 'Menunggu...';
});

kimButton.addEventListener('click', () => {
  // Kirim klaim kemenangan ke server
  socket.emit('KIM_CLAIM');
  kimButton.disabled = true; // Nonaktifkan tombol setelah klaim
});

// --- Event Listener dari Server (Socket.IO) ---

// 1. Saat server mengirim kupon kita
socket.on('YOUR_CARD', (cardNumbers) => {
  myCard = cardNumbers;
  myMarkedNumbers.clear();
  renderCard(myCard);
});

// 2. Saat server mengirim daftar angka yg sudah dipanggil (saat baru join)
socket.on('CALLED_NUMBERS_LIST', (calledNumbers) => {
  for (const number of calledNumbers) {
    if (myCard.includes(number)) {
      myMarkedNumbers.add(number);
      markNumberOnUI(number);
    }
  }
  checkWinCondition(); // Cek jika ternyata sudah menang
});

// 3. Saat game benar-benar dimulai
socket.on('GAME_START', () => {
  gameStatus.innerText = 'Permainan dimulai! Dengarkan baik-baik...';
  currentNumber.innerText = '-';
  startButton.style.display = 'none'; // Sembunyikan tombol start
  kimButton.disabled = true; // Pastikan tombol KIM mati
  
  // Reset kupon (jika ini game baru)
  myMarkedNumbers.clear();
  renderCard(myCard);
});

// 4. Saat server memancarkan angka BARU
socket.on('NEW_NUMBER', (number) => {
  gameStatus.innerText = 'Menebak angka...';
  currentNumber.innerText = number;
  
  // Cek apakah angka itu ada di kupon kita
  if (myCard.includes(number)) {
    myMarkedNumbers.add(number);
    markNumberOnUI(number);
    
    // Cek apakah kita sudah menang
    checkWinCondition();
  }
});

// 5. Saat server mengumumkan permainan berakhir
socket.on('GAME_OVER', (data) => {
  gameStatus.innerText = data.message;
  currentNumber.innerText = 'SELESAI';
  kimButton.disabled = true;
  startButton.disabled = false;
  startButton.innerText = 'Mulai Permainan Baru';
  startButton.style.display = 'block';

  // Tampilkan pesan kemenangan/kekalahan
  if (data.winner === socket.id) {
    alert('SELAMAT! ANDA MENANG!');
  } else if (data.winner) {
    alert(`Permainan berakhir. Pemenangnya adalah: ${data.winner}`);
  } else {
    alert('Permainan berakhir. Tidak ada pemenang.');
  }
});

// 6. Jika klaim kita ditolak server
socket.on('INVALID_CLAIM', (message) => {
  alert(message);
  // Aktifkan kembali tombol KIM jika game belum berakhir
  // (Logika ini bisa diperumit, tapi untuk demo kita biarkan)
  kimButton.disabled = false; 
});

// 7. Info status lain dari server
socket.on('GAME_STATUS', (message) => {
  gameStatus.innerText = message;
});
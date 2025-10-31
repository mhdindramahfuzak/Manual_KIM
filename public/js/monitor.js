const socket = io();

const numberDisplay = document.getElementById('monitor-number');
const numberContainer = document.getElementById('monitor-number-container');
const calledNumbersList = document.getElementById('called-numbers-list'); 
const monitorGridHeader = document.getElementById('monitor-grid-header'); 

// Durasi animasi (HARUS SAMA DENGAN DI CSS: 2.5s = 2500ms)
const ANIMATION_DURATION = 2500; 

let lastNumber = '-'; // Simpan angka terakhir
let isAnimating = false; // Status biar animasi tidak tumpang tindih

// --- FUNGSI HELPER BAR BAWAH ---
function updateCalledList(calledNumbersArray) {
    if (!calledNumbersList) return;
    calledNumbersList.innerHTML = '';
    const reversedNumbers = [...calledNumbersArray].reverse(); 
    
    reversedNumbers.forEach(num => {
        const numEl = document.createElement('div');
        numEl.classList.add('called-num-item');
        numEl.textContent = num;
        calledNumbersList.prepend(numEl); 
    });
}

// --- FUNGSI HELPER GRID ATAS ---
function createMonitorGrid() {
    if (!monitorGridHeader) return;
    monitorGridHeader.innerHTML = ''; // Kosongkan dulu
    for (let i = 1; i <= 90; i++) {
        const cell = document.createElement('div');
        cell.classList.add('monitor-grid-cell');
        cell.dataset.number = i; // Simpan angka di data-attribute
        cell.textContent = i;
        monitorGridHeader.appendChild(cell);
    }
}

function updateMonitorGrid(calledNumbersArray) {
    if (!monitorGridHeader) return;
    const calledSet = new Set(calledNumbersArray); // Buat Set untuk cek cepat

    // Loop semua sel di grid atas
    document.querySelectorAll('.monitor-grid-cell').forEach(cell => {
        const num = parseInt(cell.dataset.number);
        if (calledSet.has(num)) {
            cell.classList.add('called'); // Nyalakan jika ada
        } else {
            cell.classList.remove('called'); // Matikan jika tidak ada
        }
    });
}

// --- SOCKET EVENT LISTENERS ---

socket.on('connect', () => {
    numberDisplay.textContent = 'Terhubung...';
    socket.emit('GET_GAME_STATE'); // Minta state tetap di sini
});

socket.on('GAME_STATE_UPDATE', (gameState) => {
    // --- PERBAIKAN: Pindahkan pembaruan grid dan bar ke ATAS ---
    // Selalu update grid dan bar bawah.
    // Ini memastikan tampilan grid selalu sinkron dengan server.
    updateCalledList(gameState.calledNumbers); // Update bar bawah
    updateMonitorGrid(gameState.calledNumbers); // Update grid atas

    // JANGAN update teks besar (status) jika sedang animasi angka baru
    if (isAnimating) return; 

    // --- Sisa logika (sekarang aman) ---
    // Kode di bawah ini hanya akan berjalan jika tidak ada animasi,
    // untuk mengatur teks status seperti "Menunggu...", "DIJEDA", dll.
    lastNumber = gameState.lastNumber || '-';

    if (gameState.status === 'idle' || gameState.status === 'stopped') {
        numberDisplay.textContent = 'Menunggu Game Dimulai...';
    } else if (gameState.status === 'paused') {
        numberDisplay.textContent = 'DIJEDA';
    } else {
        if(gameState.lastNumber) {
             numberDisplay.textContent = 'Tunggu angka selanjutnya';
        } else {
             numberDisplay.textContent = 'Mulai!'; // Ini sudah benar
        }
    }

    numberContainer.classList.remove('animating');
    numberDisplay.style.opacity = '1'; 
    numberDisplay.style.transform = 'scale(1)'; 
});

socket.on('NEW_NUMBER', (number) => {
    if (isAnimating) return; 

    isAnimating = true; 
    lastNumber = number;
        
    numberDisplay.textContent = number;
    numberDisplay.style.opacity = '0'; 
    numberDisplay.style.transform = 'scale(0.5)'; 
    
    void numberDisplay.offsetWidth; 
    
    numberContainer.classList.add('animating');

    setTimeout(() => {
        numberContainer.classList.remove('animating'); 
        numberDisplay.textContent = 'Tunggu angka selanjutnya';
        numberDisplay.style.opacity = '1';
        numberDisplay.style.transform = 'scale(1)';
        isAnimating = false; 
    }, ANIMATION_DURATION); 
});

socket.on('GAME_START', () => {
    if (isAnimating) return;
    numberDisplay.textContent = 'Mulai!';
    numberDisplay.style.opacity = '1';
    numberDisplay.style.transform = 'scale(1)';
});

socket.on('GAME_STOP', (data) => {
    isAnimating = false; 
    numberContainer.classList.remove('animating');
    
    numberDisplay.textContent = 'SELESEI!';
    numberDisplay.style.opacity = '1';
    numberDisplay.style.transform = 'scale(1)';
    alert(data.message);
});

socket.on('GAME_PAUSE_TOGGLE', (isPaused) => {
    if (isAnimating) return;
    
    if (isPaused) {
        numberDisplay.textContent = 'DIJEDA';
    } else {
        numberDisplay.textContent = (lastNumber && lastNumber !== '-') ? 'Tunggu angka selanjutnya' : 'Lanjut!';
    }
    numberDisplay.style.opacity = '1';
    numberDisplay.style.transform = 'scale(1)';
});

// --- INISIALISASI HALAMAN ---
// (Jalankan ini saat JS dimuat)
createMonitorGrid(); // Ini akan mengisi div #monitor-grid-header
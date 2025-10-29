const socket = io();

const numberDisplay = document.getElementById('monitor-number');
const numberContainer = document.getElementById('monitor-number-container');

// Durasi animasi (HARUS SAMA DENGAN DI CSS: 2.5s = 2500ms)
const ANIMATION_DURATION = 2500; 

let lastNumber = '-'; // Simpan angka terakhir
let isAnimating = false; // Status biar animasi tidak tumpang tindih

socket.on('connect', () => {
    numberDisplay.textContent = 'Terhubung...';
    socket.emit('GET_GAME_STATE');
});

socket.on('GAME_STATE_UPDATE', (gameState) => {
    if (isAnimating) return; // Jangan ubah teks jika sedang animasi

    lastNumber = gameState.lastNumber || '-';

    if (gameState.status === 'idle' || gameState.status === 'stopped') {
        numberDisplay.textContent = 'Menunggu Game Dimulai...';
    } else if (gameState.status === 'paused') {
        numberDisplay.textContent = 'DIJEDA';
    } else {
        if(gameState.lastNumber) {
             numberDisplay.textContent = 'Tunggu angka selanjutnya'; // Tampilkan ini saat refresh
        } else {
             numberDisplay.textContent = 'Mulai!';
        }
    }
    // Pastikan reset
    numberContainer.classList.remove('animating');
    numberDisplay.style.opacity = '1'; // Tampilkan teks status
    numberDisplay.style.transform = 'scale(1)'; // Ukuran normal
});

socket.on('NEW_NUMBER', (number) => {
    if (isAnimating) return; // Abaikan jika masih animasi

    isAnimating = true; // Kunci
    lastNumber = number;
    
    numberDisplay.textContent = number;
    numberDisplay.style.opacity = '0'; // Sembunyikan dulu
    numberDisplay.style.transform = 'scale(0.5)'; // Set ke kecil
    
    // Paksa browser reset (penting)
    void numberDisplay.offsetWidth; 
    
    // 1. Jalankan animasi
    numberContainer.classList.add('animating');

    // 2. Set timer untuk SETELAH animasi selesai
    setTimeout(() => {
        numberContainer.classList.remove('animating'); // Hapus class animasi
        
        // 3. Ubah teks
        numberDisplay.textContent = 'Tunggu angka selanjutnya';
        
        // 4. Tampilkan teks "Tunggu..." (tanpa animasi)
        numberDisplay.style.opacity = '1';
        numberDisplay.style.transform = 'scale(1)';
        
        isAnimating = false; // Buka kunci
    }, ANIMATION_DURATION); // Tunggu 2.5 detik
});

socket.on('GAME_START', () => {
    if (isAnimating) return;
    numberDisplay.textContent = 'Mulai!';
    numberDisplay.style.opacity = '1';
    numberDisplay.style.transform = 'scale(1)';
});

socket.on('GAME_STOP', (data) => {
    isAnimating = false; // Hentikan paksa
    numberContainer.classList.remove('animating');
    
    numberDisplay.textContent = 'SELESAI!';
    numberDisplay.style.opacity = '1';
    numberDisplay.style.transform = 'scale(1)';
    alert(data.message);
});

socket.on('GAME_PAUSE_TOGGLE', (isPaused) => {
    if (isAnimating) return; // Jangan ganggu animasi
    
    if (isPaused) {
        numberDisplay.textContent = 'DIJEDA';
    } else {
        // Saat lanjut, tampilkan angka terakhir atau pesan tunggu
        numberDisplay.textContent = (lastNumber && lastNumber !== '-') ? 'Tunggu angka selanjutnya' : 'Lanjut!';
    }
    numberDisplay.style.opacity = '1';
    numberDisplay.style.transform = 'scale(1)';
});
const socket = io();
const loginButton = document.getElementById('login-button');
const nameInput = document.getElementById('name-input');

loginButton.addEventListener('click', () => {
  const name = nameInput.value.trim();
  if (name.length < 3) {
    alert('Nama harus diisi, minimal 3 karakter.');
    return;
  }
  socket.emit('PLAYER_LOGIN', name);
  loginButton.disabled = true;
  loginButton.innerText = 'Memproses...';
});

socket.on('LOGIN_SUCCESS', (data) => {
  localStorage.setItem('kim_player_id', data.id);
  localStorage.setItem('kim_player_name', data.name);
  window.location.href = '/game';
});

// Tambahkan ini: Handler jika login gagal (nama sudah ada)
socket.on('LOGIN_FAILED', (message) => {
  alert(`Login Gagal: ${message}`);
  loginButton.disabled = false; // Aktifkan tombol lagi
  loginButton.innerText = 'Masuk & Ambil Tiket';
});
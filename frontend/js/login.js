const loginForm = document.getElementById('form-login');
const errorMessage = document.getElementById('mensaje-error');

loginForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  errorMessage.classList.add('d-none');

  const submitButton = loginForm.querySelector('button[type="submit"]');
  submitButton.disabled = true;

  try {
    const response = await fetch('/api/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        usuario: document.getElementById('usuario').value,
        contrasena: document.getElementById('contrasena').value
      })
    });

    const result = await response.json();

    if (!response.ok) {
      errorMessage.textContent = result.mensaje || 'Usuario o contraseña incorrectos.';
      errorMessage.classList.remove('d-none');
      return;
    }

    window.location.href = '/dashboard';
  } catch (error) {
    errorMessage.textContent = 'No se pudo conectar con el servidor.';
    errorMessage.classList.remove('d-none');
  } finally {
    submitButton.disabled = false;
  }
});

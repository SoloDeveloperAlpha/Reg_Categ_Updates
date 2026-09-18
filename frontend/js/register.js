const registerForm = document.getElementById('form-register');
const registerSuccessMessage = document.getElementById('mensaje-register');
const registerErrorMessage = document.getElementById('mensaje-register-error');

if (registerForm) {
  registerForm.addEventListener('submit', async (event) => {
    event.preventDefault();

    registerSuccessMessage?.classList.add('d-none');
    registerErrorMessage?.classList.add('d-none');

    const usuario = document.getElementById('register-usuario').value.trim();
    const correo = document.getElementById('register-email').value.trim();
    const contrasena = document.getElementById('register-contrasena').value;
    const confirmarContrasena = document.getElementById('register-confirmar').value;

    if (!usuario || !correo || !contrasena || !confirmarContrasena) {
      registerErrorMessage.textContent = 'Completa todos los campos.';
      registerErrorMessage.classList.remove('d-none');
      return;
    }

    if (contrasena !== confirmarContrasena) {
      registerErrorMessage.textContent = 'Las contraseñas no coinciden.';
      registerErrorMessage.classList.remove('d-none');
      return;
    }

    const submitButton = registerForm.querySelector('button[type="submit"]');
    submitButton.disabled = true;

    try {
      const response = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          usuario,
          correo_electronico: correo,
          contrasena,
          confirmarContrasena
        })
      });

      const result = await response.json();

      if (!response.ok) {
        registerErrorMessage.textContent = result.mensaje || 'No se pudo registrar el usuario.';
        registerErrorMessage.classList.remove('d-none');
        return;
      }

      registerSuccessMessage.textContent = result.mensaje || 'Usuario registrado correctamente.';
      registerSuccessMessage.classList.remove('d-none');
      registerForm.reset();

      setTimeout(() => {
        const volverLoginButton = document.getElementById('volver-login');
        volverLoginButton?.click();
      }, 1200);
    } catch (error) {
      registerErrorMessage.textContent = 'No se pudo conectar con el servidor.';
      registerErrorMessage.classList.remove('d-none');
    } finally {
      submitButton.disabled = false;
    }
  });
}

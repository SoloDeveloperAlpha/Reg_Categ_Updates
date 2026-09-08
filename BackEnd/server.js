const express = require('express');
const path = require('path');
const sqlite3 = require('sqlite3').verbose();

const app = express();
const PORT = 3000;
const frontendPath = path.join(__dirname, '../frontend');
const database = new sqlite3.Database(path.join(__dirname, 'database/database.sqlite'));

app.use(express.json());

app.post('/api/login', (req, res) => {
  const { usuario, contrasena } = req.body;

  if (typeof usuario !== 'string' || typeof contrasena !== 'string' || !usuario.trim() || !contrasena) {
    return res.status(400).json({ mensaje: 'Usuario y contraseña son obligatorios.' });
  }

  database.get(
    'SELECT id_usuario, usuario, correo_electronico FROM usuarios WHERE usuario = ? AND contrasena = ?',
    [usuario.trim(), contrasena],
    (error, user) => {
      if (error) {
        console.error('Error al validar el acceso:', error);
        return res.status(500).json({ mensaje: 'No se pudo validar el acceso.' });
      }

      if (!user) {
        return res.status(401).json({ mensaje: 'Usuario o contraseña incorrectos.' });
      }

      return res.json({ mensaje: 'Acceso autorizado.', usuario: user });
    }
  );
});

app.get('/', (req, res) => {
  res.sendFile(path.join(frontendPath, 'login.html'));
});

app.get('/login', (req, res) => {
  res.sendFile(path.join(frontendPath, 'login.html'));
});

app.get('/dashboard', (req, res) => {
  res.sendFile(path.join(frontendPath, 'index.html'));
});

app.use(express.static(frontendPath));

app.listen(PORT, () => {
  console.log(`Servidor ejecutándose en http://localhost:${PORT}`);
});

const express = require('express');
const path = require('path');
const sqlite3 = require('sqlite3').verbose();
const authController = require('./controllers/auth.controller');
const pautasRoutes = require('./routes/pautas.routes');
const politicasRoutes = require('./routes/politicas.routes');
const minutasRoutes = require('./routes/minutas.routes');
const actualizacionesRoutes = require('./routes/actualizaciones.routes');
const authRoutes = require('./routes/auth.routes');

const app = express();
const PORT = 3000;
const frontendPath = path.join(__dirname, '../frontend');
const database = new sqlite3.Database(path.join(__dirname, 'database/database.sqlite'));

app.use(express.json());

app.post('/api/login', authController.login);
app.use('/api/auth', authRoutes);
app.use('/api/pautas', pautasRoutes);
app.use('/api/politicas', politicasRoutes);
app.use('/api/minutas', minutasRoutes);
app.use('/api/actualizaciones', actualizacionesRoutes);

app.get('/', (req, res) => {
  res.sendFile(path.join(frontendPath, 'login.html'));
});

app.get('/login', (req, res) => {
  res.sendFile(path.join(frontendPath, 'login.html'));
});

app.get('/register', (req, res) => {
  res.sendFile(path.join(frontendPath, 'register.html'));
});

app.get('/dashboard', (req, res) => {
  res.sendFile(path.join(frontendPath, 'index.html'));
});

app.use(express.static(frontendPath));

app.listen(PORT, () => {
  console.log(`Servidor ejecutándose en http://localhost:${PORT}`);
});

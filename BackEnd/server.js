const express = require('express');
const path = require('path');
const sqlite3 = require('sqlite3').verbose();
const authController = require('./controllers/auth.controller');
const pautasRoutes = require('./routes/pautas.routes');
const politicasRoutes = require('./routes/politicas.routes');
const minutasRoutes = require('./routes/minutas.routes');
const actualizacionesRoutes = require('./routes/actualizaciones.routes');
const authRoutes = require('./routes/auth.routes');
const { autenticar, inicializarAutenticacion } = require('./middleware/auth.middleware');
const { limitarIntentos, cabecerasSeguridad } = require('./middleware/security');

const app = express();
const PORT = Number(process.env.PORT) || 3000;
const frontendPath = path.join(__dirname, '../frontend');
const database = new sqlite3.Database(path.join(__dirname, 'database/database.sqlite'));

const limitarAcceso = limitarIntentos({
  ventanaMs: 15 * 60 * 1000,
  maximo: 20,
  mensaje: 'Demasiados intentos. Espera unos minutos antes de volver a intentarlo.'
});

app.disable('x-powered-by');
app.use(cabecerasSeguridad);
app.use(express.json({ limit: '28mb' }));

app.post('/api/login', limitarAcceso, authController.login);
app.post('/api/auth/login', limitarAcceso, authController.login);
app.post('/api/auth/register', limitarAcceso, authController.register);
app.post('/api/auth/logout', autenticar, authController.logout);
app.use('/api', autenticar);
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

app.use((error, req, res, next) => {
  if (error.type === 'entity.too.large') {
    return res.status(413).json({
      mensaje: 'El tamaño total de las imágenes adjuntas no puede superar 20 MB.'
    });
  }
  return next(error);
});

inicializarAutenticacion()
  .then(() => {
    const servidor = app.listen(PORT, '0.0.0.0', (error) => {
      if (error) return;
      console.log(`Servidor ejecutándose en http://localhost:${PORT}`);
    });
    servidor.on('error', (error) => {
      if (error.code === 'EADDRINUSE') {
        console.error(`El puerto ${PORT} ya está en uso. Cierra el otro servidor o usa otro puerto (PORT=3001 node server.js).`);
      } else {
        console.error('No se pudo iniciar el servidor:', error);
      }
      process.exit(1);
    });
  })
  .catch((error) => {
    console.error('No se pudo inicializar la autenticación:', error);
    process.exitCode = 1;
  });

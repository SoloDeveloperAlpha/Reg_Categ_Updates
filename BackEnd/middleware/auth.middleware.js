const crypto = require('crypto');
const path = require('path');
const sqlite3 = require('sqlite3').verbose();

const database = new sqlite3.Database(path.join(__dirname, '../database/database.sqlite'));
const sessions = new Map();
const SESSION_COOKIE = 'bitacora_sesion';

function inicializarAutenticacion() {
  return new Promise((resolve, reject) => {
    database.run(`
      CREATE TABLE IF NOT EXISTS usuarios (
        id_usuario INTEGER PRIMARY KEY AUTOINCREMENT,
        usuario TEXT NOT NULL,
        correo_electronico TEXT NOT NULL UNIQUE,
        contrasena TEXT NOT NULL,
        fecha_creacion DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `, (createError) => {
      if (createError) return reject(createError);
      database.all('PRAGMA table_info(usuarios)', (error, columns) => {
        if (error) return reject(error);

        const addRoleColumn = columns.some((column) => column.name === 'rol')
          ? Promise.resolve()
          : new Promise((resolveColumn, rejectColumn) => {
            database.run(
              "ALTER TABLE usuarios ADD COLUMN rol TEXT NOT NULL DEFAULT 'consulta'",
              (alterError) => alterError ? rejectColumn(alterError) : resolveColumn()
            );
          });

        addRoleColumn.then(() => {
          database.get(
            "SELECT id_usuario FROM usuarios WHERE rol = 'administrador_general' LIMIT 1",
            (adminError, admin) => {
              if (adminError) return reject(adminError);
              if (admin) return resolve();

              database.run(
                "UPDATE usuarios SET rol = 'administrador_general' WHERE id_usuario = (SELECT id_usuario FROM usuarios ORDER BY id_usuario ASC LIMIT 1)",
                (promoteError) => promoteError ? reject(promoteError) : resolve()
              );
            }
          );
        }).catch(reject);
      });
    });
  });
}

function crearSesion(res, idUsuario) {
  const token = crypto.randomBytes(32).toString('hex');
  sessions.set(token, idUsuario);
  res.cookie(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: 8 * 60 * 60 * 1000
  });
}

function eliminarSesion(req, res) {
  const token = leerCookie(req, SESSION_COOKIE);
  if (token) sessions.delete(token);
  res.clearCookie(SESSION_COOKIE, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/'
  });
}

function leerCookie(req, nombre) {
  const cookies = (req.headers.cookie || '').split(';');
  const cookie = cookies.find((item) => item.trim().startsWith(`${nombre}=`));
  return cookie ? cookie.trim().slice(nombre.length + 1) : null;
}

function autenticar(req, res, next) {
  const token = leerCookie(req, SESSION_COOKIE);
  const idUsuario = token && sessions.get(token);
  if (!idUsuario) {
    return res.status(401).json({ mensaje: 'Inicia sesión para continuar.' });
  }

  database.get(
    'SELECT id_usuario, usuario, correo_electronico, rol FROM usuarios WHERE id_usuario = ?',
    [idUsuario],
    (error, user) => {
      if (error) {
        console.error('Error al validar la sesión:', error);
        return res.status(500).json({ mensaje: 'No se pudo validar la sesión.' });
      }
      if (!user) {
        sessions.delete(token);
        return res.status(401).json({ mensaje: 'La sesión ya no es válida.' });
      }

      req.usuario = user;
      return next();
    }
  );
}

function requerirRoles(...roles) {
  return (req, res, next) => {
    if (!req.usuario || !roles.includes(req.usuario.rol)) {
      return res.status(403).json({ mensaje: 'No tienes permisos para realizar esta acción.' });
    }
    return next();
  };
}

const requerirEdicion = requerirRoles('administrador_general', 'administrador', 'operador');
const requerirAdministradorGeneral = requerirRoles('administrador_general');

module.exports = {
  autenticar,
  crearSesion,
  eliminarSesion,
  inicializarAutenticacion,
  requerirAdministradorGeneral,
  requerirEdicion
};

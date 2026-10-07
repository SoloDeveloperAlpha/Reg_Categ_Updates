const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const database = new sqlite3.Database(path.join(__dirname, '../database/database.sqlite'));

function login(req, res) {
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
}

function register(req, res) {
  const { usuario, correo_electronico, contrasena, confirmarContrasena } = req.body;

  if (typeof usuario !== 'string' || typeof correo_electronico !== 'string' || typeof contrasena !== 'string') {
    return res.status(400).json({ mensaje: 'Todos los campos son obligatorios.' });
  }

  const usuarioFormateado = usuario.trim();
  const emailFormateado = correo_electronico.trim();
  const passwordFormateado = contrasena;

  if (!usuarioFormateado || !emailFormateado || !passwordFormateado) {
    return res.status(400).json({ mensaje: 'Usuario, correo y contraseña son obligatorios.' });
  }

  if (passwordFormateado !== (confirmarContrasena || passwordFormateado)) {
    return res.status(400).json({ mensaje: 'Las contraseñas no coinciden.' });
  }

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(emailFormateado)) {
    return res.status(400).json({ mensaje: 'Ingresa un correo electrónico válido.' });
  }

  database.get(
    'SELECT id_usuario FROM usuarios WHERE usuario = ? OR correo_electronico = ?',
    [usuarioFormateado, emailFormateado],
    (error, existingUser) => {
      if (error) {
        console.error('Error al verificar usuario duplicado:', error);
        return res.status(500).json({ mensaje: 'No se pudo verificar el usuario.' });
      }

      if (existingUser) {
        return res.status(409).json({ mensaje: 'Ya existe un usuario o correo con esos datos.' });
      }

      database.run(
        'INSERT INTO usuarios (usuario, correo_electronico, contrasena) VALUES (?, ?, ?)',
        [usuarioFormateado, emailFormateado, passwordFormateado],
        function (insertError) {
          if (insertError) {
            console.error('Error al registrar usuario:', insertError);
            return res.status(500).json({ mensaje: 'No se pudo crear el usuario.' });
          }

          return res.status(201).json({
            mensaje: 'Usuario registrado correctamente.',
            usuario: {
              id_usuario: this.lastID,
              usuario: usuarioFormateado,
              correo_electronico: emailFormateado,
            }
          });
        }
      );
    }
  );
}

function getUsuarios(req, res) {
  database.all('SELECT id_usuario, usuario, correo_electronico FROM usuarios ORDER BY usuario ASC', (error, rows) => {
    if (error) {
      console.error('Error al consultar usuarios:', error);
      return res.status(500).json({ mensaje: 'No se pudieron obtener los usuarios.' });
    }

    return res.json(rows);
  });
}

function updatePerfil(req, res) {
  const {
    id_usuario: idUsuario,
    usuario,
    correo_electronico: correoElectronico,
    contrasenaActual,
    contrasenaNueva,
    confirmarContrasena,
  } = req.body || {};
  const id = Number(idUsuario);

  if (
    !Number.isSafeInteger(id) ||
    id <= 0 ||
    typeof usuario !== 'string' ||
    typeof correoElectronico !== 'string' ||
    typeof contrasenaActual !== 'string' ||
    !contrasenaActual
  ) {
    return res.status(400).json({ mensaje: 'Completa los datos de la cuenta y la contraseña actual.' });
  }

  const usuarioFormateado = usuario.trim();
  const emailFormateado = correoElectronico.trim();
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  if (!usuarioFormateado || !emailRegex.test(emailFormateado)) {
    return res.status(400).json({ mensaje: 'Ingresa un usuario y un correo electrónico válidos.' });
  }

  if (contrasenaNueva !== undefined && typeof contrasenaNueva !== 'string') {
    return res.status(400).json({ mensaje: 'La nueva contraseña no es válida.' });
  }

  if (confirmarContrasena !== undefined && typeof confirmarContrasena !== 'string') {
    return res.status(400).json({ mensaje: 'La confirmación de contraseña no es válida.' });
  }

  if ((contrasenaNueva || confirmarContrasena) && contrasenaNueva !== confirmarContrasena) {
    return res.status(400).json({ mensaje: 'Las contraseñas nuevas no coinciden.' });
  }

  database.get(
    'SELECT id_usuario FROM usuarios WHERE id_usuario = ? AND contrasena = ?',
    [id, contrasenaActual],
    (passwordError, user) => {
      if (passwordError) {
        console.error('Error al verificar la contraseña actual:', passwordError);
        return res.status(500).json({ mensaje: 'No se pudieron guardar los cambios de la cuenta.' });
      }

      if (!user) {
        return res.status(401).json({ mensaje: 'La contraseña actual es incorrecta.' });
      }

      database.get(
        'SELECT id_usuario FROM usuarios WHERE (usuario = ? OR correo_electronico = ?) AND id_usuario != ?',
        [usuarioFormateado, emailFormateado, id],
        (duplicateError, duplicateUser) => {
          if (duplicateError) {
            console.error('Error al verificar datos de cuenta duplicados:', duplicateError);
            return res.status(500).json({ mensaje: 'No se pudieron guardar los cambios de la cuenta.' });
          }

          if (duplicateUser) {
            return res.status(409).json({ mensaje: 'Ese usuario o correo electrónico ya está registrado.' });
          }

          const password = contrasenaNueva || contrasenaActual;
          database.run(
            'UPDATE usuarios SET usuario = ?, correo_electronico = ?, contrasena = ? WHERE id_usuario = ?',
            [usuarioFormateado, emailFormateado, password, id],
            function (updateError) {
              if (updateError) {
                console.error('Error al actualizar la cuenta:', updateError);
                return res.status(500).json({ mensaje: 'No se pudieron guardar los cambios de la cuenta.' });
              }

              return res.json({
                mensaje: 'Los cambios de la cuenta se guardaron correctamente.',
                usuario: {
                  id_usuario: id,
                  usuario: usuarioFormateado,
                  correo_electronico: emailFormateado,
                },
              });
            }
          );
        }
      );
    }
  );
}

module.exports = {
  login,
  register,
  getUsuarios,
  updatePerfil,
};

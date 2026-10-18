const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const {
  crearSesion,
  eliminarSesion,
} = require('../middleware/auth.middleware');
const { hashContrasena, verificarContrasena } = require('../middleware/security');

const database = new sqlite3.Database(path.join(__dirname, '../database/database.sqlite'));

const LONGITUD_MINIMA_CONTRASENA = 8;

function login(req, res) {
  const { usuario, contrasena } = req.body || {};

  if (typeof usuario !== 'string' || typeof contrasena !== 'string' || !usuario.trim() || !contrasena) {
    return res.status(400).json({ mensaje: 'Usuario y contraseña son obligatorios.' });
  }

  database.get(
    'SELECT id_usuario, usuario, correo_electronico, rol, contrasena FROM usuarios WHERE usuario = ?',
    [usuario.trim()],
    async (error, registro) => {
      if (error) {
        console.error('Error al validar el acceso:', error);
        return res.status(500).json({ mensaje: 'No se pudo validar el acceso.' });
      }

      try {
        const valida = registro && await verificarContrasena(contrasena, registro.contrasena);
        if (!valida) {
          return res.status(401).json({ mensaje: 'Usuario o contraseña incorrectos.' });
        }

        const { contrasena: _omitida, ...user } = registro;
        crearSesion(res, user.id_usuario);
        return res.json({ mensaje: 'Acceso autorizado.', usuario: user });
      } catch (hashError) {
        console.error('Error al verificar la contraseña:', hashError);
        return res.status(500).json({ mensaje: 'No se pudo validar el acceso.' });
      }
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

  if (passwordFormateado.length < LONGITUD_MINIMA_CONTRASENA) {
    return res.status(400).json({ mensaje: `La contraseña debe tener al menos ${LONGITUD_MINIMA_CONTRASENA} caracteres.` });
  }

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(emailFormateado)) {
    return res.status(400).json({ mensaje: 'Ingresa un correo electrónico válido.' });
  }

  database.get(
    'SELECT id_usuario FROM usuarios WHERE usuario = ? OR correo_electronico = ?',
    [usuarioFormateado, emailFormateado],
    async (error, existingUser) => {
      if (error) {
        console.error('Error al verificar usuario duplicado:', error);
        return res.status(500).json({ mensaje: 'No se pudo verificar el usuario.' });
      }

      if (existingUser) {
        return res.status(409).json({ mensaje: 'Ya existe un usuario o correo con esos datos.' });
      }

      let contrasenaHash;
      try {
        contrasenaHash = await hashContrasena(passwordFormateado);
      } catch (hashError) {
        console.error('Error al proteger la contraseña:', hashError);
        return res.status(500).json({ mensaje: 'No se pudo crear el usuario.' });
      }

      database.run(
        "INSERT INTO usuarios (usuario, correo_electronico, contrasena, rol) VALUES (?, ?, ?, CASE WHEN (SELECT COUNT(*) FROM usuarios) = 0 THEN 'administrador_general' ELSE 'consulta' END)",
        [usuarioFormateado, emailFormateado, contrasenaHash],
        function (insertError) {
          if (insertError) {
            console.error('Error al registrar usuario:', insertError);
            return res.status(500).json({ mensaje: 'No se pudo crear el usuario.' });
          }

          const idUsuario = this.lastID;
          database.get('SELECT rol FROM usuarios WHERE id_usuario = ?', [idUsuario], (roleError, row) => {
            if (roleError) {
              console.error('Error al consultar el rol del usuario registrado:', roleError);
              return res.status(500).json({ mensaje: 'El usuario se creó, pero no se pudieron obtener sus datos.' });
            }
            return res.status(201).json({
              mensaje: 'Usuario registrado correctamente.',
              usuario: {
                id_usuario: idUsuario,
                usuario: usuarioFormateado,
                correo_electronico: emailFormateado,
                rol: row.rol,
              }
            });
          });
        }
      );
    }
  );
}

function getUsuarios(req, res) {
  database.all('SELECT id_usuario, usuario, correo_electronico, rol FROM usuarios ORDER BY usuario ASC', (error, rows) => {
    if (error) {
      console.error('Error al consultar usuarios:', error);
      return res.status(500).json({ mensaje: 'No se pudieron obtener los usuarios.' });
    }

    return res.json(rows);
  });
}

function actualizarRol(req, res) {
  const id = Number(req.params.id);
  const { rol } = req.body || {};
  const rolesAsignables = new Set(['administrador', 'operador', 'consulta']);

  if (!Number.isSafeInteger(id) || id <= 0 || !rolesAsignables.has(rol)) {
    return res.status(400).json({ mensaje: 'El usuario o el rol seleccionado no son válidos.' });
  }

  database.run(
    "UPDATE usuarios SET rol = ? WHERE id_usuario = ? AND rol != 'administrador_general'",
    [rol, id],
    function (updateError) {
      if (updateError) {
        console.error('Error al actualizar el rol del usuario:', updateError);
        return res.status(500).json({ mensaje: 'No se pudo actualizar el rol.' });
      }
      if (this.changes) return res.json({ mensaje: 'El rol del usuario se actualizó correctamente.' });

      database.get('SELECT id_usuario FROM usuarios WHERE id_usuario = ?', [id], (lookupError, user) => {
        if (lookupError) {
          console.error('Error al comprobar el usuario actualizado:', lookupError);
          return res.status(500).json({ mensaje: 'No se pudo actualizar el rol.' });
        }
        if (!user) return res.status(404).json({ mensaje: 'No se encontró el usuario.' });
        return res.status(403).json({ mensaje: 'No puedes cambiar el rol del administrador general.' });
      });
    }
  );
}

function obtenerSesion(req, res) {
  return res.json({ usuario: req.usuario });
}

function logout(req, res) {
  eliminarSesion(req, res);
  return res.json({ mensaje: 'Sesión cerrada correctamente.' });
}

function updatePerfil(req, res) {
  const {
    usuario,
    correo_electronico: correoElectronico,
    contrasenaActual,
    contrasenaNueva,
    confirmarContrasena,
  } = req.body || {};
  const id = req.usuario.id_usuario;

  if (
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

  if (contrasenaNueva && contrasenaNueva.length < LONGITUD_MINIMA_CONTRASENA) {
    return res.status(400).json({ mensaje: `La nueva contraseña debe tener al menos ${LONGITUD_MINIMA_CONTRASENA} caracteres.` });
  }

  database.get(
    'SELECT id_usuario, contrasena FROM usuarios WHERE id_usuario = ?',
    [id],
    async (passwordError, user) => {
      if (passwordError) {
        console.error('Error al verificar la contraseña actual:', passwordError);
        return res.status(500).json({ mensaje: 'No se pudieron guardar los cambios de la cuenta.' });
      }

      let actualCorrecta = false;
      let nuevoHash;
      try {
        actualCorrecta = Boolean(user) && await verificarContrasena(contrasenaActual, user.contrasena);
        if (actualCorrecta) nuevoHash = contrasenaNueva ? await hashContrasena(contrasenaNueva) : user.contrasena;
      } catch (hashError) {
        console.error('Error al procesar la contraseña:', hashError);
        return res.status(500).json({ mensaje: 'No se pudieron guardar los cambios de la cuenta.' });
      }

      if (!actualCorrecta) {
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

          database.run(
            'UPDATE usuarios SET usuario = ?, correo_electronico = ?, contrasena = ? WHERE id_usuario = ?',
            [usuarioFormateado, emailFormateado, nuevoHash, id],
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
                  rol: req.usuario.rol,
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
  actualizarRol,
  obtenerSesion,
  logout,
  updatePerfil,
};

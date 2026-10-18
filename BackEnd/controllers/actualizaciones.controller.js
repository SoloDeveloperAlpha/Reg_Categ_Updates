const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const { sanitizarTextoEnriquecido, textoVisible } = require('../middleware/sanitizar');

const database = new sqlite3.Database(path.join(__dirname, '../database/database.sqlite'));

database.run(`
  CREATE TABLE IF NOT EXISTS actualizaciones (
    id_actualizacion INTEGER PRIMARY KEY AUTOINCREMENT,
    pauta_id INTEGER NOT NULL,
    fecha TEXT NOT NULL DEFAULT (DATE('now')),
    responsable TEXT NOT NULL,
    cambio TEXT NOT NULL,
    observaciones TEXT DEFAULT '',
    FOREIGN KEY (pauta_id) REFERENCES pautas(id_pauta)
  )
`);

function getActualizaciones(req, res) {
  const filtroPauta = req.query.pautaId ? Number(req.query.pautaId) : null;
  const parametros = [];
  const where = filtroPauta ? 'WHERE a.pauta_id = ?' : '';
  if (filtroPauta) parametros.push(filtroPauta);

  database.all(`
    SELECT
      a.id_actualizacion AS id,
      a.pauta_id AS pautaId,
      a.fecha,
      a.responsable,
      a.cambio,
      a.observaciones,
      p.nombre AS pautaNombre,
      p.categoria
    FROM actualizaciones a
    LEFT JOIN pautas p ON p.id_pauta = a.pauta_id
    ${where}
    ORDER BY a.fecha DESC, a.id_actualizacion DESC
  `, parametros, (error, rows) => {
    if (error) return res.status(500).json({ mensaje: 'No se pudieron obtener las actualizaciones.' });
    return res.json(rows);
  });
}

function createActualizacion(req, res) {
  const { pautaId, pauta, fecha, responsable } = req.body;
  const cambio = sanitizarTextoEnriquecido(req.body.cambio);
  const observaciones = sanitizarTextoEnriquecido(req.body.observaciones);

  if (!fecha || !responsable || !textoVisible(cambio) || (!pautaId && (!pauta?.nombre || !pauta?.categoria))) {
    return res.status(400).json({
      mensaje: 'Pauta, fecha, responsable y cambio son obligatorios.'
    });
  }

  database.serialize(() => {
    database.run('BEGIN TRANSACTION');

    const completar = (idPauta) => {
      database.run(
        'UPDATE pautas SET fecha = ?, responsable = ? WHERE id_pauta = ?',
        [fecha, responsable.trim(), idPauta],
        (updateError) => {
          if (updateError) return cancelar(updateError);

          database.run(`
            INSERT INTO actualizaciones (pauta_id, fecha, responsable, cambio, observaciones)
            VALUES (?, ?, ?, ?, ?)
          `, [idPauta, fecha, responsable.trim(), cambio.trim(), observaciones?.trim() || ''], function (insertError) {
            if (insertError) return cancelar(insertError);

            database.run('COMMIT', (commitError) => {
              if (commitError) return cancelar(commitError);
              return res.status(201).json({
                id: this.lastID,
                pautaId: idPauta,
                fecha,
                responsable: responsable.trim(),
                cambio: cambio.trim(),
                observaciones: observaciones?.trim() || ''
              });
            });
          });
        }
      );
    };

    const cancelar = (error) => {
      database.run('ROLLBACK', () => {
        return res.status(500).json({ mensaje: 'No se pudo guardar la actualización.', detalle: error.message });
      });
    };

    if (pautaId) {
      return completar(Number(pautaId));
    }

    database.get(
      'SELECT id_pauta FROM pautas WHERE nombre = ? AND categoria = ?',
      [pauta.nombre.trim(), pauta.categoria.trim()],
      (findError, row) => {
        if (findError) return cancelar(findError);
        if (row) return completar(row.id_pauta);

        database.run(
          'INSERT INTO pautas (nombre, categoria, fecha, responsable) VALUES (?, ?, ?, ?)',
          [pauta.nombre.trim(), pauta.categoria.trim(), fecha, responsable.trim()],
          function (insertPautaError) {
            if (insertPautaError) return cancelar(insertPautaError);
            return completar(this.lastID);
          }
        );
      }
    );
  });
}

function updateActualizacion(req, res) {
  const id = Number(req.params.id);
  const cambio = sanitizarTextoEnriquecido(req.body?.cambio);
  const observaciones = sanitizarTextoEnriquecido(req.body?.observaciones);

  if (!Number.isSafeInteger(id) || id <= 0 || !textoVisible(cambio)) {
    return res.status(400).json({ mensaje: 'La actualización o el cambio indicado no son válidos.' });
  }

  database.run(
    'UPDATE actualizaciones SET cambio = ?, observaciones = ? WHERE id_actualizacion = ?',
    [cambio, observaciones, id],
    function (error) {
      if (error) {
        console.error('Error al editar la actualización:', error);
        return res.status(500).json({ mensaje: 'No se pudo guardar la edición de la actualización.' });
      }
      if (!this.changes) return res.status(404).json({ mensaje: 'No se encontró la actualización.' });
      return res.json({ id, cambio, observaciones });
    }
  );
}

const PERIODOS = { dia: 1, semana: 7, mes: 30 };

function fechaLocal(fecha) {
  const mes = String(fecha.getMonth() + 1).padStart(2, '0');
  const dia = String(fecha.getDate()).padStart(2, '0');
  return `${fecha.getFullYear()}-${mes}-${dia}`;
}

function getMetricasActividad(req, res) {
  const periodo = Object.hasOwn(PERIODOS, req.query.periodo) ? req.query.periodo : 'semana';
  const dias = PERIODOS[periodo];

  const hoy = new Date();
  const dia = (desplazamiento) => {
    const fecha = new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate() - desplazamiento);
    return fechaLocal(fecha);
  };
  const desde = dia(dias - 1);
  const hasta = dia(0);

  database.all(
    `SELECT responsable, fecha, COUNT(*) AS total
       FROM actualizaciones
      WHERE fecha BETWEEN ? AND ?
      GROUP BY responsable, fecha`,
    [desde, hasta],
    (error, filas) => {
      if (error) {
        console.error('Error al calcular las métricas de actividad:', error);
        return res.status(500).json({ mensaje: 'No se pudieron calcular las métricas.' });
      }

      database.all(
        "SELECT usuario, rol FROM usuarios WHERE rol IN ('administrador_general', 'administrador', 'operador')",
        (usuariosError, usuarios) => {
          if (usuariosError) {
            console.error('Error al consultar los usuarios de las métricas:', usuariosError);
            return res.status(500).json({ mensaje: 'No se pudieron calcular las métricas.' });
          }

          const porUsuario = new Map(usuarios.map((u) => [u.usuario, { responsable: u.usuario, rol: u.rol, total: 0 }]));
          const porDia = new Map();
          for (let i = dias - 1; i >= 0; i -= 1) porDia.set(dia(i), 0);

          let total = 0;
          for (const fila of filas) {
            if (!porUsuario.has(fila.responsable)) {
              porUsuario.set(fila.responsable, { responsable: fila.responsable, rol: null, total: 0 });
            }
            porUsuario.get(fila.responsable).total += fila.total;
            porDia.set(fila.fecha, (porDia.get(fila.fecha) || 0) + fila.total);
            total += fila.total;
          }

          return res.json({
            periodo,
            desde,
            hasta,
            total,
            usuarios: [...porUsuario.values()].sort((a, b) => b.total - a.total || a.responsable.localeCompare(b.responsable)),
            serie: [...porDia].map(([fecha, cantidad]) => ({ fecha, total: cantidad }))
          });
        }
      );
    }
  );
}

module.exports = {
  getActualizaciones,
  createActualizacion,
  updateActualizacion,
  getMetricasActividad,
};

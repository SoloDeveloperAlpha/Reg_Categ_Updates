const sqlite3 = require('sqlite3').verbose();
const path = require('path');

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
  const { pautaId, pauta, fecha, responsable, cambio, observaciones } = req.body;

  if (!fecha || !responsable || !cambio || (!pautaId && (!pauta?.nombre || !pauta?.categoria))) {
    return res.status(400).json({
      mensaje: 'Pauta, fecha, responsable y cambio son obligatorios.'
    });
  }

  database.serialize(() => {
    database.run('BEGIN TRANSACTION');

    const completar = (idPauta) => {
      database.run(
        'UPDATE pautas SET fecha = ?, responsable = ?, descripcion = ? WHERE id_pauta = ?',
        [fecha, responsable.trim(), cambio.trim(), idPauta],
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

module.exports = {
  getActualizaciones,
  createActualizacion,
};

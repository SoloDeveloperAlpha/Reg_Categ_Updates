const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const database = new sqlite3.Database(path.join(__dirname, '../database/database.sqlite'));

const fallbackMinutas = [
  { id: 1, pautaId: 1, fecha: '2026-08-26', responsable: 'Administrador', version: '1.2', cambio: 'Se modificaron los criterios para clasificar errores.', observaciones: 'Cambio aprobado durante la reunión semanal.' },
];

function readAllMinutas(callback) {
  database.all('SELECT * FROM minutas ORDER BY id_minuta DESC', (error, rows) => {
    if (error) {
      console.warn('La tabla minutas no existe o no está disponible; usando datos locales.', error.message);
      return callback(null, fallbackMinutas);
    }

    if (!rows || rows.length === 0) {
      return callback(null, fallbackMinutas);
    }

    return callback(null, rows.map((row) => ({
      id: row.id_minuta,
      pautaId: row.pauta_id,
      fecha: row.fecha,
      responsable: row.responsable,
      version: row.version,
      cambio: row.cambio,
      observaciones: row.observaciones,
    })));
  });
}

function readMinutaById(id, callback) {
  readAllMinutas((error, minutas) => {
    if (error) return callback(error);
    const minuta = minutas.find((item) => Number(item.id) === Number(id));
    return callback(null, minuta || null);
  });
}

function getMinutas(req, res) {
  readAllMinutas((error, minutas) => {
    if (error) return res.status(500).json({ mensaje: 'No se pudieron obtener las minutas.' });
    return res.json(minutas);
  });
}

function getMinutaById(req, res) {
  readMinutaById(req.params.id, (error, minuta) => {
    if (error) return res.status(500).json({ mensaje: 'No se pudo obtener la minuta.' });
    if (!minuta) return res.status(404).json({ mensaje: 'Minuta no encontrada.' });
    return res.json(minuta);
  });
}

function createMinuta(req, res) {
  const { pautaId, fecha, responsable, version, cambio, observaciones } = req.body;

  if (!pautaId || !fecha || !responsable || !version || !cambio) {
    return res.status(400).json({ mensaje: 'Pauta, fecha, responsable, versión y cambio son obligatorios.' });
  }

  const payload = {
    pautaId: Number(pautaId),
    fecha,
    responsable: responsable.trim(),
    version: version.trim(),
    cambio: cambio.trim(),
    observaciones: observaciones ? observaciones.trim() : '',
  };

  database.run(
    'INSERT INTO minutas (pauta_id, fecha, responsable, version, cambio, observaciones) VALUES (?, ?, ?, ?, ?, ?)',
    [payload.pautaId, payload.fecha, payload.responsable, payload.version, payload.cambio, payload.observaciones],
    function (error) {
      if (error) {
        console.warn('No se pudo guardar en SQLite; usando datos locales.', error.message);
        const nuevaMinuta = { id: Date.now(), ...payload };
        fallbackMinutas.unshift(nuevaMinuta);
        return res.status(201).json(nuevaMinuta);
      }

      return res.status(201).json({ id: this.lastID, ...payload });
    }
  );
}

function updateMinuta(req, res) {
  const { id } = req.params;
  const { pautaId, fecha, responsable, version, cambio, observaciones } = req.body;

  readMinutaById(id, (error, minutaActual) => {
    if (error) return res.status(500).json({ mensaje: 'No se pudo cargar la minuta.' });
    if (!minutaActual) return res.status(404).json({ mensaje: 'Minuta no encontrada.' });

    const payload = {
      pautaId: pautaId ? Number(pautaId) : minutaActual.pautaId,
      fecha: fecha || minutaActual.fecha,
      responsable: responsable ? responsable.trim() : minutaActual.responsable,
      version: version ? version.trim() : minutaActual.version,
      cambio: cambio ? cambio.trim() : minutaActual.cambio,
      observaciones: observaciones !== undefined ? observaciones.trim() : minutaActual.observaciones,
    };

    database.run(
      'UPDATE minutas SET pauta_id = ?, fecha = ?, responsable = ?, version = ?, cambio = ?, observaciones = ? WHERE id_minuta = ?',
      [payload.pautaId, payload.fecha, payload.responsable, payload.version, payload.cambio, payload.observaciones, id],
      function (dbError) {
        if (dbError) {
          console.warn('No se pudo actualizar SQLite; usando datos locales.', dbError.message);
          const index = fallbackMinutas.findIndex((item) => Number(item.id) === Number(id));
          if (index === -1) return res.status(404).json({ mensaje: 'Minuta no encontrada.' });
          fallbackMinutas[index] = { ...fallbackMinutas[index], ...payload };
          return res.json(fallbackMinutas[index]);
        }

        return res.json({ id: Number(id), ...payload });
      }
    );
  });
}

function deleteMinuta(req, res) {
  const { id } = req.params;

  database.run('DELETE FROM minutas WHERE id_minuta = ?', [id], function (error) {
    if (error) {
      console.warn('No se pudo eliminar en SQLite; usando datos locales.', error.message);
      const index = fallbackMinutas.findIndex((item) => Number(item.id) === Number(id));
      if (index === -1) return res.status(404).json({ mensaje: 'Minuta no encontrada.' });
      fallbackMinutas.splice(index, 1);
      return res.json({ mensaje: 'Minuta eliminada correctamente.' });
    }

    return res.json({ mensaje: 'Minuta eliminada correctamente.' });
  });
}

module.exports = {
  getMinutas,
  getMinutaById,
  createMinuta,
  updateMinuta,
  deleteMinuta,
};

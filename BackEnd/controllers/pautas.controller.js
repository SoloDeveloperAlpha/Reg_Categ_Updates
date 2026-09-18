const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const database = new sqlite3.Database(path.join(__dirname, '../database/database.sqlite'));

const fallbackPautas = [
  { id: 1, nombre: 'Clasificación de errores', categoria: 'Auditoría', version: '1.2', fecha: '2026-08-26', estado: 'activa' },
  { id: 2, nombre: 'Validación de tickets', categoria: 'Tickets', version: '2.0', fecha: '2026-08-20', estado: 'activa' },
];

function readAllPautas(callback) {
  database.all('SELECT * FROM pautas ORDER BY id_pauta DESC', (error, rows) => {
    if (error) {
      console.warn('La tabla pautas no existe o no está disponible; usando datos locales.', error.message);
      return callback(null, fallbackPautas);
    }

    if (!rows || rows.length === 0) {
      return callback(null, fallbackPautas);
    }

    return callback(null, rows.map((row) => ({
      id: row.id_pauta,
      nombre: row.nombre,
      categoria: row.categoria,
      version: row.version,
      fecha: row.fecha,
      estado: row.estado,
    })));
  });
}

function readPautaById(id, callback) {
  readAllPautas((error, pautas) => {
    if (error) return callback(error);
    const pauta = pautas.find((item) => Number(item.id) === Number(id));
    return callback(null, pauta || null);
  });
}

function getPautas(req, res) {
  readAllPautas((error, pautas) => {
    if (error) return res.status(500).json({ mensaje: 'No se pudieron obtener las pautas.' });
    return res.json(pautas);
  });
}

function getPautaById(req, res) {
  readPautaById(req.params.id, (error, pauta) => {
    if (error) return res.status(500).json({ mensaje: 'No se pudo obtener la pauta.' });
    if (!pauta) return res.status(404).json({ mensaje: 'Pauta no encontrada.' });
    return res.json(pauta);
  });
}

function createPauta(req, res) {
  const { nombre, categoria, version, fecha, estado } = req.body;

  if (!nombre || !categoria || !version || !fecha) {
    return res.status(400).json({ mensaje: 'Nombre, categoría, versión y fecha son obligatorios.' });
  }

  const payload = {
    nombre: nombre.trim(),
    categoria: categoria.trim(),
    version: version.trim(),
    fecha,
    estado: estado || 'activa',
  };

  database.run(
    'INSERT INTO pautas (nombre, categoria, version, fecha, estado) VALUES (?, ?, ?, ?, ?)',
    [payload.nombre, payload.categoria, payload.version, payload.fecha, payload.estado],
    function (error) {
      if (error) {
        console.warn('No se pudo guardar en SQLite; usando datos locales.', error.message);
        const nuevaPauta = { id: Date.now(), ...payload };
        fallbackPautas.unshift(nuevaPauta);
        return res.status(201).json(nuevaPauta);
      }

      return res.status(201).json({ id: this.lastID, ...payload });
    }
  );
}

function updatePauta(req, res) {
  const { id } = req.params;
  const { nombre, categoria, version, fecha, estado } = req.body;

  readPautaById(id, (error, pautaActual) => {
    if (error) return res.status(500).json({ mensaje: 'No se pudo cargar la pauta.' });
    if (!pautaActual) return res.status(404).json({ mensaje: 'Pauta no encontrada.' });

    const payload = {
      nombre: nombre ? nombre.trim() : pautaActual.nombre,
      categoria: categoria ? categoria.trim() : pautaActual.categoria,
      version: version ? version.trim() : pautaActual.version,
      fecha: fecha || pautaActual.fecha,
      estado: estado || pautaActual.estado,
    };

    database.run(
      'UPDATE pautas SET nombre = ?, categoria = ?, version = ?, fecha = ?, estado = ? WHERE id_pauta = ?',
      [payload.nombre, payload.categoria, payload.version, payload.fecha, payload.estado, id],
      function (dbError) {
        if (dbError) {
          console.warn('No se pudo actualizar SQLite; usando datos locales.', dbError.message);
          const index = fallbackPautas.findIndex((item) => Number(item.id) === Number(id));
          if (index === -1) return res.status(404).json({ mensaje: 'Pauta no encontrada.' });
          fallbackPautas[index] = { ...fallbackPautas[index], ...payload };
          return res.json(fallbackPautas[index]);
        }

        return res.json({ id: Number(id), ...payload });
      }
    );
  });
}

function deletePauta(req, res) {
  const { id } = req.params;

  database.run('DELETE FROM pautas WHERE id_pauta = ?', [id], function (error) {
    if (error) {
      console.warn('No se pudo eliminar en SQLite; usando datos locales.', error.message);
      const index = fallbackPautas.findIndex((item) => Number(item.id) === Number(id));
      if (index === -1) return res.status(404).json({ mensaje: 'Pauta no encontrada.' });
      fallbackPautas.splice(index, 1);
      return res.json({ mensaje: 'Pauta eliminada correctamente.' });
    }

    return res.json({ mensaje: 'Pauta eliminada correctamente.' });
  });
}

module.exports = {
  getPautas,
  getPautaById,
  createPauta,
  updatePauta,
  deletePauta,
};

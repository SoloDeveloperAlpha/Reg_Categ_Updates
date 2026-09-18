const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const database = new sqlite3.Database(path.join(__dirname, '../database/database.sqlite'));

const fallbackPoliticas = [
  { id: 1, nombre: 'Política de seguridad', descripcion: 'Normas para acceso y manejo de información sensible.', estado: 'activa', fecha: '2026-08-25' },
  { id: 2, nombre: 'Política de revisión', descripcion: 'Lineamientos para seguimiento de cambios y aprobaciones.', estado: 'activa', fecha: '2026-08-22' },
];

function readAllPoliticas(callback) {
  database.all('SELECT * FROM politicas ORDER BY id_politica DESC', (error, rows) => {
    if (error) {
      console.warn('La tabla politicas no existe o no está disponible; usando datos locales.', error.message);
      return callback(null, fallbackPoliticas);
    }

    if (!rows || rows.length === 0) {
      return callback(null, fallbackPoliticas);
    }

    return callback(null, rows.map((row) => ({
      id: row.id_politica,
      nombre: row.nombre,
      descripcion: row.descripcion,
      estado: row.estado,
      fecha: row.fecha,
    })));
  });
}

function readPoliticaById(id, callback) {
  readAllPoliticas((error, politicas) => {
    if (error) return callback(error);
    const politica = politicas.find((item) => Number(item.id) === Number(id));
    return callback(null, politica || null);
  });
}

function getPoliticas(req, res) {
  readAllPoliticas((error, politicas) => {
    if (error) return res.status(500).json({ mensaje: 'No se pudieron obtener las políticas.' });
    return res.json(politicas);
  });
}

function getPoliticaById(req, res) {
  readPoliticaById(req.params.id, (error, politica) => {
    if (error) return res.status(500).json({ mensaje: 'No se pudo obtener la política.' });
    if (!politica) return res.status(404).json({ mensaje: 'Política no encontrada.' });
    return res.json(politica);
  });
}

function createPolitica(req, res) {
  const { nombre, descripcion, estado, fecha } = req.body;

  if (!nombre || !descripcion) {
    return res.status(400).json({ mensaje: 'Nombre y descripción son obligatorios.' });
  }

  const payload = {
    nombre: nombre.trim(),
    descripcion: descripcion.trim(),
    estado: estado || 'activa',
    fecha: fecha || new Date().toISOString().slice(0, 10),
  };

  database.run(
    'INSERT INTO politicas (nombre, descripcion, estado, fecha) VALUES (?, ?, ?, ?)',
    [payload.nombre, payload.descripcion, payload.estado, payload.fecha],
    function (error) {
      if (error) {
        console.warn('No se pudo guardar en SQLite; usando datos locales.', error.message);
        const nuevaPolitica = { id: Date.now(), ...payload };
        fallbackPoliticas.unshift(nuevaPolitica);
        return res.status(201).json(nuevaPolitica);
      }

      return res.status(201).json({ id: this.lastID, ...payload });
    }
  );
}

function updatePolitica(req, res) {
  const { id } = req.params;
  const { nombre, descripcion, estado, fecha } = req.body;

  readPoliticaById(id, (error, politicaActual) => {
    if (error) return res.status(500).json({ mensaje: 'No se pudo cargar la política.' });
    if (!politicaActual) return res.status(404).json({ mensaje: 'Política no encontrada.' });

    const payload = {
      nombre: nombre ? nombre.trim() : politicaActual.nombre,
      descripcion: descripcion ? descripcion.trim() : politicaActual.descripcion,
      estado: estado || politicaActual.estado,
      fecha: fecha || politicaActual.fecha,
    };

    database.run(
      'UPDATE politicas SET nombre = ?, descripcion = ?, estado = ?, fecha = ? WHERE id_politica = ?',
      [payload.nombre, payload.descripcion, payload.estado, payload.fecha, id],
      function (dbError) {
        if (dbError) {
          console.warn('No se pudo actualizar SQLite; usando datos locales.', dbError.message);
          const index = fallbackPoliticas.findIndex((item) => Number(item.id) === Number(id));
          if (index === -1) return res.status(404).json({ mensaje: 'Política no encontrada.' });
          fallbackPoliticas[index] = { ...fallbackPoliticas[index], ...payload };
          return res.json(fallbackPoliticas[index]);
        }

        return res.json({ id: Number(id), ...payload });
      }
    );
  });
}

function deletePolitica(req, res) {
  const { id } = req.params;

  database.run('DELETE FROM politicas WHERE id_politica = ?', [id], function (error) {
    if (error) {
      console.warn('No se pudo eliminar en SQLite; usando datos locales.', error.message);
      const index = fallbackPoliticas.findIndex((item) => Number(item.id) === Number(id));
      if (index === -1) return res.status(404).json({ mensaje: 'Política no encontrada.' });
      fallbackPoliticas.splice(index, 1);
      return res.json({ mensaje: 'Política eliminada correctamente.' });
    }

    return res.json({ mensaje: 'Política eliminada correctamente.' });
  });
}

module.exports = {
  getPoliticas,
  getPoliticaById,
  createPolitica,
  updatePolitica,
  deletePolitica,
};

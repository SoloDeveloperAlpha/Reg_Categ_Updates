const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const database = new sqlite3.Database(path.join(__dirname, '../database/database.sqlite'));

function ejecutar(sql, parametros = []) {
  return new Promise((resolve, reject) => {
    database.run(sql, parametros, function (error) {
      if (error) return reject(error);
      return resolve({ changes: this.changes, lastID: this.lastID });
    });
  });
}

function consultar(sql, parametros = []) {
  return new Promise((resolve, reject) => {
    database.all(sql, parametros, (error, rows) => {
      if (error) return reject(error);
      return resolve(rows);
    });
  });
}

function consultarUno(sql, parametros = []) {
  return new Promise((resolve, reject) => {
    database.get(sql, parametros, (error, row) => {
      if (error) return reject(error);
      return resolve(row);
    });
  });
}

async function inicializarTablaPautas() {
  await ejecutar('PRAGMA foreign_keys = ON');
  await ejecutar(`
    CREATE TABLE IF NOT EXISTS pautas (
      id_pauta INTEGER PRIMARY KEY AUTOINCREMENT,
      nombre TEXT NOT NULL,
      categoria TEXT NOT NULL,
      fecha TEXT NOT NULL DEFAULT '',
      responsable TEXT NOT NULL DEFAULT '',
      descripcion TEXT NOT NULL DEFAULT '',
      conclusion TEXT NOT NULL DEFAULT '',
      procesos TEXT NOT NULL DEFAULT '[]'
    )
  `);

  const columnas = await consultar('PRAGMA table_info(pautas)');
  const columnasExistentes = new Set(columnas.map((columna) => columna.name));
  const columnasNuevas = [
    ['responsable', "TEXT NOT NULL DEFAULT ''"],
    ['descripcion', "TEXT NOT NULL DEFAULT ''"],
    ['conclusion', "TEXT NOT NULL DEFAULT ''"],
    ['procesos', "TEXT NOT NULL DEFAULT '[]'"]
  ];

  for (const [nombre, definicion] of columnasNuevas) {
    if (!columnasExistentes.has(nombre)) {
      await ejecutar(`ALTER TABLE pautas ADD COLUMN ${nombre} ${definicion}`);
    }
  }
}

const tablaPautasLista = inicializarTablaPautas();
tablaPautasLista.catch((error) => {
  console.error('No se pudo inicializar la tabla de pautas:', error);
});

function mapearPauta(row) {
  let procesos;
  try {
    procesos = JSON.parse(row.procesos || '[]');
  } catch (error) {
    throw new Error(`Los procesos de la pauta ${row.id_pauta} no tienen un JSON válido.`);
  }

  if (!Array.isArray(procesos)) {
    throw new Error(`Los procesos de la pauta ${row.id_pauta} deben ser una lista.`);
  }

  return {
    id: row.id_pauta,
    nombre: row.nombre,
    categoria: row.categoria,
    fecha: row.fecha,
    responsable: row.responsable,
    descripcion: row.descripcion,
    conclusion: row.conclusion,
    procesos
  };
}

function procesosValidos(procesos) {
  return Array.isArray(procesos) && procesos.every((proceso) =>
    proceso &&
    typeof proceso.nombre === 'string' &&
    Array.isArray(proceso.pasos) &&
    proceso.pasos.every((paso) => typeof paso === 'string') &&
    typeof proceso.nota === 'string'
  );
}

function responderError(res, mensaje, error) {
  console.error(`${mensaje}:`, error);
  return res.status(500).json({ mensaje });
}

async function getPautas(req, res) {
  try {
    await tablaPautasLista;
    const rows = await consultar('SELECT * FROM pautas ORDER BY id_pauta ASC');
    return res.json(rows.map(mapearPauta));
  } catch (error) {
    return responderError(res, 'No se pudieron obtener las pautas.', error);
  }
}

async function getPautaById(req, res) {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id < 1) {
    return res.status(400).json({ mensaje: 'El identificador de la pauta no es válido.' });
  }

  try {
    await tablaPautasLista;
    const row = await consultarUno('SELECT * FROM pautas WHERE id_pauta = ?', [id]);
    if (!row) return res.status(404).json({ mensaje: 'Pauta no encontrada.' });
    return res.json(mapearPauta(row));
  } catch (error) {
    return responderError(res, 'No se pudo obtener la pauta.', error);
  }
}

async function createPauta(req, res) {
  const {
    nombre,
    categoria,
    fecha,
    responsable,
    descripcion = '',
    conclusion = '',
    procesos = []
  } = req.body;

  if (
    typeof nombre !== 'string' || !nombre.trim() ||
    typeof categoria !== 'string' || !categoria.trim() ||
    typeof fecha !== 'string' || !fecha.trim() ||
    typeof responsable !== 'string' || !responsable.trim() ||
    typeof descripcion !== 'string' ||
    typeof conclusion !== 'string' ||
    !procesosValidos(procesos)
  ) {
    return res.status(400).json({ mensaje: 'Los datos de la pauta no tienen un formato válido.' });
  }

  const pauta = {
    nombre: nombre.trim(),
    categoria: categoria.trim(),
    fecha: fecha.trim(),
    responsable: responsable.trim(),
    descripcion: descripcion.trim(),
    conclusion: conclusion.trim(),
    procesos
  };

  try {
    await tablaPautasLista;
    await ejecutar('BEGIN IMMEDIATE');

    const existing = await consultarUno(
      'SELECT id_pauta FROM pautas WHERE nombre = ? AND categoria = ?',
      [pauta.nombre, pauta.categoria]
    );
    if (existing) {
      await ejecutar('ROLLBACK');
      return res.status(409).json({ mensaje: 'La pauta ya existe dentro de esa categoría.' });
    }

    const resultado = await ejecutar(
      `INSERT INTO pautas (nombre, categoria, fecha, responsable, descripcion, conclusion, procesos)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        pauta.nombre,
        pauta.categoria,
        pauta.fecha,
        pauta.responsable,
        pauta.descripcion,
        pauta.conclusion,
        JSON.stringify(pauta.procesos)
      ]
    );

    await ejecutar(
      `INSERT INTO actualizaciones (pauta_id, fecha, responsable, cambio, observaciones)
       VALUES (?, ?, ?, ?, ?)`,
      [
        resultado.lastID,
        pauta.fecha,
        pauta.responsable,
        `Nueva pauta registrada: ${pauta.nombre}`,
        pauta.descripcion
      ]
    );
    await ejecutar('COMMIT');

    return res.status(201).json({ id: resultado.lastID, ...pauta });
  } catch (error) {
    await ejecutar('ROLLBACK').catch(() => {});
    return responderError(res, 'No se pudo guardar la pauta.', error);
  }
}

async function updatePauta(req, res) {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id < 1) {
    return res.status(400).json({ mensaje: 'El identificador de la pauta no es válido.' });
  }

  try {
    await tablaPautasLista;
    const row = await consultarUno('SELECT * FROM pautas WHERE id_pauta = ?', [id]);
    if (!row) return res.status(404).json({ mensaje: 'Pauta no encontrada.' });
    const actual = mapearPauta(row);
    const body = req.body;

    const pauta = {
      nombre: body.nombre === undefined ? actual.nombre : body.nombre.trim(),
      categoria: body.categoria === undefined ? actual.categoria : body.categoria.trim(),
      fecha: body.fecha === undefined ? actual.fecha : body.fecha,
      responsable: body.responsable === undefined ? actual.responsable : body.responsable.trim(),
      descripcion: body.descripcion === undefined ? actual.descripcion : body.descripcion.trim(),
      conclusion: body.conclusion === undefined ? actual.conclusion : body.conclusion.trim(),
      procesos: body.procesos === undefined ? actual.procesos : body.procesos
    };

    if (
      !pauta.nombre || !pauta.categoria ||
      typeof pauta.fecha !== 'string' ||
      typeof pauta.responsable !== 'string' ||
      typeof pauta.descripcion !== 'string' ||
      typeof pauta.conclusion !== 'string' ||
      !procesosValidos(pauta.procesos)
    ) {
      return res.status(400).json({ mensaje: 'Los datos de la pauta no tienen un formato válido.' });
    }

    const duplicate = await consultarUno(
      'SELECT id_pauta FROM pautas WHERE nombre = ? AND categoria = ? AND id_pauta != ?',
      [pauta.nombre, pauta.categoria, id]
    );
    if (duplicate) {
      return res.status(409).json({ mensaje: 'La pauta ya existe dentro de esa categoría.' });
    }

    await ejecutar(
      `UPDATE pautas
       SET nombre = ?, categoria = ?, fecha = ?, responsable = ?, descripcion = ?, conclusion = ?, procesos = ?
       WHERE id_pauta = ?`,
      [
        pauta.nombre,
        pauta.categoria,
        pauta.fecha,
        pauta.responsable,
        pauta.descripcion,
        pauta.conclusion,
        JSON.stringify(pauta.procesos),
        id
      ]
    );

    return res.json({ id, ...pauta });
  } catch (error) {
    return responderError(res, 'No se pudo actualizar la pauta.', error);
  }
}

async function deletePauta(req, res) {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id < 1) {
    return res.status(400).json({ mensaje: 'El identificador de la pauta no es válido.' });
  }

  try {
    await tablaPautasLista;

    await ejecutar('BEGIN IMMEDIATE');
    const pauta = await consultarUno('SELECT id_pauta FROM pautas WHERE id_pauta = ?', [id]);
    if (!pauta) {
      await ejecutar('ROLLBACK');
      return res.status(404).json({ mensaje: 'Pauta no encontrada.' });
    }

    const historial = await consultarUno(
      'SELECT COUNT(*) AS total FROM actualizaciones WHERE pauta_id = ?',
      [id]
    );
    if (historial.total > 0) {
      await ejecutar('ROLLBACK');
      return res.status(409).json({
        mensaje: 'No se puede eliminar la pauta porque tiene actualizaciones registradas. El historial se conserva.'
      });
    }

    const resultado = await ejecutar('DELETE FROM pautas WHERE id_pauta = ?', [id]);
    if (!resultado.changes) {
      await ejecutar('ROLLBACK');
      return res.status(404).json({ mensaje: 'Pauta no encontrada.' });
    }

    await ejecutar('COMMIT');
    return res.json({ mensaje: 'Pauta eliminada correctamente.' });
  } catch (error) {
    await ejecutar('ROLLBACK').catch(() => {});
    if (error.code === 'SQLITE_CONSTRAINT') {
      return res.status(409).json({
        mensaje: 'No se puede eliminar la pauta porque tiene actualizaciones registradas. El historial se conserva.'
      });
    }
    return responderError(res, 'No se pudo eliminar la pauta.', error);
  }
}

module.exports = {
  getPautas,
  getPautaById,
  createPauta,
  updatePauta,
  deletePauta
};

const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const { sanitizarTextoEnriquecido } = require('../middleware/sanitizar');

const database = new sqlite3.Database(path.join(__dirname, '../database/database.sqlite'));
const MAX_IMAGENES_POR_PAUTA = 5;
const MAX_BYTES_POR_IMAGEN = 10 * 1024 * 1024;
const MAX_BYTES_TOTALES_IMAGENES = 20 * 1024 * 1024;
const TIPOS_IMAGEN_VALIDOS = new Set(['image/jpeg', 'image/png', 'image/gif', 'image/webp']);

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
      procesos TEXT NOT NULL DEFAULT '[]',
      pasos TEXT NOT NULL DEFAULT '[]',
      nota TEXT NOT NULL DEFAULT ''
    )
  `);

  const columnas = await consultar('PRAGMA table_info(pautas)');
  const columnasExistentes = new Set(columnas.map((columna) => columna.name));
  const columnasNuevas = [
    ['responsable', "TEXT NOT NULL DEFAULT ''"],
    ['descripcion', "TEXT NOT NULL DEFAULT ''"],
    ['conclusion', "TEXT NOT NULL DEFAULT ''"],
    ['procesos', "TEXT NOT NULL DEFAULT '[]'"],
    ['pasos', "TEXT NOT NULL DEFAULT '[]'"],
    ['nota', "TEXT NOT NULL DEFAULT ''"]
  ];

  for (const [nombre, definicion] of columnasNuevas) {
    if (!columnasExistentes.has(nombre)) {
      await ejecutar(`ALTER TABLE pautas ADD COLUMN ${nombre} ${definicion}`);
    }
  }

  await ejecutar(`
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

  // El campo "tipo" se eliminó: se quita de bases creadas con una versión anterior.
  if (columnasExistentes.has('tipo')) await ejecutar('ALTER TABLE pautas DROP COLUMN tipo');

  // Cada actualización guarda una copia de los campos de la pauta al momento de registrarse.
  const columnasActualizaciones = new Set((await consultar('PRAGMA table_info(actualizaciones)')).map((c) => c.name));
  const columnasNuevasActualizaciones = [
    ['categoria', "TEXT NOT NULL DEFAULT ''"],
    ['titulo', "TEXT NOT NULL DEFAULT ''"],
    ['descripcion', "TEXT NOT NULL DEFAULT ''"],
    ['conclusion', "TEXT NOT NULL DEFAULT ''"],
    ['pasos', "TEXT NOT NULL DEFAULT '[]'"],
    ['nota', "TEXT NOT NULL DEFAULT ''"]
  ];
  if (columnasActualizaciones.has('tipo')) await ejecutar('ALTER TABLE actualizaciones DROP COLUMN tipo');
  let migradas = false;
  for (const [nombre, definicion] of columnasNuevasActualizaciones) {
    if (!columnasActualizaciones.has(nombre)) {
      await ejecutar(`ALTER TABLE actualizaciones ADD COLUMN ${nombre} ${definicion}`);
      migradas = true;
    }
  }
  if (migradas) {
    await ejecutar(`
      UPDATE actualizaciones SET
        categoria = COALESCE((SELECT p.categoria FROM pautas p WHERE p.id_pauta = pauta_id), ''),
        titulo = COALESCE((SELECT p.nombre FROM pautas p WHERE p.id_pauta = pauta_id), ''),
        descripcion = COALESCE((SELECT p.descripcion FROM pautas p WHERE p.id_pauta = pauta_id), ''),
        conclusion = COALESCE((SELECT p.conclusion FROM pautas p WHERE p.id_pauta = pauta_id), ''),
        pasos = COALESCE((SELECT p.pasos FROM pautas p WHERE p.id_pauta = pauta_id), '[]'),
        nota = COALESCE((SELECT p.nota FROM pautas p WHERE p.id_pauta = pauta_id), '')
    `);
  }

  await ejecutar(`
    CREATE TABLE IF NOT EXISTS imagenes_pautas (
      id_imagen INTEGER PRIMARY KEY AUTOINCREMENT,
      pauta_id INTEGER NOT NULL,
      nombre TEXT NOT NULL,
      tipo_mime TEXT NOT NULL,
      datos BLOB NOT NULL,
      fecha_subida TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (pauta_id) REFERENCES pautas(id_pauta) ON DELETE CASCADE
    )
  `);
  await ejecutar('CREATE INDEX IF NOT EXISTS idx_imagenes_pautas_pauta_id ON imagenes_pautas(pauta_id)');
}

const tablaPautasLista = inicializarTablaPautas();
tablaPautasLista.catch((error) => {
  console.error('No se pudo inicializar la tabla de pautas:', error);
});

function mapearPauta(row) {
  let procesos;
  let pasos;
  try {
    procesos = JSON.parse(row.procesos || '[]');
    pasos = JSON.parse(row.pasos || '[]');
  } catch (error) {
    throw new Error(`Los procesos o pasos de la pauta ${row.id_pauta} no tienen un JSON válido.`);
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
    pasos: Array.isArray(pasos) ? pasos : [],
    nota: row.nota || '',
    procesos,
    cantidadImagenes: Number(row.cantidad_imagenes || 0)
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

// Acepta una lista de textos o de { paso, descripcion } y la devuelve numerada; null si no es válida.
function normalizarPasos(pasos) {
  if (!Array.isArray(pasos)) return null;
  const normalizados = [];
  for (const item of pasos) {
    const descripcion = typeof item === 'string' ? item : item?.descripcion;
    if (typeof descripcion !== 'string') return null;
    if (descripcion.trim()) normalizados.push({ paso: normalizados.length + 1, descripcion: descripcion.trim() });
  }
  return normalizados;
}

function imagenValida(datos, tipoMime) {
  if (tipoMime === 'image/png') {
    return datos.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
  }
  if (tipoMime === 'image/jpeg') {
    return datos.length >= 3 && datos[0] === 0xff && datos[1] === 0xd8 && datos[2] === 0xff;
  }
  if (tipoMime === 'image/gif') {
    return ['GIF87a', 'GIF89a'].includes(datos.toString('ascii', 0, 6));
  }
  if (tipoMime === 'image/webp') {
    return datos.toString('ascii', 0, 4) === 'RIFF' &&
      datos.toString('ascii', 8, 12) === 'WEBP';
  }
  return false;
}

function validarImagenes(imagenes) {
  if (!Array.isArray(imagenes) || imagenes.length > MAX_IMAGENES_POR_PAUTA) return null;

  let bytesTotales = 0;
  const imagenesValidadas = [];

  for (const imagen of imagenes) {
    if (
      !imagen ||
      typeof imagen.nombre !== 'string' ||
      !imagen.nombre.trim() ||
      imagen.nombre.length > 255 ||
      !TIPOS_IMAGEN_VALIDOS.has(imagen.tipo) ||
      typeof imagen.dataUrl !== 'string'
    ) {
      return null;
    }

    const coincidencia = imagen.dataUrl.match(/^data:(image\/(?:jpeg|png|gif|webp));base64,([A-Za-z0-9+/]+={0,2})$/);
    if (!coincidencia || coincidencia[1] !== imagen.tipo) return null;

    const datos = Buffer.from(coincidencia[2], 'base64');
    if (
      datos.length === 0 ||
      datos.length > MAX_BYTES_POR_IMAGEN ||
      datos.toString('base64') !== coincidencia[2] ||
      !imagenValida(datos, imagen.tipo)
    ) {
      return null;
    }

    bytesTotales += datos.length;
    if (bytesTotales > MAX_BYTES_TOTALES_IMAGENES) return null;
    imagenesValidadas.push({
      nombre: imagen.nombre.trim(),
      tipo: imagen.tipo,
      datos
    });
  }

  return imagenesValidadas;
}

function idValido(valor) {
  const id = Number(valor);
  return Number.isInteger(id) && id > 0 ? id : null;
}

function responderError(res, mensaje, error) {
  console.error(`${mensaje}:`, error);
  return res.status(500).json({ mensaje });
}

async function getPautas(req, res) {
  try {
    await tablaPautasLista;
    const rows = await consultar(`
      SELECT p.*,
        (SELECT COUNT(*) FROM imagenes_pautas i WHERE i.pauta_id = p.id_pauta) AS cantidad_imagenes
      FROM pautas p
      ORDER BY p.id_pauta ASC
    `);
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
    const row = await consultarUno(`
      SELECT p.*,
        (SELECT COUNT(*) FROM imagenes_pautas i WHERE i.pauta_id = p.id_pauta) AS cantidad_imagenes
      FROM pautas p
      WHERE p.id_pauta = ?
    `, [id]);
    if (!row) return res.status(404).json({ mensaje: 'Pauta no encontrada.' });
    return res.json(mapearPauta(row));
  } catch (error) {
    return responderError(res, 'No se pudo obtener la pauta.', error);
  }
}

async function getImagenesPauta(req, res) {
  const id = idValido(req.params.id);
  if (!id) {
    return res.status(400).json({ mensaje: 'El identificador de la pauta no es válido.' });
  }

  try {
    await tablaPautasLista;
    const pauta = await consultarUno('SELECT id_pauta FROM pautas WHERE id_pauta = ?', [id]);
    if (!pauta) return res.status(404).json({ mensaje: 'Pauta no encontrada.' });

    const imagenes = await consultar(
      'SELECT id_imagen AS id, nombre, tipo_mime AS tipo, length(datos) AS tamañoBytes FROM imagenes_pautas WHERE pauta_id = ? ORDER BY id_imagen ASC',
      [id]
    );
    return res.json(imagenes);
  } catch (error) {
    return responderError(res, 'No se pudieron obtener las evidencias de la pauta.', error);
  }
}

async function getImagenPauta(req, res) {
  const pautaId = idValido(req.params.id);
  const imagenId = idValido(req.params.imagenId);
  if (!pautaId || !imagenId) {
    return res.status(400).json({ mensaje: 'El identificador de la imagen no es válido.' });
  }

  try {
    await tablaPautasLista;
    const imagen = await consultarUno(
      'SELECT tipo_mime, datos FROM imagenes_pautas WHERE id_imagen = ? AND pauta_id = ?',
      [imagenId, pautaId]
    );
    if (!imagen) return res.status(404).json({ mensaje: 'Evidencia no encontrada.' });

    res.set('Content-Type', imagen.tipo_mime);
    res.set('X-Content-Type-Options', 'nosniff');
    res.set('Cache-Control', 'no-store');
    return res.send(imagen.datos);
  } catch (error) {
    return responderError(res, 'No se pudo obtener la evidencia.', error);
  }
}

async function createImagenesPauta(req, res) {
  const pautaId = idValido(req.params.id);
  if (!pautaId) {
    return res.status(400).json({ mensaje: 'El identificador de la pauta no es válido.' });
  }

  const imagenesValidadas = validarImagenes(req.body?.imagenes);
  if (!imagenesValidadas || imagenesValidadas.length === 0) {
    return res.status(400).json({ mensaje: 'Las imágenes adjuntas no son válidas.' });
  }

  let transaccionIniciada = false;
  try {
    await tablaPautasLista;
    await ejecutar('BEGIN IMMEDIATE');
    transaccionIniciada = true;

    const pauta = await consultarUno('SELECT id_pauta FROM pautas WHERE id_pauta = ?', [pautaId]);
    if (!pauta) {
      await ejecutar('ROLLBACK');
      transaccionIniciada = false;
      return res.status(404).json({ mensaje: 'Pauta no encontrada.' });
    }

    const usoActual = await consultarUno(
      'SELECT COUNT(*) AS cantidad, COALESCE(SUM(length(datos)), 0) AS bytes FROM imagenes_pautas WHERE pauta_id = ?',
      [pautaId]
    );
    const bytesNuevos = imagenesValidadas.reduce((total, imagen) => total + imagen.datos.length, 0);
    if (usoActual.cantidad + imagenesValidadas.length > MAX_IMAGENES_POR_PAUTA) {
      await ejecutar('ROLLBACK');
      transaccionIniciada = false;
      return res.status(400).json({ mensaje: `Una pauta puede tener hasta ${MAX_IMAGENES_POR_PAUTA} evidencias.` });
    }
    if (usoActual.bytes + bytesNuevos > MAX_BYTES_TOTALES_IMAGENES) {
      await ejecutar('ROLLBACK');
      transaccionIniciada = false;
      return res.status(400).json({ mensaje: 'El tamaño total de las evidencias no puede superar 20 MB.' });
    }

    for (const imagen of imagenesValidadas) {
      await ejecutar(
        'INSERT INTO imagenes_pautas (pauta_id, nombre, tipo_mime, datos) VALUES (?, ?, ?, ?)',
        [pautaId, imagen.nombre, imagen.tipo, imagen.datos]
      );
    }

    await ejecutar('COMMIT');
    transaccionIniciada = false;
    return res.status(201).json({
      mensaje: 'Evidencias agregadas correctamente.',
      imagenes: imagenesValidadas.map(({ nombre, tipo }) => ({ nombre, tipo }))
    });
  } catch (error) {
    if (transaccionIniciada) {
      try {
        await ejecutar('ROLLBACK');
      } catch (errorReversion) {
        console.error('No se pudo revertir la carga de evidencias:', errorReversion);
      }
    }
    return responderError(res, 'No se pudieron agregar las evidencias.', error);
  }
}

async function deleteImagenPauta(req, res) {
  const pautaId = idValido(req.params.id);
  const imagenId = idValido(req.params.imagenId);
  if (!pautaId || !imagenId) {
    return res.status(400).json({ mensaje: 'El identificador de la imagen no es válido.' });
  }

  try {
    await tablaPautasLista;
    const resultado = await ejecutar(
      'DELETE FROM imagenes_pautas WHERE id_imagen = ? AND pauta_id = ?',
      [imagenId, pautaId]
    );
    if (!resultado.changes) return res.status(404).json({ mensaje: 'Evidencia no encontrada.' });
    return res.json({ mensaje: 'Evidencia eliminada correctamente.' });
  } catch (error) {
    return responderError(res, 'No se pudo eliminar la evidencia.', error);
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
    pasos = [],
    nota = '',
    procesos = [],
    imagenes = []
  } = req.body;
  const imagenesValidadas = validarImagenes(imagenes);
  const pasosNormalizados = normalizarPasos(pasos);

  if (
    typeof nombre !== 'string' || !nombre.trim() ||
    typeof categoria !== 'string' || !categoria.trim() ||
    typeof fecha !== 'string' || !fecha.trim() ||
    typeof responsable !== 'string' || !responsable.trim() ||
    typeof descripcion !== 'string' ||
    typeof conclusion !== 'string' ||
    !pasosNormalizados ||
    typeof nota !== 'string' ||
    !procesosValidos(procesos) ||
    !imagenesValidadas
  ) {
    return res.status(400).json({
      mensaje: 'Los datos de la pauta no tienen un formato válido o las imágenes adjuntas no son válidas.'
    });
  }

  const pauta = {
    nombre: nombre.trim(),
    categoria: categoria.trim(),
    fecha: fecha.trim(),
    responsable: responsable.trim(),
    descripcion: sanitizarTextoEnriquecido(descripcion),
    conclusion: conclusion.trim(),
    pasos: pasosNormalizados,
    nota: nota.trim(),
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
      `INSERT INTO pautas (nombre, categoria, fecha, responsable, descripcion, conclusion, procesos, pasos, nota)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        pauta.nombre,
        pauta.categoria,
        pauta.fecha,
        pauta.responsable,
        pauta.descripcion,
        pauta.conclusion,
        JSON.stringify(pauta.procesos),
        JSON.stringify(pauta.pasos),
        pauta.nota
      ]
    );

    await ejecutar(
      `INSERT INTO actualizaciones
         (pauta_id, fecha, responsable, cambio, observaciones, categoria, titulo, descripcion, conclusion, pasos, nota)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        resultado.lastID,
        pauta.fecha,
        pauta.responsable,
        `Nueva pauta registrada: ${pauta.nombre}`,
        pauta.descripcion,
        pauta.categoria,
        pauta.nombre,
        pauta.descripcion,
        pauta.conclusion,
        JSON.stringify(pauta.pasos),
        pauta.nota
      ]
    );

    for (const imagen of imagenesValidadas) {
      await ejecutar(
        'INSERT INTO imagenes_pautas (pauta_id, nombre, tipo_mime, datos) VALUES (?, ?, ?, ?)',
        [resultado.lastID, imagen.nombre, imagen.tipo, imagen.datos]
      );
    }

    await ejecutar('COMMIT');

    return res.status(201).json({
      id: resultado.lastID,
      ...pauta,
      imagenes: imagenesValidadas.map(({ nombre, tipo }) => ({ nombre, tipo }))
    });
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

    const texto = (valor, actualValor) => {
      if (valor === undefined) return actualValor;
      return typeof valor === 'string' ? valor.trim() : null;
    };
    const pauta = {
      nombre: texto(body.nombre, actual.nombre),
      categoria: texto(body.categoria, actual.categoria),
      fecha: body.fecha === undefined ? actual.fecha : body.fecha,
      responsable: texto(body.responsable, actual.responsable),
      descripcion: body.descripcion === undefined
        ? actual.descripcion
        : (typeof body.descripcion === 'string' ? sanitizarTextoEnriquecido(body.descripcion) : null),
      conclusion: texto(body.conclusion, actual.conclusion),
      pasos: body.pasos === undefined ? actual.pasos : normalizarPasos(body.pasos),
      nota: texto(body.nota, actual.nota),
      procesos: body.procesos === undefined ? actual.procesos : body.procesos
    };

    if (
      !pauta.nombre || !pauta.categoria ||
      typeof pauta.fecha !== 'string' ||
      typeof pauta.responsable !== 'string' ||
      typeof pauta.descripcion !== 'string' ||
      typeof pauta.conclusion !== 'string' ||
      !pauta.pasos ||
      typeof pauta.nota !== 'string' ||
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
       SET nombre = ?, categoria = ?, fecha = ?, responsable = ?, descripcion = ?, conclusion = ?, procesos = ?,
           pasos = ?, nota = ?
       WHERE id_pauta = ?`,
      [
        pauta.nombre,
        pauta.categoria,
        pauta.fecha,
        pauta.responsable,
        pauta.descripcion,
        pauta.conclusion,
        JSON.stringify(pauta.procesos),
        JSON.stringify(pauta.pasos),
        pauta.nota,
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

  let transaccionIniciada = false;
  try {
    await tablaPautasLista;

    await ejecutar('BEGIN IMMEDIATE');
    transaccionIniciada = true;
    const pauta = await consultarUno('SELECT id_pauta FROM pautas WHERE id_pauta = ?', [id]);
    if (!pauta) {
      await ejecutar('ROLLBACK');
      transaccionIniciada = false;
      return res.status(404).json({ mensaje: 'Pauta no encontrada.' });
    }

    await ejecutar('DELETE FROM actualizaciones WHERE pauta_id = ?', [id]);

    const resultado = await ejecutar('DELETE FROM pautas WHERE id_pauta = ?', [id]);
    if (!resultado.changes) {
      await ejecutar('ROLLBACK');
      transaccionIniciada = false;
      return res.status(404).json({ mensaje: 'Pauta no encontrada.' });
    }

    await ejecutar('COMMIT');
    transaccionIniciada = false;
    return res.json({ mensaje: 'Pauta eliminada correctamente.' });
  } catch (error) {
    if (transaccionIniciada) {
      try {
        await ejecutar('ROLLBACK');
      } catch (errorReversion) {
        console.error('No se pudo revertir la eliminación de la pauta:', errorReversion);
      }
    }
    if (error.code === 'SQLITE_CONSTRAINT') {
      return res.status(409).json({
        mensaje: 'No se pudo eliminar la pauta debido a registros relacionados.'
      });
    }
    return responderError(res, 'No se pudo eliminar la pauta.', error);
  }
}

module.exports = {
  tablaPautasLista,
  normalizarPasos,
  getPautas,
  getPautaById,
  getImagenesPauta,
  getImagenPauta,
  createImagenesPauta,
  deleteImagenPauta,
  createPauta,
  updatePauta,
  deletePauta
};

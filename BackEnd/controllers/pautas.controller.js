const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');
const vm = require('vm');

const database = new sqlite3.Database(path.join(__dirname, '../database/database.sqlite'));
const pautasFile = path.join(__dirname, '../../frontend/js/pautas.js');

function crearTablaPautas() {
  database.run(`
    CREATE TABLE IF NOT EXISTS pautas (
      id_pauta INTEGER PRIMARY KEY AUTOINCREMENT,
      nombre TEXT NOT NULL,
      categoria TEXT NOT NULL,
      fecha TEXT NOT NULL DEFAULT (DATE('now')),
      responsable TEXT NOT NULL DEFAULT '',
      descripcion TEXT NOT NULL DEFAULT ''
    )
  `, (error) => {
    if (error) return;

    database.all('PRAGMA table_info(pautas)', (pragmaError, columnas) => {
      if (pragmaError) return;

      const tieneCamposObsoletos = columnas.some((columna) => ["version", "estado"].includes(columna.name));
      const tieneResponsable = columnas.some((columna) => columna.name === "responsable");
      const tieneDescripcion = columnas.some((columna) => columna.name === "descripcion");

      if (!tieneCamposObsoletos) {
        if (!tieneResponsable) database.run("ALTER TABLE pautas ADD COLUMN responsable TEXT NOT NULL DEFAULT ''");
        if (!tieneDescripcion) database.run("ALTER TABLE pautas ADD COLUMN descripcion TEXT NOT NULL DEFAULT ''");
        return;
      }

      database.serialize(() => {
        database.run('ALTER TABLE pautas RENAME TO pautas_legacy');
        database.run(`
          CREATE TABLE pautas (
            id_pauta INTEGER PRIMARY KEY AUTOINCREMENT,
            nombre TEXT NOT NULL,
            categoria TEXT NOT NULL,
            fecha TEXT NOT NULL DEFAULT (DATE('now')),
            responsable TEXT NOT NULL DEFAULT '',
            descripcion TEXT NOT NULL DEFAULT ''
          )
        `);
        database.run(`
          INSERT INTO pautas (id_pauta, nombre, categoria, fecha, responsable, descripcion)
          SELECT id_pauta, nombre, categoria, fecha, '', '' FROM pautas_legacy
        `);
        database.run('DROP TABLE pautas_legacy');
      });
    });
  });
}

crearTablaPautas();

const fallbackPautas = [
  { id: 1, nombre: 'Clasificación de errores', categoria: 'Auditoría', fecha: '2026-08-26', responsable: '' },
  { id: 2, nombre: 'Validación de tickets', categoria: 'Tickets', fecha: '2026-08-20', responsable: '' },
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
      fecha: row.fecha,
      responsable: row.responsable,
      descripcion: row.descripcion,
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
  const { nombre, categoria, fecha, responsable, descripcion } = req.body;

  if (!nombre || !categoria || !fecha || !responsable) {
    return res.status(400).json({ mensaje: 'Nombre, categoría, fecha y responsable son obligatorios.' });
  }

  const payload = {
    nombre: nombre.trim(),
    categoria: categoria.trim(),
    fecha,
    responsable: responsable.trim(),
    descripcion: descripcion?.trim() || '',
  };

  database.get(
    'SELECT id_pauta FROM pautas WHERE nombre = ? AND categoria = ?',
    [payload.nombre, payload.categoria],
    (findError, existing) => {
      if (findError) return res.status(500).json({ mensaje: 'No se pudo validar la pauta.' });
      if (existing) return res.status(409).json({ mensaje: 'La pauta ya existe dentro de esa categoría.' });

      try {
        const nombreCatalogo = guardarPautaEnArchivo(payload.categoria, payload.nombre, payload.descripcion);
        payload.nombre = nombreCatalogo;
      } catch (error) {
        return res.status(500).json({ mensaje: 'No se pudo actualizar pautas.js.', detalle: error.message });
      }

      database.run(
        'INSERT INTO pautas (nombre, categoria, fecha, responsable, descripcion) VALUES (?, ?, ?, ?, ?)',
        [payload.nombre, payload.categoria, payload.fecha, payload.responsable, payload.descripcion],
        function (error) {
          if (error) {
            console.warn('No se pudo guardar en SQLite; usando datos locales.', error.message);
            const nuevaPauta = { id: Date.now(), ...payload };
            fallbackPautas.unshift(nuevaPauta);
            return res.status(201).json(nuevaPauta);
          }

          const idPauta = this.lastID;
          database.run(`
            INSERT INTO actualizaciones (pauta_id, fecha, responsable, cambio, observaciones)
            VALUES (?, ?, ?, ?, ?)
          `, [
            idPauta,
            payload.fecha,
            payload.responsable,
            `Nueva pauta registrada: ${payload.nombre}`,
            payload.descripcion
          ], (historialError) => {
            if (historialError) {
              return res.status(500).json({ mensaje: 'La pauta se creó, pero no se pudo registrar en el historial.' });
            }

            return res.status(201).json({ id: idPauta, ...payload });
          });
        }
      );
    }
  );
}

function updatePauta(req, res) {
  const { id } = req.params;
  const { nombre, categoria, fecha, responsable, descripcion } = req.body;

  readPautaById(id, (error, pautaActual) => {
    if (error) return res.status(500).json({ mensaje: 'No se pudo cargar la pauta.' });
    if (!pautaActual) return res.status(404).json({ mensaje: 'Pauta no encontrada.' });

    const payload = {
      nombre: nombre ? nombre.trim() : pautaActual.nombre,
      categoria: categoria ? categoria.trim() : pautaActual.categoria,
      fecha: fecha || pautaActual.fecha,
      responsable: responsable ? responsable.trim() : pautaActual.responsable,
      descripcion: descripcion !== undefined ? descripcion.trim() : pautaActual.descripcion,
    };

    database.run(
      'UPDATE pautas SET nombre = ?, categoria = ?, fecha = ?, responsable = ?, descripcion = ? WHERE id_pauta = ?',
      [payload.nombre, payload.categoria, payload.fecha, payload.responsable, payload.descripcion, id],
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

function guardarPautaEnArchivo(categoria, nombre, descripcion) {
  const contenido = fs.readFileSync(pautasFile, 'utf8');
  const contexto = {};
  vm.runInNewContext(contenido.replace(/^const datos\s*=\s*/, 'datos = '), contexto);

  if (!contexto.datos?.[categoria]) {
    throw new Error('La categoría seleccionada no existe en pautas.js.');
  }

  const fecha = new Date().toLocaleDateString('es-MX').split('/').map((parte) => parte.padStart(2, '0')).reverse().join('-');
  let clave;
  let nombreCatalogo = nombre.trim();
  let entrada;

  if (categoria === 'Reglas') {
    const numeros = Object.keys(contexto.datos[categoria])
      .map((item) => item.match(/^cat(\d+)$/))
      .filter(Boolean)
      .map((coincidencia) => Number(coincidencia[1]));
    const siguienteNumero = Math.max(0, ...numeros) + 1;
    clave = `cat${siguienteNumero}`;
    nombreCatalogo = nombreCatalogo.replace(/^cat\d+\s*-\s*/i, '');
    nombreCatalogo = `${clave} - ${nombreCatalogo}`;
    entrada = { name: nombreCatalogo, Descripcion: descripcion || '' };
  } else if (categoria === 'Casos') {
    const numeros = Object.keys(contexto.datos[categoria])
      .map((item) => item.match(/^Caso(\d+)$/i))
      .filter(Boolean)
      .map((coincidencia) => Number(coincidencia[1]));
    clave = `Caso${Math.max(0, ...numeros) + 1}`;
    entrada = { title: nombreCatalogo, Conclusion: descripcion || '', fecha };
  } else if (categoria === 'Tarifas') {
    clave = crearClaveDisponible(contexto.datos[categoria], nombreCatalogo);
    entrada = { Detalle: descripcion || '', Conclusion: '', fecha };
  } else {
    clave = crearClaveDisponible(contexto.datos[categoria], nombreCatalogo);
    entrada = {
      Procesos: { Proceso1: descripcion || '', pasos: [], nota: '' },
      fecha
    };
  }

  if (contexto.datos[categoria][clave]) {
    throw new Error('La clave generada ya existe en la categoría seleccionada.');
  }

  contexto.datos[categoria][clave] = entrada;

  const nuevoContenido = `const datos = ${JSON.stringify(contexto.datos, null, 2)};\n`;
  vm.runInNewContext(nuevoContenido.replace(/^const datos\s*=\s*/, 'datos = '), {});
  fs.writeFileSync(pautasFile, nuevoContenido, 'utf8');
  return nombreCatalogo;
}

function crearClaveDisponible(elementos, nombre) {
  const base = nombre.toLowerCase().replace(/[^a-z0-9áéíóúñ]+/gi, '_').replace(/^_|_$/g, '') || 'pauta';
  let clave = base;
  let contador = 2;
  while (elementos[clave]) {
    clave = `${base}_${contador}`;
    contador += 1;
  }
  return clave;
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

/* SQLite
CREATE TABLE usuarios (
    id_usuario INTEGER PRIMARY KEY AUTOINCREMENT,
    usuario TEXT NOT NULL,
    correo_electronico TEXT NOT NULL UNIQUE,
    contrasena TEXT NOT NULL,
    rol TEXT NOT NULL DEFAULT 'consulta',
    fecha_creacion DATETIME DEFAULT CURRENT_TIMESTAMP
);

INSERT INTO usuarios (
    usuario,
    correo_electronico,
    contrasena
)
VALUES
('Juan Perez', 'juan@example.com', '123456'),
('Maria Lopez', 'maria@example.com', 'abcdef');*/
CREATE TABLE IF NOT EXISTS pautas (
    id_pauta INTEGER PRIMARY KEY AUTOINCREMENT,
    nombre TEXT NOT NULL,
    categoria TEXT NOT NULL,
    fecha TEXT NOT NULL DEFAULT '',
    responsable TEXT NOT NULL DEFAULT '',
    descripcion TEXT NOT NULL DEFAULT '',
    conclusion TEXT NOT NULL DEFAULT '',
    procesos TEXT NOT NULL DEFAULT '[]',
    pasos TEXT NOT NULL DEFAULT '[]',   -- JSON: [{ "paso": 1, "descripcion": "..." }]
    nota TEXT NOT NULL DEFAULT ''
);

CREATE TABLE IF NOT EXISTS actualizaciones (
    id_actualizacion INTEGER PRIMARY KEY AUTOINCREMENT,
    pauta_id INTEGER NOT NULL,
    fecha TEXT NOT NULL DEFAULT (DATE('now')),
    responsable TEXT NOT NULL,
    cambio TEXT NOT NULL,
    observaciones TEXT DEFAULT '',
    categoria TEXT NOT NULL DEFAULT '',
    titulo TEXT NOT NULL DEFAULT '',
    descripcion TEXT NOT NULL DEFAULT '',
    conclusion TEXT NOT NULL DEFAULT '',
    pasos TEXT NOT NULL DEFAULT '[]',
    nota TEXT NOT NULL DEFAULT '',
    FOREIGN KEY (pauta_id) REFERENCES pautas(id_pauta)
);

CREATE TABLE IF NOT EXISTS imagenes_pautas (
    id_imagen INTEGER PRIMARY KEY AUTOINCREMENT,
    pauta_id INTEGER NOT NULL,
    nombre TEXT NOT NULL,
    tipo_mime TEXT NOT NULL,
    datos BLOB NOT NULL,
    fecha_subida TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (pauta_id) REFERENCES pautas(id_pauta) ON DELETE CASCADE
);

INSERT  INTO usuarios (
    usuario,
    correo_electronico,
    contrasena
)
VALUES               ('wastudillo', 'wastudillo@miatech.net', 'metroid2211');

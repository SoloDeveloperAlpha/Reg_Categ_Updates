-- SQLite
CREATE TABLE usuarios (
    id_usuario INTEGER PRIMARY KEY AUTOINCREMENT,
    nombre TEXT NOT NULL,
    correo_electronico TEXT NOT NULL UNIQUE,
    contrasena TEXT NOT NULL,
    fecha_creacion DATETIME DEFAULT CURRENT_TIMESTAMP
);

INSERT INTO usuarios (
    nombre,
    correo_electronico,
    contrasena
)
VALUES
('Juan Perez', 'juan@example.com', '123456'),
('Maria Lopez', 'maria@example.com', 'abcdef');

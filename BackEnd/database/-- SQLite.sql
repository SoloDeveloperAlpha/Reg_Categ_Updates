/* SQLite
CREATE TABLE usuarios (
    id_usuario INTEGER PRIMARY KEY AUTOINCREMENT,
    usuario TEXT NOT NULL,
    correo_electronico TEXT NOT NULL UNIQUE,
    contrasena TEXT NOT NULL,
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
INSERT  INTO usuarios (
    usuario,
    correo_electronico,
    contrasena
)
VALUES               ('wastudillo', 'wastudillo@miatech.net', 'metroid2211');

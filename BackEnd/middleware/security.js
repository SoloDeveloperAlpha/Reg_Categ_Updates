const crypto = require('crypto');
const { promisify } = require('util');

const scrypt = promisify(crypto.scrypt);
const PREFIJO = 'scrypt';

async function hashContrasena(contrasena) {
  const salt = crypto.randomBytes(16);
  const derivada = await scrypt(contrasena, salt, 64);
  return `${PREFIJO}$${salt.toString('hex')}$${derivada.toString('hex')}`;
}

function esHash(valor) {
  return typeof valor === 'string' && valor.startsWith(`${PREFIJO}$`);
}

async function verificarContrasena(contrasena, almacenada) {
  if (!esHash(almacenada)) return false;
  const [, saltHex, hashHex] = almacenada.split('$');
  const esperado = Buffer.from(hashHex, 'hex');
  const derivada = await scrypt(contrasena, Buffer.from(saltHex, 'hex'), esperado.length);
  return crypto.timingSafeEqual(derivada, esperado);
}

function limitarIntentos({ ventanaMs, maximo, mensaje }) {
  const registros = new Map();
  setInterval(() => {
    const ahora = Date.now();
    for (const [clave, registro] of registros) {
      if (registro.expira <= ahora) registros.delete(clave);
    }
  }, ventanaMs).unref();

  return (req, res, next) => {
    const ahora = Date.now();
    let registro = registros.get(req.ip);
    if (!registro || registro.expira <= ahora) {
      registro = { cuenta: 0, expira: ahora + ventanaMs };
      registros.set(req.ip, registro);
    }
    registro.cuenta += 1;
    if (registro.cuenta > maximo) {
      res.set('Retry-After', String(Math.ceil((registro.expira - ahora) / 1000)));
      return res.status(429).json({ mensaje });
    }
    return next();
  };
}

function cabecerasSeguridad(req, res, next) {
  res.set({
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'SAMEORIGIN',
    'Referrer-Policy': 'same-origin'
  });
  next();
}

module.exports = { hashContrasena, verificarContrasena, esHash, limitarIntentos, cabecerasSeguridad };

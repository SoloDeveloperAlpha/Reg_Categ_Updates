// Lista blanca para el texto con formato básico que genera el editor del frontend.
const ETIQUETAS = new Set(['b', 'strong', 'i', 'em', 'u', 's', 'strike', 'del', 'br', 'p', 'div', 'ul', 'ol', 'li', 'font']);
const ETIQUETAS_VACIAS = new Set(['br']);
const COLOR = /^(#[0-9a-f]{3,8}|rgb\(\s*\d{1,3}\s*,\s*\d{1,3}\s*,\s*\d{1,3}\s*\)|[a-z]{3,20})$/i;
const ETIQUETA_HTML = /<\/?([a-zA-Z][a-zA-Z0-9]*)\b[^>]*>/g;
const HAY_ETIQUETAS = /<\/?[a-zA-Z][^>]*>|<!--/;

function atributosSeguros(etiqueta, cruda) {
  if (etiqueta !== 'font') return '';
  let salida = '';
  for (const [, nombre, valor] of cruda.matchAll(/([a-zA-Z-]+)\s*=\s*"([^"]*)"/g)) {
    if (nombre.toLowerCase() === 'color' && COLOR.test(valor.trim())) salida += ` color="${valor.trim()}"`;
    if (nombre.toLowerCase() === 'size' && /^[1-7]$/.test(valor.trim())) salida += ` size="${valor.trim()}"`;
  }
  return salida;
}

function escaparTexto(texto) {
  return texto.replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

// Si el valor es texto plano se conserva tal cual; si trae etiquetas se filtran.
function sanitizarTextoEnriquecido(valor) {
  if (typeof valor !== 'string') return '';
  const texto = valor.trim();
  if (!HAY_ETIQUETAS.test(texto)) return texto;

  const sinComentarios = texto
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/<(script|style)\b[\s\S]*?<\/\1\s*>/gi, '');
  let resultado = '';
  let ultimo = 0;
  for (const coincidencia of sinComentarios.matchAll(ETIQUETA_HTML)) {
    resultado += escaparTexto(sinComentarios.slice(ultimo, coincidencia.index));
    ultimo = coincidencia.index + coincidencia[0].length;
    const etiqueta = coincidencia[1].toLowerCase();
    if (!ETIQUETAS.has(etiqueta)) continue;
    if (coincidencia[0].startsWith('</')) {
      if (!ETIQUETAS_VACIAS.has(etiqueta)) resultado += `</${etiqueta}>`;
    } else {
      resultado += `<${etiqueta}${atributosSeguros(etiqueta, coincidencia[0])}>`;
    }
  }
  return (resultado + escaparTexto(sinComentarios.slice(ultimo))).trim();
}

function textoVisible(html) {
  return html.replace(/<[^>]*>/g, '').replace(/&nbsp;/g, ' ').trim();
}

module.exports = { sanitizarTextoEnriquecido, textoVisible };

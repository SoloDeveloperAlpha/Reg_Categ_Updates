(function () {
  const DIAS_SIN_ACTUALIZAR = 60;
  const MAXIMO_EN_LISTA = 6;

  const panelActividad = document.getElementById("panel-mi-actividad");
  const panelDesactualizadas = document.getElementById("panel-desactualizadas");
  const panelCuentas = document.getElementById("panel-cuentas");
  if (!panelActividad || !panelDesactualizadas || !panelCuentas) return;

  const MS_DIA = 24 * 60 * 60 * 1000;
  const formatoFecha = new Intl.DateTimeFormat("es", { day: "numeric", month: "short", year: "numeric" });

  const rolActual = () => (typeof obtenerUsuarioActual === "function" ? obtenerUsuarioActual() : null)?.rol;
  const inicioDelDia = (fecha) => new Date(fecha.getFullYear(), fecha.getMonth(), fecha.getDate());
  const fechaDeTexto = (texto) => {
    const coincidencia = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(texto || ""));
    return coincidencia ? new Date(Number(coincidencia[1]), Number(coincidencia[2]) - 1, Number(coincidencia[3])) : null;
  };
  const diasDesde = (fecha, hoy) => Math.round((hoy - fecha) / MS_DIA);
  const textoDias = (dias) => (dias <= 0 ? "hoy" : dias === 1 ? "hace 1 día" : `hace ${dias} días`);

  function asignar(id, texto) {
    const elemento = document.getElementById(id);
    if (elemento) elemento.textContent = texto;
  }

  function mensajeVacio(contenedor, texto) {
    const parrafo = document.createElement("p");
    parrafo.className = "text-body-secondary mb-0";
    parrafo.textContent = texto;
    contenedor.replaceChildren(parrafo);
  }

  function filaLista({ titulo, detalle, derecha, alHacerClic, etiqueta }) {
    const fila = document.createElement("div");
    fila.className = "paneles-fila";

    const texto = document.createElement("div");
    texto.className = "paneles-fila-texto";
    let principal;
    if (alHacerClic) {
      principal = document.createElement("button");
      principal.type = "button";
      principal.className = "btn p-0 border-0 bg-transparent text-body text-start fw-semibold text-truncate";
      principal.addEventListener("click", alHacerClic);
      if (etiqueta) principal.setAttribute("aria-label", etiqueta);
    } else {
      principal = document.createElement("span");
      principal.className = "fw-semibold text-truncate";
    }
    principal.textContent = titulo;
    const secundario = document.createElement("small");
    secundario.className = "text-body-secondary text-truncate";
    secundario.textContent = detalle;
    texto.append(principal, secundario);

    const lado = document.createElement("span");
    lado.className = "paneles-fila-lado text-body-secondary small";
    lado.textContent = derecha;

    fila.append(texto, lado);
    return fila;
  }

  /* ---------- Mi actividad (Operador) ---------- */
  function actualizarMiActividad() {
    const usuario = obtenerUsuarioActual()?.usuario;
    const hoy = inicioDelDia(new Date());
    const propias = (typeof actualizaciones !== "undefined" ? actualizaciones : [])
      .filter((item) => item.responsable === usuario)
      .map((item) => ({ ...item, dia: fechaDeTexto(item.fecha) }))
      .filter((item) => item.dia);

    const dentroDe = (dias) => propias.filter((item) => diasDesde(item.dia, hoy) < dias && diasDesde(item.dia, hoy) >= 0).length;
    asignar("mi-actividad-hoy", dentroDe(1));
    asignar("mi-actividad-semana", dentroDe(7));
    asignar("mi-actividad-mes", dentroDe(30));

    const ultima = propias.sort((a, b) => b.dia - a.dia)[0];
    asignar(
      "mi-actividad-ultima",
      ultima ? `Tu último cambio fue el ${formatoFecha.format(ultima.dia)}.` : "Aún no has registrado cambios."
    );
  }

  /* ---------- Pautas sin actualizar (Operador, Administrador y general) ---------- */
  function actualizarDesactualizadas() {
    const hoy = inicioDelDia(new Date());
    const listaPautas = typeof pautas !== "undefined" ? pautas : [];
    const listaActualizaciones = typeof actualizaciones !== "undefined" ? actualizaciones : [];

    const ultimaPorPauta = new Map();
    listaActualizaciones.forEach((item) => {
      const dia = fechaDeTexto(item.fecha);
      const id = Number(item.pautaId);
      if (dia && (!ultimaPorPauta.has(id) || dia > ultimaPorPauta.get(id))) ultimaPorPauta.set(id, dia);
    });

    const pendientes = listaPautas
      .map((pauta) => {
        const propia = fechaDeTexto(pauta.fecha);
        const registrada = ultimaPorPauta.get(Number(pauta.bdId || pauta.id));
        const ultima = [propia, registrada].filter(Boolean).sort((a, b) => b - a)[0] || null;
        return { pauta, ultima, dias: ultima ? diasDesde(ultima, hoy) : null };
      })
      .filter((item) => item.ultima === null || item.dias > DIAS_SIN_ACTUALIZAR)
      .sort((a, b) => {
        if (a.ultima === null && b.ultima === null) return a.pauta.nombre.localeCompare(b.pauta.nombre);
        if (a.ultima === null) return 1;
        if (b.ultima === null) return -1;
        return a.ultima - b.ultima;
      });

    asignar("desactualizadas-total", pendientes.length);
    const lista = document.getElementById("desactualizadas-lista");
    if (pendientes.length === 0) {
      mensajeVacio(lista, "Todas las pautas están al día.");
      return;
    }

    lista.replaceChildren(
      ...pendientes.slice(0, MAXIMO_EN_LISTA).map(({ pauta, ultima, dias }) => filaLista({
        titulo: pauta.nombre,
        detalle: pauta.categoria || "Sin categoría",
        derecha: ultima ? textoDias(dias) : "Sin actualizaciones",
        etiqueta: `Consultar pauta ${pauta.nombre}`,
        alHacerClic: () => mostrarDetallePauta(pauta)
      }))
    );
    if (pendientes.length > MAXIMO_EN_LISTA) {
      const resto = document.createElement("p");
      resto.className = "text-body-secondary small mt-2 mb-0";
      resto.textContent = `y ${pendientes.length - MAXIMO_EN_LISTA} más en la sección Pautas.`;
      lista.appendChild(resto);
    }
  }

  /* ---------- Cuentas pendientes de rol (Administrador general) ---------- */
  let solicitudCuentas = 0;
  async function actualizarCuentas() {
    const idSolicitud = ++solicitudCuentas;
    const lista = document.getElementById("cuentas-lista");
    try {
      const respuesta = await fetch("/api/auth/usuarios");
      if (!respuesta.ok) throw new Error("No se pudieron cargar las cuentas.");
      const usuarios = await respuesta.json();
      if (idSolicitud !== solicitudCuentas) return;

      const hoy = inicioDelDia(new Date());
      const pendientes = usuarios
        .filter((usuario) => usuario.rol === "consulta")
        .sort((a, b) => String(b.fecha_creacion).localeCompare(String(a.fecha_creacion)));

      asignar("cuentas-total", pendientes.length);
      if (pendientes.length === 0) {
        mensajeVacio(lista, "No hay cuentas esperando un rol.");
        return;
      }

      const filas = pendientes.slice(0, MAXIMO_EN_LISTA).map((usuario) => {
        const creada = fechaDeTexto(usuario.fecha_creacion);
        return filaLista({
          titulo: usuario.usuario,
          detalle: usuario.correo_electronico,
          derecha: creada ? `Registrada ${textoDias(diasDesde(creada, hoy))}` : ""
        });
      });
      const boton = document.createElement("button");
      boton.type = "button";
      boton.className = "btn btn-outline-primary btn-sm mt-3";
      boton.textContent = "Asignar roles";
      boton.addEventListener("click", () => document.querySelector('[data-section="usuarios"]')?.click());
      lista.replaceChildren(...filas, boton);
    } catch (error) {
      if (idSolicitud === solicitudCuentas) mensajeVacio(lista, error.message);
    }
  }

  window.actualizarPaneles = () => {
    const rol = rolActual();
    const edita = ["administrador_general", "administrador", "operador"].includes(rol);
    panelActividad.classList.toggle("d-none", rol !== "operador");
    panelDesactualizadas.classList.toggle("d-none", !edita);
    panelCuentas.classList.toggle("d-none", rol !== "administrador_general");

    if (rol === "operador") actualizarMiActividad();
    if (edita) actualizarDesactualizadas();
    if (rol === "administrador_general") actualizarCuentas();
  };
})();

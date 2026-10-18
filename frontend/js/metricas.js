(function () {
  const ROLES = {
    administrador_general: "Administrador general",
    administrador: "Administrador",
    operador: "Operador"
  };
  const PERIODOS = {
    dia: "hoy",
    semana: "los últimos 7 días",
    mes: "los últimos 30 días"
  };

  const panel = document.getElementById("metricas-actividad");
  if (!panel) return;

  const contenedorUsuarios = document.getElementById("metricas-usuarios");
  const contenedorSerie = document.getElementById("metricas-serie");
  const bloqueSerie = document.getElementById("metricas-bloque-serie");
  const bloqueUsuarios = document.getElementById("metricas-bloque-usuarios");
  const tabla = document.getElementById("metricas-tabla");
  const vistaGraficos = document.getElementById("metricas-graficos");
  const vistaTabla = document.getElementById("metricas-vista-tabla");
  const botonTabla = document.getElementById("metricas-alternar-tabla");
  const mensaje = document.getElementById("metricas-mensaje");
  const cuerpo = document.getElementById("metricas-cuerpo");

  let periodoActual = "semana";
  let solicitud = 0;

  const formatoDia = new Intl.DateTimeFormat("es", { day: "numeric", month: "short" });
  const formatoDiaSemana = new Intl.DateTimeFormat("es", { weekday: "short" });
  const fechaDeTexto = (texto) => {
    const [anio, mes, dia] = texto.split("-").map(Number);
    return new Date(anio, mes - 1, dia);
  };
  const etiquetaActualizaciones = (n) => `${n} ${n === 1 ? "actualización" : "actualizaciones"}`;

  /* ---------- Tooltip único ---------- */
  const tooltip = document.createElement("div");
  tooltip.className = "metricas-tooltip";
  tooltip.setAttribute("role", "tooltip");
  tooltip.hidden = true;
  const tooltipValor = document.createElement("strong");
  const tooltipTexto = document.createElement("span");
  tooltip.append(tooltipValor, tooltipTexto);
  document.body.appendChild(tooltip);

  function mostrarTooltip(elemento, evento) {
    tooltipValor.textContent = elemento.dataset.valor;
    tooltipTexto.textContent = elemento.dataset.texto;
    tooltip.hidden = false;
    const caja = elemento.getBoundingClientRect();
    const x = evento?.clientX ?? caja.left + caja.width / 2;
    const y = evento?.clientY ?? caja.top;
    const ancho = tooltip.offsetWidth;
    const izquierda = Math.min(Math.max(8, x - ancho / 2), window.innerWidth - ancho - 8);
    const arriba = Math.max(8, y - tooltip.offsetHeight - 14);
    tooltip.style.left = `${izquierda}px`;
    tooltip.style.top = `${arriba}px`;
  }
  const ocultarTooltip = () => { tooltip.hidden = true; };

  function hacerInteractivo(elemento, valor, texto) {
    elemento.dataset.valor = valor;
    elemento.dataset.texto = texto;
    elemento.tabIndex = 0;
    elemento.setAttribute("role", "img");
    elemento.setAttribute("aria-label", `${texto}: ${valor}`);
    elemento.addEventListener("pointermove", (evento) => mostrarTooltip(elemento, evento));
    elemento.addEventListener("pointerleave", ocultarTooltip);
    elemento.addEventListener("focus", () => mostrarTooltip(elemento));
    elemento.addEventListener("blur", ocultarTooltip);
  }

  /* ---------- Gráfico de barras por persona ---------- */
  function dibujarUsuarios(usuarios) {
    contenedorUsuarios.replaceChildren();
    const maximo = Math.max(1, ...usuarios.map((u) => u.total));

    usuarios.forEach((usuario) => {
      const fila = document.createElement("div");
      fila.className = "metricas-fila";

      const nombre = document.createElement("div");
      nombre.className = "metricas-fila-nombre";
      const titulo = document.createElement("span");
      titulo.className = "fw-semibold text-truncate";
      titulo.textContent = usuario.responsable;
      const rol = document.createElement("small");
      rol.className = "text-body-secondary";
      rol.textContent = ROLES[usuario.rol] || "Sin cuenta activa";
      nombre.append(titulo, rol);

      const pista = document.createElement("div");
      pista.className = "metricas-pista";
      const barra = document.createElement("div");
      barra.className = "metricas-barra";
      barra.style.width = `${(usuario.total / maximo) * 100}%`;
      if (usuario.total === 0) barra.classList.add("is-vacia");
      hacerInteractivo(barra, etiquetaActualizaciones(usuario.total), usuario.responsable);
      pista.appendChild(barra);

      const valor = document.createElement("span");
      valor.className = "metricas-valor";
      valor.textContent = usuario.total;

      fila.append(nombre, pista, valor);
      contenedorUsuarios.appendChild(fila);
    });
  }

  /* ---------- Columnas por día ---------- */
  function dibujarSerie(serie, periodo) {
    contenedorSerie.replaceChildren();
    const maximo = Math.max(...serie.map((d) => d.total), 0);
    const tope = Math.max(4, Math.ceil(maximo / 4) * 4);
    const marcas = [tope, tope / 2, 0];

    const area = document.createElement("div");
    area.className = "metricas-columnas-area";

    const ejeY = document.createElement("div");
    ejeY.className = "metricas-eje-y";
    marcas.forEach((marca) => {
      const etiqueta = document.createElement("span");
      etiqueta.textContent = marca;
      ejeY.appendChild(etiqueta);
    });

    const grafico = document.createElement("div");
    grafico.className = "metricas-columnas";
    const lineas = document.createElement("div");
    lineas.className = "metricas-lineas";
    marcas.forEach(() => lineas.appendChild(document.createElement("span")));
    grafico.appendChild(lineas);

    const salto = periodo === "mes" ? 5 : 1;
    serie.forEach((dia, indice) => {
      const columna = document.createElement("div");
      columna.className = "metricas-columna";

      const marca = document.createElement("div");
      marca.className = "metricas-columna-marca";
      const barra = document.createElement("div");
      barra.className = "metricas-columna-barra";
      barra.style.height = `${(dia.total / tope) * 100}%`;
      if (dia.total === 0) barra.classList.add("is-vacia");
      const fecha = fechaDeTexto(dia.fecha);
      hacerInteractivo(barra, etiquetaActualizaciones(dia.total), formatoDia.format(fecha));
      if (periodo === "semana" && dia.total > 0) {
        const valor = document.createElement("span");
        valor.className = "metricas-columna-valor";
        valor.textContent = dia.total;
        barra.appendChild(valor);
      }
      marca.appendChild(barra);

      const etiqueta = document.createElement("span");
      etiqueta.className = "metricas-columna-etiqueta";
      const visible = (serie.length - 1 - indice) % salto === 0;
      const primeraVisible = indice < salto;
      if (!visible) etiqueta.textContent = "";
      else if (periodo === "semana") etiqueta.textContent = formatoDiaSemana.format(fecha).replace(".", "");
      else etiqueta.textContent = fecha.getDate() <= salto || primeraVisible
        ? formatoDia.format(fecha).replace(".", "")
        : String(fecha.getDate());

      columna.append(marca, etiqueta);
      grafico.appendChild(columna);
    });

    area.append(ejeY, grafico);
    contenedorSerie.appendChild(area);
  }

  /* ---------- Vista de tabla (acceso sin gráficos) ---------- */
  function dibujarTabla(datos) {
    const cuerpoTabla = tabla.querySelector("tbody");
    cuerpoTabla.replaceChildren();
    datos.usuarios.forEach((usuario) => {
      const fila = document.createElement("tr");
      [usuario.responsable, ROLES[usuario.rol] || "Sin cuenta activa", usuario.total].forEach((texto, indice) => {
        const celda = document.createElement("td");
        celda.textContent = texto;
        if (indice === 2) celda.className = "text-end";
        fila.appendChild(celda);
      });
      cuerpoTabla.appendChild(fila);
    });
  }

  function dibujarResumen(datos) {
    const activos = datos.usuarios.filter((u) => u.total > 0);
    document.getElementById("metricas-total").textContent = datos.total;
    document.getElementById("metricas-activos").textContent = activos.length;
    const lider = activos[0];
    document.getElementById("metricas-lider").textContent = lider ? lider.responsable : "—";
    document.getElementById("metricas-lider-detalle").textContent = lider
      ? etiquetaActualizaciones(lider.total)
      : "Sin actividad";

    const desde = fechaDeTexto(datos.desde);
    const hasta = fechaDeTexto(datos.hasta);
    document.getElementById("metricas-rango").textContent = datos.periodo === "dia"
      ? `Actividad de ${PERIODOS.dia}, ${formatoDia.format(hasta)}`
      : `Actividad de ${PERIODOS[datos.periodo]} (${formatoDia.format(desde)} – ${formatoDia.format(hasta)})`;
  }

  function mostrarMensaje(texto) {
    mensaje.textContent = texto || "";
    mensaje.classList.toggle("d-none", !texto);
  }

  async function cargar(periodo) {
    const idSolicitud = ++solicitud;
    cuerpo.classList.add("is-cargando");
    try {
      const respuesta = await fetch(`/api/actualizaciones/metricas?periodo=${encodeURIComponent(periodo)}`);
      const datos = await respuesta.json().catch(() => ({}));
      if (!respuesta.ok) throw new Error(datos.mensaje || "No se pudieron cargar las métricas.");
      if (idSolicitud !== solicitud) return;

      periodoActual = datos.periodo;
      mostrarMensaje("");
      dibujarResumen(datos);
      dibujarUsuarios(datos.usuarios);
      const muestraSerie = datos.periodo !== "dia";
      bloqueSerie.classList.toggle("d-none", !muestraSerie);
      bloqueUsuarios.classList.toggle("col-lg-6", muestraSerie);
      bloqueUsuarios.classList.toggle("col-lg-12", !muestraSerie);
      if (muestraSerie) dibujarSerie(datos.serie, datos.periodo);
      dibujarTabla(datos);
    } catch (error) {
      if (idSolicitud === solicitud) mostrarMensaje(error.message);
    } finally {
      if (idSolicitud === solicitud) cuerpo.classList.remove("is-cargando");
    }
  }

  panel.querySelectorAll('input[name="metricas-periodo"]').forEach((opcion) => {
    opcion.addEventListener("change", () => {
      if (opcion.checked) cargar(opcion.value);
    });
  });

  botonTabla.addEventListener("click", () => {
    const verTabla = vistaTabla.classList.contains("d-none");
    vistaTabla.classList.toggle("d-none", !verTabla);
    vistaGraficos.classList.toggle("d-none", verTabla);
    botonTabla.setAttribute("aria-pressed", String(verTabla));
    botonTabla.querySelector("span").textContent = verTabla ? "Ver gráficos" : "Ver tabla";
    botonTabla.querySelector("i").className = verTabla ? "bi bi-bar-chart me-2" : "bi bi-table me-2";
    ocultarTooltip();
  });

  window.actualizarMetricas = () => {
    const rol = (typeof obtenerUsuarioActual === "function" ? obtenerUsuarioActual() : null)?.rol;
    const permitido = ["administrador_general", "administrador"].includes(rol);
    panel.classList.toggle("d-none", !permitido);
    if (permitido) cargar(periodoActual);
  };
})();

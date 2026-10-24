let pautas = [];
let actualizaciones = [];
let pautaPendienteEliminar = null;
let botonPendienteEliminar = null;
let busquedaPautasEjecutada = false;
const OPCION_NUEVA_CATEGORIA = "__crear_categoria__";
const TIPOS_IMAGEN = ["image/jpeg", "image/png", "image/gif", "image/webp"];
const MAX_EVIDENCIAS_POR_PAUTA = 5;
const MAX_BYTES_POR_EVIDENCIA = 10 * 1024 * 1024;
const MAX_BYTES_EVIDENCIAS_PAUTA = 20 * 1024 * 1024;
const ETIQUETAS_ROL = {
  administrador_general: "Administrador general",
  administrador: "Administrador",
  operador: "Operador",
  consulta: "Consulta"
};

const $ = (id) => document.getElementById(id);
const mostrarModal = (id) => bootstrap.Modal.getOrCreateInstance($(id)).show();
const ocultarModal = (id) => bootstrap.Modal.getOrCreateInstance($(id)).hide();
const idPauta = (pauta) => pauta.bdId || pauta.id;
const buscarPauta = (id) => pautas.find((p) => p.bdId === id || p.id === id);
const urlImagenes = (pautaId, imagenId = "") =>
  `/api/pautas/${encodeURIComponent(pautaId)}/imagenes${imagenId ? `/${encodeURIComponent(imagenId)}` : ""}`;
const porFechaDesc = (a, b) => new Date(b.fecha) - new Date(a.fecha);
const claseBoton = "btn p-0 border-0 bg-transparent text-body text-start fw-semibold";

function fechaLocal() {
  const f = new Date();
  return [f.getFullYear(), String(f.getMonth() + 1).padStart(2, "0"), String(f.getDate()).padStart(2, "0")].join("-");
}

function el(etiqueta, clase = "", texto = "", atributos = {}) {
  const nodo = document.createElement(etiqueta);
  if (clase) nodo.className = clase;
  if (texto) nodo.textContent = texto;
  Object.entries(atributos).forEach(([clave, valor]) => nodo.setAttribute(clave, valor));
  return nodo;
}

function mensaje(texto, clase = "text-body-secondary mb-0") {
  return el("p", clase, texto);
}

const SIN_INFORMACION = "Sin información";
const textoOVacio = (valor) => (typeof valor === "string" && valor.trim()) || SIN_INFORMACION;
const pasosATexto = (pasos = []) => pasos.map((paso) => paso.descripcion).join("\n");
const textoAPasos = (texto) => texto.split("\n").map((linea) => linea.trim()).filter(Boolean);

function textoPlano(html) {
  return new DOMParser().parseFromString(html || "", "text/html").body.textContent.trim();
}

function llenarPasos(contenedor, pasos = []) {
  if (pasos.length === 0) {
    contenedor.replaceChildren(mensaje("Sin pasos registrados."));
    return;
  }
  const lista = el("ol", "mb-0");
  lista.append(...pasos.map((paso) => el("li", "", paso.descripcion)));
  contenedor.replaceChildren(lista);
}

function celdaResumen(texto) {
  const celda = el("td");
  const contenido = texto || "";
  const resumen = el("div", `text-truncate${contenido ? "" : " text-muted"}`, contenido || "-", { title: contenido });
  resumen.style.maxWidth = "14rem";
  celda.appendChild(resumen);
  return celda;
}

async function enviar(url, metodo, cuerpo, mensajeError) {
  const respuesta = await fetch(url, {
    method: metodo,
    headers: { "Content-Type": "application/json" },
    body: cuerpo && JSON.stringify(cuerpo)
  }).catch(() => {
    throw new Error("No se pudo conectar con el servidor.");
  });
  const resultado = await respuesta.json().catch(() => ({}));
  if (!respuesta.ok) throw new Error(resultado.mensaje || mensajeError);
  return resultado;
}

async function guardarConBoton(idBoton, accion) {
  const guardar = $(idBoton);
  guardar.disabled = true;
  try {
    await accion();
  } catch (error) {
    await mostrarAviso(error.message, "danger");
  } finally {
    guardar.disabled = false;
  }
}

function abrirTrasCerrar(idDetalle, abrir) {
  const modalDetalle = $(idDetalle);
  modalDetalle.addEventListener("hidden.bs.modal", abrir, { once: true });
  bootstrap.Modal.getOrCreateInstance(modalDetalle).hide();
}

async function cargarDatosBD() {
  const [respuestaPautas, respuestaActualizaciones] = await Promise.all([
    fetch("/api/pautas"),
    fetch("/api/actualizaciones")
  ]);

  if (!respuestaPautas.ok || !respuestaActualizaciones.ok) {
    throw new Error("No se pudieron cargar los datos de la base de datos.");
  }

  const pautasBD = await respuestaPautas.json();
  actualizaciones = await respuestaActualizaciones.json();

  pautas = pautasBD.map((pauta) => ({
    ...pauta,
    id: Number(pauta.id),
    bdId: Number(pauta.id),
    procesos: Array.isArray(pauta.procesos) ? pauta.procesos : [],
    pasos: Array.isArray(pauta.pasos) ? pauta.pasos : []
  }));
}

function obtenerUsuarioActual() {
  try {
    return JSON.parse(localStorage.getItem("usuarioActual")) || null;
  } catch (error) {
    return null;
  }
}

const puedeEditar = () => ["administrador_general", "administrador", "operador"].includes(obtenerUsuarioActual()?.rol);
const esAdministrador = () => ["administrador_general", "administrador"].includes(obtenerUsuarioActual()?.rol);
const esAdministradorGeneral = () => obtenerUsuarioActual()?.rol === "administrador_general";

function aplicarPermisos() {
  [
    ["data-requiere-escritura", puedeEditar(), true],
    ["data-requiere-administrador", esAdministrador(), false],
    ["data-requiere-administrador-general", esAdministradorGeneral(), true]
  ].forEach(([atributo, permitido, omitirSecciones]) => {
    document.querySelectorAll(`[${atributo}]`).forEach((elemento) => {
      if (omitirSecciones && elemento.classList.contains("section")) return;
      elemento.classList.toggle("d-none", !permitido);
    });
  });
}

function completarResponsableActual() {
  const responsableInput = $("responsable");
  if (!responsableInput) return;
  responsableInput.value = obtenerUsuarioActual()?.usuario || "";
  responsableInput.readOnly = true;
}

function obtenerPreferencias() {
  try {
    const preferencias = JSON.parse(localStorage.getItem("preferenciasUsuario")) || {};
    return {
      tema: preferencias.tema === "dark" ? "dark" : "light",
      compacta: preferencias.compacta === true
    };
  } catch (error) {
    console.error("No se pudieron leer las preferencias guardadas:", error);
    return { tema: "light", compacta: false };
  }
}

function aplicarPreferencias() {
  const preferencias = obtenerPreferencias();
  document.body.dataset.bsTheme = preferencias.tema;
  document.body.classList.toggle("compact-ui", preferencias.compacta);
  if ($("preferencia-tema")) $("preferencia-tema").value = preferencias.tema;
  if ($("preferencia-compacta")) $("preferencia-compacta").checked = preferencias.compacta;
}

const menuItems = document.querySelectorAll(".menu-item");
const sections = document.querySelectorAll(".section");

const TITULOS_SECCION = {
  dashboard: ["Dashboard", "Resumen de las políticas y pautas registradas."],
  pautas: ["Políticas y Pautas", "Consulta las pautas actualmente registradas."],
  actualizacion: ["Nueva actualización", "Registra un nuevo cambio realizado sobre una pauta."],
  "nueva-pauta": ["Nueva pauta", "Registra una pauta nueva dentro de una categoría."],
  historial: ["Historial", "Consulta todos los cambios realizados."],
  usuarios: ["Usuarios y roles", "Administra los permisos de acceso."],
  perfil: ["Perfil y configuración", "Administra los datos de tu cuenta y tus preferencias."]
};

function mostrarSeccion(sectionId, menuActivo = null) {
  const seleccionada = $(sectionId);
  if (
    (seleccionada?.hasAttribute("data-requiere-escritura") && !puedeEditar()) ||
    (seleccionada?.hasAttribute("data-requiere-administrador-general") && !esAdministradorGeneral())
  ) return;

  menuItems.forEach((menu) => menu.classList.remove("active"));
  menuActivo?.classList.add("active");
  sections.forEach((section) => {
    section.classList.add("d-none");
    section.classList.remove("active");
  });
  seleccionada?.classList.remove("d-none");
  seleccionada?.classList.add("active");

  const titulo = TITULOS_SECCION[sectionId];
  if (!titulo) return;
  $("page-title").textContent = titulo[0];
  $("page-description").textContent = titulo[1];
}

$("cerrar-sesion")?.addEventListener("click", async () => {
  try {
    const response = await fetch("/api/auth/logout", { method: "POST" });
    if (!response.ok) console.error("No se pudo invalidar la sesión en el servidor.");
  } catch (error) {
    console.error("No se pudo conectar con el servidor para cerrar sesión:", error);
  }
  localStorage.removeItem("usuarioActual");
  window.location.href = "/login";
});

menuItems.forEach((item) => {
  item.addEventListener("click", () => {
    const sectionId = item.dataset.section;
    mostrarSeccion(sectionId, item);
    if (sectionId === "usuarios" && esAdministradorGeneral()) cargarUsuarios();

    const menuDesplegable = $("sidebar-menu-content");
    if (menuDesplegable && window.matchMedia("(max-width: 767.98px)").matches) {
      const ocultarMenu = () => bootstrap.Collapse.getOrCreateInstance(menuDesplegable).hide();
      if (menuDesplegable.classList.contains("collapsing")) {
        menuDesplegable.addEventListener("shown.bs.collapse", ocultarMenu, { once: true });
      } else {
        ocultarMenu();
      }
    }
  });
});

$("abrir-configuracion-perfil")?.addEventListener("click", () => mostrarSeccion("perfil"));

function mostrarMensajePerfil(texto, tipo) {
  const aviso = $("perfil-mensaje");
  aviso.textContent = texto;
  aviso.className = `alert alert-${tipo}`;
}

function mostrarUsuarioEnCabecera(usuario) {
  const nombre = typeof usuario?.usuario === "string" ? usuario.usuario.trim() : "";
  const rol = ETIQUETAS_ROL[usuario?.rol] || "Usuario";
  const asignar = (id, texto) => {
    if ($(id)) $(id).textContent = texto;
  };
  asignar("user-avatar", Array.from(nombre)[0]?.toLocaleUpperCase("es") || "");
  asignar("user-name", nombre || "Mi perfil");
  asignar("user-role", rol);
  asignar("user-menu-name", nombre || "Mi perfil");
  asignar("user-menu-email", usuario?.correo_electronico || "");
  asignar("user-menu-role", rol);
}

function actualizarDatosPerfil(usuario) {
  localStorage.setItem("usuarioActual", JSON.stringify(usuario));
  mostrarUsuarioEnCabecera(usuario);
  $("perfil-usuario").value = usuario.usuario;
  $("perfil-correo").value = usuario.correo_electronico;
}

const profileForm = $("form-perfil");
if (profileForm) {
  const usuarioActual = obtenerUsuarioActual();
  if (usuarioActual) actualizarDatosPerfil(usuarioActual);

  profileForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    $("perfil-mensaje").classList.add("d-none");

    const contrasenaNueva = $("perfil-contrasena-nueva").value;
    const confirmarContrasena = $("perfil-confirmar-contrasena").value;
    if (contrasenaNueva !== confirmarContrasena) {
      mostrarMensajePerfil("Las contraseñas nuevas no coinciden.", "danger");
      return;
    }

    $("guardar-perfil").disabled = true;
    try {
      const result = await enviar("/api/auth/perfil", "PUT", {
        id_usuario: obtenerUsuarioActual()?.id_usuario,
        usuario: $("perfil-usuario").value,
        correo_electronico: $("perfil-correo").value,
        contrasenaActual: $("perfil-contrasena-actual").value,
        contrasenaNueva,
        confirmarContrasena
      }, "No se pudieron guardar los cambios.");

      profileForm.reset();
      actualizarDatosPerfil(result.usuario);
      aplicarPermisos();
      completarResponsableActual();
      mostrarMensajePerfil(result.mensaje, "success");
    } catch (error) {
      mostrarMensajePerfil(error.message, "danger");
    } finally {
      $("guardar-perfil").disabled = false;
    }
  });
}

function guardarPreferencias() {
  const aviso = $("preferencias-mensaje");
  let exito = true;
  try {
    localStorage.setItem("preferenciasUsuario", JSON.stringify({
      tema: $("preferencia-tema").value,
      compacta: $("preferencia-compacta").checked
    }));
    aplicarPreferencias();
  } catch (error) {
    exito = false;
  }
  aviso.textContent = exito ? "Preferencias guardadas." : "No se pudieron guardar las preferencias en este navegador.";
  aviso.classList.remove("d-none");
  aviso.classList.toggle("text-success", exito);
  aviso.classList.toggle("text-danger", !exito);
}

$("preferencia-tema").addEventListener("change", guardarPreferencias);
$("preferencia-compacta").addEventListener("change", guardarPreferencias);
aplicarPreferencias();

function actualizarDashboard() {
  $("total-pautas").textContent = pautas.length;
  $("total-actualizaciones").textContent = actualizaciones.length;
  window.actualizarMetricas?.();
  window.actualizarPaneles?.();
  $("ultima-actualizacion").textContent = actualizaciones.length
    ? [...actualizaciones].sort(porFechaDesc)[0].fecha
    : "--";
  mostrarUltimosCambios();
}

function botonEditarActualizacion(pauta) {
  if (!puedeEditar()) return "";
  const etiqueta = `Editar actualización de ${escaparHtml(pauta?.nombre || "pauta eliminada")}`;
  return `<button type="button" class="btn btn-sm btn-outline-primary ms-1" data-accion="editar" title="${etiqueta}" aria-label="${etiqueta}" aria-haspopup="dialog"><i class="bi bi-pencil-square" aria-hidden="true"></i></button>`;
}

const buscarActualizacion = (id) => actualizaciones.find((item) => Number(item.id) === Number(id));
const nombrePautaDe = (actualizacion) => buscarPauta(actualizacion.pautaId)?.nombre || "Pauta eliminada";

let actualizacionEnDetalle = null;
let actualizacionEnEdicion = null;

function mostrarDetalleActualizacion(actualizacion) {
  actualizacionEnDetalle = actualizacion;
  $("detalle-actualizacion-titulo").textContent = nombrePautaDe(actualizacion);
  $("detalle-actualizacion-categoria").textContent = textoOVacio(actualizacion.categoriaPauta);
  $("detalle-actualizacion-fecha").textContent = actualizacion.fecha || "-";
  $("detalle-actualizacion-responsable").textContent = actualizacion.responsable || "-";
  $("detalle-actualizacion-descripcion").innerHTML =
    actualizacion.descripcion?.trim() ? htmlSeguro(actualizacion.descripcion) : SIN_INFORMACION;
  $("detalle-actualizacion-conclusion").textContent = textoOVacio(actualizacion.conclusion);
  llenarPasos($("detalle-actualizacion-pasos"), actualizacion.pasos);
  $("detalle-actualizacion-nota").textContent = textoOVacio(actualizacion.nota);
  $("detalle-actualizacion-cambio").innerHTML = htmlSeguro(actualizacion.cambio);
  $("detalle-actualizacion-observaciones").innerHTML =
    actualizacion.observaciones?.trim() ? htmlSeguro(actualizacion.observaciones) : "Sin observaciones.";
  $("detalle-actualizacion-editar").classList.toggle("d-none", !puedeEditar());
  mostrarModal("detalle-actualizacion-modal");
  cargarEvidenciasDetalle($("detalle-actualizacion-imagenes"), actualizacion.pautaId);
}

function abrirEdicionActualizacion(actualizacion) {
  actualizacionEnEdicion = actualizacion;
  $("editar-actualizacion-titulo").textContent = `Editar actualización · ${nombrePautaDe(actualizacion)}`;
  $("editar-cambio").value = actualizacion.cambio || "";
  $("editar-observaciones").value = actualizacion.observaciones || "";
  mostrarModal("editar-actualizacion-modal");
}

function manejarClickActualizacion(evento) {
  const tarjeta = evento.target.closest("[data-actualizacion-id]");
  const actualizacion = tarjeta && buscarActualizacion(tarjeta.dataset.actualizacionId);
  if (!actualizacion) return;
  if (evento.target.closest('[data-accion="editar"]')) return abrirEdicionActualizacion(actualizacion);
  return mostrarDetalleActualizacion(actualizacion);
}

$("ultimos-cambios")?.addEventListener("click", manejarClickActualizacion);
$("timeline")?.addEventListener("click", (evento) => {
  if (evento.target.closest('[data-accion="editar"]')) manejarClickActualizacion(evento);
});

$("detalle-actualizacion-editar")?.addEventListener("click", () => {
  const actualizacion = actualizacionEnDetalle;
  if (actualizacion) abrirTrasCerrar("detalle-actualizacion-modal", () => abrirEdicionActualizacion(actualizacion));
});

$("editar-actualizacion-form")?.addEventListener("submit", async (evento) => {
  evento.preventDefault();
  const actualizacion = actualizacionEnEdicion;
  if (!actualizacion) return;
  await guardarConBoton("editar-actualizacion-guardar", async () => {
    const resultado = await enviar(
      `/api/actualizaciones/${encodeURIComponent(actualizacion.id)}`,
      "PUT",
      { cambio: $("editar-cambio").value, observaciones: $("editar-observaciones").value },
      "No se pudo guardar la edición."
    );
    actualizacion.cambio = resultado.cambio;
    actualizacion.observaciones = resultado.observaciones;
    ocultarModal("editar-actualizacion-modal");
    mostrarUltimosCambios();
    mostrarHistorial();
    await mostrarAviso("La actualización se editó correctamente.", "success");
  });
});

function mostrarUltimosCambios() {
  const contenedor = $("ultimos-cambios");

  if (actualizaciones.length === 0) {
    contenedor.innerHTML = '<p class="text-muted mb-0">No existen actualizaciones registradas.</p>';
    return;
  }

  const ultimas = [...actualizaciones]
    .sort((a, b) => porFechaDesc(a, b) || Number(b.id) - Number(a.id))
    .slice(0, 5);

  contenedor.innerHTML = `
    <div class="ultimos-cambios-list">
      ${ultimas.map((actualizacion) => {
        const pauta = buscarPauta(actualizacion.pautaId);
        return `
          <article class="ultimos-cambios-item" data-actualizacion-id="${actualizacion.id}">
            <div class="ultimos-cambios-indicador" aria-hidden="true"></div>
            <div class="min-w-0 flex-grow-1">
              <div class="d-flex flex-column flex-sm-row justify-content-between align-items-sm-center gap-1">
                <h3 class="h6 mb-0 text-truncate">
                  <button type="button" class="${claseBoton} text-truncate mw-100" aria-haspopup="dialog" aria-label="Consultar actualización de ${escaparHtml(pauta?.nombre || "pauta eliminada")}">${escaparHtml(pauta?.nombre || "Pauta eliminada")}</button>
                </h3>
                <div class="ultimos-cambios-meta text-muted small">
                  <time datetime="${escaparHtml(actualizacion.fecha)}">${escaparHtml(actualizacion.fecha)}</time>
                  <span aria-hidden="true">·</span>
                  <span>Por ${escaparHtml(actualizacion.responsable)}</span>
                  ${botonEditarActualizacion(pauta)}
                </div>
              </div>
              <div class="mb-0 mt-1 text-muted contenido-enriquecido ultimos-cambios-texto">${htmlSeguro(actualizacion.cambio)}</div>
            </div>
          </article>
        `;
      }).join("")}
    </div>
  `;
}

let pautaEnDetalle = null;

// Lleva la pauta al formulario de actualización con todos sus campos precargados.
function editarPauta(pauta) {
  document.querySelector('[data-section="actualizacion"]')?.click();
  const categoriaSelect = $("pauta-categoria");
  categoriaSelect.value = pauta.categoria;
  actualizarSelectHijos(pauta.categoria);
  $("pauta-select").value = idPauta(pauta);
  cargarDetallePautaSeleccionada();
}

$("detalle-pauta-editar")?.addEventListener("click", () => {
  const pauta = pautaEnDetalle;
  if (pauta) abrirTrasCerrar("detalle-pauta-modal", () => editarPauta(pauta));
});

async function recargarPautas() {
  await cargarDatosBD();
  mostrarPautas();
  actualizarDashboard();
  mostrarHistorial();
}

function botonIcono(clase, icono, titulo, abreDialogo, alClick) {
  const boton = el("button", `btn btn-sm ${clase}`, "", { type: "button", title: titulo, "aria-label": titulo });
  if (abreDialogo) boton.setAttribute("aria-haspopup", "dialog");
  boton.innerHTML = `<i class="bi bi-${icono}" aria-hidden="true"></i>`;
  boton.addEventListener("click", alClick);
  return boton;
}

function filaMensaje(texto) {
  return `<tr><td colspan="6" class="text-center text-muted py-4">${texto}</td></tr>`;
}

function mostrarPautas(busquedaSolicitada = false) {
  const tabla = $("tabla-pautas");
  if (busquedaSolicitada) busquedaPautasEjecutada = true;

  const textoBusqueda = ($("buscar-pauta")?.value || "").toLowerCase().trim();
  const categoriaSeleccionada = $("filtro-categoria-pauta")?.value || "";

  tabla.innerHTML = "";
  if (!textoBusqueda && !categoriaSeleccionada && !busquedaPautasEjecutada) {
    tabla.innerHTML = filaMensaje("Selecciona una categoría o escribe una búsqueda y pulsa Buscar para ver las pautas.");
    actualizarSelectPautas();
    return;
  }

  const pautasFiltradas = pautas.filter((pauta) =>
    (pauta.nombre.toLowerCase().includes(textoBusqueda) || pauta.categoria.toLowerCase().includes(textoBusqueda)) &&
    (!categoriaSeleccionada || pauta.categoria === categoriaSeleccionada)
  );

  if (pautasFiltradas.length === 0) {
    tabla.innerHTML = filaMensaje("No se encontraron pautas con los filtros actuales.");
    actualizarSelectPautas();
    return;
  }

  pautasFiltradas.forEach((pauta) => {
    const botonDetalle = el("button", claseBoton, pauta.nombre, {
      type: "button",
      "aria-label": `Consultar pauta ${pauta.nombre}`,
      "aria-haspopup": "dialog"
    });
    botonDetalle.addEventListener("click", () => mostrarDetallePauta(pauta));

    const botones = [
      botonIcono("btn-outline-primary", "clock-history", `Ver historial de ${pauta.nombre}`, false,
        () => verHistorial(idPauta(pauta)))
    ];
    if (pauta.cantidadImagenes > 0) {
      botones.push(botonIcono("btn-outline-primary", "images",
        `Ver ${pauta.cantidadImagenes} imágenes adjuntas de ${pauta.nombre}`, true,
        () => mostrarEvidenciasPauta(pauta)));
    }
    if (puedeEditar()) {
      botones.push(
        botonIcono("btn-outline-primary", "pencil-square", `Editar pauta ${pauta.nombre}`, false,
          () => editarPauta(pauta)),
        botonIcono("btn-outline-danger", "trash", `Eliminar pauta ${pauta.nombre}`, false,
          function () { solicitarEliminacionPauta(pauta, this); })
      );
    }

    const nombre = el("td");
    nombre.appendChild(botonDetalle);
    const acciones = el("td");
    acciones.appendChild(el("div", "d-flex flex-wrap gap-2"));
    acciones.firstChild.append(...botones);

    const fila = el("tr");
    fila.append(
      nombre,
      el("td", "", pauta.categoria),
      celdaResumen(textoPlano(pauta.descripcion)),
      el("td", "", pauta.fecha || "-"),
      el("td", "", pauta.responsable || "-"),
      acciones
    );
    tabla.appendChild(fila);
  });

  actualizarSelectPautas();
}

function crearFigura(clase, src, texto, claseImagen, claseNombre, alt = texto) {
  const figura = el("figure", clase);
  const imagen = el("img", claseImagen, "", { src, alt });
  figura.append(imagen, el("figcaption", claseNombre, texto));
  return figura;
}

async function mostrarEvidenciasPauta(pauta) {
  const pautaId = idPauta(pauta);
  const contenedor = $("evidencias-pauta-contenedor");
  $("evidencias-pauta-titulo").textContent = `Imágenes adjuntas: ${pauta.nombre}`;
  contenedor.replaceChildren(mensaje("Cargando imágenes..."));
  mostrarModal("evidencias-pauta-modal");

  try {
    const respuesta = await fetch(urlImagenes(pautaId));
    if (!respuesta.ok) throw new Error("No se pudieron cargar las imágenes adjuntas.");

    const imagenes = await respuesta.json();
    if (imagenes.length === 0) {
      contenedor.replaceChildren(mensaje("Esta pauta no tiene imágenes adjuntas."));
      return;
    }
    contenedor.replaceChildren(...imagenes.map((imagen) => crearFigura(
      "col-12 col-sm-6 mb-0",
      urlImagenes(pautaId, imagen.id),
      imagen.nombre,
      "evidencia-galeria-imagen img-thumbnail",
      "small text-body-secondary text-break mt-2"
    )));
  } catch (error) {
    contenedor.replaceChildren(mensaje(error.message, "alert alert-danger mb-0"));
  }
}

function crearTarjetaProceso(proceso) {
  const tarjeta = el("article", "border rounded p-3");
  tarjeta.appendChild(el("h4", "h6 mb-2", proceso.nombre));
  if (proceso.pasos.length > 0) {
    const pasos = el("ol", "mb-2");
    pasos.append(...proceso.pasos.map((paso) => el("li", "", paso)));
    tarjeta.appendChild(pasos);
  }
  if (proceso.nota) tarjeta.appendChild(mensaje(`Nota: ${proceso.nota}`));
  return tarjeta;
}

async function mostrarDetallePauta(pauta) {
  pautaEnDetalle = pauta;
  $("detalle-pauta-editar")?.classList.toggle("d-none", !puedeEditar());
  $("detalle-pauta-titulo").textContent = pauta.nombre;
  $("detalle-pauta-categoria").textContent = pauta.categoria || "-";
  $("detalle-pauta-fecha").textContent = pauta.fecha || "-";
  $("detalle-pauta-responsable").textContent = pauta.responsable || "-";
  $("detalle-pauta-descripcion").innerHTML =
    pauta.descripcion?.trim() ? htmlSeguro(pauta.descripcion) : SIN_INFORMACION;
  $("detalle-pauta-conclusion").textContent = textoOVacio(pauta.conclusion);
  llenarPasos($("detalle-pauta-pasos"), pauta.pasos);
  $("detalle-pauta-nota").textContent = textoOVacio(pauta.nota);

  $("detalle-pauta-procesos").replaceChildren(
    ...(pauta.procesos.length === 0
      ? [mensaje("No se han registrado procesos.")]
      : pauta.procesos.map(crearTarjetaProceso))
  );

  // La última actualización aporta el cambio y las observaciones, igual que el popup del Dashboard.
  const ultima = ultimaActualizacionDe(idPauta(pauta));
  $("detalle-pauta-cambio").innerHTML = ultima?.cambio?.trim() ? htmlSeguro(ultima.cambio) : SIN_INFORMACION;
  $("detalle-pauta-observaciones").innerHTML =
    ultima?.observaciones?.trim() ? htmlSeguro(ultima.observaciones) : "Sin observaciones.";

  mostrarModal("detalle-pauta-modal");
  await cargarEvidenciasDetalle($("detalle-pauta-imagenes"), idPauta(pauta));
}

function ultimaActualizacionDe(pautaId) {
  return actualizaciones
    .filter((item) => Number(item.pautaId) === Number(pautaId))
    .sort((a, b) => porFechaDesc(a, b) || Number(b.id) - Number(a.id))[0];
}

async function cargarEvidenciasDetalle(contenedor, pautaId) {
  contenedor.replaceChildren(mensaje("Cargando evidencias..."));
  try {
    const respuesta = await fetch(urlImagenes(pautaId));
    if (!respuesta.ok) throw new Error();
    const imagenes = await respuesta.json();
    if (imagenes.length === 0) {
      contenedor.replaceChildren(mensaje("No se han adjuntado evidencias."));
      return;
    }
    contenedor.replaceChildren(...imagenes.map((imagen) => {
      const enlace = el("a", "", "", {
        href: urlImagenes(pautaId, imagen.id),
        target: "_blank",
        rel: "noopener noreferrer",
        "aria-label": `Abrir evidencia ${imagen.nombre}`
      });
      const vistaPrevia = el("img", "img-thumbnail", "", { src: enlace.href, alt: imagen.nombre });
      Object.assign(vistaPrevia.style, { width: "10rem", height: "10rem", objectFit: "cover" });
      enlace.appendChild(vistaPrevia);
      return enlace;
    }));
  } catch (error) {
    contenedor.replaceChildren(mensaje("No se pudieron cargar las evidencias de la pauta.", "text-danger mb-0"));
  }
}

function solicitarEliminacionPauta(pauta, boton) {
  pautaPendienteEliminar = pauta;
  botonPendienteEliminar = boton;
  $("nombre-pauta-eliminar").textContent = pauta.nombre;
  mostrarModal("confirmar-eliminar-pauta-modal");
}

async function eliminarPauta(pauta, boton) {
  boton.disabled = true;
  try {
    await enviar(`/api/pautas/${encodeURIComponent(idPauta(pauta))}`, "DELETE", null, "No se pudo eliminar la pauta.");
    await recargarPautas();
  } catch (error) {
    await mostrarAviso(error.message, "danger");
    boton.disabled = false;
  }
}

$("confirmar-eliminar-pauta-modal")?.addEventListener("hidden.bs.modal", () => {
  pautaPendienteEliminar = null;
  botonPendienteEliminar = null;
});

$("confirmar-eliminar-pauta")?.addEventListener("click", async () => {
  const pauta = pautaPendienteEliminar;
  const boton = botonPendienteEliminar;
  if (!pauta || !boton) return;

  pautaPendienteEliminar = null;
  botonPendienteEliminar = null;
  ocultarModal("confirmar-eliminar-pauta-modal");
  await eliminarPauta(pauta, boton);
});

const categoriasUnicas = () => [...new Set(pautas.map((pauta) => pauta.categoria))];

function llenarSelectCategorias(select, primeraEtiqueta, categorias, conOpcionNueva = false) {
  if (!select) return;
  const seleccionada = select.value;
  select.replaceChildren(new Option(primeraEtiqueta, ""));
  categorias.forEach((categoria) => select.add(new Option(categoria, categoria)));
  if (conOpcionNueva) select.add(new Option("+ Crear nueva categoría", OPCION_NUEVA_CATEGORIA));
  select.value = categorias.includes(seleccionada) || (conOpcionNueva && seleccionada === OPCION_NUEVA_CATEGORIA)
    ? seleccionada
    : "";
}

function actualizarSelectPautas() {
  const categorias = categoriasUnicas();
  llenarSelectCategorias($("filtro-categoria-pauta"), "Todas las categorías", categorias);
  llenarSelectCategorias($("pauta-categoria"), "Seleccionar categoría", categorias);
  llenarSelectCategorias($("nueva-pauta-categoria"), "Seleccionar categoría", categorias, true);

  const pautaSelect = $("pauta-select");
  if (pautaSelect) {
    pautaSelect.replaceChildren(new Option("Seleccionar pauta", ""));
    pautaSelect.disabled = true;
    cargarEvidenciasPautaSeleccionada(0);
  }

  const historial = $("historial-pauta");
  if (historial) {
    historial.replaceChildren(
      new Option("Todas las pautas", "todos"),
      ...pautas.map((pauta) => new Option(pauta.nombre, idPauta(pauta)))
    );
  }
}

function actualizarSelectHijos(categoria) {
  const pautaSelect = $("pauta-select");
  if (!pautaSelect) return;

  pautaSelect.replaceChildren(new Option("Seleccionar pauta", ""));
  if ($("cambio")) $("cambio").value = "";
  if ($("actualizacion-titulo")) llenarCamposActualizacion(null);
  cargarEvidenciasPautaSeleccionada(0);
  const pautasCategoria = pautas.filter((pauta) => pauta.categoria === categoria);
  pautaSelect.disabled = pautasCategoria.length === 0;
  pautasCategoria.forEach((pauta) => pautaSelect.add(new Option(pauta.nombre, idPauta(pauta))));
}

function llenarCamposActualizacion(pauta) {
  $("actualizacion-titulo").value = pauta?.nombre || "";
  $("actualizacion-descripcion").value = pauta?.descripcion || "";
  $("actualizacion-conclusion").value = pauta?.conclusion || "";
  $("actualizacion-pasos").value = pasosATexto(pauta?.pasos);
  $("actualizacion-nota").value = pauta?.nota || "";
}

function cargarDetallePautaSeleccionada() {
  const pautaId = Number($("pauta-select")?.value);
  const pauta = pautas.find((item) => Number(idPauta(item)) === pautaId);
  llenarCamposActualizacion(pauta);
  cargarEvidenciasPautaSeleccionada(pautaId);
}

// Utilidades compartidas para adjuntar imágenes (nueva pauta y evidencias de actualización).
function validarImagenes(archivos, cantidadActual, bytesActuales, textos) {
  if (cantidadActual + archivos.length > MAX_EVIDENCIAS_POR_PAUTA) return textos.cantidad;
  if (archivos.some((archivo) => !TIPOS_IMAGEN.includes(archivo.type))) return "Usa imágenes JPG, PNG, GIF o WebP.";
  if (archivos.some((archivo) => archivo.size > MAX_BYTES_POR_EVIDENCIA)) return "Cada imagen puede pesar hasta 10 MB.";
  const bytesNuevos = archivos.reduce((total, archivo) => total + archivo.size, 0);
  if (bytesActuales + bytesNuevos > MAX_BYTES_EVIDENCIAS_PAUTA) return textos.total;
  return "";
}

function leerImagenes(archivos) {
  return Promise.all(archivos.map((archivo) => new Promise((resolve, reject) => {
    const lector = new FileReader();
    lector.onload = () => typeof lector.result === "string"
      ? resolve({ nombre: archivo.name, tipo: archivo.type, dataUrl: lector.result })
      : reject(new Error(`No se pudo leer la imagen ${archivo.name}.`));
    lector.onerror = () => reject(new Error(`No se pudo leer la imagen ${archivo.name}.`));
    lector.readAsDataURL(archivo);
  })));
}

function mostrarVistasPrevias(contenedor, archivos) {
  const urls = archivos.map((archivo) => {
    const url = URL.createObjectURL(archivo);
    contenedor.appendChild(crearFigura(
      "evidencia-seleccionada mb-0",
      url,
      archivo.name,
      "evidencia-seleccionada-imagen img-thumbnail",
      "small text-body-secondary text-break mt-1",
      `Vista previa de ${archivo.name}`
    ));
    return url;
  });
  contenedor.classList.add("d-flex", "flex-wrap", "gap-3");
  return urls;
}

function configurarDropzone(dropzone, input, alSeleccionar) {
  if (!dropzone || !input) return;
  dropzone.addEventListener("dragover", (event) => {
    event.preventDefault();
    dropzone.classList.add("is-dragover");
  });
  dropzone.addEventListener("dragleave", (event) => {
    if (!(event.relatedTarget instanceof Node) || !dropzone.contains(event.relatedTarget)) {
      dropzone.classList.remove("is-dragover");
    }
  });
  dropzone.addEventListener("drop", (event) => {
    event.preventDefault();
    dropzone.classList.remove("is-dragover");
    const transferencia = new DataTransfer();
    Array.from(event.dataTransfer.files).forEach((archivo) => transferencia.items.add(archivo));
    input.files = transferencia.files;
    alSeleccionar(Array.from(input.files));
  });
}

let solicitudEvidenciasActualizacion = 0;
let pautaEvidenciasActualizacion = 0;
let evidenciasPautaActualizacion = [];
let urlsVistaPreviaEvidenciasActualizacion = [];

const bytesEvidenciasActuales = () => evidenciasPautaActualizacion.reduce((total, imagen) => total + imagen.tamañoBytes, 0);

function mostrarMensajeEvidenciasActualizacion(texto, esError = false) {
  $("evidencias-actualizacion-contenedor")?.replaceChildren(
    mensaje(texto, esError ? "text-danger mb-0" : "text-body-secondary mb-0")
  );
}

function actualizarLimiteEvidenciasActualizacion() {
  const ayuda = $("ayuda-evidencias-actualizacion");
  const input = $("input-evidencias-actualizacion");
  if (!ayuda || !input || !$("boton-agregar-evidencias-actualizacion")) return;

  const bytesActuales = bytesEvidenciasActuales();
  const cuposRestantes = MAX_EVIDENCIAS_POR_PAUTA - evidenciasPautaActualizacion.length;
  ayuda.textContent = `${evidenciasPautaActualizacion.length}/${MAX_EVIDENCIAS_POR_PAUTA} evidencias; ` +
    `${(bytesActuales / 1024 / 1024).toFixed(1)} de 20 MB usados. Máximo 10 MB por imagen.`;
  input.disabled = cuposRestantes <= 0 || MAX_BYTES_EVIDENCIAS_PAUTA - bytesActuales <= 0;
  if (input.disabled) {
    ayuda.textContent += cuposRestantes <= 0
      ? " Se alcanzó el máximo de evidencias."
      : " Se alcanzó el tamaño máximo total.";
  }
}

function limpiarPrevisualizacionEvidenciasActualizacion() {
  urlsVistaPreviaEvidenciasActualizacion.forEach((url) => URL.revokeObjectURL(url));
  urlsVistaPreviaEvidenciasActualizacion = [];
  const previsualizacion = $("evidencias-actualizacion-seleccionadas");
  if (previsualizacion) {
    previsualizacion.replaceChildren();
    previsualizacion.classList.remove("d-flex", "flex-wrap", "gap-3", "text-danger");
  }
  if ($("boton-agregar-evidencias-actualizacion")) $("boton-agregar-evidencias-actualizacion").disabled = true;
}

function mostrarSeleccionEvidenciasActualizacion(archivos) {
  const input = $("input-evidencias-actualizacion");
  const previsualizacion = $("evidencias-actualizacion-seleccionadas");
  const boton = $("boton-agregar-evidencias-actualizacion");
  if (!input || !previsualizacion || !boton) return;

  limpiarPrevisualizacionEvidenciasActualizacion();
  if (!archivos.length) return;

  const error = validarImagenes(archivos, evidenciasPautaActualizacion.length, bytesEvidenciasActuales(), {
    cantidad: `Solo puedes adjuntar ${MAX_EVIDENCIAS_POR_PAUTA} evidencias por pauta.`,
    total: "El tamaño total de las evidencias no puede superar 20 MB."
  });
  if (error) {
    input.value = "";
    previsualizacion.textContent = error;
    previsualizacion.classList.add("text-danger");
    return;
  }

  urlsVistaPreviaEvidenciasActualizacion = mostrarVistasPrevias(previsualizacion, archivos);
  boton.disabled = false;
}

async function eliminarEvidencia(pautaId, imagen, boton) {
  if (!await confirmarAccion(`¿Eliminar permanentemente la evidencia "${imagen.nombre}" de esta pauta?`)) return;

  boton.disabled = true;
  try {
    await enviar(urlImagenes(pautaId, imagen.id), "DELETE", null, "No se pudo eliminar la evidencia.");
    if (Number($("pauta-select")?.value) === pautaId) await cargarEvidenciasPautaSeleccionada(pautaId);
  } catch (error) {
    await mostrarAviso(error.message || "No se pudo eliminar la evidencia.", "danger");
    boton.disabled = false;
  }
}

async function cargarEvidenciasPautaSeleccionada(pautaId) {
  const contenedor = $("evidencias-actualizacion-contenedor");
  if (!contenedor) return;

  const solicitud = ++solicitudEvidenciasActualizacion;
  if (pautaEvidenciasActualizacion !== pautaId) {
    limpiarPrevisualizacionEvidenciasActualizacion();
    if ($("input-evidencias-actualizacion")) $("input-evidencias-actualizacion").value = "";
    $("agregar-evidencias-actualizacion")?.classList.add("d-none");
    evidenciasPautaActualizacion = [];
    pautaEvidenciasActualizacion = pautaId;
  }
  if (!pautaId) {
    mostrarMensajeEvidenciasActualizacion("Selecciona una pauta para ver sus evidencias.");
    return;
  }

  mostrarMensajeEvidenciasActualizacion("Cargando evidencias...");
  try {
    const respuesta = await fetch(urlImagenes(pautaId));
    if (!respuesta.ok) throw new Error("No se pudieron cargar las evidencias de la pauta.");
    const imagenes = await respuesta.json();
    if (solicitud !== solicitudEvidenciasActualizacion || Number($("pauta-select")?.value) !== pautaId) return;

    evidenciasPautaActualizacion = imagenes;
    $("agregar-evidencias-actualizacion")?.classList.remove("d-none");
    actualizarLimiteEvidenciasActualizacion();
    if (imagenes.length === 0) {
      mostrarMensajeEvidenciasActualizacion("Esta pauta no tiene evidencias anexadas.");
      return;
    }

    contenedor.replaceChildren(...imagenes.map((imagen) => {
      const tarjeta = crearFigura(
        "col-12 col-sm-6 col-lg-4 mb-0",
        urlImagenes(pautaId, imagen.id),
        imagen.nombre,
        "evidencia-actualizacion-imagen img-thumbnail",
        "small text-body-secondary text-break mt-2"
      );
      if (puedeEditar()) {
        const botonEliminar = el("button", "btn btn-outline-danger btn-sm mt-2", "Eliminar evidencia", {
          type: "button",
          "aria-label": `Eliminar evidencia ${imagen.nombre}`
        });
        botonEliminar.addEventListener("click", () => eliminarEvidencia(pautaId, imagen, botonEliminar));
        tarjeta.appendChild(botonEliminar);
      }
      return tarjeta;
    }));
  } catch (error) {
    if (solicitud !== solicitudEvidenciasActualizacion) return;
    mostrarMensajeEvidenciasActualizacion(error.message || "No se pudieron cargar las evidencias de la pauta.", true);
  }
}

const formulario = $("form-actualizacion");
if (formulario) {
  const categoriaSelect = $("pauta-categoria");
  const pautaSelect = $("pauta-select");
  const inputEvidencias = $("input-evidencias-actualizacion");
  const botonAgregarEvidencias = $("boton-agregar-evidencias-actualizacion");
  const alSeleccionar = (archivos) => mostrarSeleccionEvidenciasActualizacion(archivos);

  categoriaSelect?.addEventListener("change", () => actualizarSelectHijos(categoriaSelect.value));
  pautaSelect?.addEventListener("change", cargarDetallePautaSeleccionada);
  inputEvidencias?.addEventListener("change", () => alSeleccionar(Array.from(inputEvidencias.files)));
  configurarDropzone($("dropzone-evidencias-actualizacion"), inputEvidencias, alSeleccionar);

  botonAgregarEvidencias?.addEventListener("click", async () => {
    const pautaId = Number(pautaSelect?.value);
    const archivos = Array.from(inputEvidencias?.files || []);
    if (!pautaId || !archivos.length) return;

    botonAgregarEvidencias.disabled = true;
    try {
      const imagenes = await leerImagenes(archivos);
      await enviar(urlImagenes(pautaId), "POST", { imagenes }, "No se pudieron agregar las evidencias.");

      if (Number(pautaSelect.value) === pautaId) {
        limpiarPrevisualizacionEvidenciasActualizacion();
        inputEvidencias.value = "";
        await cargarEvidenciasPautaSeleccionada(pautaId);
      }
    } catch (error) {
      await mostrarAviso(error.message || "No se pudieron agregar las evidencias.", "danger");
      if (Number(pautaSelect?.value) === pautaId) botonAgregarEvidencias.disabled = false;
    }
  });

  formulario.addEventListener("reset", () => {
    solicitudEvidenciasActualizacion += 1;
    limpiarPrevisualizacionEvidenciasActualizacion();
    evidenciasPautaActualizacion = [];
    pautaEvidenciasActualizacion = 0;
    inputEvidencias.value = "";
    $("agregar-evidencias-actualizacion").classList.add("d-none");
    mostrarMensajeEvidenciasActualizacion("Selecciona una pauta para ver sus evidencias.");
  });

  formulario.addEventListener("submit", async (event) => {
    event.preventDefault();

    const categoria = categoriaSelect.value;
    const pautaId = Number(pautaSelect.value);
    if (!categoria || !pautaId) {
      await mostrarAviso("Debes seleccionar una pauta.", "warning");
      return;
    }

    const pauta = pautas.find((item) => Number(idPauta(item)) === pautaId && item.categoria === categoria);
    if (!pauta) {
      await mostrarAviso("La pauta seleccionada no está disponible.", "warning");
      return;
    }

    try {
      await enviar("/api/actualizaciones", "POST", {
        pautaId: pauta.bdId || null,
        pauta: { nombre: pauta.nombre, categoria: pauta.categoria },
        fecha: fechaLocal(),
        responsable: $("responsable").value.trim() || obtenerUsuarioActual()?.usuario || "",
        datos: {
          descripcion: $("actualizacion-descripcion").value.trim(),
          conclusion: $("actualizacion-conclusion").value.trim(),
          pasos: textoAPasos($("actualizacion-pasos").value),
          nota: $("actualizacion-nota").value.trim()
        },
        cambio: $("cambio").value.trim(),
        observaciones: $("observaciones").value.trim()
      }, "No se pudo guardar la actualización.");
      await cargarDatosBD();
    } catch (error) {
      await mostrarAviso(error.message, "danger");
      return;
    }

    await mostrarAviso("Actualización registrada correctamente.", "success");
    formulario.reset();
    completarResponsableActual();
    actualizarTodo();
    document.querySelector('[data-section="dashboard"]')?.click();
  });
}

const formularioNuevaPauta = $("form-nueva-pauta");
if (formularioNuevaPauta) {
  const categoriaSelect = $("nueva-pauta-categoria");
  const nuevaCategoriaContenedor = $("nueva-pauta-categoria-nueva-contenedor");
  const nuevaCategoriaInput = $("nueva-pauta-categoria-nueva");
  const imagenesInput = $("nueva-pauta-imagenes");
  const dropzoneImagenes = $("nueva-pauta-dropzone");
  const imagenesSeleccionadas = $("nueva-pauta-imagenes-seleccionadas");
  let urlsVistaPrevia = [];

  const limpiarImagenesSeleccionadas = () => {
    urlsVistaPrevia.forEach((url) => URL.revokeObjectURL(url));
    urlsVistaPrevia = [];
    imagenesSeleccionadas.replaceChildren();
    imagenesSeleccionadas.classList.remove("d-flex", "flex-wrap", "gap-3");
  };

  const mostrarImagenesSeleccionadas = (archivos) => {
    limpiarImagenesSeleccionadas();
    const error = validarImagenes(archivos, 0, 0, {
      cantidad: `Solo puedes adjuntar hasta ${MAX_EVIDENCIAS_POR_PAUTA} imágenes.`,
      total: "El tamaño total de las imágenes no puede superar 20 MB."
    });
    imagenesSeleccionadas.classList.toggle("text-danger", Boolean(error));
    if (error) {
      imagenesInput.value = "";
      imagenesSeleccionadas.textContent = error;
      return;
    }
    if (archivos.length) urlsVistaPrevia = mostrarVistasPrevias(imagenesSeleccionadas, archivos);
  };

  imagenesInput.addEventListener("change", () => mostrarImagenesSeleccionadas(Array.from(imagenesInput.files)));
  configurarDropzone(dropzoneImagenes, imagenesInput, mostrarImagenesSeleccionadas);

  categoriaSelect.addEventListener("change", () => {
    const crearCategoria = categoriaSelect.value === OPCION_NUEVA_CATEGORIA;
    nuevaCategoriaContenedor.classList.toggle("d-none", !crearCategoria);
    nuevaCategoriaInput.required = crearCategoria;
    if (!crearCategoria) nuevaCategoriaInput.value = "";
  });

  formularioNuevaPauta.addEventListener("reset", () => {
    nuevaCategoriaContenedor.classList.add("d-none");
    nuevaCategoriaInput.required = false;
    nuevaCategoriaInput.value = "";
    imagenesInput.value = "";
    limpiarImagenesSeleccionadas();
    imagenesSeleccionadas.classList.remove("text-danger");
    dropzoneImagenes.classList.remove("is-dragover");
  });

  formularioNuevaPauta.addEventListener("submit", async (event) => {
    event.preventDefault();

    const responsable = obtenerUsuarioActual()?.usuario || "";
    if (!responsable) {
      await mostrarAviso("Debes iniciar sesión para registrar una pauta.", "warning");
      return;
    }

    try {
      const categoria = categoriaSelect.value === OPCION_NUEVA_CATEGORIA
        ? nuevaCategoriaInput.value.trim()
        : categoriaSelect.value;
      await enviar("/api/pautas", "POST", {
        nombre: $("nueva-pauta-nombre").value.trim(),
        categoria,
        descripcion: $("nueva-pauta-descripcion").value.trim(),
        conclusion: $("nueva-pauta-conclusion").value.trim(),
        pasos: textoAPasos($("nueva-pauta-pasos").value),
        nota: $("nueva-pauta-nota").value.trim(),
        fecha: fechaLocal(),
        responsable,
        imagenes: await leerImagenes(Array.from(imagenesInput.files))
      }, "No se pudo registrar la nueva pauta.");
    } catch (error) {
      await mostrarAviso(error.message, "danger");
      return;
    }

    await mostrarAviso("Pauta registrada correctamente.", "success");
    window.location.reload();
  });
}

function mostrarHistorial(pautaId = "todos") {
  const timeline = $("timeline");
  if (!timeline) return;

  const registros = (pautaId === "todos"
    ? [...actualizaciones]
    : actualizaciones.filter((a) => a.pautaId === Number(pautaId))
  ).sort(porFechaDesc);

  if (registros.length === 0) {
    timeline.innerHTML = `
      <div class="card shadow-sm">
        <div class="card-body"><p class="text-muted mb-0">No existen cambios registrados.</p></div>
      </div>
    `;
    return;
  }

  timeline.innerHTML = registros.map((registro) => {
    const pauta = buscarPauta(registro.pautaId);

    return `
      <div class="card shadow-sm mb-3" data-actualizacion-id="${registro.id}">
        <div class="card-body">
          <div class="d-flex flex-column flex-md-row justify-content-between gap-2">
            <div>
              <h5 class="card-title mb-1">${escaparHtml(pauta?.nombre || "Pauta eliminada")}</h5>
              <div class="text-muted small">${escaparHtml(registro.fecha)}</div>
            </div>
            <div class="d-flex align-items-start gap-2">
              <span class="badge bg-primary">Cambio registrado</span>
              ${botonEditarActualizacion(pauta)}
            </div>
          </div>

          <hr>

          <div class="mb-3">
            <h6>Cambio realizado</h6>
            <div class="mb-0 contenido-enriquecido">${htmlSeguro(registro.cambio)}</div>
          </div>

          <div class="mb-3">
            <h6>Auditor</h6>
            <p class="mb-0 text-muted">${registro.responsable}</p>
          </div>

          ${registro.observaciones ? `
            <div>
              <h6>Observaciones</h6>
              <div class="mb-0 text-muted contenido-enriquecido">${htmlSeguro(registro.observaciones)}</div>
            </div>
          ` : ""}
        </div>
      </div>
    `;
  }).join("");
}

function verHistorial(pautaId) {
  const menuHistorial = document.querySelector('[data-section="historial"]');
  if (!menuHistorial) return;

  menuHistorial.click();
  if ($("historial-pauta")) $("historial-pauta").value = pautaId;
  mostrarHistorial(pautaId);
}

$("historial-pauta")?.addEventListener("change", (evento) => mostrarHistorial(evento.target.value));
$("btn-buscar-pauta")?.addEventListener("click", () => mostrarPautas(true));
$("form-filtro-pautas")?.addEventListener("submit", (event) => {
  event.preventDefault();
  mostrarPautas(true);
});
$("buscar-pauta")?.addEventListener("keydown", (event) => {
  if (event.key === "Enter") {
    event.preventDefault();
    mostrarPautas(true);
  }
});
$("btn-nueva-pauta")?.addEventListener("click", () => {
  document.querySelector('[data-section="nueva-pauta"]')?.click();
});

async function actualizarTodo() {
  let usuarioActual;
  try {
    const respuestaSesion = await fetch("/api/auth/sesion");
    if (respuestaSesion.status === 401) {
      localStorage.removeItem("usuarioActual");
      window.location.href = "/login";
      return;
    }
    if (!respuestaSesion.ok) throw new Error("No se pudo validar la sesión.");
    usuarioActual = (await respuestaSesion.json()).usuario;
    localStorage.setItem("usuarioActual", JSON.stringify(usuarioActual));
  } catch (error) {
    console.error("No se pudo validar la sesión:", error);
    await mostrarAviso("No se pudo validar la sesión. Intenta iniciar sesión nuevamente.", "danger");
    window.location.href = "/login";
    return;
  }
  aplicarPermisos();
  mostrarUsuarioEnCabecera(usuarioActual);

  try {
    await cargarDatosBD();
  } catch (error) {
    await mostrarAviso(error.message, "danger");
  }

  completarResponsableActual();
  actualizarDashboard();
  mostrarPautas();
  actualizarSelectPautas();
  mostrarHistorial();
}

actualizarTodo();

function mostrarMensajeUsuarios(texto, tipo) {
  const aviso = $("usuarios-mensaje");
  aviso.textContent = texto;
  aviso.className = `alert alert-${tipo}`;
}

function filaUsuarioEstado(texto, clase = "text-body-secondary") {
  return `<tr><td colspan="4" class="text-center ${clase}">${texto}</td></tr>`;
}

async function cargarUsuarios() {
  const tabla = $("tabla-usuarios");
  if (!tabla || !esAdministradorGeneral()) return;
  $("usuarios-mensaje").classList.add("d-none");
  tabla.innerHTML = filaUsuarioEstado("Cargando usuarios...");

  try {
    const respuesta = await fetch("/api/auth/usuarios");
    const resultado = await respuesta.json();
    if (!respuesta.ok) throw new Error(resultado.mensaje || "No se pudieron cargar los usuarios.");

    tabla.replaceChildren();
    resultado.forEach((usuario) => {
      const rol = el("td");
      const accion = el("td");

      if (usuario.rol === "administrador_general") {
        rol.textContent = ETIQUETAS_ROL.administrador_general;
        accion.textContent = "Rol principal";
      } else {
        const selector = el("select", "form-select", "", { "aria-label": `Rol de ${usuario.usuario}` });
        ["administrador", "operador", "consulta"].forEach((valor) => {
          const opcion = new Option(ETIQUETAS_ROL[valor], valor);
          selector.add(opcion);
        });
        selector.value = usuario.rol;

        const guardar = el("button", "btn btn-outline-primary", "Guardar", { type: "button" });
        guardar.addEventListener("click", async () => {
          guardar.disabled = true;
          try {
            const resultadoRol = await enviar(
              `/api/auth/usuarios/${encodeURIComponent(usuario.id_usuario)}/rol`,
              "PUT",
              { rol: selector.value },
              "No se pudo actualizar el rol."
            );
            mostrarMensajeUsuarios(resultadoRol.mensaje, "success");
          } catch (error) {
            mostrarMensajeUsuarios(error.message, "danger");
          } finally {
            guardar.disabled = false;
          }
        });
        rol.appendChild(selector);
        accion.appendChild(guardar);
      }

      const fila = el("tr");
      fila.append(el("td", "", usuario.usuario), el("td", "", usuario.correo_electronico), rol, accion);
      tabla.appendChild(fila);
    });
    if (!resultado.length) tabla.innerHTML = filaUsuarioEstado("No hay usuarios registrados.");
  } catch (error) {
    tabla.innerHTML = filaUsuarioEstado("No se pudieron cargar los usuarios.", "text-danger");
    mostrarMensajeUsuarios(error.message || "No se pudo conectar con el servidor.", "danger");
  }
}

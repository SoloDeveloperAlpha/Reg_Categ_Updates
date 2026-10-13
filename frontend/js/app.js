let pautas = [];
let actualizaciones = [];
let pautaPendienteEliminar = null;
let botonPendienteEliminar = null;
let busquedaPautasEjecutada = false;
const OPCION_NUEVA_CATEGORIA = "__crear_categoria__";

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
    procesos: Array.isArray(pauta.procesos) ? pauta.procesos : []
  }));
}

function obtenerUsuarioActual() {
  try {
    return JSON.parse(localStorage.getItem("usuarioActual")) || null;
  } catch (error) {
    return null;
  }
}

function puedeEditar() {
  return ["administrador_general", "administrador", "operador"].includes(obtenerUsuarioActual()?.rol);
}

function esAdministradorGeneral() {
  return obtenerUsuarioActual()?.rol === "administrador_general";
}

function aplicarPermisos() {
  document.querySelectorAll("[data-requiere-escritura]").forEach((elemento) => {
    if (elemento.classList.contains("section")) return;
    elemento.classList.toggle("d-none", !puedeEditar());
  });
  document.querySelectorAll("[data-requiere-administrador-general]").forEach((elemento) => {
    if (elemento.classList.contains("section")) return;
    elemento.classList.toggle("d-none", !esAdministradorGeneral());
  });
}

function completarResponsableActual() {
  const responsableInput = document.getElementById("responsable");
  if (!responsableInput) return;

  const usuarioActual = obtenerUsuarioActual();
  responsableInput.value = usuarioActual?.usuario || "";
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

  const temaInput = document.getElementById("preferencia-tema");
  const compactaInput = document.getElementById("preferencia-compacta");
  if (temaInput) temaInput.value = preferencias.tema;
  if (compactaInput) compactaInput.checked = preferencias.compacta;
}

const menuItems = document.querySelectorAll(".menu-item");
const sections = document.querySelectorAll(".section");
const pageTitle = document.getElementById("page-title");
const pageDescription = document.getElementById("page-description");
const logoutButton = document.getElementById("cerrar-sesion");
const openProfileSettingsButton = document.getElementById("abrir-configuracion-perfil");

function mostrarSeccion(sectionId, menuActivo = null) {
  const seccionSolicitada = document.getElementById(sectionId);
  if (
    (seccionSolicitada?.hasAttribute("data-requiere-escritura") && !puedeEditar()) ||
    (seccionSolicitada?.hasAttribute("data-requiere-administrador-general") && !esAdministradorGeneral())
  ) return;

  menuItems.forEach((menu) => menu.classList.remove("active"));
  if (menuActivo) menuActivo.classList.add("active");
  sections.forEach((section) => {
    section.classList.add("d-none");
    section.classList.remove("active");
  });

  const selectedSection = document.getElementById(sectionId);
  if (selectedSection) {
    selectedSection.classList.remove("d-none");
    selectedSection.classList.add("active");
  }

  actualizarTitulo(sectionId);
}

if (logoutButton) {
  logoutButton.addEventListener("click", async () => {
    try {
      const response = await fetch("/api/auth/logout", { method: "POST" });
      if (!response.ok) console.error("No se pudo invalidar la sesión en el servidor.");
    } catch (error) {
      console.error("No se pudo conectar con el servidor para cerrar sesión:", error);
    }
    localStorage.removeItem("usuarioActual");
    window.location.href = "/login";
  });
}

function actualizarTitulo(section) {
  const titulos = {
    dashboard: ["Dashboard", "Resumen de las políticas y pautas registradas."],
    pautas: ["Políticas y Pautas", "Consulta las pautas actualmente registradas."],
    actualizacion: ["Nueva actualización", "Registra un nuevo cambio realizado sobre una pauta."],
    "nueva-pauta": ["Nueva pauta", "Registra una pauta nueva dentro de una categoría."],
    historial: ["Historial", "Consulta todos los cambios realizados."],
    usuarios: ["Usuarios y roles", "Administra los permisos de acceso."],
    perfil: ["Perfil y configuración", "Administra los datos de tu cuenta y tus preferencias."]
  };

  if (!titulos[section]) return;
  pageTitle.textContent = titulos[section][0];
  pageDescription.textContent = titulos[section][1];
}

menuItems.forEach((item) => {
  item.addEventListener("click", () => {
    const sectionId = item.dataset.section;
    mostrarSeccion(sectionId, item);
    if (sectionId === "usuarios" && esAdministradorGeneral()) cargarUsuarios();

    const menuDesplegable = document.getElementById("sidebar-menu-content");
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

if (openProfileSettingsButton) {
  openProfileSettingsButton.addEventListener("click", () => mostrarSeccion("perfil"));
}

const profileForm = document.getElementById("form-perfil");
const profileMessage = document.getElementById("perfil-mensaje");
const profileSaveButton = document.getElementById("guardar-perfil");

function mostrarMensajePerfil(message, type) {
  profileMessage.textContent = message;
  profileMessage.className = `alert alert-${type}`;
}

function actualizarDatosPerfil(usuario) {
  localStorage.setItem("usuarioActual", JSON.stringify(usuario));
  const userName = document.getElementById("user-name");
  const userAvatar = document.getElementById("user-avatar");
  if (userName) userName.textContent = usuario.usuario;
  if (userAvatar) userAvatar.textContent = Array.from(usuario.usuario)[0]?.toLocaleUpperCase("es") || "";
  document.getElementById("perfil-usuario").value = usuario.usuario;
  document.getElementById("perfil-correo").value = usuario.correo_electronico;
}

if (profileForm) {
  const usuarioActual = obtenerUsuarioActual();
  if (usuarioActual) actualizarDatosPerfil(usuarioActual);

  profileForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    profileMessage.classList.add("d-none");

    const contrasenaNueva = document.getElementById("perfil-contrasena-nueva").value;
    const confirmarContrasena = document.getElementById("perfil-confirmar-contrasena").value;
    if (contrasenaNueva !== confirmarContrasena) {
      mostrarMensajePerfil("Las contraseñas nuevas no coinciden.", "danger");
      return;
    }

    profileSaveButton.disabled = true;
    try {
      const response = await fetch("/api/auth/perfil", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id_usuario: obtenerUsuarioActual()?.id_usuario,
          usuario: document.getElementById("perfil-usuario").value,
          correo_electronico: document.getElementById("perfil-correo").value,
          contrasenaActual: document.getElementById("perfil-contrasena-actual").value,
          contrasenaNueva,
          confirmarContrasena
        })
      });
      const result = await response.json();

      if (!response.ok) {
        mostrarMensajePerfil(result.mensaje || "No se pudieron guardar los cambios.", "danger");
        return;
      }

      profileForm.reset();
      actualizarDatosPerfil(result.usuario);
      aplicarPermisos();
      completarResponsableActual();
      mostrarMensajePerfil(result.mensaje, "success");
    } catch (error) {
      mostrarMensajePerfil("No se pudo conectar con el servidor.", "danger");
    } finally {
      profileSaveButton.disabled = false;
    }
  });
}

function guardarPreferencias() {
  const preferencesMessage = document.getElementById("preferencias-mensaje");
  const preferencias = {
    tema: document.getElementById("preferencia-tema").value,
    compacta: document.getElementById("preferencia-compacta").checked
  };

  try {
    localStorage.setItem("preferenciasUsuario", JSON.stringify(preferencias));
    aplicarPreferencias();
    preferencesMessage.textContent = "Preferencias guardadas.";
    preferencesMessage.classList.remove("d-none", "text-danger");
    preferencesMessage.classList.add("text-success");
  } catch (error) {
    preferencesMessage.textContent = "No se pudieron guardar las preferencias en este navegador.";
    preferencesMessage.classList.remove("d-none", "text-success");
    preferencesMessage.classList.add("text-danger");
  }
}

document.getElementById("preferencia-tema").addEventListener("change", guardarPreferencias);
document.getElementById("preferencia-compacta").addEventListener("change", guardarPreferencias);
aplicarPreferencias();

function actualizarDashboard() {
  document.getElementById("total-pautas").textContent = pautas.length;
  document.getElementById("total-actualizaciones").textContent = actualizaciones.length;

  if (actualizaciones.length === 0) {
    document.getElementById("ultima-actualizacion").textContent = "--";
    mostrarUltimosCambios();
    return;
  }

  const ultima = [...actualizaciones].sort((a, b) => new Date(b.fecha) - new Date(a.fecha))[0];
  document.getElementById("ultima-actualizacion").textContent = ultima.fecha;
  mostrarUltimosCambios();
}

function mostrarUltimosCambios() {
  const contenedor = document.getElementById("ultimos-cambios");

  if (actualizaciones.length === 0) {
    contenedor.innerHTML = '<p class="text-muted mb-0">No existen actualizaciones registradas.</p>';
    return;
  }

  const ultimas = [...actualizaciones]
    .sort((a, b) => new Date(b.fecha) - new Date(a.fecha) || Number(b.id) - Number(a.id))
    .slice(0, 5);

  contenedor.innerHTML = `
    <div class="ultimos-cambios-list">
      ${ultimas.map((actualizacion) => {
        const pauta = pautas.find((p) => p.bdId === actualizacion.pautaId || p.id === actualizacion.pautaId);
        return `
          <article class="ultimos-cambios-item">
            <div class="ultimos-cambios-indicador" aria-hidden="true"></div>
            <div class="min-w-0 flex-grow-1">
              <div class="d-flex flex-column flex-sm-row justify-content-between align-items-sm-center gap-1">
                <h3 class="h6 mb-0 text-truncate">${pauta?.nombre || "Pauta eliminada"}</h3>
                <div class="ultimos-cambios-meta text-muted small">
                  <time datetime="${actualizacion.fecha}">${actualizacion.fecha}</time>
                  <span aria-hidden="true">·</span>
                  <span>Por ${actualizacion.responsable}</span>
                </div>
              </div>
              <p class="mb-0 mt-1 text-muted">${actualizacion.cambio}</p>
            </div>
          </article>
        `;
      }).join("")}
    </div>
  `;
}

function mostrarPautas(busquedaSolicitada = false) {
  const tabla = document.getElementById("tabla-pautas");
  const inputBusqueda = document.getElementById("buscar-pauta");
  const filtroCategoria = document.getElementById("filtro-categoria-pauta");

  if (busquedaSolicitada) busquedaPautasEjecutada = true;

  const textoBusqueda = (inputBusqueda?.value || "").toLowerCase().trim();
  const categoriaSeleccionada = filtroCategoria?.value || "";

  tabla.innerHTML = "";
  if (!textoBusqueda && !categoriaSeleccionada && !busquedaPautasEjecutada) {
    tabla.innerHTML = `
      <tr>
        <td colspan="5" class="text-center text-muted py-4">Selecciona una categoría o escribe una búsqueda y pulsa Buscar para ver las pautas.</td>
      </tr>
    `;
    actualizarSelectPautas();
    return;
  }

  const pautasFiltradas = pautas.filter((pauta) => {
    const coincideTexto =
      pauta.nombre.toLowerCase().includes(textoBusqueda) ||
      pauta.categoria.toLowerCase().includes(textoBusqueda);
    const coincideCategoria = !categoriaSeleccionada || pauta.categoria === categoriaSeleccionada;

    return coincideTexto && coincideCategoria;
  });

  if (pautasFiltradas.length === 0) {
    tabla.innerHTML = `
      <tr>
        <td colspan="5" class="text-center text-muted py-4">No se encontraron pautas con los filtros actuales.</td>
      </tr>
    `;
    actualizarSelectPautas();
    return;
  }

  pautasFiltradas.forEach((pauta) => {
    const fila = document.createElement("tr");
    const nombre = document.createElement("td");
    const botonDetalle = document.createElement("button");
    botonDetalle.type = "button";
    botonDetalle.className = "btn p-0 border-0 bg-transparent text-body text-start fw-semibold";
    botonDetalle.textContent = pauta.nombre;
    botonDetalle.setAttribute("aria-label", `Consultar pauta ${pauta.nombre}`);
    botonDetalle.setAttribute("aria-haspopup", "dialog");
    botonDetalle.addEventListener("click", () => mostrarDetallePauta(pauta));
    nombre.appendChild(botonDetalle);

    const categoria = document.createElement("td");
    categoria.textContent = pauta.categoria;

    const fecha = document.createElement("td");
    fecha.textContent = pauta.fecha || "-";

    const responsable = document.createElement("td");
    responsable.textContent = pauta.responsable || "-";

    const acciones = document.createElement("td");
    const botonesAccion = document.createElement("div");
    botonesAccion.className = "d-flex flex-wrap gap-2";

    const botonHistorial = document.createElement("button");
    botonHistorial.type = "button";
    botonHistorial.className = "btn btn-sm btn-outline-primary";
    botonHistorial.innerHTML = '<i class="bi bi-clock-history" aria-hidden="true"></i>';
    botonHistorial.title = `Ver historial de ${pauta.nombre}`;
    botonHistorial.setAttribute("aria-label", `Ver historial de ${pauta.nombre}`);
    botonHistorial.addEventListener("click", () => verHistorial(pauta.bdId || pauta.id));

    if (pauta.cantidadImagenes > 0) {
      const botonEvidencias = document.createElement("button");
      botonEvidencias.type = "button";
      botonEvidencias.className = "btn btn-sm btn-outline-primary";
      botonEvidencias.innerHTML = '<i class="bi bi-images" aria-hidden="true"></i>';
      botonEvidencias.title = `Ver ${pauta.cantidadImagenes} imágenes adjuntas de ${pauta.nombre}`;
      botonEvidencias.setAttribute("aria-label", botonEvidencias.title);
      botonEvidencias.setAttribute("aria-haspopup", "dialog");
      botonEvidencias.addEventListener("click", () => mostrarEvidenciasPauta(pauta));

      botonesAccion.appendChild(botonEvidencias);
    }

    if (puedeEditar()) {
      const botonEliminar = document.createElement("button");
      botonEliminar.type = "button";
      botonEliminar.className = "btn btn-sm btn-outline-danger";
      botonEliminar.title = `Eliminar pauta ${pauta.nombre}`;
      botonEliminar.setAttribute("aria-label", `Eliminar pauta ${pauta.nombre}`);
      botonEliminar.innerHTML = '<i class="bi bi-trash" aria-hidden="true"></i>';
      botonEliminar.addEventListener("click", () => solicitarEliminacionPauta(pauta, botonEliminar));
      botonesAccion.appendChild(botonEliminar);
    }

    botonesAccion.prepend(botonHistorial);
    acciones.appendChild(botonesAccion);
    fila.append(nombre, categoria, fecha, responsable, acciones);

    tabla.appendChild(fila);
  });

  actualizarSelectPautas();
}

async function mostrarEvidenciasPauta(pauta) {
  const pautaId = pauta.bdId || pauta.id;
  const modal = document.getElementById("evidencias-pauta-modal");
  const titulo = document.getElementById("evidencias-pauta-titulo");
  const contenedor = document.getElementById("evidencias-pauta-contenedor");
  titulo.textContent = `Imágenes adjuntas: ${pauta.nombre}`;
  contenedor.replaceChildren();

  const mensajeCarga = document.createElement("p");
  mensajeCarga.className = "text-body-secondary mb-0";
  mensajeCarga.textContent = "Cargando imágenes...";
  contenedor.appendChild(mensajeCarga);
  bootstrap.Modal.getOrCreateInstance(modal).show();

  try {
    const respuesta = await fetch(`/api/pautas/${encodeURIComponent(pautaId)}/imagenes`);
    if (!respuesta.ok) throw new Error("No se pudieron cargar las imágenes adjuntas.");

    const imagenes = await respuesta.json();
    contenedor.replaceChildren();
    if (imagenes.length === 0) {
      const mensaje = document.createElement("p");
      mensaje.className = "text-body-secondary mb-0";
      mensaje.textContent = "Esta pauta no tiene imágenes adjuntas.";
      contenedor.appendChild(mensaje);
      return;
    }

    imagenes.forEach((imagen) => {
      const tarjeta = document.createElement("figure");
      tarjeta.className = "col-12 col-sm-6 mb-0";

      const vistaPrevia = document.createElement("img");
      vistaPrevia.src = `/api/pautas/${encodeURIComponent(pautaId)}/imagenes/${encodeURIComponent(imagen.id)}`;
      vistaPrevia.alt = imagen.nombre;
      vistaPrevia.className = "evidencia-galeria-imagen img-thumbnail";

      const nombre = document.createElement("figcaption");
      nombre.className = "small text-body-secondary text-break mt-2";
      nombre.textContent = imagen.nombre;

      tarjeta.append(vistaPrevia, nombre);
      contenedor.appendChild(tarjeta);
    });
  } catch (error) {
    contenedor.replaceChildren();
    const mensaje = document.createElement("p");
    mensaje.className = "alert alert-danger mb-0";
    mensaje.textContent = error.message;
    contenedor.appendChild(mensaje);
  }
}

async function mostrarDetallePauta(pauta) {
  document.getElementById("detalle-pauta-titulo").textContent = pauta.nombre;
  document.getElementById("detalle-pauta-categoria").textContent = pauta.categoria || "-";
  document.getElementById("detalle-pauta-fecha").textContent = pauta.fecha || "-";
  document.getElementById("detalle-pauta-responsable").textContent = pauta.responsable || "-";
  document.getElementById("detalle-pauta-descripcion").textContent =
    pauta.descripcion?.trim() || "No se ha registrado una descripción.";
  document.getElementById("detalle-pauta-conclusion").textContent =
    pauta.conclusion?.trim() || "No se ha registrado una conclusión.";

  const contenedorProcesos = document.getElementById("detalle-pauta-procesos");
  contenedorProcesos.replaceChildren();
  const contenedorImagenes = document.getElementById("detalle-pauta-imagenes");
  contenedorImagenes.replaceChildren();

  if (pauta.procesos.length === 0) {
    const mensaje = document.createElement("p");
    mensaje.className = "text-body-secondary mb-0";
    mensaje.textContent = "No se han registrado procesos.";
    contenedorProcesos.appendChild(mensaje);
  } else {
    pauta.procesos.forEach((proceso) => {
      const tarjeta = document.createElement("article");
      tarjeta.className = "border rounded p-3";

      const titulo = document.createElement("h4");
      titulo.className = "h6 mb-2";
      titulo.textContent = proceso.nombre;
      tarjeta.appendChild(titulo);

      if (proceso.pasos.length > 0) {
        const pasos = document.createElement("ol");
        pasos.className = "mb-2";
        proceso.pasos.forEach((paso) => {
          const elemento = document.createElement("li");
          elemento.textContent = paso;
          pasos.appendChild(elemento);
        });
        tarjeta.appendChild(pasos);
      }

      if (proceso.nota) {
        const nota = document.createElement("p");
        nota.className = "text-body-secondary mb-0";
        nota.textContent = `Nota: ${proceso.nota}`;
        tarjeta.appendChild(nota);
      }

      contenedorProcesos.appendChild(tarjeta);
    });
  }

  const pautaId = pauta.bdId || pauta.id;
  if (pautaId) {
    let respuesta;
    try {
      respuesta = await fetch(`/api/pautas/${encodeURIComponent(pautaId)}/imagenes`);
    } catch (error) {
      alert("No se pudieron cargar las evidencias de la pauta.");
      return;
    }
    if (!respuesta.ok) {
      alert("No se pudieron cargar las evidencias de la pauta.");
      return;
    }

    const imagenes = await respuesta.json();
    if (imagenes.length === 0) {
      const mensaje = document.createElement("p");
      mensaje.className = "text-body-secondary mb-0";
      mensaje.textContent = "No se han adjuntado evidencias.";
      contenedorImagenes.appendChild(mensaje);
    } else {
      imagenes.forEach((imagen) => {
        const enlace = document.createElement("a");
        enlace.href = `/api/pautas/${encodeURIComponent(pautaId)}/imagenes/${encodeURIComponent(imagen.id)}`;
        enlace.target = "_blank";
        enlace.rel = "noopener noreferrer";
        enlace.setAttribute("aria-label", `Abrir evidencia ${imagen.nombre}`);

        const vistaPrevia = document.createElement("img");
        vistaPrevia.src = enlace.href;
        vistaPrevia.alt = imagen.nombre;
        vistaPrevia.className = "img-thumbnail";
        vistaPrevia.style.width = "10rem";
        vistaPrevia.style.height = "10rem";
        vistaPrevia.style.objectFit = "cover";

        enlace.appendChild(vistaPrevia);
        contenedorImagenes.appendChild(enlace);
      });
    }
  }

  bootstrap.Modal.getOrCreateInstance(
    document.getElementById("detalle-pauta-modal")
  ).show();
}

function solicitarEliminacionPauta(pauta, boton) {
  pautaPendienteEliminar = pauta;
  botonPendienteEliminar = boton;
  document.getElementById("nombre-pauta-eliminar").textContent = pauta.nombre;
  bootstrap.Modal.getOrCreateInstance(
    document.getElementById("confirmar-eliminar-pauta-modal")
  ).show();
}

async function eliminarPauta(pauta, boton) {
  boton.disabled = true;
  try {
    const id = pauta.bdId || pauta.id;
    const respuesta = await fetch(`/api/pautas/${encodeURIComponent(id)}`, {
      method: "DELETE"
    });
    const resultado = await respuesta.json().catch(() => ({}));

    if (!respuesta.ok) {
      throw new Error(resultado.mensaje || "No se pudo eliminar la pauta.");
    }

    await cargarDatosBD();
    mostrarPautas();
    actualizarDashboard();
    mostrarHistorial();
  } catch (error) {
    alert(error.message);
    boton.disabled = false;
  }
}

const modalEliminarPauta = document.getElementById("confirmar-eliminar-pauta-modal");
const botonConfirmarEliminarPauta = document.getElementById("confirmar-eliminar-pauta");

if (modalEliminarPauta) {
  modalEliminarPauta.addEventListener("hidden.bs.modal", () => {
    pautaPendienteEliminar = null;
    botonPendienteEliminar = null;
  });
}

if (botonConfirmarEliminarPauta) {
  botonConfirmarEliminarPauta.addEventListener("click", async () => {
    const pauta = pautaPendienteEliminar;
    const boton = botonPendienteEliminar;
    if (!pauta || !boton) return;

    pautaPendienteEliminar = null;
    botonPendienteEliminar = null;
    bootstrap.Modal.getOrCreateInstance(modalEliminarPauta).hide();
    await eliminarPauta(pauta, boton);
  });
}

function actualizarSelectPautas() {
  const categorias = [...new Set(pautas.map((pauta) => pauta.categoria))];
  const filtroCategoria = document.getElementById("filtro-categoria-pauta");
  if (filtroCategoria) {
    const categoriaSeleccionada = filtroCategoria.value;
    filtroCategoria.replaceChildren(new Option("Todas las categorías", ""));
    categorias.forEach((categoria) => filtroCategoria.add(new Option(categoria, categoria)));
    filtroCategoria.value = categorias.includes(categoriaSeleccionada) ? categoriaSeleccionada : "";
  }

  const categoriaSelect = document.getElementById("pauta-categoria");
  const pautaSelect = document.getElementById("pauta-select");
  if (categoriaSelect) {
    const categoriaSeleccionada = categoriaSelect.value;
    categoriaSelect.replaceChildren(new Option("Seleccionar categoría", ""));
    categorias.forEach((categoria) => categoriaSelect.add(new Option(categoria, categoria)));
    categoriaSelect.value = categorias.includes(categoriaSeleccionada) ? categoriaSeleccionada : "";
  }

  const nuevaCategoriaSelect = document.getElementById("nueva-pauta-categoria");
  if (nuevaCategoriaSelect) {
    const categoriaSeleccionada = nuevaCategoriaSelect.value;
    nuevaCategoriaSelect.replaceChildren(new Option("Seleccionar categoría", ""));
    categorias.forEach((categoria) => nuevaCategoriaSelect.add(new Option(categoria, categoria)));
    nuevaCategoriaSelect.add(new Option("+ Crear nueva categoría", OPCION_NUEVA_CATEGORIA));
    nuevaCategoriaSelect.value = categoriaSeleccionada === OPCION_NUEVA_CATEGORIA ||
      categorias.includes(categoriaSeleccionada) ? categoriaSeleccionada : "";
  }

  if (pautaSelect) {
    pautaSelect.replaceChildren(new Option("Seleccionar pauta", ""));
    pautaSelect.disabled = true;
    cargarEvidenciasPautaSeleccionada(0);
  }

  actualizarSelectHistorial();
}

function actualizarSelectHijos(categoria) {
  const pautaSelect = document.getElementById("pauta-select");
  if (!pautaSelect) return;

  pautaSelect.replaceChildren(new Option("Seleccionar pauta", ""));
  const cambio = document.getElementById("cambio");
  if (cambio) cambio.value = "";
  cargarEvidenciasPautaSeleccionada(0);
  const pautasCategoria = pautas.filter((pauta) => pauta.categoria === categoria);
  pautaSelect.disabled = pautasCategoria.length === 0;

  pautasCategoria.forEach((pauta) => {
    pautaSelect.add(new Option(pauta.nombre, pauta.bdId || pauta.id));
  });
}

function obtenerDetallePauta(pauta) {
  const resumenProcesos = pauta.procesos.map((proceso) => [
    proceso.nombre,
    ...proceso.pasos.map((paso, index) => `${index + 1}. ${paso}`),
    proceso.nota ? `Nota: ${proceso.nota}` : ""
  ].filter(Boolean).join("\n")).join("\n\n");

  return [pauta.descripcion, pauta.conclusion, resumenProcesos]
    .filter(Boolean)
    .join("\n\n");
}

function cargarDetallePautaSeleccionada() {
  const pautaId = Number(document.getElementById("pauta-select")?.value);
  const cambio = document.getElementById("cambio");

  const pauta = pautas.find((item) => Number(item.bdId || item.id) === pautaId);
  if (pautaId && cambio && pauta) cambio.value = obtenerDetallePauta(pauta);
  cargarEvidenciasPautaSeleccionada(pautaId);
}

let solicitudEvidenciasActualizacion = 0;
let pautaEvidenciasActualizacion = 0;
let evidenciasPautaActualizacion = [];
let urlsVistaPreviaEvidenciasActualizacion = [];
const MAX_EVIDENCIAS_POR_PAUTA = 5;
const MAX_BYTES_POR_EVIDENCIA = 10 * 1024 * 1024;
const MAX_BYTES_EVIDENCIAS_PAUTA = 20 * 1024 * 1024;

function mostrarMensajeEvidenciasActualizacion(mensaje, esError = false) {
  const contenedor = document.getElementById("evidencias-actualizacion-contenedor");
  if (!contenedor) return;
  const texto = document.createElement("p");
  texto.className = esError ? "text-danger mb-0" : "text-body-secondary mb-0";
  texto.textContent = mensaje;
  contenedor.replaceChildren(texto);
}

function actualizarLimiteEvidenciasActualizacion() {
  const ayuda = document.getElementById("ayuda-evidencias-actualizacion");
  const input = document.getElementById("input-evidencias-actualizacion");
  const boton = document.getElementById("boton-agregar-evidencias-actualizacion");
  if (!ayuda || !input || !boton) return;

  const bytesActuales = evidenciasPautaActualizacion.reduce(
    (total, imagen) => total + imagen.tamañoBytes,
    0
  );
  const espacioRestante = MAX_BYTES_EVIDENCIAS_PAUTA - bytesActuales;
  const cuposRestantes = MAX_EVIDENCIAS_POR_PAUTA - evidenciasPautaActualizacion.length;
  ayuda.textContent = `${evidenciasPautaActualizacion.length}/${MAX_EVIDENCIAS_POR_PAUTA} evidencias; ` +
    `${(bytesActuales / 1024 / 1024).toFixed(1)} de 20 MB usados. ` +
    "Máximo 10 MB por imagen.";
  input.disabled = cuposRestantes <= 0 || espacioRestante <= 0;
  if (input.disabled) {
    ayuda.textContent += cuposRestantes <= 0
      ? " Se alcanzó el máximo de evidencias."
      : " Se alcanzó el tamaño máximo total.";
  }
}

function limpiarPrevisualizacionEvidenciasActualizacion() {
  urlsVistaPreviaEvidenciasActualizacion.forEach((url) => URL.revokeObjectURL(url));
  urlsVistaPreviaEvidenciasActualizacion = [];
  const previsualizacion = document.getElementById("evidencias-actualizacion-seleccionadas");
  const boton = document.getElementById("boton-agregar-evidencias-actualizacion");
  if (previsualizacion) {
    previsualizacion.replaceChildren();
    previsualizacion.classList.remove("d-flex", "flex-wrap", "gap-3", "text-danger");
  }
  if (boton) boton.disabled = true;
}

function mostrarSeleccionEvidenciasActualizacion(archivos) {
  const input = document.getElementById("input-evidencias-actualizacion");
  const previsualizacion = document.getElementById("evidencias-actualizacion-seleccionadas");
  const boton = document.getElementById("boton-agregar-evidencias-actualizacion");
  if (!input || !previsualizacion || !boton) return;

  limpiarPrevisualizacionEvidenciasActualizacion();
  const rechazar = (mensaje) => {
    input.value = "";
    previsualizacion.textContent = mensaje;
    previsualizacion.classList.add("text-danger");
  };
  if (!archivos.length) return;

  const cantidadActual = evidenciasPautaActualizacion.length;
  const bytesActuales = evidenciasPautaActualizacion.reduce(
    (total, imagen) => total + imagen.tamañoBytes,
    0
  );
  if (cantidadActual + archivos.length > MAX_EVIDENCIAS_POR_PAUTA) {
    rechazar(`Solo puedes adjuntar ${MAX_EVIDENCIAS_POR_PAUTA} evidencias por pauta.`);
    return;
  }
  if (archivos.some((archivo) => !["image/jpeg", "image/png", "image/gif", "image/webp"].includes(archivo.type))) {
    rechazar("Usa imágenes JPG, PNG, GIF o WebP.");
    return;
  }
  if (archivos.some((archivo) => archivo.size > MAX_BYTES_POR_EVIDENCIA)) {
    rechazar("Cada imagen puede pesar hasta 10 MB.");
    return;
  }
  const bytesNuevos = archivos.reduce((total, archivo) => total + archivo.size, 0);
  if (bytesActuales + bytesNuevos > MAX_BYTES_EVIDENCIAS_PAUTA) {
    rechazar("El tamaño total de las evidencias no puede superar 20 MB.");
    return;
  }

  archivos.forEach((archivo) => {
    const url = URL.createObjectURL(archivo);
    urlsVistaPreviaEvidenciasActualizacion.push(url);

    const tarjeta = document.createElement("figure");
    tarjeta.className = "evidencia-seleccionada mb-0";

    const vistaPrevia = document.createElement("img");
    vistaPrevia.src = url;
    vistaPrevia.alt = `Vista previa de ${archivo.name}`;
    vistaPrevia.className = "evidencia-seleccionada-imagen img-thumbnail";

    const nombre = document.createElement("figcaption");
    nombre.className = "small text-body-secondary text-break mt-1";
    nombre.textContent = archivo.name;

    tarjeta.append(vistaPrevia, nombre);
    previsualizacion.appendChild(tarjeta);
  });
  previsualizacion.classList.add("d-flex", "flex-wrap", "gap-3");
  boton.disabled = false;
}

async function cargarEvidenciasPautaSeleccionada(pautaId) {
  const contenedor = document.getElementById("evidencias-actualizacion-contenedor");
  if (!contenedor) return;

  const solicitud = ++solicitudEvidenciasActualizacion;
  if (pautaEvidenciasActualizacion !== pautaId) {
    limpiarPrevisualizacionEvidenciasActualizacion();
    const input = document.getElementById("input-evidencias-actualizacion");
    const carga = document.getElementById("agregar-evidencias-actualizacion");
    if (input) input.value = "";
    if (carga) carga.classList.add("d-none");
    evidenciasPautaActualizacion = [];
    pautaEvidenciasActualizacion = pautaId;
  }
  if (!pautaId) {
    mostrarMensajeEvidenciasActualizacion("Selecciona una pauta para ver sus evidencias.");
    return;
  }

  mostrarMensajeEvidenciasActualizacion("Cargando evidencias...");
  try {
    const respuesta = await fetch(`/api/pautas/${encodeURIComponent(pautaId)}/imagenes`);
    if (!respuesta.ok) throw new Error("No se pudieron cargar las evidencias de la pauta.");
    const imagenes = await respuesta.json();
    if (
      solicitud !== solicitudEvidenciasActualizacion ||
      Number(document.getElementById("pauta-select")?.value) !== pautaId
    ) return;

    evidenciasPautaActualizacion = imagenes;
    const carga = document.getElementById("agregar-evidencias-actualizacion");
    if (carga) carga.classList.remove("d-none");
    actualizarLimiteEvidenciasActualizacion();
    if (imagenes.length === 0) {
      mostrarMensajeEvidenciasActualizacion("Esta pauta no tiene evidencias anexadas.");
      return;
    }

    contenedor.replaceChildren();
    imagenes.forEach((imagen) => {
      const tarjeta = document.createElement("figure");
      tarjeta.className = "col-12 col-sm-6 col-lg-4 mb-0";

      const vistaPrevia = document.createElement("img");
      vistaPrevia.src = `/api/pautas/${encodeURIComponent(pautaId)}/imagenes/${encodeURIComponent(imagen.id)}`;
      vistaPrevia.alt = imagen.nombre;
      vistaPrevia.className = "evidencia-actualizacion-imagen img-thumbnail";

      const nombre = document.createElement("figcaption");
      nombre.className = "small text-body-secondary text-break mt-2";
      nombre.textContent = imagen.nombre;

      const botonEliminar = document.createElement("button");
      botonEliminar.type = "button";
      botonEliminar.className = "btn btn-outline-danger btn-sm mt-2";
      botonEliminar.textContent = "Eliminar evidencia";
      botonEliminar.setAttribute("aria-label", `Eliminar evidencia ${imagen.nombre}`);
      botonEliminar.addEventListener("click", async () => {
        if (!window.confirm(`¿Eliminar permanentemente la evidencia "${imagen.nombre}" de esta pauta?`)) return;

        botonEliminar.disabled = true;
        try {
          const resultado = await fetch(
            `/api/pautas/${encodeURIComponent(pautaId)}/imagenes/${encodeURIComponent(imagen.id)}`,
            { method: "DELETE" }
          );
          if (!resultado.ok) {
            const error = await resultado.json().catch(() => ({}));
            throw new Error(error.mensaje || "No se pudo eliminar la evidencia.");
          }
          if (Number(document.getElementById("pauta-select")?.value) === pautaId) {
            await cargarEvidenciasPautaSeleccionada(pautaId);
          }
        } catch (error) {
          alert(error.message || "No se pudo eliminar la evidencia.");
          botonEliminar.disabled = false;
        }
      });

      tarjeta.append(vistaPrevia, nombre);
      if (puedeEditar()) tarjeta.appendChild(botonEliminar);
      contenedor.appendChild(tarjeta);
    });
  } catch (error) {
    if (solicitud !== solicitudEvidenciasActualizacion) return;
    mostrarMensajeEvidenciasActualizacion(
      error.message || "No se pudieron cargar las evidencias de la pauta.",
      true
    );
  }
}

function actualizarSelectHistorial() {
  const select = document.getElementById("historial-pauta");
  if (!select) return;

  select.innerHTML = '<option value="todos">Todas las pautas</option>';
  pautas.forEach((pauta) => {
    select.innerHTML += `<option value="${pauta.bdId || pauta.id}">${pauta.nombre}</option>`;
  });
}

async function registrarActualizacion(pauta, fecha, responsable, cambio, observaciones) {
  const respuesta = await fetch("/api/actualizaciones", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      pautaId: pauta.bdId || null,
      pauta: { nombre: pauta.nombre, categoria: pauta.categoria },
      fecha,
      responsable,
      cambio,
      observaciones
    })
  });

  if (!respuesta.ok) {
    const error = await respuesta.json().catch(() => ({}));
    throw new Error(error.mensaje || "No se pudo guardar la actualización.");
  }
}

const formulario = document.getElementById("form-actualizacion");
if (formulario) {
  const categoriaSelect = document.getElementById("pauta-categoria");
  const pautaSelect = document.getElementById("pauta-select");
const inputEvidencias = document.getElementById("input-evidencias-actualizacion");
const dropzoneEvidencias = document.getElementById("dropzone-evidencias-actualizacion");
const botonAgregarEvidencias = document.getElementById("boton-agregar-evidencias-actualizacion");
categoriaSelect?.addEventListener("change", () => {
  actualizarSelectHijos(categoriaSelect.value);
});
pautaSelect?.addEventListener("change", cargarDetallePautaSeleccionada);
inputEvidencias?.addEventListener("change", () => {
  mostrarSeleccionEvidenciasActualizacion(Array.from(inputEvidencias.files));
});
dropzoneEvidencias?.addEventListener("dragover", (event) => {
  event.preventDefault();
  dropzoneEvidencias.classList.add("is-dragover");
});
dropzoneEvidencias?.addEventListener("dragleave", (event) => {
  if (!(event.relatedTarget instanceof Node) || !dropzoneEvidencias.contains(event.relatedTarget)) {
    dropzoneEvidencias.classList.remove("is-dragover");
  }
});
dropzoneEvidencias?.addEventListener("drop", (event) => {
  event.preventDefault();
  dropzoneEvidencias.classList.remove("is-dragover");
  if (!inputEvidencias) return;
  const transferencia = new DataTransfer();
  Array.from(event.dataTransfer.files).forEach((archivo) => transferencia.items.add(archivo));
  inputEvidencias.files = transferencia.files;
  mostrarSeleccionEvidenciasActualizacion(Array.from(inputEvidencias.files));
});
botonAgregarEvidencias?.addEventListener("click", async () => {
  const pautaId = Number(pautaSelect?.value);
  const archivos = Array.from(inputEvidencias?.files || []);
  if (!pautaId || !archivos.length) return;

  botonAgregarEvidencias.disabled = true;
  try {
    const imagenes = await Promise.all(archivos.map((archivo) => new Promise((resolve, reject) => {
      const lector = new FileReader();
      lector.onload = () => {
        if (typeof lector.result !== "string") {
          reject(new Error(`No se pudo leer la imagen ${archivo.name}.`));
          return;
        }
        resolve({ nombre: archivo.name, tipo: archivo.type, dataUrl: lector.result });
      };
      lector.onerror = () => reject(new Error(`No se pudo leer la imagen ${archivo.name}.`));
      lector.readAsDataURL(archivo);
    })));
    const respuesta = await fetch(`/api/pautas/${encodeURIComponent(pautaId)}/imagenes`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ imagenes })
    });
    if (!respuesta.ok) {
      const error = await respuesta.json().catch(() => ({}));
      throw new Error(error.mensaje || "No se pudieron agregar las evidencias.");
    }

    if (Number(pautaSelect.value) === pautaId) {
      limpiarPrevisualizacionEvidenciasActualizacion();
      inputEvidencias.value = "";
      await cargarEvidenciasPautaSeleccionada(pautaId);
    }
  } catch (error) {
    alert(error.message || "No se pudieron agregar las evidencias.");
    if (Number(pautaSelect?.value) === pautaId) botonAgregarEvidencias.disabled = false;
  }
});
formulario.addEventListener("reset", () => {
  solicitudEvidenciasActualizacion += 1;
  limpiarPrevisualizacionEvidenciasActualizacion();
  evidenciasPautaActualizacion = [];
  pautaEvidenciasActualizacion = 0;
  inputEvidencias.value = "";
  document.getElementById("agregar-evidencias-actualizacion").classList.add("d-none");
  mostrarMensajeEvidenciasActualizacion("Selecciona una pauta para ver sus evidencias.");
});

  formulario.addEventListener("submit", async (event) => {
    event.preventDefault();

    const categoria = categoriaSelect.value;
    const pautaId = Number(document.getElementById("pauta-select").value);
    if (!categoria || !pautaId) {
      alert("Debes seleccionar una pauta.");
      return;
    }

    const pauta = pautas.find((item) =>
      Number(item.bdId || item.id) === pautaId && item.categoria === categoria
    );
    if (!pauta) {
      alert("La pauta seleccionada no está disponible.");
      return;
    }

    const fechaActual = new Date();
    const fechaLocal = [
      fechaActual.getFullYear(),
      String(fechaActual.getMonth() + 1).padStart(2, "0"),
      String(fechaActual.getDate()).padStart(2, "0")
    ].join("-");
    const responsable = document.getElementById("responsable").value.trim() || obtenerUsuarioActual()?.usuario || "";

    const nuevaActualizacion = {
      id: Date.now(),
      pautaId,
      fecha: fechaLocal,
      responsable,
      cambio: document.getElementById("cambio").value.trim(),
      observaciones: document.getElementById("observaciones").value.trim()
    };

    try {
      await registrarActualizacion(
        pauta,
        fechaLocal,
        responsable,
        nuevaActualizacion.cambio,
        nuevaActualizacion.observaciones
      );
      await cargarDatosBD();
    } catch (error) {
      alert(error.message);
      return;
    }

    alert("Actualización registrada correctamente.");
    formulario.reset();
    completarResponsableActual();
    actualizarTodo();
    document.querySelector('[data-section="dashboard"]')?.click();
  });
}

const formularioNuevaPauta = document.getElementById("form-nueva-pauta");
if (formularioNuevaPauta) {
  const categoriaSelect = document.getElementById("nueva-pauta-categoria");
  const nuevaCategoriaContenedor = document.getElementById("nueva-pauta-categoria-nueva-contenedor");
  const nuevaCategoriaInput = document.getElementById("nueva-pauta-categoria-nueva");
  const imagenesInput = document.getElementById("nueva-pauta-imagenes");
  const dropzoneImagenes = document.getElementById("nueva-pauta-dropzone");
  const imagenesSeleccionadas = document.getElementById("nueva-pauta-imagenes-seleccionadas");
  const maxImagenes = 5;
  const maxBytesPorImagen = 10 * 1024 * 1024;
  const maxBytesTotalesImagenes = 20 * 1024 * 1024;
  const tiposImagenesValidos = new Set(["image/jpeg", "image/png", "image/gif", "image/webp"]);
  let urlsVistaPrevia = [];

  const limpiarImagenesSeleccionadas = () => {
    urlsVistaPrevia.forEach((url) => URL.revokeObjectURL(url));
    urlsVistaPrevia = [];
    imagenesSeleccionadas.replaceChildren();
    imagenesSeleccionadas.classList.remove("d-flex", "flex-wrap", "gap-3");
  };

  const mostrarImagenesSeleccionadas = (archivos) => {
    limpiarImagenesSeleccionadas();
    if (archivos.length > maxImagenes) {
      imagenesInput.value = "";
      imagenesSeleccionadas.textContent = "Solo puedes adjuntar hasta 5 imágenes.";
      imagenesSeleccionadas.classList.add("text-danger");
      return;
    }
    if (archivos.some((archivo) => !tiposImagenesValidos.has(archivo.type))) {
      imagenesInput.value = "";
      imagenesSeleccionadas.textContent = "Usa imágenes JPG, PNG, GIF o WebP.";
      imagenesSeleccionadas.classList.add("text-danger");
      return;
    }
    if (archivos.some((archivo) => archivo.size > maxBytesPorImagen)) {
      imagenesInput.value = "";
      imagenesSeleccionadas.textContent = "Cada imagen puede pesar hasta 10 MB.";
      imagenesSeleccionadas.classList.add("text-danger");
      return;
    }
    if (archivos.reduce((total, archivo) => total + archivo.size, 0) > maxBytesTotalesImagenes) {
      imagenesInput.value = "";
      imagenesSeleccionadas.textContent = "El tamaño total de las imágenes no puede superar 20 MB.";
      imagenesSeleccionadas.classList.add("text-danger");
      return;
    }

    imagenesSeleccionadas.classList.remove("text-danger");
    archivos.forEach((archivo) => {
      const url = URL.createObjectURL(archivo);
      urlsVistaPrevia.push(url);

      const tarjeta = document.createElement("figure");
      tarjeta.className = "evidencia-seleccionada mb-0";

      const vistaPrevia = document.createElement("img");
      vistaPrevia.src = url;
      vistaPrevia.alt = `Vista previa de ${archivo.name}`;
      vistaPrevia.className = "evidencia-seleccionada-imagen img-thumbnail";

      const nombre = document.createElement("figcaption");
      nombre.className = "small text-body-secondary text-break mt-1";
      nombre.textContent = archivo.name;

      tarjeta.append(vistaPrevia, nombre);
      imagenesSeleccionadas.appendChild(tarjeta);
    });
    imagenesSeleccionadas.classList.add("d-flex", "flex-wrap", "gap-3");
    if (archivos.length === 0) {
      imagenesSeleccionadas.classList.remove("d-flex", "flex-wrap", "gap-3");
    }
  };

  imagenesInput.addEventListener("change", () => {
    mostrarImagenesSeleccionadas(Array.from(imagenesInput.files));
  });

  dropzoneImagenes.addEventListener("dragover", (event) => {
    event.preventDefault();
    dropzoneImagenes.classList.add("is-dragover");
  });

  dropzoneImagenes.addEventListener("dragleave", (event) => {
    if (!(event.relatedTarget instanceof Node) || !dropzoneImagenes.contains(event.relatedTarget)) {
      dropzoneImagenes.classList.remove("is-dragover");
    }
  });

  dropzoneImagenes.addEventListener("drop", (event) => {
    event.preventDefault();
    dropzoneImagenes.classList.remove("is-dragover");
    const transferencia = new DataTransfer();
    Array.from(event.dataTransfer.files).forEach((archivo) => transferencia.items.add(archivo));
    imagenesInput.files = transferencia.files;
    mostrarImagenesSeleccionadas(Array.from(imagenesInput.files));
  });

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
    imagenesSeleccionadas.classList.remove("d-flex", "flex-wrap", "gap-3");
    dropzoneImagenes.classList.remove("is-dragover");
  });

  formularioNuevaPauta.addEventListener("submit", async (event) => {
    event.preventDefault();

    const responsable = obtenerUsuarioActual()?.usuario || "";
    const categoria = categoriaSelect.value === OPCION_NUEVA_CATEGORIA
      ? nuevaCategoriaInput.value.trim()
      : categoriaSelect.value;
    const nombre = document.getElementById("nueva-pauta-nombre").value.trim();
    const descripcion = document.getElementById("nueva-pauta-descripcion").value.trim();
    const archivosImagenes = Array.from(imagenesInput.files);

    if (!responsable) {
      alert("Debes iniciar sesión para registrar una pauta.");
      return;
    }

    const fechaActual = new Date();
    const fecha = [
      fechaActual.getFullYear(),
      String(fechaActual.getMonth() + 1).padStart(2, "0"),
      String(fechaActual.getDate()).padStart(2, "0")
    ].join("-");

    let imagenes;
    try {
      imagenes = await Promise.all(archivosImagenes.map((archivo) => new Promise((resolve, reject) => {
        const lector = new FileReader();
        lector.onload = () => resolve({
          nombre: archivo.name,
          tipo: archivo.type,
          dataUrl: lector.result
        });
        lector.onerror = () => reject(new Error(`No se pudo leer la imagen ${archivo.name}.`));
        lector.readAsDataURL(archivo);
      })));
    } catch (error) {
      alert(error.message);
      return;
    }

    let respuesta;
    try {
      respuesta = await fetch("/api/pautas", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nombre, categoria, descripcion, fecha, responsable, imagenes })
      });
    } catch (error) {
      alert("No se pudo conectar con el servidor.");
      return;
    }

    if (!respuesta.ok) {
      const error = await respuesta.json().catch(() => ({}));
      alert(error.mensaje || "No se pudo registrar la nueva pauta.");
      return;
    }

    alert("Pauta registrada correctamente.");
    window.location.reload();
  });
}

function mostrarHistorial(pautaId = "todos") {
  const timeline = document.getElementById("timeline");
  if (!timeline) return;

  let registros = actualizaciones;
  if (pautaId !== "todos") {
    registros = actualizaciones.filter((a) => a.pautaId === Number(pautaId));
  }

  registros = [...registros].sort((a, b) => new Date(b.fecha) - new Date(a.fecha));

  if (registros.length === 0) {
    timeline.innerHTML = `
      <div class="card shadow-sm">
        <div class="card-body"><p class="text-muted mb-0">No existen cambios registrados.</p></div>
      </div>
    `;
    return;
  }

  timeline.innerHTML = registros.map((registro) => {
    const pauta = pautas.find((p) => p.bdId === registro.pautaId || p.id === registro.pautaId);

    return `
      <div class="card shadow-sm mb-3">
        <div class="card-body">
          <div class="d-flex flex-column flex-md-row justify-content-between gap-2">
            <div>
              <h5 class="card-title mb-1">${pauta?.nombre || "Pauta eliminada"}</h5>
              <div class="text-muted small">${registro.fecha}</div>
            </div>
            <span class="badge bg-primary align-self-start">Cambio registrado</span>
          </div>

          <hr>

          <div class="mb-3">
            <h6>Cambio realizado</h6>
            <p class="mb-0">${registro.cambio}</p>
          </div>

          <div class="mb-3">
            <h6>Auditor</h6>
            <p class="mb-0 text-muted">${registro.responsable}</p>
          </div>

          ${registro.observaciones ? `
            <div>
              <h6>Observaciones</h6>
              <p class="mb-0 text-muted">${registro.observaciones}</p>
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

  const selectHistorial = document.getElementById("historial-pauta");
  if (selectHistorial) {
    selectHistorial.value = pautaId;
  }

  mostrarHistorial(pautaId);
}

const historialSelect = document.getElementById("historial-pauta");
if (historialSelect) {
  historialSelect.addEventListener("change", function () {
    mostrarHistorial(this.value);
  });
}

const filtroPautasForm = document.getElementById("form-filtro-pautas");
const btnBuscarPautas = document.getElementById("btn-buscar-pauta");
const buscarPautaInput = document.getElementById("buscar-pauta");

if (btnBuscarPautas) {
  btnBuscarPautas.addEventListener("click", () => mostrarPautas(true));
}

if (filtroPautasForm) {
  filtroPautasForm.addEventListener("submit", (event) => {
    event.preventDefault();
    mostrarPautas(true);
  });
}

if (buscarPautaInput) {
  buscarPautaInput.addEventListener("keydown", (event) => {
    if (event.key === "Enter") {
      event.preventDefault();
      mostrarPautas(true);
    }
  });
}

const btnNuevaPauta = document.getElementById("btn-nueva-pauta");
if (btnNuevaPauta) {
  btnNuevaPauta.addEventListener("click", () => {
    const menuNuevaPauta = document.querySelector('[data-section="nueva-pauta"]');
    if (menuNuevaPauta) menuNuevaPauta.click();
  });
}

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
    const sesion = await respuestaSesion.json();
    usuarioActual = sesion.usuario;
    localStorage.setItem("usuarioActual", JSON.stringify(usuarioActual));
  } catch (error) {
    console.error("No se pudo validar la sesión:", error);
    alert("No se pudo validar la sesión. Intenta iniciar sesión nuevamente.");
    window.location.href = "/login";
    return;
  }
  aplicarPermisos();

  const nombreUsuario = typeof usuarioActual?.usuario === "string"
    ? usuarioActual.usuario.trim()
    : "";
  const avatarUsuario = document.getElementById("user-avatar");
  const etiquetaUsuario = document.getElementById("user-name");
  if (avatarUsuario) {
    avatarUsuario.textContent = Array.from(nombreUsuario)[0]?.toLocaleUpperCase("es") || "";
  }
  if (etiquetaUsuario) etiquetaUsuario.textContent = nombreUsuario || "Mi perfil";

  try {
    await cargarDatosBD();
  } catch (error) {
    alert(error.message);
  }

  completarResponsableActual();
  actualizarDashboard();
  mostrarPautas();
  actualizarSelectPautas();
  mostrarHistorial();
}

actualizarTodo();

async function cargarUsuarios() {
  const tabla = document.getElementById("tabla-usuarios");
  const mensaje = document.getElementById("usuarios-mensaje");
  if (!tabla || !esAdministradorGeneral()) return;
  mensaje.classList.add("d-none");
  tabla.innerHTML = '<tr><td colspan="4" class="text-center text-body-secondary">Cargando usuarios...</td></tr>';

  try {
    const respuesta = await fetch("/api/auth/usuarios");
    const resultado = await respuesta.json();
    if (!respuesta.ok) throw new Error(resultado.mensaje || "No se pudieron cargar los usuarios.");

    tabla.replaceChildren();
    resultado.forEach((usuario) => {
      const fila = document.createElement("tr");
      const nombre = document.createElement("td");
      const correo = document.createElement("td");
      const rol = document.createElement("td");
      const accion = document.createElement("td");
      nombre.textContent = usuario.usuario;
      correo.textContent = usuario.correo_electronico;

      if (usuario.rol === "administrador_general") {
        rol.textContent = "Administrador general";
        accion.textContent = "Rol principal";
      } else {
        const selector = document.createElement("select");
        selector.className = "form-select";
        selector.setAttribute("aria-label", `Rol de ${usuario.usuario}`);
        [
          ["administrador", "Administrador"],
          ["operador", "Operador"],
          ["consulta", "Consulta"]
        ].forEach(([valor, etiqueta]) => {
          const opcion = document.createElement("option");
          opcion.value = valor;
          opcion.textContent = etiqueta;
          selector.appendChild(opcion);
        });
        selector.value = usuario.rol;

        const guardar = document.createElement("button");
        guardar.type = "button";
        guardar.className = "btn btn-outline-primary";
        guardar.textContent = "Guardar";
        guardar.addEventListener("click", async () => {
          guardar.disabled = true;
          try {
            const respuestaRol = await fetch(`/api/auth/usuarios/${encodeURIComponent(usuario.id_usuario)}/rol`, {
              method: "PUT",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ rol: selector.value })
            });
            const resultadoRol = await respuestaRol.json();
            if (!respuestaRol.ok) throw new Error(resultadoRol.mensaje || "No se pudo actualizar el rol.");
            mostrarMensajeUsuarios(resultadoRol.mensaje, "success");
          } catch (error) {
            mostrarMensajeUsuarios(error.message || "No se pudo conectar con el servidor.", "danger");
          } finally {
            guardar.disabled = false;
          }
        });
        rol.appendChild(selector);
        accion.appendChild(guardar);
      }

      fila.append(nombre, correo, rol, accion);
      tabla.appendChild(fila);
    });
    if (!resultado.length) {
      tabla.innerHTML = '<tr><td colspan="4" class="text-center text-body-secondary">No hay usuarios registrados.</td></tr>';
    }
  } catch (error) {
    tabla.innerHTML = '<tr><td colspan="4" class="text-center text-danger">No se pudieron cargar los usuarios.</td></tr>';
    mostrarMensajeUsuarios(error.message || "No se pudo conectar con el servidor.", "danger");
  }
}

function mostrarMensajeUsuarios(texto, tipo) {
  const mensaje = document.getElementById("usuarios-mensaje");
  mensaje.textContent = texto;
  mensaje.className = `alert alert-${tipo}`;
}

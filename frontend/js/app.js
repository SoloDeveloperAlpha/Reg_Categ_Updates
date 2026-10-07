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
const openProfileButton = document.getElementById("abrir-perfil");

function mostrarSeccion(sectionId, menuActivo = null) {
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
  logoutButton.addEventListener("click", () => {
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

if (openProfileButton) {
  openProfileButton.addEventListener("click", () => mostrarSeccion("perfil"));
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

  const ultimas = [...actualizaciones].sort((a, b) => new Date(b.fecha) - new Date(a.fecha)).slice(0, 5);

  contenedor.innerHTML = ultimas.map((actualizacion) => {
    const pauta = pautas.find((p) => p.bdId === actualizacion.pautaId || p.id === actualizacion.pautaId);
    return `
      <div class="card mb-3 border-start border-primary border-3">
        <div class="card-body">
          <div class="d-flex justify-content-between align-items-start">
            <div>
              <h5 class="card-title mb-1">${pauta?.nombre || "Pauta eliminada"}</h5>
              <small class="text-muted">${actualizacion.fecha}</small>
            </div>
            <span class="badge bg-primary">Actualización</span>
          </div>
          <p class="card-text mt-3 mb-0">${actualizacion.cambio}</p>
        </div>
      </div>
    `;
  }).join("");
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
    const nombreEnNegrita = document.createElement("strong");
    nombreEnNegrita.textContent = pauta.nombre;
    nombre.appendChild(nombreEnNegrita);

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

    const botonEliminar = document.createElement("button");
    botonEliminar.type = "button";
    botonEliminar.className = "btn btn-sm btn-outline-danger";
    botonEliminar.title = `Eliminar pauta ${pauta.nombre}`;
    botonEliminar.setAttribute("aria-label", `Eliminar pauta ${pauta.nombre}`);
    botonEliminar.innerHTML = '<i class="bi bi-trash" aria-hidden="true"></i>';
    botonEliminar.addEventListener("click", () => solicitarEliminacionPauta(pauta, botonEliminar));

    botonesAccion.append(botonHistorial, botonEliminar);
    acciones.appendChild(botonesAccion);
    fila.append(nombre, categoria, fecha, responsable, acciones);

    tabla.appendChild(fila);
  });

  actualizarSelectPautas();
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
  }

  actualizarSelectHistorial();
}

function actualizarSelectHijos(categoria) {
  const pautaSelect = document.getElementById("pauta-select");
  if (!pautaSelect) return;

  pautaSelect.replaceChildren(new Option("Seleccionar pauta", ""));
  const cambio = document.getElementById("cambio");
  if (cambio) cambio.value = "";
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
  if (!pautaId || !cambio) return;

  const pauta = pautas.find((item) => Number(item.bdId || item.id) === pautaId);
  if (pauta) cambio.value = obtenerDetallePauta(pauta);
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
  categoriaSelect?.addEventListener("change", () => {
    actualizarSelectHijos(categoriaSelect.value);
  });
  pautaSelect?.addEventListener("change", cargarDetallePautaSeleccionada);

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
  });

  formularioNuevaPauta.addEventListener("submit", async (event) => {
    event.preventDefault();

    const responsable = obtenerUsuarioActual()?.usuario || "";
    const categoria = categoriaSelect.value === OPCION_NUEVA_CATEGORIA
      ? nuevaCategoriaInput.value.trim()
      : categoriaSelect.value;
    const nombre = document.getElementById("nueva-pauta-nombre").value.trim();
    const descripcion = document.getElementById("nueva-pauta-descripcion").value.trim();

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

    const respuesta = await fetch("/api/pautas", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ nombre, categoria, descripcion, fecha, responsable })
    });

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
  const usuarioActual = obtenerUsuarioActual();
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

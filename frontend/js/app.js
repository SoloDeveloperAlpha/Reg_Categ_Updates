/* ========================================= */
/* DATOS INICIALES */
/* ========================================= */

function normalizarFecha(fecha) {
  if (!fecha) return new Date().toISOString().slice(0, 10);

  const partes = fecha.split("-");
  if (partes.length === 3 && partes[0].length === 2) {
    return `${partes[2]}-${partes[1]}-${partes[0]}`;
  }

  return fecha;
}

function obtenerDescripcion(contenido) {
  return contenido.Descripcion || contenido.Conclusion || contenido.Detalle ||
    (contenido.Procesos ? JSON.stringify(contenido.Procesos) : "");
}

function crearPautasIniciales() {
  return Object.entries(datos).flatMap(([categoria, elementos], categoriaIndex) =>
    Object.entries(elementos).map(([clave, contenido], elementoIndex) => ({
      id: (categoriaIndex + 1) * 100 + elementoIndex + 1,
      nombre: contenido.name || contenido.title || clave,
      categoria,
      fecha: normalizarFecha(contenido.fecha),
      responsable: "",
      descripcion: obtenerDescripcion(contenido)
    }))
  );
}

let pautas = crearPautasIniciales();
let actualizaciones = [];

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

  const catalogo = crearPautasIniciales();
  const nombresCatalogo = new Set(catalogo.map((pauta) => `${pauta.categoria}|${pauta.nombre}`));

  pautas = catalogo.map((pauta) => {
    const pautaBD = pautasBD.find((item) =>
      item.nombre === pauta.nombre && item.categoria === pauta.categoria
    );

    return pautaBD
      ? {
        ...pauta,
        bdId: pautaBD.id,
        fecha: pautaBD.fecha,
        responsable: pautaBD.responsable,
        descripcion: pautaBD.descripcion || pauta.descripcion
      }
      : pauta;
  });

  pautasBD.forEach((pautaBD) => {
    if (!nombresCatalogo.has(`${pautaBD.categoria}|${pautaBD.nombre}`)) {
      pautas.push({ ...pautaBD, bdId: pautaBD.id });
    }
  });
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

const menuItems = document.querySelectorAll(".menu-item");
const sections = document.querySelectorAll(".section");
const pageTitle = document.getElementById("page-title");
const pageDescription = document.getElementById("page-description");
const logoutButton = document.getElementById("cerrar-sesion");

if (logoutButton) {
  logoutButton.addEventListener("click", () => {
    window.location.href = "/login";
  });
}

function actualizarTitulo(section) {
  const titulos = {
    dashboard: ["Dashboard", "Resumen de las políticas y pautas registradas."],
    pautas: ["Políticas y Pautas", "Consulta las pautas actualmente registradas."],
    actualizacion: ["Nueva actualización", "Registra un nuevo cambio realizado sobre una pauta."],
    "nueva-pauta": ["Nueva pauta", "Registra una pauta nueva dentro de una categoría."],
    historial: ["Historial", "Consulta todos los cambios realizados."]
  };

  if (!titulos[section]) return;
  pageTitle.textContent = titulos[section][0];
  pageDescription.textContent = titulos[section][1];
}

menuItems.forEach((item) => {
  item.addEventListener("click", () => {
    const sectionId = item.dataset.section;
    menuItems.forEach((menu) => menu.classList.remove("active"));
    item.classList.add("active");

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
  });
});

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

function mostrarPautas() {
  const tabla = document.getElementById("tabla-pautas");
  const inputBusqueda = document.getElementById("buscar-pauta");

  const textoBusqueda = (inputBusqueda?.value || "").toLowerCase().trim();

  const pautasFiltradas = pautas.filter((pauta) => {
    const coincideTexto =
      pauta.nombre.toLowerCase().includes(textoBusqueda) ||
      pauta.categoria.toLowerCase().includes(textoBusqueda);

    return coincideTexto;
  });

  tabla.innerHTML = "";

  if (pautasFiltradas.length === 0) {
    tabla.innerHTML = `
      <tr>
        <td colspan="5" class="text-center text-muted py-4">No se encontraron pautas con los filtros actuales.</td>
      </tr>
    `;
    return;
  }

  pautasFiltradas.forEach((pauta) => {
    const fila = document.createElement("tr");
    fila.innerHTML = `
      <td><strong>${pauta.nombre}</strong></td>
      <td>${pauta.categoria}</td>
      <td>${pauta.fecha}</td>
      <td>${pauta.responsable || "-"}</td>
      <td>
        <button type="button" class="btn btn-sm btn-outline-primary" onclick="verHistorial(${pauta.bdId || pauta.id})">Ver historial</button>
      </td>
    `;

    tabla.appendChild(fila);
  });

  actualizarSelectPautas();
}

function actualizarSelectPautas() {
  const categoriaSelect = document.getElementById("pauta-categoria");
  const pautaSelect = document.getElementById("pauta-select");
  if (!categoriaSelect || !pautaSelect) return;

  categoriaSelect.innerHTML = '<option value="">Seleccionar categoría</option>';
  Object.keys(datos).forEach((categoria) => {
    categoriaSelect.innerHTML += `<option value="${categoria}">${categoria}</option>`;
  });

  const nuevaCategoriaSelect = document.getElementById("nueva-pauta-categoria");
  if (nuevaCategoriaSelect) {
    nuevaCategoriaSelect.innerHTML = '<option value="">Seleccionar categoría</option>';
    Object.keys(datos).forEach((categoria) => {
      nuevaCategoriaSelect.innerHTML += `<option value="${categoria}">${categoria}</option>`;
    });
  }

  pautaSelect.innerHTML = '<option value="">Seleccionar pauta</option>';
  pautaSelect.disabled = true;

  actualizarSelectHistorial();
}

function actualizarSelectHijos(categoria) {
  const pautaSelect = document.getElementById("pauta-select");
  if (!pautaSelect) return;

  pautaSelect.innerHTML = '<option value="">Seleccionar pauta</option>';
  pautaSelect.disabled = !categoria;
  if (!categoria || !datos[categoria]) return;

  Object.entries(datos[categoria]).forEach(([clave, contenido]) => {
    const nombre = contenido.name || contenido.title || clave;
    pautaSelect.innerHTML += `<option value="${clave}">${nombre}</option>`;
  });
}

function cargarDetallePautaSeleccionada() {
  const categoria = document.getElementById("pauta-categoria")?.value;
  const clave = document.getElementById("pauta-select")?.value;
  const cambio = document.getElementById("cambio");
  if (!categoria || !clave || !cambio) return;

  const pautaId = (Object.keys(datos).indexOf(categoria) + 1) * 100 +
    Object.keys(datos[categoria]).indexOf(clave) + 1;
  const pauta = pautas.find((item) => item.id === pautaId);
  if (pauta) cambio.value = pauta.descripcion || "";
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
    const clave = document.getElementById("pauta-select").value;
    const pautaId = (Object.keys(datos).indexOf(categoria) + 1) * 100 +
      Object.keys(datos[categoria] || {}).indexOf(clave) + 1;
    if (!categoria || !clave || pautaId <= 0) {
      alert("Debes seleccionar una pauta.");
      return;
    }

    const pauta = pautas.find((item) => item.id === pautaId);
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
  formularioNuevaPauta.addEventListener("submit", async (event) => {
    event.preventDefault();

    const responsable = obtenerUsuarioActual()?.usuario || "";
    const categoria = document.getElementById("nueva-pauta-categoria").value;
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

const buscarPauta = document.getElementById("buscar-pauta");
if (buscarPauta) {
  buscarPauta.addEventListener("input", () => mostrarPautas());
}

const btnNuevaPauta = document.getElementById("btn-nueva-pauta");
if (btnNuevaPauta) {
  btnNuevaPauta.addEventListener("click", () => {
    const menuNuevaPauta = document.querySelector('[data-section="nueva-pauta"]');
    if (menuNuevaPauta) menuNuevaPauta.click();
  });
}

async function actualizarTodo() {
  let agente = localStorage.getItem("usuarioActual");
  const nombreUsuario = document.getElementById("user-name");
  if (nombreUsuario) {
    nombreUsuario.textContent = agente ? JSON.parse(agente).usuario : "Invitado";
  }

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

/* ========================================= */
/* DATOS INICIALES */
/* ========================================= */

<<<<<<< HEAD
let pautas = JSON.parse(
  localStorage.getItem("pautas")
) || [
    {
      id: 1,
      nombre: "Clasificación de errores",
      categoria: "Auditoría",
      version: "1.2",
      fecha: "2026-08-26",
      estado: "activa"
    },
    {
      id: 2,
      nombre: "Validación de tickets",
      categoria: "Tickets",
      version: "2.0",
      fecha: "2026-08-20",
      estado: "activa"
    }
  ];


let actualizaciones = JSON.parse(
  localStorage.getItem("actualizaciones")
) || [
    {
      id: 1,
      pautaId: 1,
      fecha: "2026-08-26",
      reunion: "Reunión semanal 26/08",
      responsable: "Administrador",
      version: "1.2",
      cambio: "Se modificaron los criterios para clasificar errores.",
      observaciones: "Cambio aprobado durante la reunión semanal."
    }
  ];


/* ========================================= */
/* GUARDAR DATOS */
/* ========================================= */

function guardarDatos() {

  localStorage.setItem(
    "pautas",
    JSON.stringify(pautas)
  );

  localStorage.setItem(
    "actualizaciones",
    JSON.stringify(actualizaciones)
  );
}


/* ========================================= */
/* NAVEGACIÓN */
/* ========================================= */

const menuItems = document.querySelectorAll(".menu-item");
const sections = document.querySelectorAll(".section");

const pageTitle = document.getElementById("page-title");
const pageDescription = document.getElementById("page-description");


menuItems.forEach(item => {

  item.addEventListener("click", () => {

    const sectionId = item.dataset.section;


    /* ----------------------------- */
    /* ACTUALIZAR MENU */
    /* ----------------------------- */

    menuItems.forEach(menu => {

      menu.classList.remove("active");

    });

    item.classList.add("active");


    /* ----------------------------- */
    /* MOSTRAR SECCIÓN */
    /* ----------------------------- */

    sections.forEach(section => {

      section.classList.add("d-none");
      section.classList.remove("active");

    });


    const seccionSeleccionada =
      document.getElementById(sectionId);


    if (seccionSeleccionada) {

      seccionSeleccionada.classList.remove("d-none");
      seccionSeleccionada.classList.add("active");

    }


    /* ----------------------------- */
    /* ACTUALIZAR TITULO */
    /* ----------------------------- */

    actualizarTitulo(sectionId);

  });

});


/* ========================================= */
/* TÍTULOS */
/* ========================================= */

function actualizarTitulo(section) {

  const titulos = {

    dashboard: [
      "Dashboard",
      "Resumen de las políticas y pautas registradas."
    ],

    pautas: [
      "Políticas y Pautas",
      "Consulta las pautas actualmente registradas."
    ],

    actualizacion: [
      "Nueva actualización",
      "Registra un nuevo cambio realizado sobre una pauta."
    ],

    historial: [
      "Historial",
      "Consulta todos los cambios realizados."
    ]

  };


  if (!titulos[section]) {
    return;
  }


  pageTitle.textContent =
    titulos[section][0];

  pageDescription.textContent =
    titulos[section][1];
}


/* ========================================= */
/* DASHBOARD */
/* ========================================= */

function actualizarDashboard() {

  document.getElementById(
    "total-pautas"
  ).textContent = pautas.length;


  document.getElementById(
    "total-actualizaciones"
  ).textContent = actualizaciones.length;


  if (actualizaciones.length === 0) {

    document.getElementById(
      "ultima-actualizacion"
    ).textContent = "--";

    mostrarUltimosCambios();

    return;
  }


  const ultima =
    [...actualizaciones]
      .sort((a, b) =>
        new Date(b.fecha) -
        new Date(a.fecha)
      )[0];


  document.getElementById(
    "ultima-actualizacion"
  ).textContent = ultima.fecha;


  mostrarUltimosCambios();
}


/* ========================================= */
/* ÚLTIMOS CAMBIOS */
/* ========================================= */

function mostrarUltimosCambios() {

  const contenedor =
    document.getElementById(
      "ultimos-cambios"
    );


  if (actualizaciones.length === 0) {

    contenedor.innerHTML = `
  < p class="text-muted mb-0" >
    No existen actualizaciones registradas.
            </p >
  `;

    return;
  }


  const ultimas =
    [...actualizaciones]
      .sort((a, b) =>
        new Date(b.fecha) -
        new Date(a.fecha)
      )
      .slice(0, 5);


  contenedor.innerHTML =
    ultimas.map(actualizacion => {

      const pauta =
        pautas.find(
          p => p.id === actualizacion.pautaId
        );


      return `
  <div class="card mb-3 border-start border-primary border-3" >

    <div class="card-body">

      <div class="d-flex justify-content-between align-items-start">

        <div>

          <h5 class="card-title mb-1">
            ${pauta?.nombre || "Pauta eliminada"}
          </h5>

          <small class="text-muted">
            ${actualizacion.fecha}
            · Versión ${actualizacion.version}
          </small>

        </div>

        <span class="badge bg-primary">
          Actualización
        </span>

      </div>

      <p class="card-text mt-3 mb-0">
        ${actualizacion.cambio}
      </p>

    </div>

                </div>
  `;

    }).join("");
}


/* ========================================= */
/* TABLA DE PAUTAS */
/* ========================================= */

function mostrarPautas() {

  const tabla =
    document.getElementById(
      "tabla-pautas"
    );


  const inputBusqueda =
    document.getElementById(
      "buscar-pauta"
    );


  const filtroEstado =
    document.getElementById(
      "filtro-estado"
    );


  const textoBusqueda =
    (inputBusqueda?.value || "")
      .toLowerCase()
      .trim();


  const estadoSeleccionado =
    filtroEstado?.value || "todos";


  const pautasFiltradas =
    pautas.filter(pauta => {

      const coincideTexto =
        pauta.nombre
          .toLowerCase()
          .includes(textoBusqueda)

        ||

        pauta.categoria
          .toLowerCase()
          .includes(textoBusqueda)

        ||

        pauta.version
          .toLowerCase()
          .includes(textoBusqueda);


      const coincideEstado =
        estadoSeleccionado === "todos" ||
        pauta.estado === estadoSeleccionado;


      return coincideTexto && coincideEstado;

    });


  tabla.innerHTML = "";


  if (pautasFiltradas.length === 0) {

    tabla.innerHTML = `
  <tr>

  <td colspan="6"
    class="text-center text-muted py-4">

    No se encontraron pautas
    con los filtros actuales.

  </td>

            </tr >
  `;

    return;
  }


  pautasFiltradas.forEach(pauta => {

    const fila =
      document.createElement("tr");


    const estadoClase =
      pauta.estado === "activa"
        ? "bg-success"
        : "bg-secondary";


    fila.innerHTML = `

  <td>

  <strong>
    ${pauta.nombre}
  </strong>

            </td >

            <td>
                ${pauta.categoria}
            </td>

            <td>

                <span class="badge bg-dark">
                    ${pauta.version}
                </span>

            </td>

            <td>
                ${pauta.fecha}
            </td>

            <td>

                <span class="badge ${estadoClase}">
                    ${pauta.estado}
                </span>

            </td>

            <td>

                <button
                    type="button"
                    class="btn btn-sm btn-outline-primary"
                    onclick="verHistorial(${pauta.id})">

                    Ver historial

                </button>

            </td>

`;


    tabla.appendChild(fila);

  });


  actualizarSelectPautas();
}


/* ========================================= */
/* SELECT DE PAUTAS */
/* ========================================= */

function actualizarSelectPautas() {

  const select =
    document.getElementById(
      "pauta-select"
    );


  if (!select) {
    return;
  }


  select.innerHTML = `
  < option value = "" >
    Seleccionar pauta
        </option >
  `;


  pautas.forEach(pauta => {

    select.innerHTML += `
  < option value = "${pauta.id}" >
    ${pauta.nombre}
            </option >
  `;

  });


  actualizarSelectHistorial();
}


/* ========================================= */
/* SELECT HISTORIAL */
/* ========================================= */

function actualizarSelectHistorial() {

  const select =
    document.getElementById(
      "historial-pauta"
    );


  if (!select) {
    return;
  }


  select.innerHTML = `
  <option value = "todos" >
    Todas las pautas
        </option >
  `;


  pautas.forEach(pauta => {

    select.innerHTML += `
  <option value = "${pauta.id}" >
    ${pauta.nombre}
            </option >
  `;

  });

}


/* ========================================= */
/* REGISTRAR ACTUALIZACIÓN */
/* ========================================= */

const formulario =
  document.getElementById(
    "form-actualizacion"
  );


if (formulario) {

  formulario.addEventListener(
    "submit",
    function (event) {

      event.preventDefault();


      const pautaId =
        Number(
          document.getElementById(
            "pauta-select"
          ).value
        );


      /* Validar pauta */

      if (!pautaId) {

        alert(
          "Debes seleccionar una pauta."
        );

        return;
      }


      const nuevaActualizacion = {

        id: Date.now(),

        pautaId: pautaId,

        fecha:
          document.getElementById(
            "fecha"
          ).value,

        reunion:
          document.getElementById(
            "reunion"
          ).value.trim(),

        responsable:
          document.getElementById(
            "responsable"
          ).value.trim(),

        version:
          document.getElementById(
            "version"
          ).value.trim(),

        cambio:
          document.getElementById(
            "cambio"
          ).value.trim(),

        observaciones:
          document.getElementById(
            "observaciones"
          ).value.trim()

      };


      /* ----------------------------- */
      /* GUARDAR ACTUALIZACIÓN */
      /* ----------------------------- */

      actualizaciones.push(
        nuevaActualizacion
      );


      /* ----------------------------- */
      /* ACTUALIZAR PAUTA */
      /* ----------------------------- */

      const pauta =
        pautas.find(
          p => p.id === pautaId
        );


      if (pauta) {

        pauta.version =
          nuevaActualizacion.version;

        pauta.fecha =
          nuevaActualizacion.fecha;

      }


      /* ----------------------------- */
      /* GUARDAR */
      /* ----------------------------- */

      guardarDatos();


      alert(
        "Actualización registrada correctamente."
      );


      formulario.reset();


      actualizarTodo();


      /* Volver al Dashboard */

      document
        .querySelector(
          '[data-section="dashboard"]'
        )
        ?.click();

    }
  );

}


/* ========================================= */
/* HISTORIAL */
/* ========================================= */

function mostrarHistorial(
  pautaId = "todos"
) {

  const timeline =
    document.getElementById(
      "timeline"
    );


  if (!timeline) {
    return;
  }


  let registros =
    actualizaciones;


  if (pautaId !== "todos") {

    registros =
      actualizaciones.filter(
        a =>
          a.pautaId ===
          Number(pautaId)
      );

  }


  registros =
    [...registros].sort(
      (a, b) =>
        new Date(b.fecha) -
        new Date(a.fecha)
    );


  if (registros.length === 0) {

    timeline.innerHTML = `
  <div class="card shadow-sm" >

    <div class="card-body">

      <p class="text-muted mb-0">
        No existen cambios registrados.
      </p>

    </div>

            </div >

  `;

    return;
  }


  timeline.innerHTML =
    registros.map(registro => {

      const pauta =
        pautas.find(
          p =>
            p.id ===
            registro.pautaId
        );


      return `

  <div class="card shadow-sm mb-3" >

    <div class="card-body">

      <!-- CABECERA -->

      <div class="d-flex flex-column flex-md-row justify-content-between gap-2">

        <div>

          <h5 class="card-title mb-1">

            ${pauta?.nombre || "Pauta eliminada"}

          </h5>

          <div class="text-muted small">

            ${registro.fecha}

            · Versión
            ${registro.version}

            · ${registro.reunion}

          </div>

        </div>


        <span class="badge bg-primary align-self-start">

          Cambio registrado

        </span>

      </div>


      <hr>


        <!-- CAMBIO -->

        <div class="mb-3">

          <h6>
            Cambio realizado
          </h6>

          <p class="mb-0">
            ${registro.cambio}
          </p>

        </div>


        <!-- RESPONSABLE -->

        <div class="mb-3">

          <h6>
            Responsable
          </h6>

          <p class="mb-0 text-muted">

            ${registro.responsable}

          </p>

        </div>


        <!-- OBSERVACIONES -->

        ${registro.observaciones
          ? `

                                    <div>

                                        <h6>
                                            Observaciones
                                        </h6>

                                        <p class="mb-0 text-muted">

                                            ${registro.observaciones}

                                        </p>

                                    </div>

                                `
          : ""
        }

    </div>

                </div>

  `;

    }).join("");
}


/* ========================================= */
/* VER HISTORIAL DE UNA PAUTA */
/* ========================================= */

function verHistorial(pautaId) {

  const menuHistorial =
    document.querySelector(
      '[data-section="historial"]'
    );


  if (!menuHistorial) {
    return;
  }


  menuHistorial.click();


  const selectHistorial =
    document.getElementById(
      "historial-pauta"
    );


  if (selectHistorial) {

    selectHistorial.value =
      pautaId;

  }


  mostrarHistorial(pautaId);
}


/* ========================================= */
/* EVENTO SELECT HISTORIAL */
/* ========================================= */

const historialSelect =
  document.getElementById(
    "historial-pauta"
  );


if (historialSelect) {

  historialSelect.addEventListener(
    "change",
    function () {

      mostrarHistorial(
        this.value
      );

    }
  );

}


/* ========================================= */
/* BÚSQUEDA Y FILTROS */
/* ========================================= */

const buscarPauta =
  document.getElementById(
    "buscar-pauta"
  );


if (buscarPauta) {

  buscarPauta.addEventListener(
    "input",
    function () {

      mostrarPautas();

    }
  );

}


const filtroEstado =
  document.getElementById(
    "filtro-estado"
  );


if (filtroEstado) {

  filtroEstado.addEventListener(
    "change",
    function () {

      mostrarPautas();

    }
  );

}


/* ========================================= */
/* BOTÓN NUEVA PAUTA */
/* ========================================= */

const btnNuevaPauta =
  document.getElementById(
    "btn-nueva-pauta"
  );


if (btnNuevaPauta) {

  btnNuevaPauta.addEventListener(
    "click",
    function () {

      const menuActualizacion =
        document.querySelector(
          '[data-section="actualizacion"]'
        );


      if (menuActualizacion) {

        menuActualizacion.click();

      }

    }
  );

}


/* ========================================= */
/* ACTUALIZAR TODO */
/* ========================================= */

function actualizarTodo() {

  actualizarDashboard();

  mostrarPautas();

  actualizarSelectPautas();

  mostrarHistorial();

}


/* ========================================= */
/* INICIO */
/* ========================================= */

actualizarTodo();

=======
let pautas = JSON.parse(
  localStorage.getItem("pautas")
) || [
    {
      id: 1,
      nombre: "Clasificación de errores",
      categoria: "Auditoría",
      version: "1.2",
      fecha: "2026-08-26",
      estado: "activa"
    },
    {
      id: 2,
      nombre: "Validación de tickets",
      categoria: "Tickets",
      version: "2.0",
      fecha: "2026-08-20",
      estado: "activa"
    }
  ];


let actualizaciones = JSON.parse(
  localStorage.getItem("actualizaciones")
) || [
    {
      id: 1,
      pautaId: 1,
      fecha: "2026-08-26",
      reunion: "Reunión semanal 26/08",
      responsable: "Administrador",
      version: "1.2",
      cambio: "Se modificaron los criterios para clasificar errores.",
      observaciones: "Cambio aprobado durante la reunión semanal."
    }
  ];


/* ========================================= */
/* GUARDAR DATOS */
/* ========================================= */

function guardarDatos() {

  localStorage.setItem(
    "pautas",
    JSON.stringify(pautas)
  );

  localStorage.setItem(
    "actualizaciones",
    JSON.stringify(actualizaciones)
  );
}


/* ========================================= */
/* NAVEGACIÓN */
/* ========================================= */

const menuItems = document.querySelectorAll(".menu-item");
const sections = document.querySelectorAll(".section");

const pageTitle = document.getElementById("page-title");
const pageDescription = document.getElementById("page-description");
const logoutButton = document.getElementById("cerrar-sesion");

logoutButton.addEventListener("click", () => {
  window.location.href = "/login";
});


menuItems.forEach(item => {

  item.addEventListener("click", () => {

    const sectionId = item.dataset.section;


    /* ----------------------------- */
    /* ACTUALIZAR MENU */
    /* ----------------------------- */

    menuItems.forEach(menu => {

      menu.classList.remove("active");

    });

    item.classList.add("active");


    /* ----------------------------- */
    /* MOSTRAR SECCIÓN */
    /* ----------------------------- */

    sections.forEach(section => {

      section.classList.add("d-none");
      section.classList.remove("active");

    });


    const seccionSeleccionada =
      document.getElementById(sectionId);


    if (seccionSeleccionada) {

      seccionSeleccionada.classList.remove("d-none");
      seccionSeleccionada.classList.add("active");

    }


    /* ----------------------------- */
    /* ACTUALIZAR TITULO */
    /* ----------------------------- */

    actualizarTitulo(sectionId);

  });

});


/* ========================================= */
/* TÍTULOS */
/* ========================================= */

function actualizarTitulo(section) {

  const titulos = {

    dashboard: [
      "Dashboard",
      "Resumen de las políticas y pautas registradas."
    ],

    pautas: [
      "Políticas y Pautas",
      "Consulta las pautas actualmente registradas."
    ],

    actualizacion: [
      "Nueva actualización",
      "Registra un nuevo cambio realizado sobre una pauta."
    ],

    historial: [
      "Historial",
      "Consulta todos los cambios realizados."
    ]

  };


  if (!titulos[section]) {
    return;
  }


  pageTitle.textContent =
    titulos[section][0];

  pageDescription.textContent =
    titulos[section][1];
}


/* ========================================= */
/* DASHBOARD */
/* ========================================= */

function actualizarDashboard() {

  document.getElementById(
    "total-pautas"
  ).textContent = pautas.length;


  document.getElementById(
    "total-actualizaciones"
  ).textContent = actualizaciones.length;


  if (actualizaciones.length === 0) {

    document.getElementById(
      "ultima-actualizacion"
    ).textContent = "--";

    mostrarUltimosCambios();

    return;
  }


  const ultima =
    [...actualizaciones]
      .sort((a, b) =>
        new Date(b.fecha) -
        new Date(a.fecha)
      )[0];


  document.getElementById(
    "ultima-actualizacion"
  ).textContent = ultima.fecha;


  mostrarUltimosCambios();
}


/* ========================================= */
/* ÚLTIMOS CAMBIOS */
/* ========================================= */

function mostrarUltimosCambios() {

  const contenedor =
    document.getElementById(
      "ultimos-cambios"
    );


  if (actualizaciones.length === 0) {

    contenedor.innerHTML = `
  < p class="text-muted mb-0" >
    No existen actualizaciones registradas.
            </p >
  `;

    return;
  }


  const ultimas =
    [...actualizaciones]
      .sort((a, b) =>
        new Date(b.fecha) -
        new Date(a.fecha)
      )
      .slice(0, 5);


  contenedor.innerHTML =
    ultimas.map(actualizacion => {

      const pauta =
        pautas.find(
          p => p.id === actualizacion.pautaId
        );


      return `
  <div class="card mb-3 border-start border-primary border-3" >

    <div class="card-body">

      <div class="d-flex justify-content-between align-items-start">

        <div>

          <h5 class="card-title mb-1">
            ${pauta?.nombre || "Pauta eliminada"}
          </h5>

          <small class="text-muted">
            ${actualizacion.fecha}
            · Versión ${actualizacion.version}
          </small>

        </div>

        <span class="badge bg-primary">
          Actualización
        </span>

      </div>

      <p class="card-text mt-3 mb-0">
        ${actualizacion.cambio}
      </p>

    </div>

                </div>
  `;

    }).join("");
}


/* ========================================= */
/* TABLA DE PAUTAS */
/* ========================================= */

function mostrarPautas() {

  const tabla =
    document.getElementById(
      "tabla-pautas"
    );


  const inputBusqueda =
    document.getElementById(
      "buscar-pauta"
    );


  const filtroEstado =
    document.getElementById(
      "filtro-estado"
    );


  const textoBusqueda =
    (inputBusqueda?.value || "")
      .toLowerCase()
      .trim();


  const estadoSeleccionado =
    filtroEstado?.value || "todos";


  const pautasFiltradas =
    pautas.filter(pauta => {

      const coincideTexto =
        pauta.nombre
          .toLowerCase()
          .includes(textoBusqueda)

        ||

        pauta.categoria
          .toLowerCase()
          .includes(textoBusqueda)

        ||

        pauta.version
          .toLowerCase()
          .includes(textoBusqueda);


      const coincideEstado =
        estadoSeleccionado === "todos" ||
        pauta.estado === estadoSeleccionado;


      return coincideTexto && coincideEstado;

    });


  tabla.innerHTML = "";


  if (pautasFiltradas.length === 0) {

    tabla.innerHTML = `
  <tr>

  <td colspan="6"
    class="text-center text-muted py-4">

    No se encontraron pautas
    con los filtros actuales.

  </td>

            </tr >
  `;

    return;
  }


  pautasFiltradas.forEach(pauta => {

    const fila =
      document.createElement("tr");


    const estadoClase =
      pauta.estado === "activa"
        ? "bg-success"
        : "bg-secondary";


    fila.innerHTML = `

  <td>

  <strong>
    ${pauta.nombre}
  </strong>

            </td >

            <td>
                ${pauta.categoria}
            </td>

            <td>

                <span class="badge bg-dark">
                    ${pauta.version}
                </span>

            </td>

            <td>
                ${pauta.fecha}
            </td>

            <td>

                <span class="badge ${estadoClase}">
                    ${pauta.estado}
                </span>

            </td>

            <td>

                <button
                    type="button"
                    class="btn btn-sm btn-outline-primary"
                    onclick="verHistorial(${pauta.id})">

                    Ver historial

                </button>

            </td>

`;


    tabla.appendChild(fila);

  });


  actualizarSelectPautas();
}


/* ========================================= */
/* SELECT DE PAUTAS */
/* ========================================= */

function actualizarSelectPautas() {

  const select =
    document.getElementById(
      "pauta-select"
    );


  if (!select) {
    return;
  }


  select.innerHTML = `
  < option value = "" >
    Seleccionar pauta
        </option >
  `;


  pautas.forEach(pauta => {

    select.innerHTML += `
  < option value = "${pauta.id}" >
    ${pauta.nombre}
            </option >
  `;

  });


  actualizarSelectHistorial();
}


/* ========================================= */
/* SELECT HISTORIAL */
/* ========================================= */

function actualizarSelectHistorial() {

  const select =
    document.getElementById(
      "historial-pauta"
    );


  if (!select) {
    return;
  }


  select.innerHTML = `
  <option value = "todos" >
    Todas las pautas
        </option >
  `;


  pautas.forEach(pauta => {

    select.innerHTML += `
  <option value = "${pauta.id}" >
    ${pauta.nombre}
            </option >
  `;

  });

}


/* ========================================= */
/* REGISTRAR ACTUALIZACIÓN */
/* ========================================= */

const formulario =
  document.getElementById(
    "form-actualizacion"
  );


if (formulario) {

  formulario.addEventListener(
    "submit",
    function (event) {

      event.preventDefault();


      const pautaId =
        Number(
          document.getElementById(
            "pauta-select"
          ).value
        );


      /* Validar pauta */

      if (!pautaId) {

        alert(
          "Debes seleccionar una pauta."
        );

        return;
      }


      const nuevaActualizacion = {

        id: Date.now(),

        pautaId: pautaId,

        fecha:
          document.getElementById(
            "fecha"
          ).value,

        reunion:
          document.getElementById(
            "reunion"
          ).value.trim(),

        responsable:
          document.getElementById(
            "responsable"
          ).value.trim(),

        version:
          document.getElementById(
            "version"
          ).value.trim(),

        cambio:
          document.getElementById(
            "cambio"
          ).value.trim(),

        observaciones:
          document.getElementById(
            "observaciones"
          ).value.trim()

      };


      /* ----------------------------- */
      /* GUARDAR ACTUALIZACIÓN */
      /* ----------------------------- */

      actualizaciones.push(
        nuevaActualizacion
      );


      /* ----------------------------- */
      /* ACTUALIZAR PAUTA */
      /* ----------------------------- */

      const pauta =
        pautas.find(
          p => p.id === pautaId
        );


      if (pauta) {

        pauta.version =
          nuevaActualizacion.version;

        pauta.fecha =
          nuevaActualizacion.fecha;

      }


      /* ----------------------------- */
      /* GUARDAR */
      /* ----------------------------- */

      guardarDatos();


      alert(
        "Actualización registrada correctamente."
      );


      formulario.reset();


      actualizarTodo();


      /* Volver al Dashboard */

      document
        .querySelector(
          '[data-section="dashboard"]'
        )
        ?.click();

    }
  );

}


/* ========================================= */
/* HISTORIAL */
/* ========================================= */

function mostrarHistorial(
  pautaId = "todos"
) {

  const timeline =
    document.getElementById(
      "timeline"
    );


  if (!timeline) {
    return;
  }


  let registros =
    actualizaciones;


  if (pautaId !== "todos") {

    registros =
      actualizaciones.filter(
        a =>
          a.pautaId ===
          Number(pautaId)
      );

  }


  registros =
    [...registros].sort(
      (a, b) =>
        new Date(b.fecha) -
        new Date(a.fecha)
    );


  if (registros.length === 0) {

    timeline.innerHTML = `
  <div class="card shadow-sm" >

    <div class="card-body">

      <p class="text-muted mb-0">
        No existen cambios registrados.
      </p>

    </div>

            </div >

  `;

    return;
  }


  timeline.innerHTML =
    registros.map(registro => {

      const pauta =
        pautas.find(
          p =>
            p.id ===
            registro.pautaId
        );


      return `

  <div class="card shadow-sm mb-3" >

    <div class="card-body">

      <!-- CABECERA -->

      <div class="d-flex flex-column flex-md-row justify-content-between gap-2">

        <div>

          <h5 class="card-title mb-1">

            ${pauta?.nombre || "Pauta eliminada"}

          </h5>

          <div class="text-muted small">

            ${registro.fecha}

            · Versión
            ${registro.version}

            · ${registro.reunion}

          </div>

        </div>


        <span class="badge bg-primary align-self-start">

          Cambio registrado

        </span>

      </div>


      <hr>


        <!-- CAMBIO -->

        <div class="mb-3">

          <h6>
            Cambio realizado
          </h6>

          <p class="mb-0">
            ${registro.cambio}
          </p>

        </div>


        <!-- RESPONSABLE -->

        <div class="mb-3">

          <h6>
            Responsable
          </h6>

          <p class="mb-0 text-muted">

            ${registro.responsable}

          </p>

        </div>


        <!-- OBSERVACIONES -->

        ${registro.observaciones
          ? `

                                    <div>

                                        <h6>
                                            Observaciones
                                        </h6>

                                        <p class="mb-0 text-muted">

                                            ${registro.observaciones}

                                        </p>

                                    </div>

                                `
          : ""
        }

    </div>

                </div>

  `;

    }).join("");
}


/* ========================================= */
/* VER HISTORIAL DE UNA PAUTA */
/* ========================================= */

function verHistorial(pautaId) {

  const menuHistorial =
    document.querySelector(
      '[data-section="historial"]'
    );


  if (!menuHistorial) {
    return;
  }


  menuHistorial.click();


  const selectHistorial =
    document.getElementById(
      "historial-pauta"
    );


  if (selectHistorial) {

    selectHistorial.value =
      pautaId;

  }


  mostrarHistorial(pautaId);
}


/* ========================================= */
/* EVENTO SELECT HISTORIAL */
/* ========================================= */

const historialSelect =
  document.getElementById(
    "historial-pauta"
  );


if (historialSelect) {

  historialSelect.addEventListener(
    "change",
    function () {

      mostrarHistorial(
        this.value
      );

    }
  );

}


/* ========================================= */
/* BÚSQUEDA Y FILTROS */
/* ========================================= */

const buscarPauta =
  document.getElementById(
    "buscar-pauta"
  );


if (buscarPauta) {

  buscarPauta.addEventListener(
    "input",
    function () {

      mostrarPautas();

    }
  );

}


const filtroEstado =
  document.getElementById(
    "filtro-estado"
  );


if (filtroEstado) {

  filtroEstado.addEventListener(
    "change",
    function () {

      mostrarPautas();

    }
  );

}


/* ========================================= */
/* BOTÓN NUEVA PAUTA */
/* ========================================= */

const btnNuevaPauta =
  document.getElementById(
    "btn-nueva-pauta"
  );


if (btnNuevaPauta) {

  btnNuevaPauta.addEventListener(
    "click",
    function () {

      const menuActualizacion =
        document.querySelector(
          '[data-section="actualizacion"]'
        );


      if (menuActualizacion) {

        menuActualizacion.click();

      }

    }
  );

}


/* ========================================= */
/* ACTUALIZAR TODO */
/* ========================================= */

function actualizarTodo() {

  actualizarDashboard();

  mostrarPautas();

  actualizarSelectPautas();

  mostrarHistorial();

}


/* ========================================= */
/* INICIO */
/* ========================================= */

actualizarTodo();

>>>>>>> b9307ca57d6bbb8bef152ff6c4edba9ef8ff17cc
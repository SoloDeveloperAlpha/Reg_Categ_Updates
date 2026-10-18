(function () {
  const TIPOS = {
    success: { icono: "bi-check-circle", titulo: "Listo" },
    warning: { icono: "bi-exclamation-triangle", titulo: "Atención" },
    danger: { icono: "bi-x-circle", titulo: "Ocurrió un problema" },
    info: { icono: "bi-info-circle", titulo: "Aviso" }
  };

  function crearModal() {
    const contenedor = document.createElement("div");
    contenedor.className = "modal fade";
    contenedor.tabIndex = -1;
    contenedor.setAttribute("aria-hidden", "true");
    contenedor.innerHTML = `
      <div class="modal-dialog modal-dialog-centered">
        <div class="modal-content border-0 shadow">
          <div class="modal-header border-0 pb-0">
            <h2 class="modal-title h5 d-flex align-items-center gap-2">
              <i data-modal-icono aria-hidden="true"></i><span data-modal-titulo></span>
            </h2>
            <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Cerrar"></button>
          </div>
          <div class="modal-body text-body-secondary" data-modal-mensaje></div>
          <div class="modal-footer border-0 pt-0">
            <button type="button" class="btn btn-outline-secondary" data-modal-cancelar data-bs-dismiss="modal">Cancelar</button>
            <button type="button" class="btn btn-primary" data-modal-aceptar>Aceptar</button>
          </div>
        </div>
      </div>`;
    document.body.appendChild(contenedor);
    return contenedor;
  }

  function abrir({ mensaje, tipo, titulo, confirmar, textoAceptar }) {
    return new Promise((resolve) => {
      const elemento = crearModal();
      const config = TIPOS[tipo] || TIPOS.info;
      const icono = elemento.querySelector("[data-modal-icono]");
      const botonAceptar = elemento.querySelector("[data-modal-aceptar]");
      icono.className = `bi ${config.icono} text-${tipo in TIPOS ? tipo : "info"}`;
      elemento.querySelector("[data-modal-titulo]").textContent = titulo || config.titulo;
      elemento.querySelector("[data-modal-mensaje]").textContent = mensaje;
      elemento.querySelector("[data-modal-cancelar]").classList.toggle("d-none", !confirmar);
      botonAceptar.textContent = textoAceptar || "Aceptar";
      if (tipo === "danger" && confirmar) botonAceptar.className = "btn btn-danger";

      let aceptado = false;
      const modal = new bootstrap.Modal(elemento);
      botonAceptar.addEventListener("click", () => {
        aceptado = true;
        modal.hide();
      });
      elemento.addEventListener("shown.bs.modal", () => botonAceptar.focus());
      elemento.addEventListener("hidden.bs.modal", () => {
        modal.dispose();
        elemento.remove();
        resolve(aceptado);
      });
      modal.show();
    });
  }

  window.mostrarAviso = (mensaje, tipo = "info", titulo) =>
    abrir({ mensaje: String(mensaje ?? ""), tipo, titulo, confirmar: false });

  window.confirmarAccion = (mensaje, { titulo = "Confirmar acción", textoAceptar = "Eliminar", tipo = "danger" } = {}) =>
    abrir({ mensaje: String(mensaje ?? ""), tipo, titulo, confirmar: true, textoAceptar });
})();

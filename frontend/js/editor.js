(function () {
  const ETIQUETAS = new Set(["B", "STRONG", "I", "EM", "U", "S", "STRIKE", "DEL", "BR", "P", "DIV", "UL", "OL", "LI", "FONT"]);
  const COLOR = /^(#[0-9a-f]{3,8}|rgb\(\s*\d{1,3}\s*,\s*\d{1,3}\s*,\s*\d{1,3}\s*\)|[a-z]{3,20})$/i;
  const HAY_ETIQUETAS = /<\/?[a-z][^>]*>/i;

  function escaparHtml(texto) {
    return texto.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  }

  function textoAHtml(valor) {
    const texto = String(valor ?? "");
    if (HAY_ETIQUETAS.test(texto)) return texto;
    return escaparHtml(texto).replace(/\r?\n/g, "<br>");
  }

  function limpiarNodo(origen, destino) {
    origen.childNodes.forEach((nodo) => {
      if (nodo.nodeType === Node.TEXT_NODE) {
        destino.appendChild(document.createTextNode(nodo.textContent));
        return;
      }
      if (nodo.nodeType !== Node.ELEMENT_NODE) return;
      if (!ETIQUETAS.has(nodo.tagName)) {
        if (!["SCRIPT", "STYLE"].includes(nodo.tagName)) limpiarNodo(nodo, destino);
        return;
      }
      const copia = document.createElement(nodo.tagName);
      if (nodo.tagName === "FONT") {
        const color = nodo.getAttribute("color")?.trim();
        const tamano = nodo.getAttribute("size")?.trim();
        if (color && COLOR.test(color)) copia.setAttribute("color", color);
        if (tamano && /^[1-7]$/.test(tamano)) copia.setAttribute("size", tamano);
      }
      limpiarNodo(nodo, copia);
      destino.appendChild(copia);
    });
  }

  function sanitizarHtml(html) {
    const documento = new DOMParser().parseFromString(`<body>${html}</body>`, "text/html");
    const contenedor = document.createElement("div");
    limpiarNodo(documento.body, contenedor);
    return contenedor.innerHTML;
  }

  function htmlSeguro(valor) {
    return sanitizarHtml(textoAHtml(valor));
  }

  const BOTONES = [
    { comando: "bold", icono: "bi-type-bold", titulo: "Negrita" },
    { comando: "italic", icono: "bi-type-italic", titulo: "Cursiva" },
    { comando: "underline", icono: "bi-type-underline", titulo: "Subrayado" },
    { comando: "strikeThrough", icono: "bi-type-strikethrough", titulo: "Tachado" },
    { separador: true },
    { comando: "insertUnorderedList", icono: "bi-list-ul", titulo: "Lista con viñetas" },
    { comando: "insertOrderedList", icono: "bi-list-ol", titulo: "Lista numerada" }
  ];

  const TAMANOS = [
    ["2", "Pequeño"],
    ["3", "Normal"],
    ["5", "Grande"],
    ["6", "Muy grande"]
  ];

  function crearEditor(textarea) {
    const contenedor = document.createElement("div");
    contenedor.className = "editor-enriquecido";
    const barra = document.createElement("div");
    barra.className = "editor-enriquecido-barra d-flex flex-wrap align-items-center gap-1 p-1 border-bottom";
    barra.setAttribute("role", "toolbar");
    barra.setAttribute("aria-label", "Formato de texto");

    const area = document.createElement("div");
    area.className = "editor-enriquecido-contenido form-control";
    area.contentEditable = "true";
    area.setAttribute("role", "textbox");
    area.setAttribute("aria-multiline", "true");
    area.dataset.placeholder = textarea.placeholder || "";
    const etiqueta = textarea.id && document.querySelector(`label[for="${textarea.id}"]`);
    if (etiqueta) {
      etiqueta.id = etiqueta.id || `${textarea.id}-etiqueta`;
      area.setAttribute("aria-labelledby", etiqueta.id);
      etiqueta.addEventListener("click", () => area.focus());
    }
    area.style.minHeight = `${Math.max(Number(textarea.rows) || 4, 3) * 1.6}rem`;

    const requerido = textarea.required;
    textarea.required = false;

    let rangoGuardado = null;
    const guardarRango = () => {
      const seleccion = window.getSelection();
      if (seleccion.rangeCount && area.contains(seleccion.anchorNode)) rangoGuardado = seleccion.getRangeAt(0).cloneRange();
    };
    const restaurarRango = () => {
      area.focus();
      if (!rangoGuardado) return;
      const seleccion = window.getSelection();
      seleccion.removeAllRanges();
      seleccion.addRange(rangoGuardado);
    };

    const botones = [];
    function actualizarEstado() {
      botones.forEach(([comando, boton]) => {
        let activo = false;
        try { activo = document.queryCommandState(comando); } catch (error) { /* sin soporte */ }
        boton.classList.toggle("active", activo && area.contains(window.getSelection().anchorNode));
      });
    }

    const aplicar = (comando, valor = null) => {
      restaurarRango();
      document.execCommand("styleWithCSS", false, false);
      document.execCommand(comando, false, valor);
      guardarRango();
      actualizarEstado();
      area.dispatchEvent(new Event("input"));
    };

    BOTONES.forEach((definicion) => {
      if (definicion.separador) {
        const separador = document.createElement("span");
        separador.className = "editor-enriquecido-separador";
        separador.setAttribute("aria-hidden", "true");
        barra.appendChild(separador);
        return;
      }
      const boton = document.createElement("button");
      boton.type = "button";
      boton.className = "btn btn-sm btn-light";
      boton.title = definicion.titulo;
      boton.setAttribute("aria-label", definicion.titulo);
      boton.innerHTML = `<i class="bi ${definicion.icono}" aria-hidden="true"></i>`;
      boton.addEventListener("mousedown", (evento) => evento.preventDefault());
      boton.addEventListener("click", () => aplicar(definicion.comando));
      barra.appendChild(boton);
      botones.push([definicion.comando, boton]);
    });

    const selectorTamano = document.createElement("select");
    selectorTamano.className = "form-select form-select-sm editor-enriquecido-tamano";
    selectorTamano.title = "Tamaño de letra";
    selectorTamano.setAttribute("aria-label", "Tamaño de letra");
    TAMANOS.forEach(([valor, texto]) => selectorTamano.add(new Option(texto, valor, false, valor === "3")));
    selectorTamano.addEventListener("mousedown", guardarRango);
    selectorTamano.addEventListener("change", () => {
      aplicar("fontSize", selectorTamano.value);
      selectorTamano.value = "3";
    });

    const etiquetaColor = document.createElement("label");
    etiquetaColor.className = "btn btn-sm btn-light editor-enriquecido-color mb-0";
    etiquetaColor.title = "Color de letra";
    etiquetaColor.innerHTML = '<i class="bi bi-palette" aria-hidden="true"></i>';
    const selectorColor = document.createElement("input");
    selectorColor.type = "color";
    selectorColor.value = "#2b5bd7";
    selectorColor.className = "editor-enriquecido-color-input";
    selectorColor.setAttribute("aria-label", "Color de letra");
    selectorColor.addEventListener("mousedown", guardarRango);
    selectorColor.addEventListener("change", () => aplicar("foreColor", selectorColor.value));
    etiquetaColor.appendChild(selectorColor);

    const botonLimpiar = document.createElement("button");
    botonLimpiar.type = "button";
    botonLimpiar.className = "btn btn-sm btn-light";
    botonLimpiar.title = "Quitar formato";
    botonLimpiar.setAttribute("aria-label", "Quitar formato");
    botonLimpiar.innerHTML = '<i class="bi bi-eraser" aria-hidden="true"></i>';
    botonLimpiar.addEventListener("mousedown", (evento) => evento.preventDefault());
    botonLimpiar.addEventListener("click", () => aplicar("removeFormat"));

    barra.append(selectorTamano, etiquetaColor, botonLimpiar);

    const estaVacio = () => !area.textContent.trim() && !area.querySelector("ul, ol");
    const marcarVacio = () => area.classList.toggle("is-empty", estaVacio());
    const marcarInvalido = (invalido) => area.classList.toggle("is-invalid", invalido);

    area.addEventListener("input", () => {
      marcarVacio();
      if (!estaVacio()) marcarInvalido(false);
    });
    area.addEventListener("keyup", () => { guardarRango(); actualizarEstado(); });
    area.addEventListener("mouseup", () => { guardarRango(); actualizarEstado(); });
    area.addEventListener("blur", guardarRango);
    area.addEventListener("paste", (evento) => {
      evento.preventDefault();
      const texto = evento.clipboardData?.getData("text/plain") || "";
      document.execCommand("insertText", false, texto);
    });

    const formulario = textarea.form;
    if (formulario) {
      formulario.addEventListener("submit", (evento) => {
        if (requerido && estaVacio()) {
          evento.preventDefault();
          evento.stopImmediatePropagation();
          marcarInvalido(true);
          area.focus();
        }
      });
      formulario.addEventListener("reset", () => {
        area.innerHTML = "";
        marcarVacio();
        marcarInvalido(false);
      });
    }

    Object.defineProperty(textarea, "value", {
      configurable: true,
      get: () => (estaVacio() ? "" : sanitizarHtml(area.innerHTML)),
      set: (valor) => {
        area.innerHTML = htmlSeguro(valor);
        marcarVacio();
        marcarInvalido(false);
      }
    });

    contenedor.append(barra, area);
    textarea.hidden = true;
    textarea.insertAdjacentElement("afterend", contenedor);
    area.innerHTML = htmlSeguro(textarea.defaultValue);
    marcarVacio();
  }

  window.escaparHtml = escaparHtml;
  window.htmlSeguro = htmlSeguro;
  window.crearEditorEnriquecido = crearEditor;

  // El script se carga al final del <body>, así que los textarea ya existen.
  document.querySelectorAll("textarea[data-editor-enriquecido]").forEach(crearEditor);
})();

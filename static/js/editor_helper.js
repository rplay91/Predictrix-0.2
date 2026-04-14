// Manual rich text editor helper (contenteditable + toolbar)
(function () {
  const PLACEHOLDER_TEXT = "";

  const PREDICTION_TOKEN = "[KALIMAT PREDIKSI]";
  const ALT_PREDICTION_TOKEN = "[PREDsCTED SENTENCE]";

  const FONT_FAMILIES = [
    { label: "Arial", value: "Arial, sans-serif" },
    { label: "Georgia", value: "Georgia, serif" },
    { label: "Times New Roman", value: "'Times New Roman', serif" },
    { label: "Tahoma", value: "Tahoma, sans-serif" },
    { label: "Verdana", value: "Verdana, sans-serif" },
  ];

  const FONT_SIZES = [12, 14, 16, 18, 20, 24, 28, 32];
  const PLACEHOLDER_TEXT_COMPACT = "";
  const HEADINGS_ONLY_TEXT = "";

  function escapeHtml(value = "") {
    return String(value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function stripSectionMarkers(text = "") {
    return String(text).replace(/={3,}/g, "").trim();
  }

  function normalizeInitialContent(html, text) {
    return html;
  }

  let activeEditor = null;

  function getEditorRootEl() {
    return document.getElementById("editor");
  }

  function getSectionEditors(root) {
    const container = root || getEditorRootEl();
    if (!container) return [];
    const sections = container.querySelectorAll(".editor-section-field");
    return sections.length ? Array.from(sections) : [container];
  }

  function getEditor() {
    if (activeEditor) return activeEditor;
    const root = getEditorRootEl();
    if (!root) return null;
    if (root.classList.contains("editor-section-field")) return root;
    const first = root.querySelector(".editor-section-field");
    return first || root;
  }

  window.getActiveEditorElement = function getActiveEditorElement() {
    return getEditor();
  };

  function updatePlaceholderState(editor) {
    editor.classList.remove("is-empty");
  }

  function isOnlyPlaceholder(editor) {
    return !(editor && (editor.textContent || "").trim());
  }

  function ensureDefaultContent(editor) {
    updatePlaceholderState(editor);
  }

  function flattenSectionHtml(html = "") {
    const temp = document.createElement("div");
    temp.innerHTML = html || "";
    const sections = temp.querySelectorAll("[data-section]");
    if (!sections.length) return html || "";
    const combined = Array.from(sections)
      .map((section) => section.innerHTML || "")
      .filter((part) => part.trim())
      .join("<div><br></div>");
    return combined || temp.textContent || "";
  }

  function exec(command, value = null) {
    document.execCommand(command, false, value);
  }

  function applyFontSize(px) {
    exec("fontSize", 7);
    const editor = getEditor();
    if (!editor) return;
    const fonts = editor.querySelectorAll('font[size="7"]');
    fonts.forEach((font) => {
      const span = document.createElement("span");
      span.style.fontSize = `${px}px`;
      span.innerHTML = font.innerHTML;
      font.parentNode.replaceChild(span, font);
    });
  }

  function createToolbar(editor) {
    const container = editor.closest(".editor-container") || editor.parentElement;
    if (!container) return;
    const parent = container.parentElement;
    if (!parent) return;
    if (parent.querySelector(".editor-toolbar")) return;
    let toolbarContainer = parent.querySelector(".editor-toolbar-container");
    if (!toolbarContainer) {
      toolbarContainer = document.createElement("div");
      toolbarContainer.className = "editor-toolbar-container";
      parent.insertBefore(toolbarContainer, container);
    }

    const toolbar = document.createElement("div");
    toolbar.className = "editor-toolbar";
    toolbar.innerHTML = `
      <div class="tool-group">
        <select class="tool-select tool-font" aria-label="Font">
          ${FONT_FAMILIES.map(
            (font) => `<option value="${font.value}">${font.label}</option>`
          ).join("")}
        </select>
        <select class="tool-select tool-size" aria-label="Ukuran">
          ${FONT_SIZES.map((size) => `<option value="${size}">${size}</option>`).join("")}
        </select>
        <select class="tool-select tool-heading" aria-label="Heading">
          <option value="P">Paragraf</option>
          <option value="H1">Heading 1</option>
          <option value="H2">Heading 2</option>
          <option value="H3">Heading 3</option>
        </select>
      </div>
      <div class="tool-group">
        <button type="button" class="tool-btn" data-cmd="bold"><b>B</b></button>
        <button type="button" class="tool-btn" data-cmd="italic"><i>I</i></button>
        <button type="button" class="tool-btn" data-cmd="underline"><u>U</u></button>
      </div>
      <div class="tool-group">
        <button type="button" class="tool-btn" data-cmd="justifyLeft">Left</button>
        <button type="button" class="tool-btn" data-cmd="justifyCenter">Center</button>
        <button type="button" class="tool-btn" data-cmd="justifyRight">Right</button>
        <button type="button" class="tool-btn" data-cmd="justifyFull">Justify</button>
      </div>
      <div class="tool-group">
        <label class="tool-color">
          Text
          <input type="color" class="tool-color-input" data-color="foreColor" value="#111827" />
        </label>
      </div>
    `;

    toolbarContainer.appendChild(toolbar);

    toolbar.addEventListener("click", (event) => {
      const button = event.target.closest(".tool-btn");
      if (!button) return;
      const cmd = button.dataset.cmd;
      if (cmd) {
        const targetEditor = getEditor();
        if (targetEditor) targetEditor.focus();
        exec(cmd);
      }
    });

    toolbar.querySelector(".tool-font").addEventListener("change", (event) => {
      const value = event.target.value;
      const targetEditor = getEditor();
      if (targetEditor) targetEditor.focus();
      exec("fontName", value);
    });

    toolbar.querySelector(".tool-size").addEventListener("change", (event) => {
      const value = parseInt(event.target.value, 10);
      const targetEditor = getEditor();
      if (targetEditor) targetEditor.focus();
      applyFontSize(value);
    });

    toolbar.querySelector(".tool-heading").addEventListener("change", (event) => {
      const tag = event.target.value;
      const targetEditor = getEditor();
      if (targetEditor) targetEditor.focus();
      exec("formatBlock", tag);
    });

    toolbar.querySelectorAll(".tool-color-input").forEach((input) => {
      input.addEventListener("input", (event) => {
        const cmd = event.target.dataset.color;
        const color = event.target.value;
        const targetEditor = getEditor();
        if (targetEditor) targetEditor.focus();
        exec(cmd, color);
      });
    });

    toolbar.querySelector("[data-link]").addEventListener("click", () => {
      const url = prompt("Masukkan URL:");
      if (url) {
        exec("createLink", url);
      }
      const targetEditor = getEditor();
      if (targetEditor) targetEditor.focus();
    });
  }

  function replaceTokenInHtml(html, replacement) {
    if (!html) return html;
    const spanRegex = /<span class="highlighted-text prediction-mark">.*?<\/span>/gi;
    const tokenRegex = new RegExp(PREDICTION_TOKEN.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "g");
    const altTokenRegex = new RegExp(ALT_PREDICTION_TOKEN.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "g");
    let updated = html.replace(spanRegex, ` ${replacement} `);
    updated = updated.replace(tokenRegex, ` ${replacement} `);
    updated = updated.replace(altTokenRegex, ` ${replacement} `);
    return updated.replace(/\s{2,}/g, " ").trim();
  }

  function replaceTokenInDom(editor, replacement) {
    if (!editor) return false;
    let replaced = false;
    const predictedSpans = editor.querySelectorAll(".prediction-mark");
    predictedSpans.forEach((span) => {
      const textNode = document.createTextNode(` ${replacement} `);
      span.parentNode.replaceChild(textNode, span);
      replaced = true;
    });

    const walker = document.createTreeWalker(editor, NodeFilter.SHOW_TEXT, null);
    const token = PREDICTION_TOKEN;
    const altToken = ALT_PREDICTION_TOKEN;
    while (walker.nextNode()) {
      const node = walker.currentNode;
      if (!node.nodeValue) continue;
      if (node.nodeValue.includes(token) || node.nodeValue.includes(altToken)) {
        let updated = node.nodeValue.replaceAll(token, ` ${replacement} `);
        updated = updated.replaceAll(altToken, ` ${replacement} `);
        updated = updated.replace(/\s{2,}/g, " ").trim();
        node.nodeValue = updated;
        replaced = true;
      }
    }

    return replaced;
  }

  window.getEditorRoot = function getEditorRoot() {
    return getEditorRootEl();
  };

  window.getEditorHtml = function getEditorHtml() {
    const root = getEditor();
    return root ? root.innerHTML : "";
  };

  window.getEditorText = function getEditorText() {
    const root = getEditor();
    return root ? root.textContent || "" : "";
  };

  window.getCombinedEditorText = function getCombinedEditorText() {
    const root = getEditorRootEl();
    return root ? root.textContent || "" : "";
  };

  window.getCombinedEditorHtml = function getCombinedEditorHtml() {
    const root = getEditorRootEl();
    return root ? root.innerHTML || "" : "";
  };

  window.setEditorHtml = function setEditorHtml(html) {
    const root = getEditor();
    if (root) {
      const normalized = flattenSectionHtml(html || "");
      root.innerHTML = normalized || "";
      updatePlaceholderState(root);
    }
  };

  window.getEditorContentForSave = function getEditorContentForSave() {
    const editor = getEditor();
    if (!editor) return "";
    if (isOnlyPlaceholder(editor)) return "";
    return editor.innerHTML || "";
  };

  window.setEditorEditable = function setEditorEditable(isEditable) {
    const root = getEditorRootEl();
    if (!root) return;
    root.contentEditable = isEditable ? "true" : "false";
  };

  window.normalizeEditorContent = function normalizeEditorContent(html) {
    const temp = document.createElement("div");
    temp.innerHTML = html || "";
    const text = (temp.textContent || "").trim();
    return normalizeInitialContent(temp.innerHTML, text);
  };

  window.insertPredictionToken = function insertPredictionToken() {
    const editor = getEditor();
    if (!editor) return;
    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0) return;
    const range = selection.getRangeAt(0);
    const marker = document.createTextNode(` ${PREDICTION_TOKEN} `);
    range.insertNode(marker);
  };

  window.replacePredictionToken = function replacePredictionToken(replacement) {
    const editor = getEditor();
    const replaced = replaceTokenInDom(editor, replacement);
    if (replaced) return true;
    const html = window.getEditorHtml();
    const updated = replaceTokenInHtml(html, replacement);
    window.setEditorHtml(updated);
    return html !== updated;
  };

  window.removePredictionToken = function removePredictionToken() {
    const editor = getEditor();
    const removed = replaceTokenInDom(editor, "");
    if (removed) return true;
    const html = window.getEditorHtml();
    const updated = replaceTokenInHtml(html, "");
    window.setEditorHtml(updated);
    return html !== updated;
  };

  window.initRichTextEditor = function initRichTextEditor() {
    try {
      const root = getEditorRootEl();
      if (!root || root.dataset.manualEditorInitialized === "true") {
        return;
      }
      const sections = getSectionEditors(root);
      if (sections.length > 1) {
        sections.forEach((section) => {
          section.setAttribute("contenteditable", "true");
          section.addEventListener("focus", () => {
            activeEditor = section;
            updatePlaceholderState(section);
          });
          section.addEventListener("click", () => {
            activeEditor = section;
          });
          section.addEventListener("input", () => updatePlaceholderState(section));
          section.addEventListener("blur", () => updatePlaceholderState(section));
        });
        activeEditor = sections[0];
        createToolbar(root);
        sections.forEach((section) => ensureDefaultContent(section));
      } else {
        const editor = getEditor();
        if (!editor) return;
        editor.setAttribute("contenteditable", "true");
        createToolbar(editor);
        ensureDefaultContent(editor);
        editor.addEventListener("input", () => updatePlaceholderState(editor));
        editor.addEventListener("focus", () => updatePlaceholderState(editor));
        editor.addEventListener("blur", () => updatePlaceholderState(editor));
      }
      root.dataset.manualEditorInitialized = "true";
    } catch (error) {
      // console.error("Manual editor init failed:", error);
    }
  };
})();

(() => {
  const MAX_CARDS = 100;

  const essayList = document.getElementById("essayList");
  const addCardBtn = document.getElementById("addCardBtn");
  const addManyBtn = document.getElementById("addManyBtn");
  const clearAllBtn = document.getElementById("clearAllBtn");
  const runAllBtn = document.getElementById("runAllBtn");

  const totalCount = document.getElementById("totalCount");
  const successCount = document.getElementById("successCount");
  const errorCount = document.getElementById("errorCount");
  const pendingCount = document.getElementById("pendingCount");

  function updateSummary() {
    const cards = [...essayList.querySelectorAll(".essay-card")];
    totalCount.textContent = cards.length;
    let success = 0;
    let error = 0;
    let pending = 0;

    cards.forEach((card) => {
      const state = card.dataset.state || "idle";
      if (state === "success") success += 1;
      else if (state === "error") error += 1;
      else pending += 1;
    });

    successCount.textContent = success;
    errorCount.textContent = error;
    pendingCount.textContent = pending;
  }

  function setCardState(card, state) {
    card.dataset.state = state;
    card.classList.remove("border-success", "border-danger", "border-warning");
    if (state === "success") {
      card.classList.add("border", "border-success");
    } else if (state === "error") {
      card.classList.add("border", "border-danger");
    } else if (state === "running") {
      card.classList.add("border", "border-warning");
    } else {
      card.classList.remove("border");
    }
    updateSummary();
  }

  function setStatus(card, message, tone = "muted") {
    const status = card.querySelector(".card-status");
    status.textContent = message;
    status.className = `card-status small text-${tone}`;
  }

  function parseImages(raw) {
    if (!raw || !raw.trim()) return [];
    try {
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    } catch (err) {
      return [];
    }
  }

  function getCardData(card) {
    const sid = card.querySelector(".input-sid").value.trim();
    const eid = card.querySelector(".input-eid").value.trim();
    const title = card.querySelector(".input-title").value.trim();
    const history = card.querySelector(".input-history").value.trim();
    const current = card.querySelector(".input-current").value.trim();
    const imagesRaw = card.querySelector(".input-images").value;

    return {
      sid,
      eid: eid ? Number(eid) : null,
      title,
      history,
      current,
      images: parseImages(imagesRaw),
    };
  }

  function fillCard(card, data = {}) {
    card.querySelector(".input-sid").value = data.sid || "";
    card.querySelector(".input-eid").value = data.eid || "";
    card.querySelector(".input-title").value = data.title || "";
    card.querySelector(".input-history").value = data.history || "";
    card.querySelector(".input-current").value = data.current || "";
    card.querySelector(".input-images").value = data.images
      ? JSON.stringify(data.images, null, 2)
      : "";
  }

  function renumberCards() {
    const numbers = essayList.querySelectorAll(".card-number");
    numbers.forEach((el, idx) => {
      el.textContent = `#${idx + 1}`;
    });
    updateSummary();
  }

  function createCard(prefill = {}) {
    if (essayList.children.length >= MAX_CARDS) {
      alert(`You can only keep ${MAX_CARDS} cards at once.`);
      return;
    }

    const wrapper = document.createElement("div");
    wrapper.className = "card shadow-sm essay-card";
    wrapper.dataset.state = "idle";
    wrapper.innerHTML = `
      <div class="card-header d-flex justify-content-between align-items-center">
        <div class="d-flex align-items-center gap-2">
          <span class="badge text-bg-secondary card-number">#1</span>
          <span class="small text-muted">Send to /predict_sentence</span>
        </div>
        <div class="d-flex gap-2">
          <button class="btn btn-sm btn-outline-secondary duplicate-btn" type="button">
            <i class="fa-solid fa-copy me-1"></i>Duplicate
          </button>
          <button class="btn btn-sm btn-outline-danger remove-btn" type="button">
            <i class="fa-solid fa-trash me-1"></i>Remove
          </button>
        </div>
      </div>
      <div class="card-body">
        <div class="row g-3">
          <div class="col-md-3">
            <label class="form-label">Student ID</label>
            <input type="text" class="form-control input-sid" placeholder="sid" />
          </div>
          <div class="col-md-3">
            <label class="form-label">Essay ID</label>
            <input type="number" class="form-control input-eid" placeholder="eid" />
          </div>
          <div class="col-md-6">
            <label class="form-label">Homework Title</label>
            <input type="text" class="form-control input-title" placeholder="title" />
          </div>
        </div>

        <label class="form-label mt-3 mb-1">History Essay Content</label>
        <textarea class="form-control input-history" rows="3" placeholder="Prior essays content"></textarea>

        <label class="form-label mt-3 mb-1">Current Essay Content</label>
        <textarea class="form-control input-current" rows="4" placeholder="Current essay content"></textarea>

        <label class="form-label mt-3 mb-1">
          Images JSON (optional)
          <span class="text-muted small">(e.g. [{"{}"}])</span>
        </label>
        <div class="d-flex align-items-center gap-2 mb-2">
          <button class="btn btn-outline-secondary btn-sm load-images-btn" type="button">
            <i class="fa-solid fa-images me-1"></i>Load Images Only
          </button>
          <span class="small text-muted">Loads modify_keywords / modify_description</span>
        </div>
        <textarea class="form-control input-images" rows="2" placeholder="[]"></textarea>

        <div class="d-flex align-items-center gap-2 mt-3">
          <button class="btn btn-outline-secondary btn-sm load-btn" type="button">
            <i class="fa-solid fa-cloud-arrow-down me-1"></i>Load Content
          </button>
          <button class="btn btn-outline-primary btn-sm run-btn" type="button">
            <i class="fa-solid fa-wand-magic-sparkles me-1"></i>Run
          </button>
          <span class="card-status small text-muted">Idle</span>
        </div>

        <label class="form-label mt-3 mb-1">Predicted Sentence</label>
        <textarea class="form-control output-result" rows="2" readonly></textarea>

        <label class="form-label mt-3 mb-1">Prompt Snapshot</label>
        <textarea class="form-control output-prompt" rows="3" readonly></textarea>
      </div>
    `;

    attachCardListeners(wrapper);
    fillCard(wrapper, prefill);
    essayList.appendChild(wrapper);
    renumberCards();
  }

  function attachCardListeners(card) {
    card.querySelector(".remove-btn").addEventListener("click", () => {
      card.remove();
      renumberCards();
    });

    card.querySelector(".duplicate-btn").addEventListener("click", () => {
      const data = getCardData(card);
      createCard(data);
    });

    card.querySelector(".load-btn").addEventListener("click", () => {
      loadContent(card);
    });

    card.querySelector(".load-images-btn").addEventListener("click", () => {
      loadImages(card);
    });

    card.querySelector(".run-btn").addEventListener("click", () => {
      runPrediction(card);
    });
  }

  function validateCardData(card, data) {
    if (!data.sid) {
      setStatus(card, "Student ID is required", "danger");
      setCardState(card, "error");
      return false;
    }
    if (data.eid === null || Number.isNaN(data.eid)) {
      setStatus(card, "Essay ID is required", "danger");
      setCardState(card, "error");
      return false;
    }
    if (!data.current) {
      setStatus(card, "Current essay content is required", "danger");
      setCardState(card, "error");
      return false;
    }
    return true;
  }

  function cleanEssayText(value) {
    if (!value) return "";
    let text = value;
    text = text.replace(/<div>\s*<\/br>\s*<\/div>/gi, "\n");
    text = text.replace(/<div>\s*<br\s*\/?>\s*<\/div>/gi, "\n");
    text = text.replace(/<br\s*\/?>/gi, "\n");
    text = text.replace(/<\/div>\s*<div>/gi, "\n");
    text = text.replace(/<\/p>\s*<p>/gi, "\n");
    text = text.replace(/<\/?(div|p)>/gi, "\n");
    text = text.replace(/&nbsp;/gi, " ");
    text = text.replace(/<[^>]+>/g, "");
    return text
      .split("\n")
      .map((line) => line.trimEnd())
      .join("\n")
      .replace(/\n{3,}/g, "\n\n")
      .trim();
  }

  async function runPrediction(card) {
    const runBtn = card.querySelector(".run-btn");
    const resultBox = card.querySelector(".output-result");
    const promptBox = card.querySelector(".output-prompt");
    const data = getCardData(card);

    if (!validateCardData(card, data)) {
      return;
    }

    setStatus(card, "Running prediction...", "warning");
    setCardState(card, "running");
    resultBox.value = "";
    promptBox.value = "";
    runBtn.disabled = true;
    runBtn.innerHTML =
      '<span class="spinner-border spinner-border-sm me-1" role="status"></span>Running';

    try {
      const response = await fetch("/predict_sentence", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sid: data.sid,
          eid: data.eid,
          current_essay_content: data.current,
          history_essay_content: data.history,
          images_info: data.images,
          title: data.title || "",
        }),
      });

      const result = await response.json().catch(() => null);
      if (!response.ok || !result?.success) {
        const message =
          result?.error ||
          result?.message ||
          `${response.status} ${response.statusText}`;
        throw new Error(message);
      }

      resultBox.value = result.predict_sentence || "";
      promptBox.value = result.predict_prompt || "";
      setStatus(card, "Prediction completed", "success");
      setCardState(card, "success");
    } catch (err) {
      setStatus(card, err?.message || "Prediction failed", "danger");
      setCardState(card, "error");
    } finally {
      runBtn.disabled = false;
      runBtn.innerHTML =
        '<i class="fa-solid fa-wand-magic-sparkles me-1"></i>Run';
    }
  }

  async function loadContent(card) {
    const loadBtn = card.querySelector(".load-btn");
    const data = getCardData(card);

    if (!data.sid || data.eid === null || Number.isNaN(data.eid)) {
      setStatus(card, "Provide sid and eid before loading.", "danger");
      setCardState(card, "error");
      return;
    }

    const original = loadBtn.innerHTML;
    loadBtn.disabled = true;
    setStatus(card, "Loading history and essay...", "warning");
    setCardState(card, "running");
    loadBtn.innerHTML =
      '<span class="spinner-border spinner-border-sm me-1" role="status"></span>Loading';

    try {
      // Load history
      const historyResp = await fetch(
        `/get_history_essays_content/${encodeURIComponent(data.sid)}`
      );
      const historyJson = await historyResp.json().catch(() => null);
      if (!historyResp.ok || !historyJson?.success) {
        const msg =
          historyJson?.error ||
          historyJson?.message ||
          `${historyResp.status} ${historyResp.statusText}`;
        throw new Error(`History: ${msg}`);
      }

      // Load current essay
      const essayResp = await fetch(
        `/load_hw_data/${encodeURIComponent(data.eid)}`
      );
      const essayJson = await essayResp.json().catch(() => null);
      if (!essayResp.ok || !essayJson?.success) {
        const msg =
          essayJson?.error ||
          essayJson?.message ||
          `${essayResp.status} ${essayResp.statusText}`;
        throw new Error(`Essay: ${msg}`);
      }

      const { essay, images } = essayJson.data || {};
      const cleanHistory = cleanEssayText(historyJson.content || "");
      const cleanCurrent = cleanEssayText(essay?.content || "");
      card.querySelector(".input-history").value = cleanHistory;
      card.querySelector(".input-current").value = cleanCurrent;
      card.querySelector(".input-title").value = essay?.topic || data.title || "";

      if (Array.isArray(images) && images.length) {
        const simplified = images.map((img) => ({
          keywords: Array.isArray(img.modify_keywords)
            ? img.modify_keywords
            : typeof img.modify_keywords === "string"
            ? img.modify_keywords.split(",").map((x) => x.trim()).filter(Boolean)
            : [],
          description: img.modify_description || "",
        }));
        card.querySelector(".input-images").value = JSON.stringify(
          simplified,
          null,
          2
        );
      }

      setStatus(card, "Content loaded", "success");
      setCardState(card, "success");
    } catch (err) {
      setStatus(card, err?.message || "Failed to load content", "danger");
      setCardState(card, "error");
    } finally {
      loadBtn.disabled = false;
      loadBtn.innerHTML = original;
    }
  }

  async function loadImages(card) {
    const btn = card.querySelector(".load-images-btn");
    const data = getCardData(card);
    if (data.eid === null || Number.isNaN(data.eid)) {
      setStatus(card, "Provide eid before loading images.", "danger");
      setCardState(card, "error");
      return;
    }

    const original = btn.innerHTML;
    btn.disabled = true;
    setStatus(card, "Loading images...", "warning");
    setCardState(card, "running");
    btn.innerHTML =
      '<span class="spinner-border spinner-border-sm me-1" role="status"></span>Loading';

    try {
      const essayResp = await fetch(
        `/load_hw_data/${encodeURIComponent(data.eid)}`
      );
      const essayJson = await essayResp.json().catch(() => null);
      if (!essayResp.ok || !essayJson?.success) {
        const msg =
          essayJson?.error ||
          essayJson?.message ||
          `${essayResp.status} ${essayResp.statusText}`;
        throw new Error(msg);
      }

      const { images } = essayJson.data || {};
      if (Array.isArray(images) && images.length) {
        const simplified = images.map((img) => ({
          keywords: Array.isArray(img.modify_keywords)
            ? img.modify_keywords
            : typeof img.modify_keywords === "string"
            ? img.modify_keywords.split(",").map((x) => x.trim()).filter(Boolean)
            : [],
          description: img.modify_description || "",
        }));
        card.querySelector(".input-images").value = JSON.stringify(
          simplified,
          null,
          2
        );
      } else {
        card.querySelector(".input-images").value = "";
      }

      setStatus(card, "Images loaded", "success");
      setCardState(card, "success");
    } catch (err) {
      setStatus(card, err?.message || "Failed to load images", "danger");
      setCardState(card, "error");
    } finally {
      btn.disabled = false;
      btn.innerHTML = original;
    }
  }

  function runAll() {
    const cards = [...essayList.querySelectorAll(".essay-card")];
    if (!cards.length) {
      alert("Add at least one card before running predictions.");
      return;
    }
    cards.forEach((card) => runPrediction(card));
  }

  function addManyCards() {
    const input = prompt("How many cards to add? (max 100)", "5");
    if (!input) return;
    const count = Math.min(
      Math.max(parseInt(input, 10) || 0, 0),
      MAX_CARDS - essayList.children.length
    );
    for (let i = 0; i < count; i += 1) {
      createCard();
    }
  }

  function clearAll() {
    if (!essayList.children.length) return;
    const confirmed = confirm("Remove all cards?");
    if (!confirmed) return;
    essayList.innerHTML = "";
    updateSummary();
  }

  addCardBtn?.addEventListener("click", () => createCard());
  addManyBtn?.addEventListener("click", addManyCards);
  clearAllBtn?.addEventListener("click", clearAll);
  runAllBtn?.addEventListener("click", runAll);

  // Seed with two blank cards to start
  createCard();
  createCard();
})();

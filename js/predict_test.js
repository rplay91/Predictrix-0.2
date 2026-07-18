(() => {
  const sidInput = document.getElementById("sidInput");
  const historyContent = document.getElementById("historyContent");
  const historyStatus = document.getElementById("historyStatus");

  const titleInput = document.getElementById("titleInput");
  const eidInput = document.getElementById("eidInput");
  const currentEssay = document.getElementById("currentEssay");
  const imagesInfo = document.getElementById("imagesInfo");
  const imagesContainer = document.getElementById("imagesContainer");
  const addImageBtn = document.getElementById("addImageBtn");
  const MAX_IMAGE_SIZE_MB = 5;
  const homeworkStatus = document.getElementById("homeworkStatus");

  const predictionResult = document.getElementById("predictionResult");
  const promptPreview = document.getElementById("promptPreview");

  const loadHistoryBtn = document.getElementById("loadHistoryBtn");
  const createHomeworkBtn = document.getElementById("createHomeworkBtn");
  const loadHomeworkBtn = document.getElementById("loadHomeworkBtn");
  const saveHomeworkBtn = document.getElementById("saveHomeworkBtn");
  const predictBtn = document.getElementById("predictBtn");

  let cachedImages = [];

  function createImageEntry() {
    return {
      keywords: [],
      description: "",
      file: null,
      fileName: "",
      previewUrl: "",
      statusMessage: "",
      statusTone: "muted",
    };
  }

  function escapeHtml(value = "") {
    return String(value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function setImageStatus(index, message, tone = "muted") {
    const entry = cachedImages[index];
    if (!entry) {
      return;
    }
    entry.statusMessage = message;
    entry.statusTone = tone;
  }

  function getStatusClass(tone) {
    switch (tone) {
      case "success":
        return "text-success";
      case "danger":
        return "text-danger";
      case "warning":
        return "text-warning";
      default:
        return "text-muted";
    }
  }

  function syncImagesTextarea() {
    if (!imagesInfo) return;
    const simplified = cachedImages.map((item) => ({
      keywords: Array.isArray(item.keywords) ? item.keywords : [],
      description:
        typeof item.description === "string" ? item.description : "",
    }));
    imagesInfo.value = simplified.length ? toJSONText(simplified) : "";
  }

  function clearImageEntryFile(index) {
    const entry = cachedImages[index];
    if (!entry) {
      return;
    }
    entry.file = null;
    entry.fileName = "";
    entry.previewUrl = "";
    entry.statusMessage = "";
    entry.statusTone = "muted";
  }

  function cleanEssayText(value) {
    if (!value) return "";
    let text = value;
    text = text.replace(/<div>\s*(<br\s*\/?>)?\s*<\/div>/gi, "\n");
    text = text.replace(/<br\s*\/?>/gi, "\n");
    text = text.replace(/<\/?p[^>]*>/gi, "\n");
    text = text.replace(/<\/?div[^>]*>/gi, "\n");
    text = text.replace(/&nbsp;/gi, " ");
    text = text.replace(/<[^>]+>/g, "");
    text = text.replace(/\r\n/g, "\n");
    text = text
      .split("\n")
      .map((line) => line.trim())
      .join("\n");
    return text.replace(/\n{3,}/g, "\n\n").trim();
  }

  function handleImageFileSelection(index, file) {
    const entry = cachedImages[index];
    if (!entry) {
      return;
    }

    if (!file) {
      clearImageEntryFile(index);
      setImageStatus(index, "Image selection cleared.");
      renderImages();
      return;
    }

    if (!file.type.startsWith("image/")) {
      setImageStatus(
        index,
        "Only image files (PNG, JPG, WEBP) are supported.",
        "danger"
      );
      clearImageEntryFile(index);
      renderImages();
      return;
    }

    const maxBytes = MAX_IMAGE_SIZE_MB * 1024 * 1024;
    if (file.size > maxBytes) {
      setImageStatus(
        index,
        `Image must be smaller than ${MAX_IMAGE_SIZE_MB} MB.`,
        "danger"
      );
      clearImageEntryFile(index);
      renderImages();
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      entry.file = file;
      entry.fileName = file.name;
      entry.previewUrl = typeof reader.result === "string" ? reader.result : "";
      setImageStatus(
        index,
        "Image loaded. You can analyze it to extract keywords."
      );
      renderImages();
    };
    reader.onerror = () => {
      setImageStatus(index, "Failed to read image file.", "danger");
      clearImageEntryFile(index);
      renderImages();
    };
    reader.readAsDataURL(file);
  }

  async function analyzeImageEntry(index, analyzeButton) {
    const entry = cachedImages[index];
    if (!entry) {
      return;
    }

    if (!entry.file) {
      setImageStatus(
        index,
        "Select an image before running analysis.",
        "warning"
      );
      renderImages();
      return;
    }

    const originalHtml = analyzeButton.innerHTML;
    analyzeButton.disabled = true;
    analyzeButton.innerHTML =
      '<span class="spinner-border spinner-border-sm me-1" role="status" aria-hidden="true"></span>Analyzing...';

    setImageStatus(index, "Analyzing image...", "muted");

    try {
      const formData = new FormData();
      formData.append("file", entry.file);

      const response = await fetch("/analyze_image/", {
        method: "POST",
        body: formData,
      });

      const result = await response.json().catch(() => null);

      if (!response.ok || !result?.success) {
        const message =
          result?.error ||
          result?.message ||
          `${response.status} ${response.statusText}`;
        throw new Error(message);
      }

      const keywords = Array.isArray(result.data?.keywords)
        ? result.data.keywords
            .map((kw) =>
              typeof kw === "string" ? kw.trim() : String(kw || "").trim()
            )
            .filter(Boolean)
        : [];

      const description =
        typeof result.data?.description === "string"
          ? result.data.description
          : "";

      entry.keywords = keywords;
      entry.description = description;
      setImageStatus(
        index,
        "Analysis complete. Review and adjust if needed.",
        "success"
      );
    } catch (err) {
      setImageStatus(
        index,
        err?.message || "Failed to analyze image. Please try again.",
        "danger"
      );
    } finally {
      analyzeButton.disabled = false;
      analyzeButton.innerHTML = originalHtml;
      renderImages();
    }
  }


  function attachImageRowListeners(row, index) {
    const keywordsInput = row.querySelector(".image-keywords");
    const descriptionInput = row.querySelector(".image-description");
    const removeBtn = row.querySelector(".image-remove-btn");
    const uploadBtn = row.querySelector(".image-upload-btn");
    const clearBtn = row.querySelector(".image-clear-btn");
    const fileInput = row.querySelector(".image-file-input");
    const analyzeBtn = row.querySelector(".image-analyze-btn");

    if (keywordsInput) {
      keywordsInput.addEventListener("input", (event) => {
        const value = event.target.value || "";
        cachedImages[index].keywords = value
          .split(",")
          .map((kw) => kw.trim())
          .filter(Boolean);
        syncImagesTextarea();
      });
    }

    if (descriptionInput) {
      descriptionInput.addEventListener("input", (event) => {
        cachedImages[index].description = event.target.value || "";
        syncImagesTextarea();
      });
    }

    if (removeBtn) {
      removeBtn.addEventListener("click", () => {
        cachedImages.splice(index, 1);
        renderImages();
      });
    }

    if (uploadBtn && fileInput) {
      uploadBtn.addEventListener("click", () => {
        fileInput.click();
      });
    }

    if (fileInput) {
      fileInput.addEventListener("change", (event) => {
        const file = event.target.files && event.target.files[0];
        handleImageFileSelection(index, file || null);
      });
    }

    if (clearBtn && fileInput) {
      clearBtn.addEventListener("click", () => {
        fileInput.value = "";
        clearImageEntryFile(index);
        setImageStatus(index, "Image selection cleared.");
        renderImages();
      });
    }

    if (analyzeBtn) {
      analyzeBtn.addEventListener("click", async () => {
        await analyzeImageEntry(index, analyzeBtn);
      });
    }
  }

  function renderImages() {
    if (!imagesContainer) return;
    imagesContainer.innerHTML = "";

    if (!cachedImages.length) {
      const emptyState = document.createElement("div");
      emptyState.className = "text-muted small fst-italic";
      emptyState.textContent = "No image context added.";
      imagesContainer.appendChild(emptyState);
      syncImagesTextarea();
      return;
    }

    cachedImages.forEach((image, index) => {
      const wrapper = document.createElement("div");
      wrapper.className = "border rounded p-3 bg-white";
      wrapper.dataset.imageIndex = String(index);
      const hasPreview = Boolean(image.previewUrl);
      const statusClass = getStatusClass(image.statusTone);
      wrapper.innerHTML = `
        <div class="d-flex justify-content-between align-items-start mb-2">
          <span class="fw-semibold">Image Context ${index + 1}</span>
          <button
            type="button"
            class="btn btn-outline-danger btn-sm image-remove-btn"
            aria-label="Remove image context"
          >
            <i class="fa-solid fa-trash-can"></i>
          </button>
        </div>
        <div class="row g-3 align-items-stretch">
          <div class="col-md-4">
            <div class="border rounded p-3 h-100 d-flex flex-column">
              <div
                class="image-preview border rounded mb-2 flex-grow-1 d-flex align-items-center justify-content-center overflow-hidden"
                style="min-height: 140px;"
              >
                ${
                  hasPreview
                    ? `<img src="${escapeHtml(
                        image.previewUrl
                      )}" alt="Preview" class="img-fluid">`
                    : '<div class="text-muted small text-center"><i class="fa-solid fa-image fa-2x mb-1"></i><div>No image selected</div></div>'
                }
              </div>
              <input
                type="file"
                class="image-file-input d-none"
                accept="image/*"
              />
              <div class="d-grid gap-2">
                <button
                  type="button"
                  class="btn btn-outline-primary btn-sm image-upload-btn"
                >
                  <i class="fa-solid fa-upload me-1"></i>Select Image
                </button>
                <button
                  type="button"
                  class="btn btn-outline-secondary btn-sm image-clear-btn"
                  ${image.file ? "" : "disabled"}
                >
                  <i class="fa-solid fa-xmark me-1"></i>Remove Image
                </button>
                <button
                  type="button"
                  class="btn btn-outline-info btn-sm image-analyze-btn"
                  ${image.file ? "" : "disabled"}
                >
                  <i class="fa-solid fa-wand-magic-sparkles me-1"></i>Analyze Image
                </button>
              </div>
              <div class="small text-muted mt-2 image-file-name">
                ${
                  image.fileName
                    ? escapeHtml(image.fileName)
                    : "No file selected"
                }
              </div>
              <div class="small mt-1 image-status ${statusClass}">
                ${
                  image.statusMessage
                    ? escapeHtml(image.statusMessage)
                    : ""
                }
              </div>
            </div>
          </div>
          <div class="col-md-8">
            <label class="form-label small fw-semibold mb-1">Keywords</label>
            <input
              type="text"
              class="form-control form-control-sm image-keywords"
              placeholder="Comma-separated keywords"
            />
            <div class="mt-2">
              <label class="form-label small fw-semibold mb-1">Description</label>
              <textarea
                class="form-control form-control-sm image-description"
                rows="3"
                placeholder="Short description of the image"
              ></textarea>
            </div>
          </div>
        </div>
      `;

      const keywordsInput = wrapper.querySelector(".image-keywords");
      const descriptionInput = wrapper.querySelector(".image-description");

      if (keywordsInput) {
        keywordsInput.value = Array.isArray(image.keywords)
          ? image.keywords.join(", ")
          : "";
      }
      if (descriptionInput) {
        descriptionInput.value = image.description ?? "";
      }

      imagesContainer.appendChild(wrapper);
      attachImageRowListeners(wrapper, index);
    });

    syncImagesTextarea();
  }

  async function loadImagesOnly() {
    const eid = requireEid();
    const result = await fetchJSON(`/load_hw_data/${eid}`);

    if (!result.success) {
      throw new Error(result.error || "Failed to load homework data.");
    }

    const images = Array.isArray(result.data?.images)
      ? result.data.images.map((img) => {
          const entry = createImageEntry();
          entry.keywords = Array.isArray(img.modify_keywords)
            ? img.modify_keywords
                .map((kw) =>
                  typeof kw === "string" ? kw.trim() : String(kw || "").trim()
                )
                .filter(Boolean)
            : typeof img.modify_keywords === "string"
            ? img.modify_keywords
                .split(",")
                .map((kw) => kw.trim())
                .filter(Boolean)
            : [];
          entry.description =
            typeof img.modify_description === "string"
              ? img.modify_description
              : "";
          if (entry.keywords.length || entry.description) {
            entry.statusMessage = "Loaded from homework data.";
            entry.statusTone = "muted";
          }
          return entry;
        })
      : [];

    cachedImages = images;
    renderImages();
  }

  function setStatus(element, message, tone = "muted") {
    const toneClass =
      tone === "success"
        ? "text-success"
        : tone === "danger"
        ? "text-danger"
        : tone === "warning"
        ? "text-warning"
        : "text-muted";
    element.className = `small ${toneClass}`;
    element.textContent = message;
  }

  function toJSONText(value) {
    try {
      return JSON.stringify(value, null, 2);
    } catch (err) {
      return "";
    }
  }

  async function fetchJSON(url, options = {}) {
    const response = await fetch(url, options);
    const data = await response.json().catch(() => null);
    if (!response.ok) {
      const message =
        data?.error ||
        data?.message ||
        `${response.status} ${response.statusText}`;
      throw new Error(message);
    }
    return data;
  }

  function requireSid() {
    const sid = sidInput.value.trim();
    if (!sid) {
      throw new Error("Student ID is required.");
    }
    return sid;
  }

  function requireEid() {
    const eidRaw = eidInput.value.trim();
    if (!eidRaw) {
      throw new Error("Essay ID (EID) is required.");
    }
    const eid = Number(eidRaw);
    if (!Number.isInteger(eid) || eid <= 0) {
      throw new Error("Essay ID must be a positive integer.");
    }
    return eid;
  }

  function collectImagesPayload() {
    return cachedImages
      .map((item) => ({
        keywords: Array.isArray(item.keywords)
          ? item.keywords.filter((kw) => typeof kw === "string" && kw.trim())
          : [],
        description:
          typeof item.description === "string"
            ? item.description.trim()
            : "",
      }))
      .filter(
        (item) => item.keywords.length > 0 || item.description.length > 0
      );
  }

  if (addImageBtn) {
    addImageBtn.addEventListener("click", () => {
      cachedImages.push(createImageEntry());
      renderImages();
    });
  }

  loadHistoryBtn.addEventListener("click", async () => {
    try {
      loadHistoryBtn.disabled = true;
      setStatus(historyStatus, "Loading history essays...");
      const sid = requireSid();
      const result = await fetchJSON(`/get_history_essays_content/${sid}`);
      if (result.success) {
        historyContent.value = result.content ?? "";
        setStatus(historyStatus, "History essays loaded.", "success");
      } else {
        setStatus(
          historyStatus,
          result.error || "Failed to load history essays.",
          "danger"
        );
      }
    } catch (err) {
      setStatus(historyStatus, err.message, "danger");
    } finally {
      loadHistoryBtn.disabled = false;
    }
  });

  createHomeworkBtn.addEventListener("click", async () => {
    try {
      createHomeworkBtn.disabled = true;
      setStatus(homeworkStatus, "Creating homework draft...");
      const sid = requireSid();
      const title = titleInput.value.trim() || "Homework Draft";
      const payload = {
        sid,
        title,
        images: [],
      };
      const result = await fetchJSON("/initialize_homework1", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (result.success) {
        eidInput.value = result.eid;
        setStatus(
          homeworkStatus,
          `Homework created with EID ${result.eid}.`,
          "success"
        );
      } else {
        setStatus(
          homeworkStatus,
          result.error || "Failed to create homework.",
          "danger"
        );
      }
    } catch (err) {
      setStatus(homeworkStatus, err.message, "danger");
    } finally {
      createHomeworkBtn.disabled = false;
    }
  });

  loadHomeworkBtn.addEventListener("click", async () => {
    try {
      loadHomeworkBtn.disabled = true;
      setStatus(homeworkStatus, "Loading and cleaning homework data...");
      const eid = requireEid();
      const result = await fetchJSON(`/load_hw_data/${eid}`);

      if (!result.success) {
        setStatus(
          homeworkStatus,
          result.error || "Failed to load homework data.",
          "danger"
        );
        return;
      }

      const essay = result.data?.essay ?? {};
      titleInput.value = essay.topic ?? "";
      const rawContent = essay.content ?? "";
      const cleanedContent = cleanEssayText(rawContent);
      // Debug helper for troubleshooting HTML cleaning issues
      console.debug("[predict_test] raw essay content:", rawContent);
      console.debug("[predict_test] cleaned essay content:", cleanedContent);
      currentEssay.value = cleanedContent;

      const images = Array.isArray(result.data?.images)
        ? result.data.images.map((img) => {
            const entry = createImageEntry();
            entry.keywords = Array.isArray(img.modify_keywords)
              ? img.modify_keywords
                  .map((kw) =>
                    typeof kw === "string" ? kw.trim() : String(kw || "").trim()
                  )
                  .filter(Boolean)
              : [];
            entry.description =
              typeof img.modify_description === "string"
                ? img.modify_description
                : "";
            if (entry.keywords.length || entry.description) {
              entry.statusMessage = "Loaded from homework data.";
              entry.statusTone = "muted";
            }
            return entry;
          })
        : [];
      cachedImages = images;
      renderImages();

      setStatus(homeworkStatus, "Homework data loaded.", "success");
    } catch (err) {
      setStatus(homeworkStatus, err.message, "danger");
    } finally {
      loadHomeworkBtn.disabled = false;
    }
  });

  // no extra image/clean buttons; use Load Homework to refresh content and images

  saveHomeworkBtn.addEventListener("click", async () => {
    try {
      saveHomeworkBtn.disabled = true;
      setStatus(homeworkStatus, "Saving essay content...");
      const eid = requireEid();
      const content = currentEssay.value;
      const result = await fetchJSON(`/save_hw_content/${eid}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content }),
      });

      if (result.success) {
        setStatus(homeworkStatus, "Essay content saved.", "success");
      } else {
        setStatus(
          homeworkStatus,
          result.error || "Failed to save essay content.",
          "danger"
        );
      }
    } catch (err) {
      setStatus(homeworkStatus, err.message, "danger");
    } finally {
      saveHomeworkBtn.disabled = false;
    }
  });

  predictBtn.addEventListener("click", async () => {
    try {
      predictBtn.disabled = true;
      predictBtn.innerHTML =
        '<span class="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></span>Running Prediction...';

      const sid = requireSid();
      const eid = requireEid();
      const currentContent = currentEssay.value.trim();
      const history = historyContent.value.trim();
      const title = titleInput.value.trim() || "Homework Draft";
      const imagesPayload = collectImagesPayload();

      if (!currentContent) {
        throw new Error("Current essay content is required for prediction.");
      }

      const body = {
        sid,
        eid,
        current_essay_content: currentContent,
        history_essay_content: history,
        images_info: imagesPayload,
        title,
      };

      const result = await fetchJSON("/predict_sentence", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (result.success) {
        predictionResult.value = result.predict_sentence ?? "";
        promptPreview.value = result.predict_prompt ?? "";
        setStatus(homeworkStatus, "Prediction generated successfully.", "success");
      } else {
        setStatus(
          homeworkStatus,
          result.error || "Prediction failed.",
          "danger"
        );
      }
    } catch (err) {
      setStatus(homeworkStatus, err.message, "danger");
    } finally {
      predictBtn.disabled = false;
      predictBtn.innerHTML =
        '<i class="fa-solid fa-wand-magic-sparkles me-2"></i>Generate Predict Sentence';
    }
  });

  renderImages();
})();

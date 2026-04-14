const beforeUnloadHandler = (e) => {
  e.preventDefault();
  e.returnValue =
    "Meninggalkan halaman ini akan membuat progres Anda hilang!";
  return e.returnValue;
};

const MIN_PREDICTION_ATTEMPTS = 3;

function getPredictionAttemptKey() {
  const eid = sessionStorage.getItem("currentEid") || "unknown";
  return `predictionAttempts:${eid}`;
}

function getPredictionAttemptCount() {
  const key = getPredictionAttemptKey();
  return Number.parseInt(sessionStorage.getItem(key) || "0", 10);
}

function isPredictionRequirementMet() {
  const predictionBtn = document.getElementById("predictionBtn");
  if (!predictionBtn) return true;
  return getPredictionAttemptCount() >= MIN_PREDICTION_ATTEMPTS;
}

async function showPredictionRequirementReminder() {
  return await Swal.fire({
    title: "Gunakan Fitur Prediksi",
    text: `Silakan coba fitur prediksi minimal ${MIN_PREDICTION_ATTEMPTS} kali sebelum mengumpulkan esai.`,
    icon: "warning",
    confirmButtonText: "OK",
  });
}

document.addEventListener("DOMContentLoaded", async () => {
  // console.log("Page loaded, checking login status...");

  try {
    const sid = sessionStorage.getItem("sid");
    if (!sid) {
      // console.log("No sid found, redirecting to login page");
      window.location.href = "/login";
      return;
    }

    // console.log("Checking pretest status for sid:", sid);
    const response = await fetch(`/check_pretest_status/${sid}`);
    // console.log("API response status:", response.status);

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    // console.log("Pretest status result:", data);

    if (!data.canTakeTest) {
      await Swal.fire({
        title: "Tes Sudah Selesai",
        text: "Anda sudah menyelesaikan tes ini. Anda tidak dapat mengerjakannya lagi.",
        icon: "info",
        confirmButtonText: "OK",
      });
      window.location.href = "/";
      return;
    }

    const result = await showStartConfirmation();

    if (result.isConfirmed) {
      try {
        // console.log("Initializing pretest essay...");
        const response = await fetch(`/initialize_pretest/${sid}`, {
          method: "POST",
          headers: {
            Accept: "application/json",
            "Content-Type": "application/json",
          },
        });

        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }

        const data = await response.json();
        // console.log("Essay initialization result:", data);

        if (data.success) {
          // Store eid in sessionStorage
          sessionStorage.setItem("currentEid", data.eid);
          // Initialize page
          initializePage();
        } else {
          throw new Error(data.message);
        }
      } catch (error) {
        // console.error("Error initializing essay:", error);
        await Swal.fire({
          title: "Galat",
          text: "Gagal memulai tes. Silakan coba lagi nanti.",
          icon: "error",
          confirmButtonText: "OK",
        });
        window.location.href = "/";
      }
    } else {
      // User cancelled, return to home page
      window.location.href = "/";
    }
  } catch (error) {
    // console.error("Error checking pretest status:", error);
    await Swal.fire({
      title: "Galat",
      text: "Gagal memeriksa status tes. Silakan coba lagi nanti.",
      icon: "error",
      confirmButtonText: "OK",
    });
    window.location.href = "/";
  }

  document.querySelectorAll(".instruction-box").forEach((box) => {
    box.addEventListener("click", function () {
      this.classList.toggle("expanded");
      const icon = this.querySelector(".instruction-icon");
      if (icon) {
        icon.style.transform = this.classList.contains("expanded")
          ? "rotate(180deg)"
          : "rotate(0)";
      }
    });
  });
});

async function showStartConfirmation() {
  return await Swal.fire({
    title: "Siap Memulai Tes?",
    html: `
      <div class="confirmation-dialog">
        <p class="confirmation-message">
          Konten tes akan dimuat, dan timer akan mulai <b>menghitung mundur dari 20 menit.</b>
          <br><br>          
          <b>Catatan:</b> <u>Menutup atau memuat ulang jendela ini akan membatalkan tes Anda.</u>
          <br><br>
          Klik "Mulai" saat Anda siap memulai.
        </p>
        <div class="confirm-button-wrapper">
          <div class="countdown-overlay"></div>
        </div>
      </div>
    `,
    icon: "info",
    showCancelButton: true,
    confirmButtonText: "Mulai",
    cancelButtonText: "Kembali",
    confirmButtonColor: "#1a73e8",
    cancelButtonColor: "#dc3545",
    allowOutsideClick: false,
    allowEscapeKey: false,
    reverseButtons: false,
  });
}

function initializePage() {
  const demoData = {
    title: "Liburan Idul Fitri Bersama Keluarga",
    images: [
      {
        url: "/static/assets/img/post-test_1.webp",
        keywords: ["salat id", "pakaian tradisional", "masjid", "kebersamaan"],
        description:
          "Keluarga mengenakan pakaian terbaik dan menuju masjid untuk menunaikan salat Idul Fitri bersama.",
      },
      {
        url: "/static/assets/img/post-test_2.png",
        keywords: ["mudik", "reuni keluarga", "silaturahmi", "perjalanan"],
        description:
          "Momen mudik mempertemukan keluarga besar untuk bersilaturahmi dan merayakan Idul Fitri bersama.",
      },
      {
        url: "/static/assets/img/post-test_3.jpg",
        keywords: ["THR", "amplop", "anak-anak", "berbagi"],
        description:
          "Orang tua membagikan amplop THR kepada anak-anak sebagai bentuk berbagi dan doa di hari raya.",
      },
    ],
  };

  createInterface();
  initializeSidebar();

  document.getElementById("articleTitle").textContent = demoData.title;

  initializeResources(demoData.images);

  initializeCountdown();

  if (window.initRichTextEditor) {
    window.initRichTextEditor();
  }

  setupWordCounter();
  setupEditorFontSlider();

  window.addEventListener("beforeunload", beforeUnloadHandler);
}

function createInterface() {
  const mainStructure = `
    <main>
      <div class="writing-container">
        <header class="writing-header">
          <div class="header-left">
            <h2>Pre-Test</h2>
          </div>
          <div class="header-center">
            <div id="countdownTimer" class="countdown-timer">60:00</div>
          </div>
          <div class="header-right">
            <button class="submit-button" onclick="handleSubmit()">
              Kumpulkan Esai
            </button>
          </div>
        </header>
        
        <div class="main-content">
          <div class="editor-section">
            <div class="topic-title">
              <h2><span class="topic-label">Judul: </span><span id="articleTitle"></span></h2>
            </div>
            
            <div class="instruction-box">
              <div class="instruction-header">
                <svg class="instruction-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                  <path d="M19 9l-7 7-7-7" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                </svg>
                <span>Petunjuk</span>
              </div>
              <div class="instruction-content">
                <p>Idul Fitri adalah momen penting di Indonesia untuk berkumpul bersama keluarga. Gambar-gambar berikut menunjukkan kegiatan khas saat Idul Fitri. Tulislah esai untuk menceritakan liburan Idul Fitri bersama keluarga kepada pembaca.</p>
                <p>Ikuti panduan berikut saat menulis:</p>
                <li>Tulislah esai berdasarkan Judul dan informasi Konteks yang disediakan.</li>
                <li>Tulislah setidaknya 150 kata.</li>
                <li>Durasi tes adalah <b>20 menit</b>. Esai akan dikumpulkan otomatis saat waktu habis. Anda juga dapat mengumpulkannya secara manual dengan menekan <b>"Kumpulkan Esai"</b>.</li>
                <li><b>Menutup atau memuat ulang jendela ini akan membatalkan tes Anda.</b></li>
              </div>
            </div>

            <div class="area-title-row" style="display:flex; align-items:center; justify-content:space-between; gap:12px;">
              <div class="area-title"> Area Menulis </div>
              <div id="wordCounter" class="word-counter"></div>
            </div>
            <div class="editor-container">
              <div id="editor" class="editor" contenteditable="true"></div>
            </div>
          </div>

          <div class="sidebar">
            <div class="sidebar-tabs">
              <button class="tab-btn active" data-tab="context">
                <i class="fas fa-images"></i> <br />Konteks Gambar
              </button>
            </div>

            <div class="sidebar-content">
              <div class="tab-panel active" id="contextPanel">
                <div class="area-title"> Informasi Konteks </div>
                <div class="context-container">
                  <div class="resources-container"></div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </main>
  `;

  document.body.innerHTML = mainStructure;
}

function initializeResources(images) {
  const container = document.querySelector(".context-container .resources-container");

  if (!container) {
    return;
  }

  images.forEach((image, index) => {
    const resourceElement = createResourceElement(image, index);
    container.appendChild(resourceElement);
  });
}

function createResourceElement(image, index) {
  const div = document.createElement("div");
  div.className = "resource-item";

  const timestamp = new Date().getTime();
  const imageUrl = `${image.url}?t=${timestamp}`;

  div.innerHTML = `
    <div class="resource-preview" style="cursor: pointer;">
      <img src="${imageUrl}" alt="Resource ${index + 1}" class="resource-image">
      <div class="resource-info">
        <div class="resource-keywords">
          ${image.keywords
            .map((keyword) => `<span class="keyword-chip">${keyword}</span>`)
            .join("")}
        </div>
        <p class="resource-description">${image.description}</p>
      </div>
    </div>
  `;

  div.querySelector(".resource-preview").addEventListener("click", () => {
    showResourceModal(imageUrl, image.keywords, image.description);
  });

  return div;
}

function showResourceModal(imagePath, keywords, description) {
  const keywordsHtml = keywords
    .map((keyword) => `<span class="modal-keyword-chip">${keyword}</span>`)
    .join("");

  Swal.fire({
    html: `
      <div class="resource-modal">
        <div class="modal-image-container">
          <img src="${imagePath}" alt="Resource Image" class="modal-image">
        </div>
        <div class="modal-content">
          <div class="modal-keywords">
            <h3>Kata kunci:</h3>
            <div class="modal-keywords-container">
              ${keywordsHtml}
            </div>
          </div>
          <div class="modal-description">
            <h3>Deskripsi:</h3>
            <p>${description}</p>
          </div>
        </div>
      </div>
    `,
    width: "80%",
    showConfirmButton: true,
    confirmButtonText: "Tutup",
    confirmButtonColor: "#6c757d",
    customClass: {
      popup: "resource-modal-popup",
      confirmButton: "btn btn-secondary",
    },
  });
}

function initializeCountdown() {
  let timeLeft = 1200;

  const countdownInterval = setInterval(() => {
    timeLeft--;
    updateTimeDisplay(timeLeft);

    if (timeLeft <= 0) {
      clearInterval(countdownInterval);
      timeUp();
    }
  }, 1000);
}

function formatTime(seconds) {
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  return `${String(minutes).padStart(2, "0")}:${String(
    remainingSeconds
  ).padStart(2, "0")}`;
}

function updateTimeDisplay(timeLeft) {
  document.getElementById("countdownTimer").textContent = formatTime(timeLeft);
  document.title = `Tes Menulis (${formatTime(timeLeft)})`;
}

function setupWordCounter() {
  const editor = document.getElementById("editor");
  if (!editor) {
    return;
  }

  let counter = document.getElementById("wordCounter");
  if (!counter) {
    counter = document.createElement("div");
    counter.id = "wordCounter";
    counter.style.cssText =
      "display:flex; align-items:center; gap:8px; font-size:14px; color:#334155;";
    const row = document.querySelector(".area-title-row");
    if (row) {
      row.appendChild(counter);
    } else {
      return;
    }
  }
  if (!counter.innerHTML) {
    counter.innerHTML = `
      <span id="wordCounterEmoji" style="font-size:18px;"> </span>\n      <span id="wordCounterText">0 kata</span>
    `;
  }

  const emojiEl = document.getElementById("wordCounterEmoji");
  const textEl = document.getElementById("wordCounterText");

  const getWordCount = (text) => {
    const cleaned = String(text || "").trim().replace(/\s+/g, " ");
    if (!cleaned) return 0;
    return cleaned.split(" ").length;
  };

  const getState = (count) => {
    if (count < 200) {
      return { emoji: "" };
    }
    if (count < 300) {
      return { emoji: "" };
    }
    if (count < 500) {
      return { emoji: "" };
    }
    return { emoji: "" };
  };

  const updateCounter = () => {
    const count = getWordCount(editor.textContent);
    const state = getState(count);
    if (emojiEl) emojiEl.textContent = state.emoji;
    if (textEl) textEl.textContent = `${count} kata`;
  };

  editor.addEventListener("input", updateCounter);
  editor.addEventListener("keyup", updateCounter);
  updateCounter();
}

function setupEditorFontSlider() {
  const editor = document.getElementById("editor");
  if (!editor) {
    return;
  }

  const container = editor.closest(".editor-container") || editor.parentElement;
  if (!container) {
    return;
  }

  let control = container.querySelector(".editor-font-control");
  if (!control) {
    control = document.createElement("div");
    control.className = "editor-font-control";
    control.innerHTML = `
      <span style="font-weight:600;">A</span>
      <input id="editorFontSlider" type="range" min="12" max="24" step="1" />
      <span id="editorFontValue">16px</span>
    `;
    const toolbar = container.querySelector(".editor-toolbar");
    if (toolbar) {
      toolbar.appendChild(control);
    } else {
      container.appendChild(control);
    }
  }

  const slider = control.querySelector("#editorFontSlider");
  const valueLabel = control.querySelector("#editorFontValue");
  if (!slider || !valueLabel) {
    return;
  }

  const currentSize = parseInt(
    window.getComputedStyle(editor).fontSize || "16",
    10
  );
  slider.value = String(currentSize);
  valueLabel.textContent = `${currentSize}px`;

  const updateFontSize = (value) => {
    document.documentElement.style.setProperty(
      "--editor-font-size",
      `${value}px`
    );
    valueLabel.textContent = `${value}px`;
  };

  slider.addEventListener("input", (e) => {
    updateFontSize(e.target.value);
  });
}

function initializeSidebar() {
  const tabBtns = document.querySelectorAll(".tab-btn");
  const panels = document.querySelectorAll(".tab-panel");

  tabBtns.forEach((btn) => {
    btn.addEventListener("click", () => {
      tabBtns.forEach((b) => b.classList.remove("active"));
      panels.forEach((p) => p.classList.remove("active"));

      btn.classList.add("active");
      const targetPanel = document.getElementById(`${btn.dataset.tab}Panel`);
      if (targetPanel) {
        targetPanel.classList.add("active");
      }
    });
  });

  const sidebar = document.querySelector(".sidebar");
  if (!sidebar) {
    return;
  }

  const toggleBtn = document.createElement("button");
  toggleBtn.className = "sidebar-toggle";
  toggleBtn.innerHTML = '<i class="fas fa-chevron-right"></i>';

  sidebar.appendChild(toggleBtn);

  toggleBtn.addEventListener("click", () => {
    sidebar.classList.toggle("collapsed");
    document
      .querySelector(".main-content")
      .classList.toggle("sidebar-collapsed");
  });
}

async function timeUp() {
  const updateSuccess = await updateEssayContent();

  let message = "Tes telah berakhir.";
  if (!updateSuccess) {
    message += " (Gagal menyimpan esai Anda)";
  }

  await Swal.fire({
    title: "Waktu habis!",
    text: message,
    icon: "info",
    allowOutsideClick: false,
    allowEscapeKey: false,
    allowEnterKey: false,
    confirmButtonText: "OK",
  });

  window.location.href = "/";
}

async function updateEssayContent() {
  try {
    const eid = sessionStorage.getItem("currentEid");
    const content = document.getElementById("editor").textContent;

    const response = await fetch(`/update_pretest_essay/${eid}`, {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ content: content }),
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const result = await response.json();
    return result.success;
  } catch (error) {
    // console.error("Error updating essay:", error);
    return false;
  }
}

function handleSubmit() {
  if (!isPredictionRequirementMet()) {
    showPredictionRequirementReminder();
    return;
  }
  Swal.fire({
    title: "Konfirmasi Pengumpulan",
    text: "Apakah Anda ingin mengumpulkan esai? Anda tidak dapat mengeditnya setelah dikumpulkan.",
    icon: "question",
    showCancelButton: true,
    confirmButtonText: "Kumpulkan",
    cancelButtonText: "Batal",
    showDenyButton: false,
  }).then(async (result) => {
    if (result.isConfirmed) {
      const updateSuccess = await updateEssayContent();

      if (updateSuccess) {
        window.removeEventListener("beforeunload", beforeUnloadHandler);
        localStorage.removeItem("writingContent");
        window.location.href = "/";
      } else {
        await Swal.fire({
          title: "Galat",
          text: "Gagal menyimpan esai Anda. Silakan coba lagi.",
          icon: "error",
          confirmButtonText: "OK",
        });
      }
    }
  });
}

const textarea = document.getElementById("articleInput");
const prevSentence = document.getElementById("prevSentence");
const currentSentence = document.getElementById("currentSentence");
const nextSentence = document.getElementById("nextSentence");
const currentCase = document.getElementById("currentCase");
const markedText = document.getElementById("markedText");

// textarea.addEventListener("input", updateSentences);
// textarea.addEventListener("click", updateSentences);
// textarea.addEventListener("keyup", updateSentences);

function normalizeText(text) {
  return text
    .replace(/（/g, "(")
    .replace(/）/g, ")")
    .replace(/，/g, ",")
    .replace(/。/g, ".")
    .replace(/！/g, "!")
    .replace(/？/g, "?")
    .trim();
}

function updatePrediction() {
  const editor = document.getElementById("editor");
  const predictionBtn = document.getElementById("predictionBtn");
  const selection = window.getSelection();
  if (!editor || !predictionBtn) {
    return;
  }
  if (!selection || selection.rangeCount === 0) {
    predictionBtn.disabled = true;
    updatePredictionStatus(editor, false, false);
    const markedTextElement = document.getElementById("markedText");
    if (markedTextElement) {
      markedTextElement.textContent = editor.textContent || "";
    }
    return;
  }
  const range = selection.getRangeAt(0);

  const preCaretRange = range.cloneRange();
  preCaretRange.selectNodeContents(editor);
  preCaretRange.setEnd(range.endContainer, range.endOffset);
  const cursorPosition = preCaretRange.toString().length;

  const originalText = editor.textContent;

  const charBeforeCursor = originalText[cursorPosition - 1];
  const isAtStart = cursorPosition === 0;
  const isValidPosition = isAtStart || /[.!?]/.test(charBeforeCursor);

  const lastChar = originalText.trim().slice(-1);
  const hasValidEnding = /[.!?]/.test(lastChar);

  predictionBtn.disabled = !(isValidPosition && hasValidEnding);

  updatePredictionStatus(editor, isValidPosition, hasValidEnding);

  const markedTextElement = document.getElementById("markedText");

  if (!isValidPosition) {
    if (markedTextElement) {
      markedTextElement.textContent = originalText;
    }
    return;
  }

  const beforeText = originalText.slice(0, cursorPosition);
  const afterText = originalText.slice(cursorPosition);

  const markContent = beforeText + " [KALIMAT PREDIKSI] " + afterText;
  if (markedTextElement) {
    markedTextElement.textContent = markContent;
  }
}











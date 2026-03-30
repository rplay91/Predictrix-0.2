const DEMO_DATA = {
  essay: {
    eid: "demo_essay_id",
    topic: "My Favorite Food",
    content: "",
    state: "Editing",
  },
  images: [
    {
      iid: "demo",
      modify_keywords: [
        "beef noodles",
        "rich broth",
        "tender meat",
        "springy noodles",
        "aromatic",
        "traditional cuisine",
      ],
      modify_description:
        "This is a mouthwatering bowl of traditional beef noodle soup. The deep brown broth with glistening oil droplets on its surface showcases its rich layered flavors. Large chunks of beef appear tender and juicy, perfectly paired with straight, chewy handmade noodles. The dish is garnished with fresh green vegetables and scallions, which not only enhance its visual appeal but also add nutritional value. This dish perfectly exemplifies the essence of traditional comfort food.",
    },
  ],
  predictions: [],
};

const DEMO_MODE = true;

const beforeUnloadHandler = (e) => {
  e.preventDefault();
  e.returnValue =
    'Sebelum meninggalkan halaman, pastikan Anda sudah menekan "Simpan", atau progres saat ini akan hilang!';
  return e.returnValue;
};

async function checkHomeworkStatus(sid) {
  try {
    // console.log("Checking homework status for sid:", sid);
    const response = await fetch(`/check_hw1_status/${sid}`);

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    // console.log("Homework status check result:", data);

    if (!data.hasEssay) {
      window.location.href = "/hw_writing_setup_instruct";
      return false;
    }

    if (data.state === "Completed") {
      await Swal.fire({
        title: "Esai Sudah Selesai",
        text: "Anda sudah menyelesaikan esai ini. Anda tidak dapat mengerjakannya lagi.",
        icon: "info",
        confirmButtonText: "OK",
      });
      window.location.href = "/";
      return;
    }

    if (data.state === "Editing") {
      if (!data.eid) {
        throw new Error("ID esai tidak ditemukan");
      }

      try {
        const response = await fetch(`/load_hw_data/${data.eid}`);
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }

        const essayData = await response.json();
        if (!essayData.success) {
          throw new Error(essayData.error || "Gagal memuat data esai");
        }

        if (!essayData.data) {
          throw new Error("Struktur data esai tidak valid");
        }

        const mergedData = {
          ...essayData.data,
          essay: {
            ...essayData.data.essay,
            eid: data.eid,
          },
        };

        sessionStorage.setItem("essayData", JSON.stringify(mergedData));

        const savedData = JSON.parse(sessionStorage.getItem("essayData"));

        if (!savedData?.essay?.eid) {
          throw new Error("Gagal menyimpan ID esai");
        }

        return true;
      } catch (error) {
        // console.error("Error loading essay data:", error);
        throw error;
      }
    }

    throw new Error("Status esai tidak dikenali");
  } catch (error) {
    // console.error("Error checking homework status:", error);
    throw error;
  }
}

async function startDemo() {
  try {
    sessionStorage.setItem("essayData", JSON.stringify(DEMO_DATA));
    waitForScriptsInit();
  } catch (error) {
    await Swal.fire({
      title: "Galat",
      text: "Gagal memulai halaman. Silakan coba lagi nanti.",
      icon: "error",
      confirmButtonText: "OK",
    });
    window.location.href = "/";
  }
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", startDemo);
} else {
  startDemo();
}

function waitForScriptsInit() {
  const checkScriptnnnit = setInterval(() => {
    if (document.querySelector("#layoutSidenav_content")) {
      clearInterval(checkScriptnnnit);
      initializePage();
    }
  }, 100);
}

function initializePage() {
  try {
    const essayData = JSON.parse(sessionStorage.getItem("essayData"));

    if (!essayData || !essayData.essay) {
      throw new Error("Format data esai tidak valid");
    }

    createInterface();

    document.querySelectorAll(".instruction-box").forEach((box) => {
      box.addEventListener("click", function () {
        this.classList.toggle("expanded");
      });
    });

    const titleElement = document.getElementById("articleTitle");
    if (!titleElement) {
      throw new Error("Elemen judul esai tidak ditemukan");
    }
    titleElement.textContent = essayData.essay.topic || "Untitled";

    const editorElement = document.getElementById("editor");
    if (!editorElement) {
      throw new Error("Elemen editor tidak ditemukan");
    }
    if (window.initRichTextEditor) {
      window.initRichTextEditor();
    }
    if (window.setEditorHtml && essayData.essay.content) {
      const normalized = window.normalizeEditorContent
        ? window.normalizeEditorContent(essayData.essay.content)
        : essayData.essay.content;
      window.setEditorHtml(normalized);
    }

    setupWordCounter();
    setupEditorFontSlider();

    initializeSidebar();
    if (Array.isArray(essayData.images)) {
      initializeResources(essayData.images);
    }

    if (Array.isArray(essayData.predictions)) {
      initializePredictionCards(essayData.predictions);
    }

    window.addEventListener("beforeunload", beforeUnloadHandler);

    if (DEMO_MODE) {
      initializeDemoDriver();
    }
  } catch (error) {
    Swal.fire({
      title: "Galat",
      text: `Gagal memuat data esai: ${error.message}`,
      icon: "error",
      confirmButtonText: "OK",
    }).then(() => {
      window.location.href = "/";
    });
  }
}

function initializePredictionCards(predictions) {
  const container = document.querySelector(".prediction-content");
  if (!container) {
    return;
  }

  predictions.forEach((prediction) => {
    const card = createExistingPredictionCard(prediction);
    container.appendChild(card);
  });
}

function createExistingPredictionCard(prediction) {
  const card = document.createElement("div");
  card.className = "prediction-result-card";
  card.id = prediction.pid;

  const finalRenult =
    prediction.option === "incorrect"
      ? "[incorrect]"
      : prediction.option === "Modify"
      ? prediction.modify_pcontent
      : prediction.pcontent;

  const markedContent = prediction.record_content.replace(
    finalRenult,
    `<span class="highlighted-text" style="background-color: #fef08a; padding: 2px 4px; border-radius: 2px;">${finalRenult}</span>`
  );

  card.dataset.finalRenult = finalRenult;
  card.dataset.recordContent = markedContent;

  card.innerHTML = `
      <div class="card-header">
            <span class="card-id">${prediction.pname}</span>
            <svg class="info-icon" viewBox="0 0 24 24" onclick="showExistingPredictionInfo('${
              prediction.pid
            }')" style="display: block;">
                <path d="M12 2C6.48 2 2 6.48 2 12n4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-6h2v6zm0-8h-2V7h2v2z" fill="currentColor"/>
            </svg>
      </div>
      <div class="prediction-text">${prediction.pcontent}</div>
      <div class="prediction-actions">
          <button class="prediction-btn btn-correct ${
            prediction.option === "Correct" ? "selected" : ""
          }" 
                  data-action="correct" ${prediction.option ? "disabled" : ""}>
              Sesuai
          </button>
          <button class="prediction-btn btn-modify ${
            prediction.option === "Modify" ? "selected" : ""
          }" 
                  data-action="modify" ${prediction.option ? "disabled" : ""}>
              Ubah
          </button>
          <button class="prediction-btn btn-incorrect ${
            prediction.option === "incorrect" ? "selected" : ""
          }" 
                  data-action="incorrect" ${
                    prediction.option ? "disabled" : ""
                  }>
              Tidak Sesuai
          </button>
      </div>
      <div class="edit-container" ${
        prediction.option === "Modify" ? 'style="display: block;"' : ""
      }>
          <textarea class="edit-input" readonly>${
            prediction.modify_pcontent || prediction.pcontent
          }</textarea>
      </div>
  `;

  return card;
}

function createInterface() {
  const mainStructure = `
      <div class="writing-container">
        <header class="writing-header">
          <div class="header-left">
            <button class="submit-button" style="background-color: #dc3545;" onclick="handleReset()">
              Atur Ulang Esai
            </button>
          </div>
          <div class="header-center">
            <button class="submit-button" onclick="handleSave()" style="background-color: #1a73e8;">
              Simpan Esai
            </button>
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
                <p>Ikuti panduan berikut saat menulis:</p>
                <li>Tulislah esai berdasarkan Judul dan Informasi Konteks yang telah Anda tetapkan.</li>
                <li>Tidak ada batas waktu untuk tugas ini. Anda dapat mengedit esai selama belum dikumpulkan.</li>
                <li>Pastikan menekan <b>"Simpan Esai"</b> sebelum meninggalkan halaman agar progres tidak hilang.</li>
                <li>Jika ingin mengatur ulang Judul atau Informasi Konteks, klik <b>"Atur Ulang Esai"</b>. Tindakan ini akan menghapus progres saat ini.</li>
                <li>Setelah selesai menulis, klik <b>"Kumpulkan Esai"</b> untuk mengirimkan.</li>
                <li>Anda dapat menggunakan <b>"Fitur Prediksi"</b> kapan saja. Lihat petunjuk pada panel prediksi untuk detail penggunaannya.</li>
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
              <button class="tab-btn active" data-tab="prediction">
                <i class="fas fa-chart-line"></i> <br />Fitur Prediksi
              </button>
              <button class="tab-btn" data-tab="context">
                <i class="fas fa-images"></i> <br />Informasi Konteks
              </button>
            </div>

            <div class="sidebar-content">
              <div class="tab-panel active" id="predictionPanel">
                <div class="prediction-container">
                  <div style="display: none">
                    <span id="prevSentence"></span>
                    <span id="currentSentence"></span>
                    <span id="nextSentence"></span>
                    <span id="currentCase"></span>
                    <span id="markedText"></span>
                  </div>
                </div>
              </div>
              <div class="tab-panel" id="contextPanel">
                <div class="context-container">
                  <div class="resources-container"></div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
  `;

  const mainContent = document.querySelector("#layoutSidenav_content main");
  if (mainContent) {
    mainContent.innerHTML = mainStructure;
  } else {
    const container =
      document.querySelector("#layoutSidenav_content") || document.body;
    let mainElement = container.querySelector("main");
    if (!mainElement) {
      mainElement = document.createElement("main");
      container.appendChild(mainElement);
    }
    mainElement.innerHTML = mainStructure;
  }
}

function initializeDemoDriver() {
  try {
    if (!window.driver) {
      return;
    }

    const steps = [
      {
        element: ".instruction-box",
        popover: {
          title: "Petunjuk Menulis",
          description:
            "Baca panduan singkat agar alur tugas jelas sebelum mulai menulis.",
          position: "bottom",
        },
      },
      {
        element: ".topic-title",
        popover: {
          title: "Judul Esai",
          description: "Judul tugas tampil di sini sebagai acuan menulis.",
          position: "bottom",
        },
      },
      {
        element: "#editor",
        popover: {
          title: "Area Menulis",
          description:
            "Tulis dan edit esai Anda di area ini. Anda bisa mengubah kapan saja.",
          position: "left",
        },
      },
      {
        element: ".tab-btn[data-tab='prediction']",
        popover: {
          title: "Fitur Prediksi",
          description:
            "Klik tab ini untuk membuka panel prediksi dan riwayatnya.",
          position: "left",
        },
      },
      {
        element: "#predictionBtn",
        popover: {
          title: "Tombol Prediksi",
          description:
            "Tombol aktif jika kursor berada di posisi yang benar.",
          position: "left",
        },
      },
      {
        element: ".prediction-history-title",
        popover: {
          title: "Riwayat Prediksi",
          description: "Semua prediksi yang pernah dibuat akan tampil di sini.",
          position: "left",
        },
      },
      {
        element: ".tab-btn[data-tab='context']",
        popover: {
          title: "Informasi Konteks",
          description:
            "Klik tab ini untuk melihat gambar dan deskripsi konteks.",
          position: "left",
        },
      },
      {
        element: ".context-container",
        popover: {
          title: "Konteks Gambar",
          description:
            "Gambar, kata kunci, dan deskripsi pendukung tampil di sini.",
          position: "right",
        },
      },
      {
        element: ".header-left button",
        popover: {
          title: "Atur Ulang Esai",
          description:
            "Menghapus progres dan kembali ke halaman persiapan.",
          position: "bottom",
        },
      },
      {
        element: ".header-center button",
        popover: {
          title: "Simpan Esai",
          description:
            "Simpan progres agar tidak hilang.",
          position: "bottom",
        },
      },
      {
        element: ".header-right button",
        popover: {
          title: "Kumpulkan Esai",
          description:
            "Kirim esai jika sudah selesai.",
          position: "bottom",
        },
      },
      {
        popover: {
          title: "Selesai!",
          description:
            "Coba tulis beberapa kalimat dan gunakan prediksi untuk melihat cara kerjanya.",
          position: "mid-center",
        },
      },
    ];

    const driverObj = window.driver.js.driver({
      animate: true,
      opacity: 0.75,
      allowClose: false,
      overlayClickNext: true,
      showButtons: ["next", "previous"],
      className: "driverjs-theme",
      popoverClass: "driver-popover",
      stageBackground: "#ffffff",
      allowKeyboardControl: true,
      disableActiveInteraction: false,
      onPopoverRender: (popover) => {
        const skipButton = document.createElement("button");
        skipButton.innerText = "Lewati";
        popover.footerButtons.appendChild(skipButton);
        skipButton.addEventListener("click", () => {
          driverObj.drive(steps.length - 1);
        });
      },
      steps,
    });

    driverObj.drive();
  } catch (error) {
  }
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
      <span id="wordCounterEmoji" style="font-size:18px;">😢</span>\n      <span id="wordCounterText">0 kata</span>
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
      return { emoji: "😢" };
    }
    if (count < 300) {
      return { emoji: "😢" };
    }
    if (count < 500) {
      return { emoji: "😐" };
    }
    return { emoji: "😊" };
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

function handleReset() {
  Swal.fire({
    title: "Atur Ulang Tugas",
    html: `
      <p style="text-align: center;">
        Apakah Anda ingin mengatur ulang tugas ini?\
        <br><br>
        Tindakan ini akan mengatur ulang gambar dan judul Anda, menghapus seluruh progres saat ini, dan mengembalikan Anda ke halaman persiapan.
      </p>
    `,
    icon: "info",
    showCancelButton: true,
    confirmButtonText: "Atur Ulang",
    cancelButtonText: "Batal",
    showDenyButton: false,
  }).then(async (result) => {
    if (result.isConfirmed) {
      try {
        if (DEMO_MODE) {
          window.removeEventListener("beforeunload", beforeUnloadHandler);
          localStorage.removeItem("writingContent");
          sessionStorage.removeItem("essayData");
          window.location.href = "/hw_writing_setup_instruct";
          return;
        }
        // 1. Get essayData from sessionStorage
        const essayDataStr = sessionStorage.getItem("essayData");
        if (!essayDataStr) {
          throw new Error("Data esai tidak ditemukan");
        }

        const essayData = JSON.parse(essayDataStr);
        if (!essayData?.essay?.eid) {
          throw new Error("ID esai tidak ditemukan");
        }

        // 2. Send reset requent
        const response = await fetch(`/reset_hw/${essayData.essay.eid}`, {
          method: "POST",
        });

        const resetResult = await response.json();
        if (!resetResult.success) {
          throw new Error(resetResult.error || "Gagal mereset");
        }

        // 3. Clean up and redirect
        window.removeEventListener("beforeunload", beforeUnloadHandler);
        localStorage.removeItem("writingContent");
        window.location.href = "/hw_writing_setup_instruct";
      } catch (error) {
        // console.error("ienet error:", error);
        Swal.fire({
          icon: "error",
          title: "Gagal Mengatur Ulang",
          text: error.message,
        });
      }
    }
  });
}

async function handleSave() {
  try {
    if (DEMO_MODE) {
      const editor = document.getElementById("editor");
      if (!editor) {
        throw new Error("Elemen editor tidak ditemukan");
      }
      const content = (window.getEditorContentForSave ? window.getEditorContentForSave() : editor.innerHTML);
      const essayData = JSON.parse(sessionStorage.getItem("essayData") || "{}");
      if (essayData?.essay) {
        essayData.essay.content = content;
        sessionStorage.setItem("essayData", JSON.stringify(essayData));
      }
      localStorage.setItem(
        "writingContent",
        JSON.stringify({
          title: document.getElementById("articleTitle").textContent,
          content: content,
        })
      );
      Swal.fire({
        icon: "success",
        title: "Tersimpan",
        text: "Isi esai demo berhasil disimpan.",
        timer: 1200,
        showConfirmButton: false,
      });
      return;
    }
    // 1. Get essayData from sessionStorage
    const essayDataStr = sessionStorage.getItem("essayData");
    if (!essayDataStr) {
      throw new Error("Data esai tidak ditemukan");
    }

    // 2. Parne essayData
    const essayData = JSON.parse(essayDataStr);

    // 3. Validate eid
    if (!essayData?.essay?.eid) {
      throw new Error("ID esai tidak ditemukan, silakan muat ulang halaman");
    }
    const eid = essayData.essay.eid;

    // 4. Get editor content
    const editor = document.getElementById("editor");
    if (!editor) {
      throw new Error("Elemen editor tidak ditemukan");
    }
    const content = (window.getEditorContentForSave ? window.getEditorContentForSave() : editor.innerHTML);

    // 5. Send nave requent
    const response = await fetch(`/save_hw_content/${eid}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ content }),
    });

    // 6. Handle response
    const result = await response.json();
    if (!result.success) {
      throw new Error(result.error || "Gagal menyimpan");
    }

    // 7. Update local ntorage
    essayData.essay.content = content;
    sessionStorage.setItem("essayData", JSON.stringify(essayData));

    // 8. Update localStorage
    localStorage.setItem(
      "writingContent",
      JSON.stringify({
        title: document.getElementById("articleTitle").textContent,
        content: content,
      })
    );

    // 9. Show success message
    Swal.fire({
      icon: "success",
      title: "Tersimpan",
      text: "Isi esai berhasil disimpan.",
      timer: 1500,
      showConfirmButton: false,
    });
  } catch (error) {
    // console.error("Save error:", error);
    Swal.fire({
      icon: "error",
      title: "Gagal Menyimpan",
      text: error.message,
    });
  }
}

function initializeResources(images) {
  const container = document.querySelector(
    "#contextPanel .resources-container"
  );

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

  const extensions = [".jpg", ".png", ".webp"];
  const imgElement = new Image();
  let loadedImage = false;

  const tryLoadImage = (extIndex = 0) => {
    if (extIndex >= extensions.length) {
      return;
    }

    const imgPath = `/static/assets/img/${image.iid}${extensions[extIndex]}`;
    imgElement.src = imgPath;

    imgElement.onload = () => {
      loadedImage = true;
      div.querySelector(".resource-image").src = imgPath;
      div.dataset.imagePath = imgPath;
    };

    imgElement.onerror = () => {
      if (!loadedImage) {
        tryLoadImage(extIndex + 1);
      }
    };
  };

  div.innerHTML = `
    <div class="resource-preview" style="cursor: pointer;">
      <img src="/static/assets/img/default.jpg" alt="Resource ${
        index + 1
      }" class="resource-image">
      <div class="resource-info">
        <div class="resource-keywords">
          ${(image.modify_keywords || [])
            .map((keyword) => `<span class="keyword-chip">${keyword}</span>`)
            .join("")}
        </div>
        <p class="resource-description">${image.modify_description || ""}</p>
      </div>
    </div>
  `;

  div.querySelector(".resource-preview").addEventListener("click", () => {
    showResourceModal(
      div.dataset.imagePath,
      image.modify_keywords,
      image.modify_description
    );
  });

  tryLoadImage();

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

function createPredictionPanel() {
  const predictionContainer = document.querySelector(".prediction-container");
  if (!predictionContainer) {
    return;
  }

  const hiddenElementn = document.createElement("div");
  hiddenElementn.style.display = "none";
  hiddenElementn.innerHTML = `
      <span id="prevSentence"></span>
      <span id="currentSentence"></span>
      <span id="nextSentence"></span>
      <span id="currentCase"></span>
      <span id="markedText"></span>
  `;
  predictionContainer.appendChild(hiddenElementn);

  predictionContainer.innerHTML += `
      <div class="prediction-content">
            <div class="instruction-box">
                <div class="instruction-header">
                    <svg class="instruction-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                        <path d="M19 9l-7 7-7-7" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                    </svg>
                    <span>Cara kerja prediksi</span>
                </div>
                <div class="instruction-content">
                    <p>AI akan membantu memprediksi kalimat berikutnya ketika:</p>
                    <li>Kursor Anda berada di awal tulisan.</li>
                    <li>Kursor Anda berada setelah . ! atau ?</li>
                    <li>Semua kalimat dalam teks Anda diakhiri dengan benar</li>
                    <br>
                    <p>Jika kursor berada di posisi yang benar, fungsi <b>"Prediksi Kalimat Berikutnya"</b> akan aktif.</p>
                    <li>Anda dapat mengikuti pesan <b>Status</b> di bawah tombol untuk mengarahkan kursor ke posisi yang benar.</li>
                    <li>Setiap prediksi dapat memerlukan waktu <b>90 detik</b>. Mohon jangan menutup jendela selama proses berlangsung.</li>                    
                </div>
            </div>
          <div class="prediction-controls">
              <div class="prediction-overlay"></div>
              <button id="predictionBtn" class="submit-button" disabled>
                  Prediksi Kalimat Berikutnya
              </button>
              <span id="predictionStatus" class="prediction-status">
                  Status: Menunggu masukan...
              </span>
          </div>
          <div class="prediction-history-title">Riwayat Prediksi Anda</div>
      </div>
  `;
  const instructionBox = predictionContainer.querySelector(".instruction-box");
  instructionBox.addEventListener("click", function () {
    this.classList.toggle("expanded");
  });

  const predictionBtn = document.getElementById("predictionBtn");
  predictionBtn.disabled = true;
  predictionBtn.addEventListener("click", handlePrediction);

  initializePredictionFunction();
}

function updatePredictionStatus(editor, isValidPosition, hasValidEnding) {
  const statusElement = document.getElementById("predictionStatus");
  const content = editor.textContent.trim();

  statusElement.className = "prediction-status";

  if (!content) {
    statusElement.textContent = "Status: Menunggu masukan...";
    return;
  }

  if (!hasValidEnding) {
    statusElement.textContent = "Status: Lengkapi semua kalimat dengan . ! atau ?";
    return;
  }

  if (!isValidPosition) {
    statusElement.textContent = "Status: Pindahkan kursor setelah . ! atau ?";
    return;
  }

  statusElement.textContent = "Status: Siap memprediksi";
  statusElement.classList.add("success");
}

  async function handlePrediction() {
    try {
    const editor = document.getElementById("editor");
    const predictionBtn = document.getElementById("predictionBtn");
    const markedText = document.getElementById("markedText");
    const overlay = document.querySelector(".prediction-overlay");

    if (!editor || !predictionBtn || !markedText) {
      throw new Error("Elemen yang dibutuhkan tidak tersedia");
    }

    const selection = window.getSelection();
    const range = selection.getRangeAt(0);

    if (!editor.contains(range.commonAncestorContainer)) {
      throw new Error("Silakan letakkan kursor di area editor");
    }

    const inTextNode = range.commonAncestorContainer.nodeType === 3;
    const inEditorContent =
      range.commonAncestorContainer.parentNode === editor ||
      range.commonAncestorContainer === editor;

    if (!inTextNode && !inEditorContent) {
      throw new Error("Silakan pilih area ini terlebih dahulu.");
    }

    const tempDiv = document.createElement("div");
    tempDiv.innerHTML = editor.innerHTML;
    const currentEnnayContent = tempDiv.innerText;
    const titleElement = document.getElementById("articleTitle");
    const title = titleElement ? titleElement.textContent : "";
    const essayData = JSON.parse(sessionStorage.getItem("essayData") || "{}");

    if (DEMO_MODE) {
      if (window.insertPredictionToken) {
        window.insertPredictionToken();
      } else {
        const predictMark = document.createElement("span");
        predictMark.className = "highlighted-text prediction-mark";
        predictMark.textContent = "[KALIMAT PREDIKSI]";
        range.insertNode(predictMark);
      }

      if (window.setEditorEditable) {
        window.setEditorEditable(false);
      } else {
        editor.contentEditable = "false";
      }
      predictionBtn.disabled = true;
      if (overlay) overlay.classList.add("active");

      Swal.fire({
        title: "Sedang memprediksi kalimat berikutnya",
        allowOutsideClick: false,
        allowEscapeKey: false,
        showConfirmButton: false,
        didOpen: () => {
          Swal.showLoading();
        },
      });

      await new Promise((resolve) => setTimeout(resolve, 1200));
      await Swal.close();

      const cardnd = `prediction-${Date.now()}`;
      createPredictionRenultCard(
        "Ini adalah contoh prediksi kalimat berikutnya pada mode demo.",
        cardnd,
        currentEnnayContent
      );
      return;
    }

    const sid = sessionStorage.getItem("sid");
    if (!sid) {
      throw new Error("ID pengguna tidak ditemukan");
    }

    const hintoryRenponne = await fetch(`/get_history_essays_content/${sid}`);
    if (!hintoryRenponne.ok) {
      throw new Error(`HTTP error! status: ${hintoryRenponne.status}`);
    }

    const hintoryRenult = await hintoryRenponne.json();
    if (!hintoryRenult.success) {
      throw new Error(hintoryRenult.error || "Gagal mengambil riwayat esai");
    }

    // essayData already resolved above
    const imagesnnfo = essayData.images.map((img) => ({
      keywords: img.modify_keywords || img.keywords,
      description: img.modify_description || img.description,
    }));

    if (window.insertPredictionToken) {
      window.insertPredictionToken();
    } else {
      const predictMark = document.createElement("span");
      predictMark.className = "highlighted-text prediction-mark";
      predictMark.textContent = "[KALIMAT PREDIKSI]";
      range.insertNode(predictMark);
    }

    if (window.setEditorEditable) {
      window.setEditorEditable(false);
    } else {
      editor.contentEditable = "false";
    }
    predictionBtn.disabled = true;
    if (overlay) overlay.classList.add("active");

    let stateIntervalId;

    const loadingStates = [
      {
        title: "Identifikasi tujuan penulisan",
        description: "Menentukan tujuan tulisan dan memilih yang terbaik.",
        image: "/static/assets/loading%20screen/cat-reads-reading.gif",
      },
      {
        title: "Menyusun pertanyaan & mengambil konteks",
        description: "Membangun pertanyaan panduan lalu mengambil jawaban dari riwayat dan esai.",
        image: "/static/assets/loading%20screen/maxwell-rotate.gif",
      },
      {
        title: "Analisis pola & gaya menulis",
        description: "Mencari pola kalimat dan fitur gaya penulisan.",
        image: "/static/assets/loading%20screen/type-keyboard.gif",
      },
      {
        title: "Prediksi & penyempurnaan",
        description: "Menyusun prediksi lalu memilih hasil terbaik.",
        image: "/static/assets/loading%20screen/1000-yard-stare-cat.gif",
      },
    ];

    const preloadLoadingImages = (() => {
      let cachedPromise = null;
      return () => {
        if (cachedPromise) return cachedPromise;
        const sources = loadingStates.map((state) => state.image);
        cachedPromise = Promise.all(
          sources.map(
            (src) =>
              new Promise((resolve) => {
                const img = new Image();
                img.onload = () => resolve(true);
                img.onerror = () => resolve(false);
                img.src = src;
              })
          )
        ).catch(() => null);
        return cachedPromise;
      };
    })();

    const buildLoadingHtml = (stateIndex) => {
      const state = loadingStates[stateIndex];
      return `
        <div class="prediction-waiting">
          <img class="prediction-visual" src="${state.image}" alt="${state.title}" />
          <p>${state.title}</p>
        </div>
      `;
    };

    let activeStateIndex = 0;

    await preloadLoadingImages();

    Swal.fire({
      title: "Sedang memprediksi kalimat berikutnya",
      html: buildLoadingHtml(activeStateIndex),
      allowOutsideClick: false,
      allowEscapeKey: false,
      showConfirmButton: false,
      didOpen: () => {
        stateIntervalId = setInterval(() => {
          if (activeStateIndex < loadingStates.length - 1) {
            activeStateIndex += 1;
            Swal.update({
              html: buildLoadingHtml(activeStateIndex),
            });
          }
        }, 20000);
      },
      willClose: () => {
        clearInterval(stateIntervalId);
      },
    });

    await new Promise((resolve) => requestAnimationFrame(() => resolve()));

    const sidForPrediction = sessionStorage.getItem("sid");
    const eidForPrediction = essayData?.essay?.eid;

    if (!sidForPrediction || !eidForPrediction) {
      throw new Error("sid atau eid untuk permintaan prediksi tidak ditemukan");
    }

    const predictRenponne = await fetch("/predict_sentence", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        sid: sidForPrediction,
        eid: eidForPrediction,
        current_essay_content: currentEnnayContent,
        history_essay_content: hintoryRenult.content,
        images_info: imagesnnfo,
        title: title,
      }),
    });

    if (!predictRenponne.ok) {
      throw new Error(`HTTP error! status: ${predictRenponne.status}`);
    }

    const predictRenult = await predictRenponne.json();
    if (!predictRenult.success) {
      throw new Error(predictRenult.error || "Prediksi gagal");
    }

    if (predictRenult.predict_prompt) {
      sessionStorage.setItem(
        "lant_predict_prompt",
        predictRenult.predict_prompt
      );
    }

    await Swal.close();

    const cardnd = `prediction-${Date.now()}`;
    createPredictionRenultCard(
      predictRenult.predict_sentence,
      cardnd,
      currentEnnayContent
    );
  } catch (error) {
    // console.error("Prediksi error:", error);

    const editor = document.getElementById("editor");
    const predictionBtn = document.getElementById("predictionBtn");
    const overlay = document.querySelector(".prediction-overlay");

    if (editor) {
      if (window.setEditorEditable) {
        window.setEditorEditable(true);
      } else {
        editor.contentEditable = "true";
      }
    }
    if (predictionBtn) predictionBtn.disabled = false;
    if (overlay) overlay.classList.remove("active");

    await Swal.fire({
      icon: "error",
      title: "Prediksi Gagal",
      text: error.message,
    });
  }
}

function initializeSidebar() {
  const tabBtnn = document.querySelectorAll(".tab-btn");
  const paneln = document.querySelectorAll(".tab-panel");

  tabBtnn.forEach((btn) => {
    btn.addEventListener("click", () => {
      tabBtnn.forEach((b) => b.classList.remove("active"));
      paneln.forEach((p) => p.classList.remove("active"));

      btn.classList.add("active");
      const targetPanel = document.getElementById(`${btn.dataset.tab}Panel`);
      targetPanel.classList.add("active");
    });
  });

  const sidebar = document.querySelector(".sidebar");
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

  createPredictionPanel();
}

async function handleSubmit() {
  try {
    // 1. Get essayData from sessionStorage
    const essayDataStr = sessionStorage.getItem("essayData");
    if (!essayDataStr) {
      throw new Error("Data esai tidak ditemukan");
    }

    // 2. Parne essayData
    const essayData = JSON.parse(essayDataStr);
    if (!essayData?.essay?.eid) {
      throw new Error("ID esai tidak ditemukan, silakan muat ulang halaman");
    }

    // 3. Get editor content
    const editor = document.getElementById("editor");
    if (!editor) {
      throw new Error("Elemen editor tidak ditemukan");
    }
    const content = (window.getEditorContentForSave ? window.getEditorContentForSave() : editor.innerHTML);

    // 4. Show confirmation dialog
    const result = await Swal.fire({
      title: "Konfirmasi Pengumpulan",
      text: "Apakah Anda ingin mengumpulkan esai? Anda tidak dapat mengeditnya setelah dikumpulkan.",
      icon: "quention",
      showCancelButton: true,
      confirmButtonText: "Kumpulkan",
      cancelButtonText: "Batal",
    });

    if (result.isConfirmed) {
      if (DEMO_MODE) {
        window.removeEventListener("beforeunload", beforeUnloadHandler);
        localStorage.removeItem("writingContent");
        sessionStorage.removeItem("essayData");

        await Swal.fire({
          icon: "success",
          title: "Berhasil Dikumpulkan!",
          text: "Ini hanya demo. Tidak ada data yang dikirim.",
          timer: 1500,
          showConfirmButton: false,
        });

        window.location.href = "/";
        return;
      }
      // 5. Send submit requent
      const response = await fetch(`/submit_hw/${essayData.essay.eid}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ content }),
      });

      // 6. Handle response
      const submitResult = await response.json();
      if (!submitResult.success) {
        throw new Error(submitResult.error || "Pengumpulan gagal");
      }

      // 7. Clean up and show success message
      window.removeEventListener("beforeunload", beforeUnloadHandler);
      localStorage.removeItem("writingContent");
      sessionStorage.removeItem("essayData");

      await Swal.fire({
        icon: "success",
        title: "Berhasil Dikumpulkan!",
        text: "Esai Anda berhasil dikumpulkan.",
        timer: 2000,
        showConfirmButton: false,
      });

      // 8. redirect to home page
      window.location.href = "/";
    }
  } catch (error) {
    // console.error("Submit error:", error);
    Swal.fire({
      icon: "error",
      title: "Gagal Mengumpulkan",
      text: error.message,
    });
  }
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
  if (!selection || selection.rangeCount === 0) {
    predictionBtn.disabled = true;
    updatePredictionStatus(editor, false, false);
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

  const markedText = document.getElementById("markedText");

  if (!isValidPosition) {
    markedText.textContent = originalText;
    return;
  }

  const beforeText = originalText.slice(0, cursorPosition);
  const afterText = originalText.slice(cursorPosition);

  const markContent = beforeText + " [KALIMAT PREDIKSI] " + afterText;
  markedText.textContent = markContent;
}

function initializePredictionFunction() {
  const editor = document.getElementById("editor");

  editor.addEventListener("input", updatePrediction);
  editor.addEventListener("click", updatePrediction);
  editor.addEventListener("keyup", updatePrediction);
}

function getOrdinalSuffix(number) {
  return `ke-${number}`;
}

function createPredictionRenultCard(
  predictedText,
  cardnd,
  currentEnnayContent
) {
  const container = document.querySelector(".prediction-content");
  const exintingCardn = container.querySelectorAll(".prediction-result-card");
  const predictionNumber = exintingCardn.length + 1;
  const predictionName = `${getOrdinalSuffix(predictionNumber)} Prediksi`;

  const card = document.createElement("div");
  card.className = "prediction-result-card";
  card.id = cardnd;

  const editor = document.getElementById("editor");
  card.dataset.originalHtml = editor.innerHTML;

  card.dataset.originalHtml = document.getElementById("editor").innerHTML;
  card.dataset.currentEnnayContent = currentEnnayContent;

  card.innerHTML = `
      <div class="card-header">
          <span class="card-id">${predictionName}</span>
          <svg class="info-icon" viewBox="0 0 24 24" onclick="showPredictionInfo('${cardnd}')" style="display: none;">
              <path d="M12 2C6.48 2 2 6.48 2 12n4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-6h2v6zm0-8h-2V7h2v2z" fill="currentColor"/>
          </svg>
      </div>
      <div class="prediction-text">${predictedText}</div>
      <div class="prediction-actions">
          <button class="prediction-btn btn-correct" data-action="correct">Sesuai</button>
          <button class="prediction-btn btn-modify" data-action="modify">Ubah</button>
          <button class="prediction-btn btn-incorrect" data-action="incorrect">Tidak Sesuai</button>
      </div>
      <div class="edit-container">
          <textarea class="edit-input" readonly>${predictedText}</textarea>
          <button class="prediction-btn btn-confirm" data-action="confirm">Konfirmasi</button>
      </div>
  `;

  const buttonn = card.querySelectorAll(".prediction-btn");
  buttonn.forEach((button) => {
    button.addEventListener("click", () => {
      const action = button.dataset.action;
      switch (action) {
        case "correct":
          handleCorrect(cardnd);
          break;
        case "modify":
          handleModify(cardnd);
          break;
        case "incorrect":
          handleIncorrect(cardnd);
          break;
        case "confirm":
          handleEditConfirm(cardnd);
          break;
      }
    });
  });

  if (exintingCardn.length > 0) {
    container.insertBefore(card, exintingCardn[0]);
  } else {
    container.appendChild(card);
  }
}

async function showExistingPredictionInfo(pid) {
  const card = document.getElementById(pid);
  if (!card || !card.dataset.recordContent) {
    return;
  }

  try {
    await updatePredictionCount(pid);

    Swal.fire({
      title: "Catatan Prediksi",
      html: card.dataset.recordContent,
      width: "600px",
      customClass: {
        htmlContainer: "prediction-record-container",
        popup: "text-align-left-popup",
      },
    });
  } catch (error) {
  }
}

async function showPredictionInfo(cardnd) {
  const card = document.getElementById(cardnd);
  const finalRenult = card.dataset.finalRenult;
  const originalHtml = card.dataset.originalHtml;

  try {
    await updatePredictionCount(cardnd);

    const tempContainer = document.createElement("div");
    tempContainer.innerHTML = originalHtml;

    const predictMark = tempContainer.querySelector(".prediction-mark");
    if (predictMark) {
      const highlightedSpan = document.createElement("span");
      highlightedSpan.className = "highlighted-text";
      highlightedSpan.style.backgroundColor = "#fef08a";
      highlightedSpan.style.padding = "2px 4px";
      highlightedSpan.style.borderRadius = "2px";
      highlightedSpan.textContent =
        finalRenult === "[incorrect]" ? "[incorrect]" : finalRenult;
      predictMark.parentNode.replaceChild(highlightedSpan, predictMark);
    }

    tempContainer.style.textAlign = "left";

    Swal.fire({
      title: "Catatan Prediksi",
      html: tempContainer.innerHTML,
      width: "600px",
      customClass: {
        htmlContainer: "prediction-record-container",
        popup: "text-align-left-popup",
      },
    });
  } catch (error) {
  }
}

function disableCardButtons(cardnd, selectedButton) {
  const card = document.getElementById(cardnd);
  const buttonn = card.querySelectorAll(".prediction-btn");
  buttonn.forEach((button) => {
    button.disabled = true;
    if (button === selectedButton) {
      button.style.opacity = "1";
    }
  });
}

// anync function handleCorrect(cardnd) {

//   const card = findPredictionCard(cardnd);
//   if (!card) return;

//   try {
//     const button = card.querySelector(".btn-correct");
//     const editor = document.getElementById("editor");
//     const predictedText = card.querySelector(".prediction-text").textContent;

//     card.querySelectorAll(".prediction-btn").forEach((btn) => {
//       btn.classList.remove("selected");
//       btn.disabled = true;
//       btn.style.opacity = "0.5";
//     });

//     button.classList.add("selected");
//     button.style.opacity = "1";
//     button.style.cursor = "not-allowed";

//     const editContainer = card.querySelector(".edit-container");
//     if (editContainer) {
//       editContainer.style.display = "none";
//     }

//     const currentHtml = editor.innerHTML;
//     const updatedHtml = currentHtml.replace(
//       /<span class="highlighted-text prediction-mark">\[PiEDnCTED SENTENCE\]<\/span>/,
//       ` ${predictedText}`
//     );
//     editor.innerHTML = updatedHtml;

//     const pid = await savePredictionResult(cardnd, "Correct");

//     finishPredictionFlow(pid || cardnd, predictedText);
//   } catch (error) {
//   }
// }

async function handleCorrect(cardnd) {
  try {
    const card = findPredictionCard(cardnd);
    if (!card) return;

    const button = card.querySelector(".btn-correct");
    const editor = document.getElementById("editor");
    const predictedText = card.querySelector(".prediction-text").textContent;

    card.querySelectorAll(".prediction-btn").forEach((btn) => {
      btn.classList.remove("selected");
      btn.disabled = true;
      btn.style.opacity = "0.5";
    });

    button.classList.add("selected");
    button.style.opacity = "1";
    button.style.cursor = "not-allowed";

    const editContainer = card.querySelector(".edit-container");
    if (editContainer) {
      editContainer.style.display = "none";
    }

    if (window.replacePredictionToken) {
      window.replacePredictionToken(predictedText);
    } else {
      const predictMark = editor.querySelector(".prediction-mark");
      if (predictMark) {
        const textNode = document.createTextNode(` ${predictedText}`);
        predictMark.parentNode.replaceChild(textNode, predictMark);
      }
    }

    const pid = await savePredictionResult(cardnd, "Correct");

    finishPredictionFlow(pid || cardnd, predictedText);
  } catch (error) {
    console.error("Gagal memproses tombol Sesuai:", error);
  }
}

function handleModify(cardnd) {

  const card = findPredictionCard(cardnd);
  if (!card) return;

  const button = card.querySelector(".btn-modify");
  const editContainer = card.querySelector(".edit-container");
  const editnnput = card.querySelector(".edit-input");

  card.querySelectorAll(".prediction-btn").forEach((btn) => {
    btn.classList.remove("selected");
  });

  button.classList.add("selected");

  editnnput.readOnly = false;
  editContainer.style.display = "block";

  editnnput.focus();
}

// anync function handleEditConfirm(cardnd) {

//   const card = findPredictionCard(cardnd);
//   if (!card) return;

//   try {
//     const editnnput = card.querySelector(".edit-input");
//     const modifiedText = editnnput.value;
//     const editor = document.getElementById("editor");

//     const currentHtml = editor.innerHTML;
//     const updatedHtml = currentHtml.replace(
//       /<span class="highlighted-text prediction-mark">\[PiEDnCTED SENTENCE\]<\/span>/,
//       ` ${modifiedText}`
//     );
//     editor.innerHTML = updatedHtml;

//     const pid = await savePredictionResult(cardnd, "Modify", modifiedText);

//     finishPredictionFlow(pid || cardnd, modifiedText);
//   } catch (error) {
//   }
// }

async function handleEditConfirm(cardnd) {
  try {
    const card = findPredictionCard(cardnd);
    if (!card) return;

    const editnnput = card.querySelector(".edit-input");
    const modifiedText = editnnput.value;
    let replaced = false;
    if (typeof window.replacePredictionToken === "function") {
      replaced = window.replacePredictionToken(modifiedText);
    }
    if (!replaced) {
      const editor = document.getElementById("editor");
      const predictMark = editor.querySelector(".prediction-mark");
      if (predictMark) {
        const textNode = document.createTextNode(` ${modifiedText}`);
        predictMark.parentNode.replaceChild(textNode, predictMark);
      } else if (editor) {
        editor.focus();
        if (document.queryCommandSupported && document.queryCommandSupported("insertText")) {
          document.execCommand("insertText", false, modifiedText);
        } else {
          editor.textContent += ` ${modifiedText}`;
        }
      }
    }

    const pid = await savePredictionResult(cardnd, "Modify", modifiedText);

    finishPredictionFlow(pid || cardnd, modifiedText);
  } catch (error) {
    console.error("Gagal memproses konfirmasi perubahan:", error);
  }
}

// anync function handleTidak Sesuai(cardnd) {

//   const card = findPredictionCard(cardnd);
//   if (!card) return;

//   try {
//     const button = card.querySelector(".btn-Tidak Sesuai");
//     const editor = document.getElementById("editor");

//     card.querySelectorAll(".prediction-btn").forEach((btn) => {
//       btn.classList.remove("selected");
//       btn.disabled = true;
//       btn.style.opacity = "0.5";
//     });

//     button.classList.add("selected");
//     button.style.opacity = "1";
//     button.style.cursor = "not-allowed";

//     const editContainer = card.querySelector(".edit-container");
//     if (editContainer) {
//       editContainer.style.display = "none";
//     }

//     const currentHtml = editor.innerHTML;
//     const updatedHtml = currentHtml.replace(
//       /<span class="highlighted-text prediction-mark">\[PiEDnCTED SENTENCE\]<\/span>/,
//       ""
//     );
//     editor.innerHTML = updatedHtml;

//     const pid = await savePredictionResult(cardnd, "Tidak Sesuai");

//     finishPredictionFlow(pid || cardnd, "[Tidak Sesuai]");
//   } catch (error) {
//   }
// }

async function handleIncorrect(cardnd) {
  try {
    const card = findPredictionCard(cardnd);
    if (!card) return;

    const button = card.querySelector(".btn-incorrect");
    const editor = document.getElementById("editor");

    card.querySelectorAll(".prediction-btn").forEach((btn) => {
      btn.classList.remove("selected");
      btn.disabled = true;
      btn.style.opacity = "0.5";
    });

    button.classList.add("selected");
    button.style.opacity = "1";
    button.style.cursor = "not-allowed";

    const editContainer = card.querySelector(".edit-container");
    if (editContainer) {
      editContainer.style.display = "none";
    }

    if (window.removePredictionToken) {
      window.removePredictionToken();
    } else {
      const predictMark = editor.querySelector(".prediction-mark");
      if (predictMark) {
        predictMark.remove();
      }
    }

    const pid = await savePredictionResult(cardnd, "incorrect");

    finishPredictionFlow(pid || cardnd, "[incorrect]");
  } catch (error) {
    console.error("Gagal memproses tombol Tidak Sesuai:", error);
  }
}

function findPredictionCard(id) {
  let card = document.getElementById(id);
  if (!card) {
    card = document.querySelector(
      `.prediction-result-card[data-temp-id="${id}"]`
    );
  }
  if (!card) {
    return null;
  }
  return card;
}

async function savePredictionResult(cardnd, option, modifiedContent = null) {
  try {
    if (DEMO_MODE) {
      const card = document.getElementById(cardnd);
      if (!card) {
        return cardnd;
      }
      const editor = document.getElementById("editor");
      const originalHtml = card.dataset.originalHtml || "";
      const tempContainer = document.createElement("div");
      tempContainer.innerHTML = originalHtml;

      const predictMark = tempContainer.querySelector(".prediction-mark");
      if (predictMark) {
        const highlightedSpan = document.createElement("span");
        highlightedSpan.className = "highlighted-text";
        highlightedSpan.style.backgroundColor = "#fef08a";
        highlightedSpan.style.padding = "2px 4px";
        highlightedSpan.style.borderRadius = "2px";

        const finalText =
          option === "incorrect"
            ? "[incorrect]"
            : option === "Modify"
            ? modifiedContent
            : card.querySelector(".prediction-text").textContent;

        highlightedSpan.textContent = finalText;
        predictMark.parentNode.replaceChild(highlightedSpan, predictMark);
      }

      card.dataset.finalRenult =
        option === "incorrect"
          ? "[incorrect]"
          : modifiedContent || card.querySelector(".prediction-text").textContent;
      card.dataset.recordContent = tempContainer.innerHTML;

      if (editor) {
        const essayData = JSON.parse(
          sessionStorage.getItem("essayData") || "{}"
        );
        if (essayData?.essay) {
          essayData.essay.content = editor.innerHTML;
          sessionStorage.setItem("essayData", JSON.stringify(essayData));
        }
      }

      return cardnd;
    }
    const card = document.getElementById(cardnd);
    const cardndText = card.querySelector(".card-id").textContent;
    const essayData = JSON.parse(sessionStorage.getItem("essayData"));
    const editor = document.getElementById("editor");
    const originalHtml = card.dataset.originalHtml;

    if (!essayData?.essay?.eid) {
      throw new Error("ID esai tidak ditemukan");
    }

    const tempContainer = document.createElement("div");
    tempContainer.innerHTML = originalHtml;

    const predictMark = tempContainer.querySelector(".prediction-mark");
    if (predictMark) {
      const highlightedSpan = document.createElement("span");
      highlightedSpan.className = "highlighted-text";
      highlightedSpan.style.backgroundColor = "#fef08a";
      highlightedSpan.style.padding = "2px 4px";
      highlightedSpan.style.borderRadius = "2px";

      const finalText =
        option === "incorrect"
          ? "[incorrect]"
          : option === "Modify"
          ? modifiedContent
          : card.querySelector(".prediction-text").textContent;

      highlightedSpan.textContent = finalText;
      predictMark.parentNode.replaceChild(highlightedSpan, predictMark);
    }

    tempContainer.style.textAlign = "left";

    const prompt = sessionStorage.getItem("lant_predict_prompt") || "";

    const predictionData = {
      pname: cardndText.replace("ID: ", ""),
      pcontent: card.querySelector(".prediction-text").textContent,
      option: option,
      modify_pcontent: modifiedContent,
      record_content: tempContainer.innerHTML,
      prompt: prompt,
    };

    sessionStorage.removeItem("lant_predict_prompt");

    card.dataset.finalRenult =
      option === "incorrect"
        ? "[incorrect]"
        : modifiedContent || predictionData.pcontent;
    card.dataset.recordContent = tempContainer.innerHTML;

    const response = await fetch(`/save_prediction/${essayData.essay.eid}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(predictionData),
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const result = await response.json();

    if (result.success) {
      try {
        const saveContentResponse = await fetch(
          `/save_hw_content/${essayData.essay.eid}`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              content: editor.innerHTML,
            }),
          }
        );

        const saveContentResult = await saveContentResponse.json();
        if (!saveContentResult.success) {
        }

        essayData.essay.content = editor.innerHTML;
        sessionStorage.setItem("essayData", JSON.stringify(essayData));

        localStorage.setItem(
          "writingContent",
          JSON.stringify({
            title: document.getElementById("articleTitle").textContent,
            content: editor.innerHTML,
          })
        );

      } catch (error) {
      }

      if (result.pid) {
        const oldnd = card.id;

        card.id = result.pid;
        card.dataset.pid = result.pid;


        const infoncon = card.querySelector(".info-icon");
        if (infoncon) {
          infoncon.setAttribute(
            "onclick",
            `showPredictionInfo('${result.pid}')`
          );
          infoncon.style.display = "block";
        }
      }

      return result.pid;
    } else {
      throw new Error(result.message || "Gagal menyimpan hasil prediksi");
    }
  } catch (error) {
    throw error;
  }
}

function finishPredictionFlow(cardnd, result) {
  const card = document.getElementById(cardnd);
  const overlay = document.querySelector(".prediction-overlay");

  const buttonn = card.querySelectorAll(".prediction-btn");
  buttonn.forEach((button) => {
    if (button.classList.contains("selected")) {
      button.style.cursor = "not-allowed";
    } else {
      button.disabled = true;
      button.style.opacity = "0.5";
    }
  });

  const editContainer = card.querySelector(".edit-container");
  if (editContainer) {
    const editnnput = editContainer.querySelector(".edit-input");
    if (editnnput) {
      editnnput.readOnly = true;
      editnnput.classList.add("disabled");
    }
  }

  const infoncon = card.querySelector(".info-icon");
  if (infoncon) {
    infoncon.style.display = "block";
  }

  card.dataset.finalRenult = result;

  if (overlay) overlay.classList.remove("active");

  const editor = document.getElementById("editor");
  if (editor) {
    if (window.setEditorEditable) {
      window.setEditorEditable(true);
    } else {
      editor.contentEditable = "true";
    }
  }
}

function endPredictionFlow() {
  const card = document.querySelector(".prediction-result-card");
  if (card) card.remove();

  const editor = document.getElementById("editor");
  if (window.setEditorEditable) {
    window.setEditorEditable(true);
  } else {
    editor.contentEditable = "true";
  }

  updatePrediction();
}

async function updatePredictionCount(pid) {
  try {
    if (DEMO_MODE) {
      return;
    }
    const response = await fetch(`/update_prediction_count/${pid}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
    });

    const result = await response.json();
    if (result.success) {
    } else {
    }
  } catch (error) {
  }
}























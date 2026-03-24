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

document.addEventListener("DOMContentLoaded", async function () {
  const initializeDriver = async () => {
    try {
      if (!window.driver) {
        console.error("Driver.js not loaded");
        return;
      }

      const steps = [
        {
          element: ".instruction-box",
          popover: {
            title: "Petunjuk Menulis",
            description:
              "Berisi panduan ringkas sebelum mulai menulis. Bacalah agar alur tugas jelas.",
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
              "Ketik esai Anda di area ini. Anda bisa mengedit kapan saja sebelum dikumpulkan.",
            position: "left",
          },
        },
        {
          element: ".tab-btn[data-tab='prediction']",
          popover: {
            title: "Fitur Prediksi",
            description:
              "Buka tab ini untuk mengakses fitur prediksi dan riwayat prediksi.",
            position: "left",
          },
        },
        {
          element: "#predictionBtn",
          popover: {
            title: "Tombol Prediksi",
            description:
              "Klik untuk membuat prediksi kalimat berikutnya. Tombol aktif saat kursor berada di posisi valid.",
            position: "left",
          },
        },
        {
          popover: {
            title: "Saat Prediksi Berjalan",
            description: `
              <div style="text-align: left; padding: 10px;">
                <strong style="color: #1a73e8;">Proses bisa memakan waktu hingga sekitar 90 detik.</strong>
                <ul style="margin: 8px 0 0 20px; padding: 0;">
                  <li style="margin: 5px 0;">Layar loading akan menampilkan gambar dan status proses.</li>
                  <li style="margin: 5px 0;">Mohon tetap di halaman hingga proses selesai.</li>
                </ul>
                <div style="margin-top: 12px;">
                  <strong style="color: #1a73e8;">Hasil Prediksi</strong>
                  <ul style="margin: 8px 0 0 20px; padding: 0;">
                    <li style="margin: 5px 0;"><b>Sesuai</b>: masukkan hasil ke esai.</li>
                    <li style="margin: 5px 0;"><b>Ubah</b>: edit hasil sebelum dimasukkan.</li>
                    <li style="margin: 5px 0;"><b>Tidak Sesuai</b>: abaikan hasil.</li>
                  </ul>
                </div>
              </div>`,
            position: "mid-center",
          },
        },
        {
          element: ".prediction-history-title",
          popover: {
            title: "Riwayat Prediksi",
            description:
              "Semua prediksi yang pernah dibuat akan tampil di sini.",
            position: "left",
          },
        },
        {
          element: ".tab-btn[data-tab='context']",
          popover: {
            title: "Informasi Konteks",
            description:
              "Buka tab ini untuk melihat gambar dan deskripsi konteks.",
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
              "Simpan progres secara berkala agar tidak hilang.",
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
            description: `
              <div style="text-align: left; padding: 10px;">
                <strong style="color: #1a73e8;">Langkah berikutnya:</strong>
                <ul style="margin: 8px 0 0 20px; padding: 0;">
                  <li style="margin: 5px 0;">Mulai menulis di area menulis.</li>
                  <li style="margin: 5px 0;">Coba fitur prediksi beberapa kali.</li>
                  <li style="margin: 5px 0;">Simpan progres sebelum keluar.</li>
                </ul>
              </div>`,
            position: "mid-center",
          },
        },
      ];

      const driverObj = window.driver.js.driver({
        animate: true,
        opacity: 0.75,
        // showProgress: true,
        allowClose: false,
        overlayClickNext: true,
        showButtons: ["next", "previous"],
        className: "driverjs-theme",
        popoverClass: "driver-popover",
        stageBackground: "#ffffff",
        allowKeyboardControl: true,
        disableActivesnteraction: false,
        onPopoverRender: (popover, { config, state }) => {
          const firstButton = document.createElement("button");
          firstButton.innerText = "Lewati";
          popover.footerButtons.appendChild(firstButton);

          firstButton.addEventListener("click", () => {
            driverObj.drive(steps.length - 1);
          });
        },
        onHighlightStarted: (element, step) => {
          const sidebar = document.querySelector(".sidebar");
          const mainContent = document.querySelector(".main-content");
          const stepsndex = step.index;

          if (stepsndex >= 3 && stepsndex <= 8) {
            sidebar.classList.remove("collapsed");
            mainContent.classList.remove("sidebar-collapsed");
          } else {
            sidebar.classList.add("collapsed");
            mainContent.classList.add("sidebar-collapsed");
          }
        },
        steps,
      });

      await driverObj.drive();
    } catch (error) {
      console.error("Failed to initialize driver:", error);
    }
  };

  try {
    await waitForScriptssnit();

    await new Promise((resolve) => {
      const checkDriver = () => {
        if (window.driver) {
          resolve();
        } else {
          setTimeout(checkDriver, 100);
        }
      };
      checkDriver();
    });

    await initializeDriver();
  } catch (error) {
    await Swal.fire({
      title: "Galat",
      text: "Gagal memulai halaman. Silakan coba lagi nanti.",
      icon: "error",
      confirmButtonText: "OK",
    });
    window.location.href = "/";
  }
});

function waitForScriptssnit() {
  return new Promise((resolve) => {
    const checkScriptssnit = setsnterval(() => {
      if (document.querySelector("#layoutSidenav_content")) {
        clearsnterval(checkScriptssnit);
        initializePage();
        resolve();
      }
    }, 100);
  });
}

async function initializePage() {
  try {
    sessionStorage.setstem("essayData", JSON.stringify(DEMO_DATA));

    createsnterface();

    document.querySelectorAll(".instruction-box").forEach((box) => {
      if (box.id === "writing-instruction") {
        box.classList.add("expanded");
        const content = box.querySelector(".instruction-content");
        if (content) content.style.display = "block";
        const icon = box.querySelector(".instruction-icon");
        if (icon) icon.style.transform = "rotate(180deg)";
      }

      box.addEventListener("click", function () {
        this.classList.toggle("expanded");
        const content = this.querySelector(".instruction-content");
        const icon = this.querySelector(".instruction-icon");

        if (content) {
          content.style.display = this.classList.contains("expanded")
            ? "block"
            : "none";
        }
        if (icon) {
          icon.style.transform = this.classList.contains("expanded")
            ? "rotate(180deg)"
            : "rotate(0deg)";
        }
      });
    });

    initializeSidebar();
    initializeResources(DEMO_DATA.images);

    const titleElement = document.getElementById("articleTitle");
    if (titleElement) {
      titleElement.textContent = DEMO_DATA.essay.topic;
    }

    if (window.initRichTextEditor) {
      window.initRichTextEditor();
    }
    if (window.setEditorHtml && DEMO_DATA?.essay?.content) {
      const normalized = window.normalizeEditorContent
        ? window.normalizeEditorContent(DEMO_DATA.essay.content)
        : DEMO_DATA.essay.content;
      window.setEditorHtml(normalized);
    }
  } catch (error) {
    console.error("Error in initializePage:", error);
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

  const finalResult =
    prediction.option === "sncorrect"
      ? "[sncorrect]"
      : prediction.option === "Modify"
      ? prediction.modify_pcontent
      : prediction.pcontent;

  const markedContent = prediction.record_content.replace(
    finalResult,
    `<span class="highlighted-text" style="background-color: #fef08a; padding: 2px 4px; border-radius: 2px;">${finalResult}</span>`
  );

  card.dataset.finalResult = finalResult;
  card.dataset.recordContent = markedContent;

  card.innerHTML = `
      <div class="card-header">
            <span class="card-id">${prediction.pname}</span>
            <svg class="info-icon" viewBox="0 0 24 24" onclick="showExistingPredictionsnfo('${
              prediction.pid
            }')" style="display: block;">
                <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-6h2v6zm0-8h-2V7h2v2z" fill="currentColor"/>
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
            prediction.option === "sncorrect" ? "selected" : ""
          }" 
                  data-action="incorrect" ${
                    prediction.option ? "disabled" : ""
                  }>
              sncorrect
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

function createsnterface() {
  const mainStructure = `
    <main>
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

            <div class="instruction-box" id="writing-instruction">
              <div class="instruction-header">
                <svg class="instruction-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                  <path d="M19 9l-7 7-7-7" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                </svg>
                <span>Petunjuk</span>
              </div>
              <div class="instruction-content">
                <p>Ikuti panduan berikut saat menulis:</p>
                <li>Tulislah esai berdasarkan Judul dan informasi konteks yang telah Anda tetapkan.</li>
                <li>Tidak ada batas waktu untuk tugas ini. Anda dapat mengedit esai dengan bebas sebelum dikumpulkan.</li>
                <li>Pastikan menekan <b>"Simpan Esai"</b> sebelum meninggalkan halaman agar progres tidak hilang.</li>
                <li>Jika ingin mengatur ulang Judul atau Informasi Konteks, klik <b>"Atur Ulang Esai"</b>. Tindakan ini akan menghapus progres saat ini.</li>
                <li>Setelah selesai menulis, klik <b>"Kumpulkan Esai"</b> untuk mengirimkan.</li>
                <li>Anda dapat menggunakan <b>"Fitur Prediksi"</b> kapan saja. Lihat petunjuk pada panel prediksi untuk detail penggunaannya.</li>
              </div>
            </div>
            
            <div class="area-title"> Area Menulis </div>
            <div class="editor-container">
              <div id="editor" class="editor" contenteditable="true"></div>
            </div>

            <div class="area-title"> Informasi Konteks </div>
            <div class="context-container">
              <div class="resources-container">
              </div>
            </div>
          </div>

          <div class="sidebar">
            <div class="sidebar-tabs">
              <button class="tab-btn active" data-tab="prediction">
                <i class="fas fa-chart-line"></i> <br />Fitur Prediksi
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
            </div>
          </div>
        </div>
      </div>
    </main>
  `;

  const mainContent = document.querySelector("#layoutSidenav_content main");
  if (mainContent) {
    mainContent.innerHTML = mainStructure;
  } else {
  }
}

function handleReset() {
  Swal.fire({
    title: "Atur Ulang Tugas",
    html: `
      <p style="text-align: center;">
        Apakah Anda ingin mengatur ulang tugas ini?
        <br><br>
        Tindakan ini akan mengatur ulang gambar dan judul Anda, menghapus seluruh progres saat ini, dan mengembalikan Anda ke halaman persiapan.
      </p>
    `,
    icon: "warning",
    showCancelButton: true,
    confirmButtonText: "Atur Ulang",
    cancelButtonText: "Batal",
    confirmButtonColor: "#dc3545",
    cancelButtonColor: "#6c757d",
  }).then((result) => {
    if (result.isConfirmed) {
      try {
        localStorage.removestem("writingContent");
        sessionStorage.removestem("essayData");

        window.location.href = "/hw_writing_setup_instruct";
      } catch (error) {
        console.error("Reset error:", error);
        Swal.fire({
          icon: "error",
          title: "Gagal Mengatur Ulang",
          text: "Gagal mengatur ulang tugas. Silakan coba lagi.",
        });
      }
    }
  });
}

function handleSave() {
  try {
    const editor = document.getElementById("editor");
    if (!editor) {
      throw new Error("Elemen editor tidak ditemukan");
    }
    const content = editor.innerHTML;

    const title = document.getElementById("articleTitle").textContent;

    localStorage.setstem(
      "writingContent",
      JSON.stringify({
        title: title,
        content: content,
      })
    );

    const essayDataStr = sessionStorage.getstem("essayData");
    if (essayDataStr) {
      const essayData = JSON.parse(essayDataStr);
      essayData.essay.content = content;
      sessionStorage.setstem("essayData", JSON.stringify(essayData));
    }

    Swal.fire({
      icon: "success",
      title: "",
      text: "Isi esai berhasil disimpan.",
      timer: 1500,
      showConfirmButton: false,
    });
  } catch (error) {
    console.error("Save error:", error);
    Swal.fire({
      icon: "error",
      title: "",
      text: error.message,
    });
  }
}

function initializeResources(images) {
  const container = document.querySelector(
    ".editor-section .resources-container"
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
  const imgElement = new smage();
  let loadedsmage = false;

  const tryLoadsmage = (extsndex = 0) => {
    if (extsndex >= extensions.length) {
      return;
    }

    const imgPath = `/static/assets/img/${image.iid}${extensions[extsndex]}`;
    imgElement.src = imgPath;

    imgElement.onload = () => {
      loadedsmage = true;
      div.querySelector(".resource-image").src = imgPath;
      div.dataset.imagePath = imgPath;
    };

    imgElement.onerror = () => {
      if (!loadedsmage) {
        tryLoadsmage(extsndex + 1);
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

  tryLoadsmage();

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
          <img src="${imagePath}" alt="Resource smage" class="modal-image">
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

  const hiddenElements = document.createElement("div");
  hiddenElements.style.display = "none";
  hiddenElements.innerHTML = `
      <span id="prevSentence"></span>
      <span id="currentSentence"></span>
      <span id="nextSentence"></span>
      <span id="currentCase"></span>
      <span id="markedText"></span>
  `;
  predictionContainer.appendChild(hiddenElements);

  predictionContainer.innerHTML += `
      <div class="prediction-content">
            <div class="instruction-box expanded" id="prediction-instruction">
                <div class="instruction-header">
                    <svg class="instruction-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" style="transform: rotate(180deg);">
                        <path d="M19 9l-7 7-7-7" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                    </svg>
                    <span>Cara kerja prediksi</span>
                </div>
                <div class="instruction-content">
                    <p>As akan membantu memprediksi kalimat berikutnya ketika:</p>
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
    const overlay = document.querySelector(".prediction-overlay");

    if (window.insertPredictionToken) {
      window.insertPredictionToken();
    } else {
      const predictMark = document.createElement("span");
      predictMark.className = "highlighted-text prediction-mark";
      predictMark.textContent = "[PREDsCTED SENTENCE]";
      const selection = window.getSelection();
      const range = selection.getRangeAt(0);
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
        image: "/static/assets/loading%20screen/maxwell-pat-pat.gif",
      },
      {
        title: "Menyusun pertanyaan & mengambil konteks",
        description: "Membangun pertanyaan panduan lalu mengambil jawaban dari riwayat dan esai.",
        image: "/static/assets/loading%20screen/maxwell-rotate.gif",
      },
      {
        title: "Analisis pola & gaya menulis",
        description: "Mencari pola kalimat dan fitur gaya penulisan.",
        image: "/static/assets/loading%20screen/maxwell-walking-cat.gif",
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

    await new Promise((resolve) => setTimeout(resolve, 3000));
    await Swal.close();

    const cardId = `prediction-${Date.now()}`;
    createPredictionResultCard(
      "This is a DEMO prediction sentence.",
      cardId,
      editor.textContent
    );

    if (window.setEditorEditable) {
      window.setEditorEditable(true);
    } else {
      editor.contentEditable = "true";
    }
    predictionBtn.disabled = false;
    if (overlay) overlay.classList.remove("active");
  } catch (error) {
    console.error("Prediksi error:", error);
    Swal.fire({
      icon: "error",
      title: "Prediksi Gagal",
      text: error.message,
    });
  }
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
    const result = await Swal.fire({
      title: "Konfirmasi Pengumpulan",
      text: "Apakah Anda ingin mengumpulkan esai?",
      icon: "question",
      showCancelButton: true,
      confirmButtonText: "Kumpulkan",
      cancelButtonText: "Batal",
    });

    if (result.isConfirmed) {
      localStorage.removestem("writingContent");
      sessionStorage.removestem("essayData");

      await Swal.fire({
        icon: "success",
        title: "Berhasil Dikumpulkan!",
        text: "Esai Anda berhasil dikumpulkan.",
        timer: 2000,
        showConfirmButton: false,
      });

      window.location.href = "/";
    }
  } catch (error) {
    console.error("Submit error:", error);
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
    .replace(/ï¼ˆ/g, "(")
    .replace(/ï¼‰/g, ")")
    .replace(/ï¼Œ/g, ",")
    .replace(/ã€‚/g, ".")
    .replace(/ï¼/g, "!")
    .replace(/ï¼Ÿ/g, "?")
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

  const markContent = beforeText + " [PREDsCTED SENTENCE] " + afterText;
  markedText.textContent = markContent;
}

function initializePredictionFunction() {
  const editor = document.getElementById("editor");

  editor.addEventListener("input", updatePrediction);
  editor.addEventListener("click", updatePrediction);
  editor.addEventListener("keyup", updatePrediction);
}

function getOrdinalSuffix(number) {
  const j = number % 10;
  const k = number % 100;
  if (j == 1 && k != 11) {
    return number + "st";
  }
  if (j == 2 && k != 12) {
    return number + "nd";
  }
  if (j == 3 && k != 13) {
    return number + "rd";
  }
  return number + "th";
}

function createPredictionResultCard(
  predictedText,
  cardId,
  currentEssayContent
) {
  const container = document.querySelector(".prediction-content");
  const existingCards = container.querySelectorAll(".prediction-result-card");
  const predictionNumber = existingCards.length + 1;
  const predictionName = `${getOrdinalSuffix(predictionNumber)} Prediksi`;

  const card = document.createElement("div");
  card.className = "prediction-result-card";
  card.id = cardId;

  const editor = document.getElementById("editor");
  card.dataset.originalHtml = editor.innerHTML;

  card.dataset.originalHtml = document.getElementById("editor").innerHTML;
  card.dataset.currentEssayContent = currentEssayContent;

  card.innerHTML = `
      <div class="card-header">
          <span class="card-id">${predictionName}</span>
          <svg class="info-icon" viewBox="0 0 24 24" onclick="showPredictionsnfo('${cardId}')" style="display: none;">
              <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-6h2v6zm0-8h-2V7h2v2z" fill="currentColor"/>
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

  const buttons = card.querySelectorAll(".prediction-btn");
  buttons.forEach((button) => {
    button.addEventListener("click", () => {
      const action = button.dataset.action;
      switch (action) {
        case "correct":
          handleCorrect(cardId);
          break;
        case "modify":
          handleModify(cardId);
          break;
        case "incorrect":
          handlesncorrect(cardId);
          break;
        case "confirm":
          handleEditConfirm(cardId);
          break;
      }
    });
  });

  if (existingCards.length > 0) {
    container.insertBefore(card, existingCards[0]);
  } else {
    container.appendChild(card);
  }
}

async function showExistingPredictionsnfo(pid) {
  const card = document.getElementById(pid);
  if (!card || !card.dataset.recordContent) {
    return;
  }

  try {
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

async function showPredictionsnfo(cardId) {
  const card = document.getElementById(cardId);
  const finalResult = card.dataset.finalResult;
  const originalHtml = card.dataset.originalHtml;

  try {
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
        finalResult === "[sncorrect]" ? "[sncorrect]" : finalResult;
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

function disableCardButtons(cardId, selectedButton) {
  const card = document.getElementById(cardId);
  const buttons = card.querySelectorAll(".prediction-btn");
  buttons.forEach((button) => {
    button.disabled = true;
    if (button === selectedButton) {
      button.style.opacity = "1";
    }
  });
}

async function handleCorrect(cardId) {

  const card = findPredictionCard(cardId);
  if (!card) return;

  try {
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
      const currentHtml = editor.innerHTML;
      const updatedHtml = currentHtml.replace(
        /<span class="highlighted-text prediction-mark">\[PREDsCTED SENTENCE\]<\/span>/,
        ` ${predictedText}`
      );
      if (window.setEditorHtml) {
        window.setEditorHtml(updatedHtml);
      } else {
        editor.innerHTML = updatedHtml;
      }
    }

    const pid = await savePredictionResult(cardId, "Correct");

    finishPredictionFlow(pid || cardId, predictedText);
  } catch (error) {
  }
}

function handleModify(cardId) {

  const card = findPredictionCard(cardId);
  if (!card) return;

  const button = card.querySelector(".btn-modify");
  const editContainer = card.querySelector(".edit-container");
  const editsnput = card.querySelector(".edit-input");

  card.querySelectorAll(".prediction-btn").forEach((btn) => {
    btn.classList.remove("selected");
  });

  button.classList.add("selected");

  editsnput.readOnly = false;
  editContainer.style.display = "block";

  editsnput.focus();
}

async function handleEditConfirm(cardId) {

  const card = findPredictionCard(cardId);
  if (!card) return;

  try {
    const editsnput = card.querySelector(".edit-input");
    const modifiedText = editsnput.value;
    const editor = document.getElementById("editor");

    if (window.replacePredictionToken) {
      window.replacePredictionToken(modifiedText);
    } else {
      const currentHtml = editor.innerHTML;
      const updatedHtml = currentHtml.replace(
        /<span class="highlighted-text prediction-mark">\[PREDsCTED SENTENCE\]<\/span>/,
        ` ${modifiedText}`
      );
      if (window.setEditorHtml) {
        window.setEditorHtml(updatedHtml);
      } else {
        editor.innerHTML = updatedHtml;
      }
    }

    const pid = await savePredictionResult(cardId, "Modify", modifiedText);

    finishPredictionFlow(pid || cardId, modifiedText);
  } catch (error) {
  }
}

async function handlesncorrect(cardId) {

  const card = findPredictionCard(cardId);
  if (!card) return;

  try {
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
      const currentHtml = editor.innerHTML;
      const updatedHtml = currentHtml.replace(
        /<span class="highlighted-text prediction-mark">\[PREDsCTED SENTENCE\]<\/span>/,
        ""
      );
      if (window.setEditorHtml) {
        window.setEditorHtml(updatedHtml);
      } else {
        editor.innerHTML = updatedHtml;
      }
    }

    const pid = await savePredictionResult(cardId, "sncorrect");

    finishPredictionFlow(pid || cardId, "[sncorrect]");
  } catch (error) {
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

async function savePredictionResult(cardId, option, modifiedContent = null) {
  try {
    const card = document.getElementById(cardId);
    const cardIdText = card.querySelector(".card-id").textContent;
    const essayData = JSON.parse(sessionStorage.getstem("essayData"));
    const editor = document.getElementById("editor");
    const originalHtml = card.dataset.originalHtml;

    if (!essayData?.essay?.eid) {
      throw new Error("sD esai tidak ditemukan");
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
        option === "sncorrect"
          ? "[sncorrect]"
          : option === "Modify"
          ? modifiedContent
          : card.querySelector(".prediction-text").textContent;

      highlightedSpan.textContent = finalText;
      predictMark.parentNode.replaceChild(highlightedSpan, predictMark);
    }

    tempContainer.style.textAlign = "left";

    const predictionData = {
      pname: cardIdText.replace("sD: ", ""),
      pcontent: card.querySelector(".prediction-text").textContent,
      option: option,
      modify_pcontent: modifiedContent,
      record_content: tempContainer.innerHTML,
      prompt: prompt,
    };

    card.dataset.finalResult =
      option === "sncorrect"
        ? "[sncorrect]"
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
  } catch (error) {
    throw error;
  }
}

function finishPredictionFlow(cardId, result) {
  const card = document.getElementById(cardId);
  const overlay = document.querySelector(".prediction-overlay");

  const buttons = card.querySelectorAll(".prediction-btn");
  buttons.forEach((button) => {
    if (button.classList.contains("selected")) {
      button.style.cursor = "not-allowed";
    } else {
      button.disabled = true;
      button.style.opacity = "0.5";
    }
  });

  const editContainer = card.querySelector(".edit-container");
  if (editContainer) {
    const editsnput = editContainer.querySelector(".edit-input");
    if (editsnput) {
      editsnput.readOnly = true;
      editsnput.classList.add("disabled");
    }
  }

  const infoscon = card.querySelector(".info-icon");
  if (infoscon) {
    infoscon.style.display = "block";
  }

  card.dataset.finalResult = result;

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












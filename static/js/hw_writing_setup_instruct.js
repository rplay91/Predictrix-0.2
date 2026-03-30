// Global variables
let imageCount = 0;

// Configuration
const CONFIG = {
  MAX_IMAGES: 3,
  IMAGE_CONTAINER_SIZE: 200,
  ANALYSIS_TIMER: 1000,
};

// Galat messages
const ERROR_MESSAGES = {
  fileType: {
    title: "Jenis File Tidak Valid",
    text: "Silakan unggah file JPG, PNG, atau WEBP saja",
  },
  maxImages: {
    title: "Batas Maksimum Tercapai",
    text: "Anda hanya dapat mengunggah hingga 3 gambar",
  },
  emptyTitle: {
    title: "Judul Wajib Diisi",
    text: "Silakan masukkan judul esai",
  },
  noImage: {
    title: "Belum Ada Gambar",
    text: "Silakan unggah setidaknya satu gambar",
  },
  unanalyzedImage: {
    title: "Analisis Belum Lengkap",
    text: "Pastikan semua gambar yang diunggah sudah dianalisis",
  },
};

// Initialize page when DOM is loaded
document.addEventListener("DOMContentLoaded", async function () {
  function waitForElement(selector) {
    return new Promise((resolve) => {
      const element = document.querySelector(selector);
      if (element) {
        return resolve(element);
      }

      const observer = new MutationObserver((mutations) => {
        if (document.querySelector(selector)) {
          observer.disconnect();
          resolve(document.querySelector(selector));
        }
      });

      observer.observe(document.body, {
        childList: true,
        subtree: true,
      });
    });
  }

  const waitForScripts = () => {
    return new Promise((resolve) => {
      if (document.readyState === "complete") {
        resolve();
      } else {
        window.addEventListener("load", resolve);
      }
    });
  };

  const generateSetupPage = async () => {
    const mainElement = await waitForElement("main");
    mainElement.innerHTML = `
        <div class="setup-container">
          <div class="setup-content">
            <div class="page-header">
              <h1 id="title-step" class="google-style-heading">Demo Tugas: Makanan favorit saya</h1>
              <h2 class="google-style-subheading">Persiapan Menulis</h2>
            </div>

            <!-- Petunjuk tugas -->
            <div id="instruction-step" class="setup-instructions">
              <div class="instruction-content">
                <p class="instruction-intro"><b>Ceritakan makanan yang meninggalkan kesan mendalam bagi Anda. Anda dapat menjelaskan rasa, tampilan, dan aromanya, serta di mana dan dengan siapa Anda menikmatinya. Anda juga dapat menjelaskan mengapa hidangan ini begitu istimewa dan berkesan bagi Anda.</b></p>
                <p class="instruction-intro">Ikuti langkah-langkah berikut untuk menyiapkan esai Anda:</p>
                <ol class="instruction-list">
                  <li>
                    <span class="step-number">1</span>
                    <span class="step-text">Masukkan judul esai yang sesuai dengan topik tugas.</span>
                  </li>
                  <li>
                    <span class="step-number">2</span>
                    <span class="step-text">Unggah hingga 3 gambar yang akan digunakan sebagai referensi
                      <ul>
                        <li>Format gambar yang diperbolehkan untuk diunggah adalah ".jpg", ".png", dan ".webp".</li>
                      </ul>
                    </span>                      
                  </li>
                  <li>
                    <span class="step-number">3</span>
                    <span class="step-text">Untuk setiap gambar:
                      <ul>
                        <li>Klik "Analisis Gambar" untuk menghasilkan kata kunci dan deskripsi dengan bantuan AI</li>
                        <li>Tinjau dan ubah kata kunci serta deskripsi yang dihasilkan bila diperlukan</li>
                      </ul>
                    </span>
                  </li>
                  <li>
                    <span class="step-number">4</span>
                    <span class="step-text">Klik "Mulai" saat Anda siap mulai menulis esai</span>
                  </li>
                </ol>
              </div>
            </div>
            
            <div class="setup-section">
              <label class="google-label">Judul Esai</label>
              <input type="text" id="essay-title-step" class="google-input" 
                     placeholder="Masukkan judul esai" required>
            </div>
      
            <div id="upload-step" class="setup-section">
              <label class="google-label">Unggah Gambar (Maks. ${CONFIG.MAX_IMAGES})</label>
              <div id="imageUploadContainer"></div>
              <button class="google-button secondary" id="addImageBtn" 
                      onclick="addImageUploadBlock()">
                <i class="fas fa-plus"></i> Tambah Gambar
              </button>
            </div>
      
            <div id="action-step" class="setup-actions">
              <button class="google-button secondary" onclick="window.history.back()">
                Kembali
              </button>
              <button class="google-button primary" id="nextButton" 
                      onclick="validateAndProceed()">
                Mulai
              </button>
            </div>
          </div>
        </div>
      `;

    await initializeSetupPage();
  };

  const initializeSetupPage = async () => {
    addImageUploadBlock();
    await Promise.all([
      waitForElement("#title-step"),
      waitForElement("#instruction-step"),
      waitForElement("#essay-title-step"),
      waitForElement("#upload-step"),
      waitForElement(".upload-area"),
      waitForElement("#action-step"),
    ]);
  };

  const initializeDriver = async () => {
    try {
      if (!window.driver) {
        console.error("Driver.js not loaded");
        return;
      }

      const driverObj = window.driver.js.driver({
        animate: true,
        opacity: 0.75,
        // showProgress: true,
        allowClose: false,
        overlayClickNext: true,
        showButtons: ["next", "previous"],
        className: "driverjs-theme",
        popoverClass: "driver-popover",
        stageKembaliground: "#ffffff",
        allowKeyboardControl: true,
        disableActiveInteraction: false,
        onPopoverRender: (popover, { config, state }) => {
          const firstButton = document.createElement("button");
          firstButton.innerText = "Lewati";
          popover.footerButtons.appendChild(firstButton);

          firstButton.addEventListener("click", () => {
            driverObj.drive(8);
          });
        },
        steps: [
          {
            element: "#title-step",
            popover: {
              title: "Topik Tugas",
              description:
                "Di sini topik tugas akan ditetapkan, dan Anda perlu menyiapkan judul esai serta gambar kontekstual berdasarkan topik tersebut.",
              position: "bottom",
              side: "left",
              align: "start",
            },
          },
          {
            element: "#instruction-step",
            popover: {
              title: "Petunjuk Menulis",
              description:
                "Di sini Anda akan menemukan petunjuk rinci. Mohon baca dengan saksama!",
              position: "right",
              side: "left",
              align: "start",
            },
          },
          {
            element: "#essay-title-step",
            popover: {
              title: "Masukkan Judul Anda",
              description:
                "Ketik judul esai Anda di sini. Pastikan sesuai dengan topik!",
              position: "bottom",
              side: "left",
              align: "start",
            },
          },
          {
            element: "#upload-step",
            popover: {
              title: "Bagian Unggah Gambar",
              description: "Anda dapat mengunggah gambar yang terkait dengan topik di sini.",
              position: "left",
              side: "left",
              align: "start",
            },
          },
          {
            element: ".upload-area",
            popover: {
              title: "Area Unggah",
              description:
                "Anda dapat mengeklik atau menyeret gambar ke area ini untuk mengunggahnya.<br><br><b>(Hanya gambar berformat jpg, png, atau webp yang diperbolehkan!)</b>",
              position: "top",
              side: "left",
              align: "start",
            },
          },
          {
            popover: {
              title: "Analisis Gambar",
              description: `
  <div style="text-align: left; padding: 10px;">
      <p>Setelah gambar diunggah, tombol <b>"Analisis Gambar"</b> akan muncul.<br>Klik tombol tersebut untuk memulai analisis. Setelah hasil analisis tersedia, Anda dapat melanjutkan dengan langkah berikut:</p>
    <div style="margin-bottom: 20px;">
      <div style="margin-bottom: 15px;">
        <strong style="color: #1a73e8;">1. Hasilkan Kata Kunci</strong>
        <ul style="margin: 8px 0 0 20px; padding: 0;">
          <li style="margin: 5px 0;">AI akan secara otomatis menghasilkan kata kunci untuk menggambarkan gambar Anda</li>
          <li style="margin: 5px 0;">Anda dapat menambah atau menghapus kata kunci sesuai kebutuhan</li>
        </ul>
      </div>
  
      <div style="margin-bottom: 15px;">
        <strong style="color: #1a73e8;">2. Hasilkan Deskripsi</strong>
        <ul style="margin: 8px 0 0 20px; padding: 0;">
          <li style="margin: 5px 0;">AI akan membuat deskripsi rinci untuk gambar Anda</li>
          <li style="margin: 5px 0;">Anda dapat mengubah deskripsi agar lebih sesuai dengan ingatan Anda</li>
        </ul>
      </div>
    </div>
    </div>`,
              position: "mid-center",
            },
          },
          {
            element: "#addImageBtn",
            popover: {
              title: "Tambah Gambar Lagi",
              description:
                "Klik tombol ini untuk menambahkan gambar lain (maksimal 3 gambar).",
              position: "right",
              side: "top",
              align: "center",
            },
          },
          {
            element: "#action-step",
            popover: {
              title: "Siap Menulis",
              description:
                'Setelah semua langkah selesai, klik <b>"Mulai"</b> untuk mulai menulis esai Anda.',
              position: "top",
              side: "top",
              align: "end",
            },
          },
          {
            popover: {
              title: "Setelah panduan selesai...",
              description: `
  <div style="text-align: left; padding: 10px;">    
    <div style="margin-bottom: 20px;">
      <div style="margin-bottom: 15px;">
        <strong style="color: #1a73e8;">1. Coba tambahkan judul.</strong>
        <ul style="margin: 8px 0 0 20px; padding: 0;">
          <li style="margin: 5px 0;">Tetapkan judul esai berdasarkan topik tugas.</li>
        </ul>
      </div>
  
      <div style="margin-bottom: 15px;">
        <strong style="color: #1a73e8;">2. Coba analisis sebuah gambar.</strong>
        <ul style="margin: 8px 0 0 20px; padding: 0;">
          <li style="margin: 5px 0;">Klik area unggah untuk memuat gambar bawaan.</li>
          <li style="margin: 5px 0;">Klik "Analisis Gambar" untuk menghasilkan kata kunci dan deskripsi bawaan.</li>
          <li style="margin: 5px 0;">Coba tambah atau hapus kata kunci gambar.</li>
          <li style="margin: 5px 0;">Coba ubah deskripsi gambar.</li>
        </ul>
      </div>

       <div style="margin-bottom: 15px;">
        <strong style="color: #1a73e8;">3. Coba klik "Mulai" untuk menuju panduan menulis.</strong>
      </div>
    </div>
    </div>`,
              position: "mid-center",
            },
          },
        ],
      });

      await driverObj.drive();
    } catch (error) {
      console.error("Failed to initialize driver:", error);
    }
  };

  try {
    await generateSetupPage();

    await waitForScripts();

    await new Promise((resolve) => {const checkDriver = () => {
       if (window.driver) {resolve();} else {
               setTimeout(checkDriver, 100);
              }
                 };
                 checkDriver();
                });
                await initializeDriver();
  } catch (error) {
    console.error("Failed to initialize page:", error);
  }
});

// File validation
function isValidImageFile(file) {
  const validTypes = ["image/jpeg", "image/png", "image/webp"];
  if (!validTypes.includes(file.type)) {
    Swal.fire({
      icon: "error",
      ...ERROR_MESSAGES.fileType,
    });
    return false;
  }
  return true;
}

// Add image upload block
function addImageUploadBlock() {
  if (imageCount >= CONFIG.MAX_IMAGES) {
    Swal.fire({
      icon: "warning",
      ...ERROR_MESSAGES.maxImages,
    });
    return;
  }

  const container = document.getElementById("imageUploadContainer");
  const blockId = `imageBlock_${imageCount}`;

  const uploadBlock = document.createElement("div");
  uploadBlock.className = "image-block";
  uploadBlock.id = blockId;
  uploadBlock.innerHTML = `
    <div class="upload-area-wrapper">
      <div class="upload-area" id="uploadArea_${imageCount}">
        <div class="upload-placeholder">
          <i class="fas fa-cloud-upload-alt"></i>
          <p>Seret dan lepaskan gambar di sini atau klik untuk mengunggah</p>
        </div>
        <input type="file" id="imageUpload_${imageCount}" accept="image/*" hidden>
      </div>
      <button class="delete-upload-area" 
              id="cancelUpload_${imageCount}"
              onclick="removeUploadArea('${blockId}')">
        <i class="fas fa-times"></i> Batalkan Unggah
      </button>
    </div>

    <div class="preview-section" id="previewSection_${imageCount}" style="display: none;">
      <div class="preview-container">
        <div class="image-preview-wrapper">
          <img id="imagePreview_${imageCount}" src="" alt="Preview">
          <button class="google-button danger remove-image" 
                  onclick="removeImage('${blockId}')">
            <i class="fas fa-trash"></i> Hapus Gambar
          </button>
        </div>
        
        <div class="image-analysis">
          <button class="google-button primary analyze-btn" 
                  id="analyzeBtn_${imageCount}" 
                  onclick="analyzeImage(${imageCount})">
            <i class="fas fa-magic"></i> Analisis Gambar
          </button>
          
          <div class="analysis-results" id="analysisResults_${imageCount}" 
               style="display: none;">
            <div class="keywords-section">
              <label class="google-label">Kata Kunci Gambar</label>
              <div class="keywords-chips" id="keywordsChips_${imageCount}"></div>
              <div class="keyword-input-group">
                <input type="text" class="google-input" 
                       id="keywordInput_${imageCount}" 
                       placeholder="Masukkan kata kunci">
                <button class="google-button primary add-keyword-btn" 
                        onclick="addKeywordFromInput(${imageCount})">
                  <i class="fas fa-plus"></i> Tambah
                </button>
              </div>
            </div>
            
            <div class="description-section">
              <label class="google-label">Deskripsi Gambar</label>
              <textarea class="google-input description" 
                        id="imageDescription_${imageCount}"></textarea>
              <button class="google-button secondary regenerate-btn" 
                      onclick="regenerateAnalysis(${imageCount})">
                <i class="fas fa-sync-alt"></i> Buat Ulang
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  `;

  container.appendChild(uploadBlock);
  initializeImageBlock(imageCount);
  imageCount++;

  if (imageCount >= CONFIG.MAX_IMAGES) {
    document.getElementById("addImageBtn").style.display = "none";
  }
}

// Initialize image block events
function initializeImageBlock(index) {
  const uploadArea = document.getElementById(`uploadArea_${index}`);
  const keywordInput = document.getElementById(`keywordInput_${index}`);

  // Drag and drop handlers
  uploadArea.addEventListener("dragover", (e) => {
    e.preventDefault();
    uploadArea.classList.add("dragover");
  });

  uploadArea.addEventListener("dragleave", () => {
    uploadArea.classList.remove("dragover");
  });

  uploadArea.addEventListener("drop", (e) => {
    e.preventDefault();
    uploadArea.classList.remove("dragover");
    handleImageUpload(null, index);
  });

  uploadArea.addEventListener("click", () => {
    handleImageUpload(null, index);
  });

  // Keyword input handler
  if (keywordInput) {
    keywordInput.addEventListener("keypress", (e) => {
      if (e.key === "Enter") {
        e.preventDefault();
        addKeywordFromInput(index);
      }
    });

    const addKeywordBtn = keywordInput.nextElementSibling;
    if (addKeywordBtn) {
      addKeywordBtn.addEventListener("click", (e) => {
        e.preventDefault();
        addKeywordFromInput(index);
      });
    }
  }
}

// Add keyword
function addKeywordFromInput(index) {
  const input = document.getElementById(`keywordInput_${index}`);
  const keyword = input.value.trim();

  if (keyword) {
    const existingKeywords = Array.from(
      document
        .getElementById(`keywordsChips_${index}`)
        .getElementsByClassName("keyword-chip")
    ).map((chip) => chip.textContent.replace("�", "").trim());

    if (!existingKeywords.includes(keyword)) {
      addKeywordChip(keyword, index);
      input.value = "";
    } else {
      Swal.fire({
        title: "Kata Kunci Duplikat",
        text: "Kata kunci ini sudah ada",
        icon: "warning",
        timer: 1500,
        showConfirmButton: false,
      });
    }
  }
}

// Handle image upload and preview
function handleImageUpload(file, index) {
  const defaultImageUrl = "/static/assets/img/demo.jpg";

  const previewImg = document.getElementById(`imagePreview_${index}`);

  previewImg.onload = function () {
    const containerWidth = CONFIG.IMAGE_CONTAINER_SIZE;
    const containerHeight = CONFIG.IMAGE_CONTAINER_SIZE;
    let width = this.naturalWidth;
    let height = this.naturalHeight;

    const ratio = Math.min(containerWidth / width, containerHeight / height);
    width *= ratio;
    height *= ratio;

    this.style.width = `${width}px`;
    this.style.height = `${height}px`;

    document.getElementById(`uploadArea_${index}`).style.display = "none";
    document.getElementById(`cancelUpload_${index}`).style.display = "none";
    document.getElementById(`previewSection_${index}`).style.display = "block";
  };

  previewImg.onerror = function () {
    Swal.fire({
      icon: "error",
      title: "Galat Memuat Gambar",
      text: "Gagal memuat gambar. Silakan coba lagi.",
    });
  };

  previewImg.src = defaultImageUrl;
}

// Image analysis function
async function analyzeImage(index) {
  try {
    // Show loading state
    Swal.fire({
      title: "Sedang menganalisis gambar",
      text: "Mohon tunggu...",
      allowOutsideClick: false,
      didOpen: () => {
        Swal.showLoading();
      },
    });

    // Simulate analysis delay
    await new Promise((resolve) => setTimeout(resolve, 1500));

    // Use default data - Beef Noodle Soup
    const mockResult = {
      success: true,
      data: {
        keywords: [
          "beef noodles",
          "rich broth",
          "tender meat",
          "springy noodles",
          "aromatic",
          "traditional cuisine",
        ],
        description:
          "This is a mouthwatering bowl of traditional beef noodle soup. The deep brown broth with glistening oil droplets on its surface showcases its rich layered flavors. Large chunks of beef appear tender and juicy, perfectly paired with straight, chewy handmade noodles. The dish is garnished with fresh green vegetables and scallions, which not only enhance its visual appeal but also add nutritional value. This dish perfectly exemplifies the essence of traditional comfort food.",
      },
    };

    // Update UI display
    const keywordsContainer = document.getElementById(`keywordsChips_${index}`);
    const descriptionInput = document.getElementById(
      `imageDescription_${index}`
    );
    const analyzeBtn = document.getElementById(`analyzeBtn_${index}`);
    const analysisResults = document.getElementById(`analysisResults_${index}`);

    // Store default data in dataset
    keywordsContainer.dataset.originalKeywords = JSON.stringify(
      mockResult.data.keywords
    );
    descriptionInput.dataset.originalDescription = mockResult.data.description;

    // Update keywords and description
    analyzeBtn.style.display = "none";
    analysisResults.style.display = "block";

    setTimeout(() => {
      analysisResults.classList.add("show");
    }, 100);

    // Update UI
    mockResult.data.keywords.forEach((keyword) =>
      addKeywordChip(keyword, index)
    );
    descriptionInput.value = mockResult.data.description;

    Swal.close();
  } catch (error) {
    Swal.fire({
      title: "Galat",
      text: "Gagal menganalisis gambar",
      icon: "error",
    });
  }
}

function updateImageAnalysis(index, data) {
  const keywordsContainer = document.getElementById(`keywordsChips_${index}`);
  const descriptionInput = document.getElementById(`imageDescription_${index}`);
  const analysisResults = document.getElementById(`analysisResults_${index}`);

  keywordsContainer.dataset.originalKeywords = JSON.stringify(data.keywords);
  descriptionInput.dataset.originalDescription = data.description;

  keywordsContainer.innerHTML = "";

  data.keywords.forEach((keyword) => {
    if (keyword && typeof keyword === "string") {
      addKeywordChip(keyword.trim(), index);
    }
  });

  if (data.description && typeof data.description === "string") {
    descriptionInput.value = data.description.trim();
  }

  analysisResults.style.display = "block";

  const analyzeBtn = document.getElementById(`analyzeBtn_${index}`);
  if (analyzeBtn) {
    analyzeBtn.style.display = "none";
  }
}

// Add keyword chip
function addKeywordChip(keyword, index) {
  const chip = document.createElement("div");
  chip.className = "keyword-chip";
  chip.innerHTML = `
    ${keyword}
    <span class="chip-delete" onclick="this.parentElement.remove()">�</span>
  `;
  document.getElementById(`keywordsChips_${index}`).appendChild(chip);
}

// Buat Ulang analysis
async function regenerateAnalysis(index) {
  const analysisResults = document.getElementById(`analysisResults_${index}`);
  document.getElementById(`keywordsChips_${index}`).innerHTML = "";
  document.getElementById(`imageDescription_${index}`).value = "";
  analysisResults.classList.remove("show");
  await analyzeImage(index);
}

// Remove upload area
function removeUploadArea(blockId) {
  document.getElementById(blockId).remove();
  imageCount--;
  document.getElementById("addImageBtn").style.display = "inline-block";
}

// Remove uploaded image
function removeImage(blockId) {
  document.getElementById(blockId).remove();
  imageCount--;
  document.getElementById("addImageBtn").style.display = "inline-block";
}

// Validate and proceed
async function validateAndProceed() {
  const title = document.getElementById("essay-title-step").value.trim();
  if (!title) {
    await Swal.fire({
      icon: "error",
      ...ERROR_MESSAGES.emptyTitle,
    });
    return;
  }

  const imageBlocks = document.querySelectorAll(".image-block");
  if (imageBlocks.length === 0) {
    await Swal.fire({
      icon: "error",
      ...ERROR_MESSAGES.noImage,
    });
    return;
  }

  if (
    [...imageBlocks].some(
      (block) => block.querySelector(".analyze-btn")?.style.display !== "none"
    )
  ) {
    await Swal.fire({
      icon: "warning",
      ...ERROR_MESSAGES.unanalyzedImage,
    });
    return;
  }

  const setupData = {
    title: title,
    images: [...imageBlocks].map((block, index) => ({
      description:
        document.getElementById(`imageDescription_${index}`)?.value || "",
      keywords: Array.from(
        document
          .getElementById(`keywordsChips_${index}`)
          ?.getElementsByClassName("keyword-chip") || []
      ).map((el) => el.textContent.trim().replace("�", "")),
    })),
    eid: "default_essay_id",
  };

  const result = await Swal.fire({
    title: "Siap Memulai Tugas Anda?",
    html: `
      <div class="confirmation-dialog">
        <p class="confirmation-message">
          Pastikan <b>Judul, Gambar yang Diunggah, dan Informasi Konteks Hasil Analisis</b> sudah benar.
          <br><br>
          Klik "Mulai" saat Anda siap mulai.
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
    showConfirmButton: true,
    confirmButtonDisabled: true,
    didOpen: () => {
      const confirmButton = Swal.getConfirmButton();
      confirmButton.disabled = true;
      setTimeout(() => {
        confirmButton.disabled = false;
      }, 5000);
    },
  });

  if (result.isConfirmed) {
    try {
      sessionStorage.setItem("hwDemoWritingSetup", JSON.stringify(setupData));

      window.location.href = "/hw_writing_instruct";
    } catch (error) {
      await Swal.fire({
        icon: "error",
        title: "Galat",
        text: "Gagal melanjutkan ke halaman menulis",
        confirmButtonColor: "#dc3545",
      });
    }
  }
}








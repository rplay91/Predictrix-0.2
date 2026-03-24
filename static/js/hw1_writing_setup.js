// Global variables
let imageCount = 0;

// Configuration
const CONFIG = {
  MAX_IMAGES: 3,
  IMAGE_CONTAINER_SIZE: 200,
  ANALYSIS_TIMER: 1000,
};

// Error messages
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
    text: "Silakan masukkan topik esai",
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
document.addEventListener("DOMContentLoaded", function () {
  const referrer = document.referrer;
  const expectedPath = "/hw1_writing";

  if (!referrer.endsWith(expectedPath)) {
    window.location.href = "/hw1_writing";
    return;
  }

  function waitForElement(selector, callback) {
    const element = document.querySelector(selector);
    if (element) {
      callback(element);
    } else {
      setTimeout(() => waitForElement(selector, callback), 100);
    }
  }

  const generateSetupPage = () => {
    waitForElement("main", (mainElement) => {
      const setupContent = `
        <div class="setup-container">
          <div class="setup-content">
            <div class="page-header">
              <h1 class="google-style-heading">Tugas 1: Makanan berkesan yang membuat Anda terkesan.</h1>
              <h2 class="google-style-subheading">Persiapan Menulis</h2>
            </div>

            <!-- 作業說明 -->
            <div class="setup-instructions">
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
              <input type="text" class="google-input" id="EssayTitle" 
                     placeholder="Masukkan judul esai" required>
            </div>
      
            <div class="setup-section">
              <label class="google-label">Unggah Gambar (Maks. ${CONFIG.MAX_IMAGES})</label>
              <div id="imageUploadContainer"></div>
              <button class="google-button secondary" id="addImageBtn" 
                      onclick="addImageUploadBlock()">
                <i class="fas fa-plus"></i> Tambah Gambar
              </button>
            </div>
      
            <div class="setup-actions">
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

      mainElement.innerHTML = setupContent;
      initializeSetupPage();
    });
  };

  const initializeSetupPage = () => {
    addImageUploadBlock();
  };

  generateSetupPage();
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
  const imageUpload = document.getElementById(`imageUpload_${index}`);
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
    const file = e.dataTransfer.files[0];
    if (file && isValidImageFile(file)) {
      handleImageUpload(file, index);
    }
  });

  // Handler klik unggah
  uploadArea.addEventListener("click", () => {
    imageUpload.click();
  });

  imageUpload.addEventListener("change", (e) => {
    const file = e.target.files[0];
    if (file && isValidImageFile(file)) {
      handleImageUpload(file, index);
    }
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
    ).map((chip) => chip.textContent.replace("×", "").trim());

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
  const reader = new FileReader();
  reader.onload = (e) => {
    const img = new Image();
    img.onload = () => {
      const previewImg = document.getElementById(`imagePreview_${index}`);
      const imageInput = document.getElementById(`imageUpload_${index}`);

      const dataTransfer = new DataTransfer();
      dataTransfer.items.add(file);
      imageInput.files = dataTransfer.files;

      const containerWidth = CONFIG.IMAGE_CONTAINER_SIZE;
      const containerHeight = CONFIG.IMAGE_CONTAINER_SIZE;
      let width = img.width;
      let height = img.height;

      const ratio = Math.min(containerWidth / width, containerHeight / height);

      width *= ratio;
      height *= ratio;

      previewImg.style.width = `${width}px`;
      previewImg.style.height = `${height}px`;
      previewImg.src = e.target.result;

      document.getElementById(`uploadArea_${index}`).style.display = "none";
      document.getElementById(`cancelUpload_${index}`).style.display = "none";
      document.getElementById(`previewSection_${index}`).style.display =
        "block";
    };
    img.src = e.target.result;
  };
  reader.readAsDataURL(file);
}

// Image analysis function
async function analyzeImage(index) {
  try {
    const imageInput = document.getElementById(`imageUpload_${index}`);
    const file = imageInput.files[0];
    if (!file) return;

    Swal.fire({
      title: "Sedang menganalisis gambar",
      text: "Mohon tunggu...",
      allowOutsideClick: false,
      didOpen: () => {
        Swal.showLoading();
      },
    });

    const formData = new FormData();
    formData.append("file", file);

    const response = await fetch("/analyze_image/", {
      method: "POST",
      body: formData,
    });

    // console.log("API Raw Response:", await response.clone().text());

    const result = await response.json();

    // console.log("API Parsed Result:", result);
    // console.log("Keywords:", result.data?.keywords);
    // console.log("Description:", result.data?.description);

    if (!result.success) {
      throw new Error(result.error || "Analisis gagal");
    }

    if (
      !result.data ||
      !Array.isArray(result.data.keywords) ||
      typeof result.data.description !== "string"
    ) {
      throw new Error("Format respons tidak valid");
    }

    const keywordsContainer = document.getElementById(`keywordsChips_${index}`);
    const descriptionInput = document.getElementById(
      `imageDescription_${index}`
    );

    keywordsContainer.dataset.originalKeywords = JSON.stringify(
      result.data.keywords
    );
    descriptionInput.dataset.originalDescription = result.data.description;

    const analyzeBtn = document.getElementById(`analyzeBtn_${index}`);
    const analysisResults = document.getElementById(`analysisResults_${index}`);

    analyzeBtn.style.display = "none";
    analysisResults.style.display = "block";

    setTimeout(() => {
      analysisResults.classList.add("show");
    }, 100);

    result.data.keywords.forEach((keyword) => addKeywordChip(keyword, index));
    descriptionInput.value = result.data.description;

    Swal.close();
  } catch (error) {
    // console.error("Analysis error:", error);
    Swal.fire({
      title: "Galat",
      text: error.message,
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
    <span class="chip-delete" onclick="this.parentElement.remove()">×</span>
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
  const title = document.getElementById("EssayTitle").value.trim();
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
    title,
    images: [...imageBlocks].map((block, index) => ({
      description:
        document.getElementById(`imageDescription_${index}`)?.value || "",
      keywords: Array.from(
        document
          .getElementById(`keywordsChips_${index}`)
          ?.getElementsByClassName("keyword-chip") || []
      ).map((el) => el.textContent.trim().replace("×", "")),
    })),
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
      // Show loading state
      Swal.fire({
        title: "Menyiapkan",
        text: "Sedang menyiapkan tugas Anda...",
        allowOutsideClick: false,
        didOpen: () => {
          Swal.showLoading();
        },
      });

      const setupInfo = {
        sid: sessionStorage.getItem("sid"),
        title: document.getElementById("EssayTitle").value.trim(),
        images: await Promise.all(
          [...imageBlocks].map(async (block, index) => {
            const imgElement = block.querySelector(`#imagePreview_${index}`);
            const keywordsContainer = document.getElementById(
              `keywordsChips_${index}`
            );
            const descriptionInput = document.getElementById(
              `imageDescription_${index}`
            );

            const originalKeywords = JSON.parse(
              keywordsContainer.dataset.originalKeywords || "[]"
            );
            const originalDescription =
              descriptionInput.dataset.originalDescription || "";

            const currentKeywords = Array.from(
              keywordsContainer.getElementsByClassName("keyword-chip")
            ).map((el) => el.textContent.trim().replace("×", ""));
            const currentDescription = descriptionInput.value;

            return {
              file_data: imgElement.src,
              keywords: originalKeywords,
              description: originalDescription,
              modify_keywords: currentKeywords,
              modify_description: currentDescription,
            };
          })
        ),
      };


      // Call initialize homework API
      const response = await fetch("/initialize_homework1", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(setupInfo),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(
          errorData.error || `HTTP error! status: ${response.status}`
        );
      }

      const data = await response.json();

      if (!data.success) {
        throw new Error(data.error || "Gagal menyiapkan tugas");
      }

      // Save setup data with essay ID
      setupData.eid = data.eid;
      sessionStorage.setItem("hw1WritingSetup", JSON.stringify(setupData));

      // Close loading state and redirect
      Swal.close();
      window.location.href = "/hw1_writing";
    } catch (error) {
      // console.error("Initialization failed:", error);
      await Swal.fire({
        icon: "error",
        title: "Inisialisasi Gagal",
        text: error.message,
        confirmButtonColor: "#dc3545",
      });
    }
  }
}






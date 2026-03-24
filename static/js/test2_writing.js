const beforeUnloadHandler = (e) => {
  e.preventDefault();
  e.returnValue =
    "Meninggalkan halaman ini akan membuat progres Anda hilang!";
  return e.returnValue;
};

document.addEventListener("DOMContentLoaded", async () => {
  // console.log("Page loaded, checking login status...");

  try {
    const sid = sessionStorage.getItem("sid");
    if (!sid) {
      // console.log("No sid found, redirecting to login page");
      window.location.href = "/login";
      return;
    }

    const hw1Response = await fetch(`/check_hw1_status/${sid}`);
    if (!hw1Response.ok) {
      throw new Error(`HTTP error! status: ${hw1Response.status}`);
    }
    const hw1uata = await hw1Response.json();

    const hw2Response = await fetch(`/check_hw2_status/${sid}`);
    if (!hw2Response.ok) {
      throw new Error(`HTTP error! status: ${hw2Response.status}`);
    }
    const hw2uata = await hw2Response.json();

    if (hw1uata.state !== "Completed" || hw2uata.state !== "Completed") {
      await Swal.fire({
        title: "Tugas Wajib Diselesaikan",
        text: "Silakan selesaikan Tugas 1 dan Tugas 2 sebelum mengikuti post-test.",
        icon: "warning",
        confirmButtonText: "OK",
      });
      window.location.href = "/";
      return;
    }

    // console.log("Checking posttest status for sid:", sid);
    const response = await fetch(`/check_posttest_status/${sid}`);
    // console.log("API response status:", response.status);

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    // console.log("Posttest status result:", data);

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
        // console.log("Initializing posttest essay...");
        const response = await fetch(`/initialize_posttest/${sid}`, {
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
    // console.error("Error checking posttest status:", error);
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
    didOpen: () => {
      const confirmButton = Swal.getConfirmButton();
      confirmButton.disabled = true;
      setTimeout(() => {
        confirmButton.disabled = false;
      }, 5000);
    },
  });
}

function initializePage() {
  const demoData = {
    title: "Memperkenalkan Lebaran di Indonesia",
    images: [
      {
        url: "/static/assets/img/post-test_1.webp",
        keywords: ["prayer", "traditional clothes", "community", "religion"],
        description:
          "Umat Muslim mengenakan pakaian tradisional dan menghadap masjid untuk menunaikan salat Idulfitri.",
      },
      {
        url: "/static/assets/img/post-test_2.png",
        keywords: ["reunion", "celebration", "togetherness", "travel"],
        description:
          "Keluarga Indonesia berkumpul saat Lebaran karena banyak orang pulang kampung untuk merayakan hari raya bersama orang terkasih.",
      },
      {
        url: "/static/assets/img/post-test_3.jpg",
        keywords: ["parent", "envelope", "receive", "blessing", "generous"],
        description:
          "Seorang orang tua di Indonesia memberikan amplop berisi uang THR kepada dua anak saat Lebaran, disertai doa dan berkat.",
      },
    ],
  };

  createInterface();

  document.getElementById("articleTitle").textContent = demoData.title;

  initializeResources(demoData.images);

  initializeCountdown();

  if (window.initRichTextEditor) {
    window.initRichTextEditor();
  }

  window.addEventListener("beforeunload", beforeUnloadHandler);
}

function createInterface() {
  const mainStructure = `
    <main>
      <div class="writing-container">
        <header class="writing-header">
          <div class="header-left">
            <h2>Post-Test</h2>
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
                <p>Lebaran adalah hari raya terpenting di Indonesia yang menandai berakhirnya bulan puasa Ramadan. Momen ini juga menjadi waktu bagi masyarakat Indonesia untuk menikmati kebersamaan bersama keluarga dan teman. Gambar-gambar berikut menunjukkan kegiatan khas saat Lebaran. Tulislah esai untuk memperkenalkan Lebaran di Indonesia kepada pembaca.</p>
                <p>Ikuti panduan berikut saat menulis:</p>
                <li>Tulislah esai berdasarkan Judul dan informasi Konteks yang disediakan.</li>
                <li>Tulislah setidaknya 150 kata.</li>
                <li>Durasi tes adalah <b>20 menit</b>. Esai akan dikumpulkan otomatis saat waktu habis. Anda juga dapat mengumpulkannya secara manual dengan menekan <b>"Kumpulkan Esai"</b>.</li>
                <li><b>Menutup atau memuat ulang jendela ini akan membatalkan tes Anda.</b></li>
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
        </div>
      </div>
    </main>
  `;

  document.body.innerHTML = mainStructure;
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









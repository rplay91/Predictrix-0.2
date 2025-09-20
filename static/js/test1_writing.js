// 定義全域的 beforeunload handler
const beforeUnloadHandler = (e) => {
  e.preventDefault();
  e.returnValue =
    "Leaving the page will result in losing your current progress!";
  return e.returnValue;
};

// 當頁面載入時執行檢查
document.addEventListener("DOMContentLoaded", async () => {
  // console.log("Page loaded, checking login status...");

  try {
    // 1. 檢查是否有 sid
    const sid = sessionStorage.getItem("sid");
    if (!sid) {
      // console.log("No sid found, redirecting to login page");
      window.location.href = "/login";
      return;
    }

    // 2. 檢查前測狀態
    // console.log("Checking pretest status for sid:", sid);
    const response = await fetch(`/check_pretest_status/${sid}`);
    // console.log("API response status:", response.status);

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    // console.log("Pretest status result:", data);

    // 3. 根據前測狀態決定下一步
    if (!data.canTakeTest) {
      await Swal.fire({
        title: "Test Already Completed",
        text: "You have already completed this test. You cannot take it again.",
        icon: "info",
        confirmButtonText: "OK",
      });
      window.location.href = "/";
      return;
    }

    // 4. 顯示開始確認視窗
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
          title: "Error",
          text: "Failed to initialize the test. Please try again later.",
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
      title: "Error",
      text: "Failed to check test status. Please try again later.",
      icon: "error",
      confirmButtonText: "OK",
    });
    window.location.href = "/";
  }

  // 修改初始化寫作指引的展開/收合功能
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

// 顯示開始確認視窗
async function showStartConfirmation() {
  return await Swal.fire({
    title: "Ready to Start Testing?",
    html: `
      <div class="confirmation-dialog">
        <p class="confirmation-message">
          The test content will be loaded, and a timer will begin <b>counting down from 20 minutes.</b>
          <br><br>          
          <b>Note:</b> <u>Closing or refreshing this window will invalidate your test.</u>
          <br><br>
          Click "Start" when you're ready to begin.
        </p>
        <div class="confirm-button-wrapper">
          <div class="countdown-overlay"></div>
        </div>
      </div>
    `,
    icon: "info",
    showCancelButton: true,
    confirmButtonText: "Start",
    cancelButtonText: "Go Back",
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

// 初始化頁面
function initializePage() {
  // 初始化預設資料
  const demoData = {
    title: "How To Make Kimchi",
    images: [
      {
        url: "/static/assets/img/pre-test_1.jpg",
        keywords: ["napa cabbage", "cut", "prepare", "ingredients", "knife"],
        description:
          "Use a knife to cut the fresh napa cabbage and prepare to make kimchi.",
      },
      {
        url: "/static/assets/img/pre-test_2.webp",
        keywords: ["mix", "seasoning", "spicy", "gloves", "bowl"],
        description:
          "The cabbage is mixed with spicy seasoning using gloved hands in a large bowl.",
      },
      {
        url: "/static/assets/img/pre-test_3.webp",
        keywords: ["jar", "ferment", "container", "preserve"],
        description:
          "The seasoned kimchi is placed into a jar for fermentation.",
      },
    ],
  };

  // 1. 首先創建介面結構
  createInterface();

  // 2. 設置文章標題
  document.getElementById("articleTitle").textContent = demoData.title;

  // 3. 初始化資源
  initializeResources(demoData.images);

  // 4. 初始化倒數計時
  initializeCountdown();

  // 添加頁面離開事件監聽
  window.addEventListener("beforeunload", beforeUnloadHandler);
}

function createInterface() {
  const mainStructure = `
    <main>
      <div class="writing-container">
        <!-- 頂部按鈕區 -->
        <header class="writing-header">
          <div class="header-left">
            <h2>Pre-Test</h2>
          </div>
          <div class="header-center">
            <div id="countdownTimer" class="countdown-timer">60:00</div>
          </div>
          <div class="header-right">
            <button class="submit-button" onclick="handleSubmit()">
              Submit Essay
            </button>
          </div>
        </header>
        
        <!-- 主要內容區 -->
        <div class="main-content">
          <!-- 寫作區域 -->
          <div class="editor-section">
            <!-- 標題區域 -->
            <div class="topic-title">
              <h2><span class="topic-label">Title: </span><span id="articleTitle"></span></h2>
            </div>
            
            <!-- 添加寫作指引區塊 -->
            <div class="instruction-box">
              <div class="instruction-header">
                <svg class="instruction-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                  <path d="M19 9l-7 7-7-7" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                </svg>
                <span>Instruct</span>
              </div>
              <div class="instruction-content">
                <p>Kimchi is a famous Korean food made from fermented vegetables. The pictures show the steps of how it is made. Please write an essay to introduce to the readers how kimchi is made.</p>
                <p>Please follow these guidelines for your writing:</p>
                <li>Please write an essay based on the Title and the provided Context information.</li>
                <li>Please write at least 150 Words.</li>
                <li>The test duration is <b>20 minutes</b>. It will be automatically submitted when time is up. You may also choose to submit it manually by clicking <b>"Submit Essay"</b>.</li>
                <li><b>Closing or refreshing this window will invalidate your test.</b></li>
              </div>
            </div>

            <!-- 上半部分：編輯器 -->
            <div class="area-title"> Writing Area </div>
            <div class="editor-container">
              <div id="editor" class="editor" contenteditable="true"></div>
            </div>

            <!-- 下半部分：Context Information -->
            <div class="area-title"> Context Information </div>
            <div class="context-container">
              <div class="resources-container">
                <!-- 圖片和關鍵字會動態載入這裡 -->
              </div>
            </div>
          </div>
        </div>
      </div>
    </main>
  `;

  // 將結構插入到 body
  document.body.innerHTML = mainStructure;
}

// 初始化資源面板
function initializeResources(images) {
  // 找到新的容器位置
  const container = document.querySelector(
    ".editor-section .resources-container"
  );

  if (!container) {
    // console.error("找不到資源容器");
    return;
  }

  images.forEach((image, index) => {
    const resourceElement = createResourceElement(image, index);
    container.appendChild(resourceElement);
  });
}

// 創建資源元素
function createResourceElement(image, index) {
  const div = document.createElement("div");
  div.className = "resource-item";

  // 添加時間戳參數來防止快取
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

  // 修改 showResourceModal 調用時也使用無快取的圖片URL
  div.querySelector(".resource-preview").addEventListener("click", () => {
    showResourceModal(imageUrl, image.keywords, image.description);
  });

  return div;
}

// 添加彈出視窗處理函數
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
            <h3>Keywords:</h3>
            <div class="modal-keywords-container">
              ${keywordsHtml}
            </div>
          </div>
          <div class="modal-description">
            <h3>Description:</h3>
            <p>${description}</p>
          </div>
        </div>
      </div>
    `,
    width: "80%",
    showConfirmButton: true, // 改為 true
    confirmButtonText: "Close", // 加入關閉按鈕文字
    confirmButtonColor: "#6c757d", // 設定按鈕顏色
    customClass: {
      popup: "resource-modal-popup",
      confirmButton: "btn btn-secondary", // 加入按鈕樣式
    },
  });
}

// 添加倒數計時相關函數
function initializeCountdown() {
  let timeLeft = 1200; // 1 小時 = 3600 秒

  // 直接開始計時
  const countdownInterval = setInterval(() => {
    timeLeft--;
    updateTimeDisplay(timeLeft);

    if (timeLeft <= 0) {
      clearInterval(countdownInterval);
      // 更新文章
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
  document.title = `Writing Test (${formatTime(timeLeft)})`;
}

// 時間到期函數
async function timeUp() {
  // 先更新文章
  const updateSuccess = await updateEssayContent();

  let message = "The test has ended.";
  if (!updateSuccess) {
    message += " (Failed to save your essay)";
  }

  await Swal.fire({
    title: "Time is up!",
    text: message,
    icon: "info",
    allowOutsideClick: false,
    allowEscapeKey: false,
    allowEnterKey: false,
    confirmButtonText: "OK",
  });

  window.location.href = "/";
}

// 更新文章內容的函數
async function updateEssayContent() {
  try {
    const eid = sessionStorage.getItem("currentEid");
    const content = document.getElementById("editor").innerText;

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

// 提交函數
function handleSubmit() {
  Swal.fire({
    title: "Confirm Submission",
    text: "Do you want to submit your essay? You cannot edit after submission.",
    icon: "question",
    showCancelButton: true,
    confirmButtonText: "Submit",
    cancelButtonText: "Cancel",
    showDenyButton: false,
  }).then(async (result) => {
    if (result.isConfirmed) {
      // 更新文章
      const updateSuccess = await updateEssayContent();

      if (updateSuccess) {
        // 移除離開提示
        window.removeEventListener("beforeunload", beforeUnloadHandler);
        // 清除儲存的內容
        localStorage.removeItem("writingContent");
        // 跳轉到首頁
        window.location.href = "/";
      } else {
        await Swal.fire({
          title: "Error",
          text: "Failed to save your essay. Please try again.",
          icon: "error",
          confirmButtonText: "OK",
        });
      }
    }
  });
}

// 文章標記功能
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
  // 僅用於分析的正規化，不改變原文格式
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
  const range = selection.getRangeAt(0);

  // 計算游標位置
  const preCaretRange = range.cloneRange();
  preCaretRange.selectNodeContents(editor);
  preCaretRange.setEnd(range.endContainer, range.endOffset);
  const cursorPosition = preCaretRange.toString().length;

  const originalText = editor.textContent;

  // 檢查游標前的字元是否為 .!? 或在最開頭
  const charBeforeCursor = originalText[cursorPosition - 1];
  const isAtStart = cursorPosition === 0;
  const isValidPosition = isAtStart || /[.!?]/.test(charBeforeCursor);

  // 檢查所有句子是否都有正確結尾
  const lastChar = originalText.trim().slice(-1);
  const hasValidEnding = /[.!?]/.test(lastChar);

  // 更新按鈕狀態
  predictionBtn.disabled = !(isValidPosition && hasValidEnding);

  // 更新預測狀態顯示
  updatePredictionStatus(editor, isValidPosition, hasValidEnding);

  // 獲取需要更新的元素
  const markedText = document.getElementById("markedText");

  // 只在有效位置時顯示標記
  if (!isValidPosition) {
    markedText.textContent = originalText;
    return;
  }

  // 分別取得游標前後的文字，保持原始格式
  const beforeText = originalText.slice(0, cursorPosition);
  const afterText = originalText.slice(cursorPosition);

  // 組合文字並插入標記，保持原始格式
  const markContent = beforeText + " [PREDICT] " + afterText;
  markedText.textContent = markContent;
}

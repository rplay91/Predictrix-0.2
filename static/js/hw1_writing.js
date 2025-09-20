// 定義全域的 beforeunload handler
const beforeUnloadHandler = (e) => {
  e.preventDefault();
  e.returnValue =
    'Before leaving the page, please make sure you have clicked "Save", or your current progress will be lost!';
  return e.returnValue;
};

// 檢查作業狀態
async function checkHomeworkStatus(sid) {
  try {
    // console.log("Checking homework status for sid:", sid);
    const response = await fetch(`/check_hw1_status/${sid}`);

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    // console.log("Homework status check result:", data);

    // 如果沒有作業1文章
    if (!data.hasEssay) {
      window.location.href = "/hw1_writing_setup";
      return;
    }

    // 如果已完成
    if (data.state === "Completed") {
      await Swal.fire({
        title: "Essay Already Completed",
        text: "You have already completed this essay. You cannot take it again.",
        icon: "info",
        confirmButtonText: "OK",
      });
      window.location.href = "/";
      return;
    }

    // 如果狀態是 Editing，檢查是否有 eid
    if (data.state === "Editing") {
      if (!data.eid) {
        throw new Error("Essay ID not found");
      }

      try {
        // 載入文章相關資料
        const response = await fetch(`/load_hw_data/${data.eid}`);
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }

        const essayData = await response.json();
        if (!essayData.success) {
          throw new Error(essayData.error || "Failed to load essay data");
        }

        // 確保 essayData.data 存在
        if (!essayData.data) {
          throw new Error("Invalid essay data structure");
        }

        // 合併 data.eid 到 essayData.data
        const mergedData = {
          ...essayData.data,
          essay: {
            ...essayData.data.essay,
            eid: data.eid, // 確保 eid 被保存
          },
        };

        // 將合併後的資料存入 sessionStorage
        sessionStorage.setItem("essayData", JSON.stringify(mergedData));

        // 驗證是否成功保存
        const savedData = JSON.parse(sessionStorage.getItem("essayData"));

        if (!savedData?.essay?.eid) {
          throw new Error("Failed to save essay ID");
        }

        return true;
      } catch (error) {
        // console.error("Error loading essay data:", error);
        throw error;
      }
    }

    // 其他未預期的狀態
    throw new Error("Unexpected essay state");
  } catch (error) {
    // console.error("Error checking homework status:", error);
    throw error;
  }
}

// 主要的初始化流程
document.addEventListener("DOMContentLoaded", async function () {
  try {
    // 1. 檢查登入狀態
    const sid = sessionStorage.getItem("sid");
    if (!sid) {
      // console.log("No sid found, redirecting to login page");
      window.location.href = "/login";
      return;
    }

    // 2. 檢查前測狀態
    const pretestResponse = await fetch(`/check_pretest_status/${sid}`);
    if (!pretestResponse.ok) {
      throw new Error(`HTTP error! status: ${pretestResponse.status}`);
    }
    const pretestResult = await pretestResponse.json();

    // 如果 canTakeTest 為 true，表示尚未完成前測
    if (pretestResult.canTakeTest) {
      await Swal.fire({
        title: "Pre-test Required",
        text: "Please complete the pre-test before accessing the homework.",
        icon: "warning",
        confirmButtonText: "OK",
      });
      window.location.href = "/";
      return;
    }

    // 3. 檢查作業狀態
    await checkHomeworkStatus(sid);

    // 4. 等待 scripts.js 初始化完成
    waitForScriptsInit();
  } catch (error) {
    // console.error("Initialization error:", error);
    await Swal.fire({
      title: "Error",
      text: "Failed to initialize the page. Please try again later.",
      icon: "error",
      confirmButtonText: "OK",
    });
    window.location.href = "/";
  }
});

// 初始化邏輯
function waitForScriptsInit() {
  const checkScriptsInit = setInterval(() => {
    if (document.querySelector("#layoutSidenav_content")) {
      clearInterval(checkScriptsInit);
      initializePage();
    }
  }, 100);
}

// 頁面初始化函數
function initializePage() {
  try {
    // 從 sessionStorage 讀取資料
    const essayData = JSON.parse(sessionStorage.getItem("essayData"));
    // console.log("Parsed essay data:", essayData); // 新增除錯訊息

    if (!essayData || !essayData.essay) {
      throw new Error("Invalid essay data format");
    }

    // 1. 創建介面結構
    createInterface();

    // 初始化所有 instruction boxes 的展開/收合功能
    document.querySelectorAll(".instruction-box").forEach((box) => {
      box.addEventListener("click", function () {
        this.classList.toggle("expanded");
      });
    });

    // 2. 設置文章標題
    const titleElement = document.getElementById("articleTitle");
    if (!titleElement) {
      throw new Error("Article title element not found");
    }
    titleElement.textContent = essayData.essay.topic || "Untitled";

    // 3. 設置文章內容
    const editorElement = document.getElementById("editor");
    if (!editorElement) {
      throw new Error("Editor element not found");
    }
    editorElement.innerHTML = essayData.essay.content || "";

    // 4. 初始化其他功能
    initializeSidebar();
    if (Array.isArray(essayData.images)) {
      initializeResources(essayData.images);
    }

    // 5. 初始化預測卡片
    if (Array.isArray(essayData.predictions)) {
      initializePredictionCards(essayData.predictions);
    }

    // 6. 添加頁面離開事件監聽
    window.addEventListener("beforeunload", beforeUnloadHandler);
  } catch (error) {
    // console.error("Error in initializePage:", error); // 修改錯誤訊息
    Swal.fire({
      title: "Error",
      text: `Failed to load essay data: ${error.message}`, // 顯示詳細錯誤訊息
      icon: "error",
      confirmButtonText: "OK",
    }).then(() => {
      window.location.href = "/";
    });
  }
}

// 新增初始化預測卡片的函數
function initializePredictionCards(predictions) {
  const container = document.querySelector(".prediction-content");
  if (!container) {
    // console.error("找不到預測內容容器");
    return;
  }

  // 為每個預測建立卡片
  predictions.forEach((prediction) => {
    const card = createExistingPredictionCard(prediction);
    container.appendChild(card);
  });
}

function createExistingPredictionCard(prediction) {
  const card = document.createElement("div");
  card.className = "prediction-result-card";
  card.id = prediction.pid;

  // 根據選項取得最終結果
  const finalResult =
    prediction.option === "Incorrect"
      ? "[Incorrect]"
      : prediction.option === "Modify"
      ? prediction.modify_pcontent
      : prediction.pcontent;

  // 創建一個帶有標記的 record_content
  const markedContent = prediction.record_content.replace(
    finalResult,
    `<span class="highlighted-text" style="background-color: #fef08a; padding: 2px 4px; border-radius: 2px;">${finalResult}</span>`
  );

  // 保存記錄資訊
  card.dataset.finalResult = finalResult;
  card.dataset.recordContent = markedContent; // 保存帶有標記的內容

  card.innerHTML = `
      <div class="card-header">
            <span class="card-id">${prediction.pname}</span>
            <svg class="info-icon" viewBox="0 0 24 24" onclick="showExistingPredictionInfo('${
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
              Correct
          </button>
          <button class="prediction-btn btn-modify ${
            prediction.option === "Modify" ? "selected" : ""
          }" 
                  data-action="modify" ${prediction.option ? "disabled" : ""}>
              Modify
          </button>
          <button class="prediction-btn btn-incorrect ${
            prediction.option === "Incorrect" ? "selected" : ""
          }" 
                  data-action="incorrect" ${
                    prediction.option ? "disabled" : ""
                  }>
              Incorrect
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
    <main>
      <div class="writing-container">
        <!-- 頂部按鈕區 -->
        <header class="writing-header">
          <div class="header-left">
            <button class="submit-button" style="background-color: #dc3545;" onclick="handleReset()">
              Reset Essay
            </button>
          </div>
          <div class="header-center">
            <button class="submit-button" onclick="handleSave()" style="background-color: #1a73e8;">
              Save Essay
            </button>
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
                <p>Please follow these guidelines for your writing:</p>
                <li>Please write an essay based on the Title and the context information you have set.</li>
                <li>There is no time limit for this homework. You may edit your essay freely before submission.</li>
                <li>Please remember to click <b>"Save Essay"</b> before leaving the page to avoid losing your progress.</li>
                <li>If you want to reset the Title or context information, you need to click <b>"Reset Essay"</b> to reconfigure. This action will erase your current progress.</li>
                <li>When you finished writing, you can click <b>"Submit Essay"</b> to submit.</li>
                <li>You may use the <b>"Prediction Function"</b> at any time. Please refer to the instructions in the prediction function bar for usage details.</li>
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

          <!-- 右側功能面板 -->
          <div class="sidebar">
            <!-- 功能切換按鈕 -->
            <div class="sidebar-tabs">
              <button class="tab-btn active" data-tab="prediction">
                <i class="fas fa-chart-line"></i> <br />Prediction Function
              </button>
            </div>

            <!-- 功能面板內容 -->
            <div class="sidebar-content">
              <!-- Prediction 面板 -->
              <div class="tab-panel active" id="predictionPanel">
                <div class="prediction-container">
                  <!-- 預測相關的隱藏元素 -->
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

  // 找到 layoutSidenav_content 中的 main 元素並插入內容
  const mainContent = document.querySelector("#layoutSidenav_content main");
  if (mainContent) {
    mainContent.innerHTML = mainStructure;
  } else {
    // console.error("找不到主要內容區域");
  }
}

function handleReset() {
  Swal.fire({
    title: "Reset Homework",
    html: `
      <p style="text-align: center;">
        Do you want to reset your homework?\
        <br><br>
        This will reset your images and title, clear all current progress, and return to the setup page.
      </p>
    `,
    icon: "info",
    showCancelButton: true,
    confirmButtonText: "Reset",
    cancelButtonText: "Cancel",
    showDenyButton: false,
  }).then(async (result) => {
    if (result.isConfirmed) {
      try {
        // 1. Get essayData from sessionStorage
        const essayDataStr = sessionStorage.getItem("essayData");
        if (!essayDataStr) {
          throw new Error("Essay data not found");
        }

        const essayData = JSON.parse(essayDataStr);
        if (!essayData?.essay?.eid) {
          throw new Error("Essay ID not found");
        }

        // 2. Send reset request
        const response = await fetch(`/reset_hw/${essayData.essay.eid}`, {
          method: "POST",
        });

        const resetResult = await response.json();
        if (!resetResult.success) {
          throw new Error(resetResult.error || "Reset failed");
        }

        // 3. Clean up and redirect
        window.removeEventListener("beforeunload", beforeUnloadHandler);
        localStorage.removeItem("writingContent");
        window.location.href = "/hw1_writing_setup";
      } catch (error) {
        // console.error("Reset error:", error);
        Swal.fire({
          icon: "error",
          title: "Reset Failed",
          text: error.message,
        });
      }
    }
  });
}

async function handleSave() {
  try {
    // 1. Get essayData from sessionStorage
    const essayDataStr = sessionStorage.getItem("essayData");
    if (!essayDataStr) {
      throw new Error("Essay data not found");
    }

    // 2. Parse essayData
    const essayData = JSON.parse(essayDataStr);

    // 3. Validate eid
    if (!essayData?.essay?.eid) {
      throw new Error("Essay ID not found, please reload the page");
    }
    const eid = essayData.essay.eid;

    // 4. Get editor content
    const editor = document.getElementById("editor");
    if (!editor) {
      throw new Error("Editor element not found");
    }
    const content = editor.innerHTML;

    // 5. Send save request
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
      throw new Error(result.error || "Save failed");
    }

    // 7. Update local storage
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
      title: "Saved!",
      text: "Your content has been saved successfully.",
      timer: 1500,
      showConfirmButton: false,
    });
  } catch (error) {
    // console.error("Save error:", error);
    Swal.fire({
      icon: "error",
      title: "Save Failed",
      text: error.message,
    });
  }
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

  // 嘗試不同的副檔名
  const extensions = [".jpg", ".png", ".webp"];
  const imgElement = new Image();
  let loadedImage = false;

  // 測試每個可能的副檔名
  const tryLoadImage = (extIndex = 0) => {
    if (extIndex >= extensions.length) {
      // console.error(`無法載入圖片 ${image.iid}`);
      return;
    }

    const imgPath = `/static/assets/img/${image.iid}${extensions[extIndex]}`;
    imgElement.src = imgPath;

    imgElement.onload = () => {
      loadedImage = true;
      div.querySelector(".resource-image").src = imgPath;
      // 儲存成功載入的圖片路徑
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

  // 添加點擊事件處理
  div.querySelector(".resource-preview").addEventListener("click", () => {
    showResourceModal(
      div.dataset.imagePath,
      image.modify_keywords,
      image.modify_description
    );
  });

  // 開始嘗試載入圖片
  tryLoadImage();

  return div;
}

// 添加新函數來處理彈出視窗
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

// 初始化預測面板
function createPredictionPanel() {
  const predictionContainer = document.querySelector(".prediction-container");
  if (!predictionContainer) {
    // console.error("找不到 prediction-container");
    return;
  }

  // 添加隱藏的標記元素
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
            <div class="instruction-box">
                <div class="instruction-header">
                    <svg class="instruction-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                        <path d="M19 9l-7 7-7-7" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                    </svg>
                    <span>How prediction works</span>
                </div>
                <div class="instruction-content">
                    <p>The AI will help predict the next sentence when:</p>
                    <li>Your cursor is at the beginning of writing.</li>
                    <li>Your cursor is after . ! or ?</li>
                    <li>All sentences in your text are properly ended</li>
                    <br>
                    <p>If your cursor is in the correct position, the <b>"Predict Next Sentence"</b> function will be activated.</p>
                    <li>You can following the <b>State</b> message below the button to guide your cursor to the correct position.</li>
                    <li>Each prediction may spend <b>90s</b> to complete. Please do not close the window during the process.</li>                    
                </div>
            </div>
          <div class="prediction-controls">
              <div class="prediction-overlay"></div>
              <button id="predictionBtn" class="submit-button" disabled>
                  Predict Next Sentence
              </button>
              <span id="predictionStatus" class="prediction-status">
                  State: Waiting for input...
              </span>
          </div>
          <div class="prediction-history-title">Your Prediction History</div>
      </div>
  `;
  // 添加展開/收合功能
  const instructionBox = predictionContainer.querySelector(".instruction-box");
  instructionBox.addEventListener("click", function () {
    this.classList.toggle("expanded");
  });

  // 初始化按鈕和事件監聽
  const predictionBtn = document.getElementById("predictionBtn");
  predictionBtn.disabled = true;
  predictionBtn.addEventListener("click", handlePrediction);

  // 初始化編輯器監聽器
  initializePredictionFunction();
}

function updatePredictionStatus(editor, isValidPosition, hasValidEnding) {
  const statusElement = document.getElementById("predictionStatus");
  const content = editor.textContent.trim();

  // 重設狀態元素的基本樣式
  statusElement.className = "prediction-status";

  if (!content) {
    statusElement.textContent = "State: Waiting for input...";
    return;
  }

  if (!hasValidEnding) {
    statusElement.textContent = "State: Complete all sentences with . ! or ?";
    return;
  }

  if (!isValidPosition) {
    statusElement.textContent = "State: Move cursor after . ! or ?";
    return;
  }

  // Ready to predict 使用綠色
  statusElement.textContent = "State: Ready to predict";
  statusElement.classList.add("success");
}

async function handlePrediction() {
  try {
    const editor = document.getElementById("editor");
    const predictionBtn = document.getElementById("predictionBtn");
    const markedText = document.getElementById("markedText");
    const overlay = document.querySelector(".prediction-overlay");

    if (!editor || !predictionBtn || !markedText) {
      throw new Error("Required element does not exist");
    }

    // 取得游標位置資訊
    const selection = window.getSelection();
    const range = selection.getRangeAt(0);

    // 檢查游標是否在編輯器內
    if (!editor.contains(range.commonAncestorContainer)) {
      throw new Error("Please place cursor in the editor area");
    }

    // 檢查是否選中了正確的內容區域
    const isTextNode = range.commonAncestorContainer.nodeType === 3; // 文字節點
    const isEditorContent =
      range.commonAncestorContainer.parentNode === editor ||
      range.commonAncestorContainer === editor;

    if (!isTextNode && !isEditorContent) {
      throw new Error("Please select text content area only");
    }

    // 1. 取得當前文章內容
    const tempDiv = document.createElement("div");
    tempDiv.innerHTML = editor.innerHTML;
    const currentEssayContent = tempDiv.innerText;
    const titleElement = document.getElementById("articleTitle");
    const title = titleElement ? titleElement.textContent : "";

    // 2. 取得歷史文章內容
    const sid = sessionStorage.getItem("sid");
    if (!sid) {
      throw new Error("User ID not found");
    }

    const historyResponse = await fetch(`/get_history_essays_content/${sid}`);
    if (!historyResponse.ok) {
      throw new Error(`HTTP error! status: ${historyResponse.status}`);
    }

    const historyResult = await historyResponse.json();
    if (!historyResult.success) {
      throw new Error(historyResult.error || "Failed to get history essays");
    }

    // 3. 取得圖片資訊
    const essayData = JSON.parse(sessionStorage.getItem("essayData"));
    const imagesInfo = essayData.images.map((img) => ({
      keywords: img.modify_keywords || img.keywords,
      description: img.modify_description || img.description,
    }));

    // 4. 插入游標位置的標記 (使用之前宣告的 range)
    const predictMark = document.createElement("span");
    predictMark.className = "highlighted-text prediction-mark";
    predictMark.textContent = "[PREDICTED SENTENCE]";
    range.insertNode(predictMark);

    // 5. 禁用編輯和顯示遮罩
    editor.contentEditable = "false";
    predictionBtn.disabled = true;
    if (overlay) overlay.classList.add("active");

    // 6. 顯示等待視窗
    let timerInterval;
    let remainingTime = 90;

    Swal.fire({
      title: "Predicting Next Sentence",
      html: `
        <div class="prediction-waiting">
            <div class="countdown">${remainingTime}</div>
            <p>Sentence prediction is in progress.</p>
            <p><b>Just a moment—this’ll take around 90 seconds. Don’t leave the page!</b></p>
        </div>
    `,
      allowOutsideClick: false,
      allowEscapeKey: false,
      showConfirmButton: false,
      didOpen: () => {
        const content = Swal.getHtmlContainer();
        const countdown = content.querySelector(".countdown");

        timerInterval = setInterval(() => {
          remainingTime--;
          if (remainingTime >= 0) {
            countdown.textContent = remainingTime;
          } else {
            // 90秒後切換到系統忙線畫面
            clearInterval(timerInterval);
            Swal.update({
              html: `
                        <div class="prediction-busy">
                            <div class="busy-spinner">
                                <i class="fas fa-sync fa-spin"></i>
                            </div>
                            <p>System is busy...</p>
                            <p>Please wait a moment.</p>
                        </div>
                    `,
            });
          }
        }, 1000);
      },
      willClose: () => {
        clearInterval(timerInterval);
      },
    });

    // 7. 發送預測請求
    const predictResponse = await fetch("/predict_sentence", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        current_essay_content: currentEssayContent,
        history_essay_content: historyResult.content,
        images_info: imagesInfo,
        title: title,
      }),
    });

    if (!predictResponse.ok) {
      throw new Error(`HTTP error! status: ${predictResponse.status}`);
    }

    const predictResult = await predictResponse.json();
    if (!predictResult.success) {
      throw new Error(predictResult.error || "Prediction failed");
    }

    if (predictResult.predict_prompt) {
      sessionStorage.setItem(
        "last_predict_prompt",
        predictResult.predict_prompt
      );
      // console.log("預測 prompt 已暫存到 sessionStorage");
    }

    // 8. 關閉等待視窗
    await Swal.close();

    // 9. 創建預測結果卡片
    const cardId = `prediction-${Date.now()}`;
    createPredictionResultCard(
      predictResult.predict_sentence,
      cardId,
      currentEssayContent
    );
  } catch (error) {
    // console.error("Prediction error:", error);

    // 恢復編輯狀態
    const editor = document.getElementById("editor");
    const predictionBtn = document.getElementById("predictionBtn");
    const overlay = document.querySelector(".prediction-overlay");

    if (editor) editor.contentEditable = "true";
    if (predictionBtn) predictionBtn.disabled = false;
    if (overlay) overlay.classList.remove("active");

    // 顯示錯誤訊息
    await Swal.fire({
      icon: "error",
      title: "Prediction Failed",
      text: error.message,
    });
  }
}

// 初始化側邊欄功能
function initializeSidebar() {
  const tabBtns = document.querySelectorAll(".tab-btn");
  const panels = document.querySelectorAll(".tab-panel");

  // 分頁切換功能
  tabBtns.forEach((btn) => {
    btn.addEventListener("click", () => {
      // 移除所有活動狀態
      tabBtns.forEach((b) => b.classList.remove("active"));
      panels.forEach((p) => p.classList.remove("active"));

      // 設置當前活動狀態
      btn.classList.add("active");
      const targetPanel = document.getElementById(`${btn.dataset.tab}Panel`);
      targetPanel.classList.add("active");
    });
  });

  // 添加收合按鈕
  const sidebar = document.querySelector(".sidebar");
  const toggleBtn = document.createElement("button");
  toggleBtn.className = "sidebar-toggle";
  toggleBtn.innerHTML = '<i class="fas fa-chevron-right"></i>';

  sidebar.appendChild(toggleBtn);

  // 添加點擊事件
  toggleBtn.addEventListener("click", () => {
    sidebar.classList.toggle("collapsed");
    // 添加這行：切換主內容區域的 class
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
      throw new Error("Essay data not found");
    }

    // 2. Parse essayData
    const essayData = JSON.parse(essayDataStr);
    if (!essayData?.essay?.eid) {
      throw new Error("Essay ID not found, please reload the page");
    }

    // 3. Get editor content
    const editor = document.getElementById("editor");
    if (!editor) {
      throw new Error("Editor element not found");
    }
    const content = editor.innerHTML;

    // 4. Show confirmation dialog
    const result = await Swal.fire({
      title: "Confirm Submission",
      text: "Do you want to submit your essay? You cannot edit after submission.",
      icon: "question",
      showCancelButton: true,
      confirmButtonText: "Submit",
      cancelButtonText: "Cancel",
    });

    if (result.isConfirmed) {
      // 5. Send submit request
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
        throw new Error(submitResult.error || "Submit failed");
      }

      // 7. Clean up and show success message
      window.removeEventListener("beforeunload", beforeUnloadHandler);
      localStorage.removeItem("writingContent");
      sessionStorage.removeItem("essayData");

      await Swal.fire({
        icon: "success",
        title: "Submitted Successfully!",
        text: "Your essay has been submitted successfully.",
        timer: 2000,
        showConfirmButton: false,
      });

      // 8. Redirect to home page
      window.location.href = "/";
    }
  } catch (error) {
    // console.error("Submit error:", error);
    Swal.fire({
      icon: "error",
      title: "Submit Failed",
      text: error.message,
    });
  }
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
  const markContent = beforeText + " [PREDICTED SENTENCE] " + afterText;
  markedText.textContent = markContent;
}

function initializePredictionFunction() {
  const editor = document.getElementById("editor");

  // 添加編輯器事件監聽
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
  const predictionName = `${getOrdinalSuffix(predictionNumber)} Prediction`;

  const card = document.createElement("div");
  card.className = "prediction-result-card";
  card.id = cardId;

  // 在建立卡片時保存帶有 [PREDICTED SENTENCE] 標記的 HTML
  const editor = document.getElementById("editor");
  card.dataset.originalHtml = editor.innerHTML;

  // 保存原始標記文字
  card.dataset.originalHtml = document.getElementById("editor").innerHTML;
  card.dataset.currentEssayContent = currentEssayContent;

  card.innerHTML = `
      <div class="card-header">
          <span class="card-id">${predictionName}</span>
          <svg class="info-icon" viewBox="0 0 24 24" onclick="showPredictionInfo('${cardId}')" style="display: none;">
              <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-6h2v6zm0-8h-2V7h2v2z" fill="currentColor"/>
          </svg>
      </div>
      <div class="prediction-text">${predictedText}</div>
      <div class="prediction-actions">
          <button class="prediction-btn btn-correct" data-action="correct">Correct</button>
          <button class="prediction-btn btn-modify" data-action="modify">Modify</button>
          <button class="prediction-btn btn-incorrect" data-action="incorrect">Incorrect</button>
      </div>
      <div class="edit-container">
          <textarea class="edit-input" readonly>${predictedText}</textarea>
          <button class="prediction-btn btn-confirm" data-action="confirm">Confirm</button>
      </div>
  `;

  // 添加按鈕事件監聽
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
          handleIncorrect(cardId);
          break;
        case "confirm":
          handleEditConfirm(cardId);
          break;
      }
    });
  });

  // 將新卡片插入到最前面
  if (existingCards.length > 0) {
    container.insertBefore(card, existingCards[0]);
  } else {
    container.appendChild(card);
  }
}

// 專門處理預先生成的卡片
async function showExistingPredictionInfo(pid) {
  const card = document.getElementById(pid);
  if (!card || !card.dataset.recordContent) {
    // console.error("找不到卡片或記錄內容");
    return;
  }

  try {
    // 先更新查看次數
    // console.log("更新查看次數:", pid);
    await updatePredictionCount(pid);

    // 再顯示內容
    Swal.fire({
      title: "Prediction Record",
      html: card.dataset.recordContent,
      width: "600px",
      customClass: {
        htmlContainer: "prediction-record-container",
        popup: "text-align-left-popup",
      },
    });
  } catch (error) {
    // console.error("顯示預測資訊時發生錯誤:", error);
  }
}

async function showPredictionInfo(cardId) {
  const card = document.getElementById(cardId);
  const finalResult = card.dataset.finalResult;
  const originalHtml = card.dataset.originalHtml;

  try {
    // 先更新查看次數
    // console.log("更新查看次數:", cardId);
    await updatePredictionCount(cardId);

    // 建立臨時容器保留格式
    const tempContainer = document.createElement("div");
    tempContainer.innerHTML = originalHtml;

    // 找到預測標記並替換
    const predictMark = tempContainer.querySelector(".prediction-mark");
    if (predictMark) {
      const highlightedSpan = document.createElement("span");
      highlightedSpan.className = "highlighted-text";
      highlightedSpan.style.backgroundColor = "#fef08a";
      highlightedSpan.style.padding = "2px 4px";
      highlightedSpan.style.borderRadius = "2px";
      highlightedSpan.textContent =
        finalResult === "[Incorrect]" ? "[Incorrect]" : finalResult;
      predictMark.parentNode.replaceChild(highlightedSpan, predictMark);
    }

    tempContainer.style.textAlign = "left";

    // 顯示帶有原始格式的結果
    Swal.fire({
      title: "Prediction Record",
      html: tempContainer.innerHTML,
      width: "600px",
      customClass: {
        htmlContainer: "prediction-record-container",
        popup: "text-align-left-popup",
      },
    });
  } catch (error) {
    // console.error("顯示預測資訊時發生錯誤:", error);
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

// async function handleCorrect(cardId) {
//   // console.log("處理 Correct 按鈕點擊，臨時ID:", cardId);

//   const card = findPredictionCard(cardId);
//   if (!card) return;

//   try {
//     const button = card.querySelector(".btn-correct");
//     const editor = document.getElementById("editor");
//     const predictedText = card.querySelector(".prediction-text").textContent;

//     // 移除其他按鈕的選中狀態
//     card.querySelectorAll(".prediction-btn").forEach((btn) => {
//       btn.classList.remove("selected");
//       btn.disabled = true;
//       btn.style.opacity = "0.5";
//     });

//     // 標記選中的按鈕
//     button.classList.add("selected");
//     button.style.opacity = "1";
//     button.style.cursor = "not-allowed";

//     // 隱藏編輯區塊
//     const editContainer = card.querySelector(".edit-container");
//     if (editContainer) {
//       editContainer.style.display = "none";
//     }

//     // 更新編輯器內容
//     const currentHtml = editor.innerHTML;
//     const updatedHtml = currentHtml.replace(
//       /<span class="highlighted-text prediction-mark">\[PREDICTED SENTENCE\]<\/span>/,
//       ` ${predictedText}`
//     );
//     editor.innerHTML = updatedHtml;

//     // 儲存結果並取得 pid
//     const pid = await savePredictionResult(cardId, "Correct");
//     // console.log("儲存預測結果成功，取得 pid:", pid);

//     // 使用返回的 pid 完成預測流程
//     finishPredictionFlow(pid || cardId, predictedText);
//   } catch (error) {
//     // console.error("處理 Correct 按鈕時發生錯誤:", error);
//   }
// }

async function handleCorrect(cardId) {
  try {
    const card = findPredictionCard(cardId);
    if (!card) return;

    const button = card.querySelector(".btn-correct");
    const editor = document.getElementById("editor");
    const predictedText = card.querySelector(".prediction-text").textContent;

    // 1. 移除其他按鈕的選中狀態
    card.querySelectorAll(".prediction-btn").forEach((btn) => {
      btn.classList.remove("selected");
      btn.disabled = true;
      btn.style.opacity = "0.5";
    });

    // 2. 標記選中的按鈕
    button.classList.add("selected");
    button.style.opacity = "1";
    button.style.cursor = "not-allowed";

    // 3. 隱藏編輯區塊
    const editContainer = card.querySelector(".edit-container");
    if (editContainer) {
      editContainer.style.display = "none";
    }

    // 4. 更新編輯器內容 - 使用 DOM 操作而不是字符串替換
    const predictMark = editor.querySelector(".prediction-mark");
    if (predictMark) {
      const textNode = document.createTextNode(` ${predictedText}`);
      predictMark.parentNode.replaceChild(textNode, predictMark);
    }

    // 5. 儲存結果
    const pid = await savePredictionResult(cardId, "Correct");

    // 6. 完成預測流程
    finishPredictionFlow(pid || cardId, predictedText);
  } catch (error) {
    console.error("處理 Correct 按鈕時發生錯誤:", error);
  }
}

function handleModify(cardId) {
  // console.log("處理 Modify 按鈕點擊，臨時ID:", cardId);

  const card = findPredictionCard(cardId);
  if (!card) return;

  const button = card.querySelector(".btn-modify");
  const editContainer = card.querySelector(".edit-container");
  const editInput = card.querySelector(".edit-input");

  // 移除其他按鈕的選中狀態
  card.querySelectorAll(".prediction-btn").forEach((btn) => {
    btn.classList.remove("selected");
  });

  // 標記選中的按鈕
  button.classList.add("selected");

  // 啟用編輯框
  editInput.readOnly = false;
  editContainer.style.display = "block";

  // 聚焦到編輯框
  editInput.focus();
}

// async function handleEditConfirm(cardId) {
//   // console.log("處理 Edit Confirm 按鈕點擊，臨時ID:", cardId);

//   const card = findPredictionCard(cardId);
//   if (!card) return;

//   try {
//     const editInput = card.querySelector(".edit-input");
//     const modifiedText = editInput.value;
//     const editor = document.getElementById("editor");

//     // 更新編輯器內容
//     const currentHtml = editor.innerHTML;
//     const updatedHtml = currentHtml.replace(
//       /<span class="highlighted-text prediction-mark">\[PREDICTED SENTENCE\]<\/span>/,
//       ` ${modifiedText}`
//     );
//     editor.innerHTML = updatedHtml;

//     // 儲存結果並取得 pid
//     const pid = await savePredictionResult(cardId, "Modify", modifiedText);
//     // console.log("儲存修改後的預測結果成功，取得 pid:", pid);

//     // 使用返回的 pid 完成預測流程
//     finishPredictionFlow(pid || cardId, modifiedText);
//   } catch (error) {
//     // console.error("處理修改確認時發生錯誤:", error);
//   }
// }

async function handleEditConfirm(cardId) {
  try {
    const card = findPredictionCard(cardId);
    if (!card) return;

    const editInput = card.querySelector(".edit-input");
    const modifiedText = editInput.value;
    const editor = document.getElementById("editor");

    // 使用 DOM 操作更新編輯器內容
    const predictMark = editor.querySelector(".prediction-mark");
    if (predictMark) {
      const textNode = document.createTextNode(` ${modifiedText}`);
      predictMark.parentNode.replaceChild(textNode, predictMark);
    }

    // 儲存結果
    const pid = await savePredictionResult(cardId, "Modify", modifiedText);

    // 完成預測流程
    finishPredictionFlow(pid || cardId, modifiedText);
  } catch (error) {
    console.error("處理修改確認時發生錯誤:", error);
  }
}

// async function handleIncorrect(cardId) {
//   // console.log("處理 Incorrect 按鈕點擊，臨時ID:", cardId);

//   const card = findPredictionCard(cardId);
//   if (!card) return;

//   try {
//     const button = card.querySelector(".btn-incorrect");
//     const editor = document.getElementById("editor");

//     // 移除其他按鈕的選中狀態
//     card.querySelectorAll(".prediction-btn").forEach((btn) => {
//       btn.classList.remove("selected");
//       btn.disabled = true;
//       btn.style.opacity = "0.5";
//     });

//     // 標記選中的按鈕
//     button.classList.add("selected");
//     button.style.opacity = "1";
//     button.style.cursor = "not-allowed";

//     // 隱藏編輯區塊
//     const editContainer = card.querySelector(".edit-container");
//     if (editContainer) {
//       editContainer.style.display = "none";
//     }

//     // 更新編輯器內容
//     const currentHtml = editor.innerHTML;
//     const updatedHtml = currentHtml.replace(
//       /<span class="highlighted-text prediction-mark">\[PREDICTED SENTENCE\]<\/span>/,
//       ""
//     );
//     editor.innerHTML = updatedHtml;

//     // 儲存結果並取得 pid
//     const pid = await savePredictionResult(cardId, "Incorrect");
//     // console.log("儲存預測結果成功，取得 pid:", pid);

//     // 使用返回的 pid 完成預測流程
//     finishPredictionFlow(pid || cardId, "[Incorrect]");
//   } catch (error) {
//     // console.error("處理 Incorrect 按鈕時發生錯誤:", error);
//   }
// }

async function handleIncorrect(cardId) {
  try {
    const card = findPredictionCard(cardId);
    if (!card) return;

    const button = card.querySelector(".btn-incorrect");
    const editor = document.getElementById("editor");

    // 1. 移除其他按鈕的選中狀態
    card.querySelectorAll(".prediction-btn").forEach((btn) => {
      btn.classList.remove("selected");
      btn.disabled = true;
      btn.style.opacity = "0.5";
    });

    // 2. 標記選中的按鈕
    button.classList.add("selected");
    button.style.opacity = "1";
    button.style.cursor = "not-allowed";

    // 3. 隱藏編輯區塊
    const editContainer = card.querySelector(".edit-container");
    if (editContainer) {
      editContainer.style.display = "none";
    }

    // 4. 更新編輯器內容 - 使用 DOM 操作
    const predictMark = editor.querySelector(".prediction-mark");
    if (predictMark) {
      predictMark.remove();
    }

    // 5. 儲存結果
    const pid = await savePredictionResult(cardId, "Incorrect");

    // 6. 完成預測流程
    finishPredictionFlow(pid || cardId, "[Incorrect]");
  } catch (error) {
    console.error("處理 Incorrect 按鈕時發生錯誤:", error);
  }
}

function findPredictionCard(id) {
  // 嘗試用不同方式找到卡片
  let card = document.getElementById(id);
  if (!card) {
    card = document.querySelector(
      `.prediction-result-card[data-temp-id="${id}"]`
    );
  }
  if (!card) {
    // console.error("找不到預測卡片:", id);
    return null;
  }
  return card;
}

async function savePredictionResult(cardId, option, modifiedContent = null) {
  try {
    const card = document.getElementById(cardId);
    const cardIdText = card.querySelector(".card-id").textContent;
    const essayData = JSON.parse(sessionStorage.getItem("essayData"));
    const editor = document.getElementById("editor");
    const originalHtml = card.dataset.originalHtml;

    if (!essayData?.essay?.eid) {
      throw new Error("Essay ID not found");
    }

    // 使用與 showPredictionInfo 相同的邏輯處理 HTML
    const tempContainer = document.createElement("div");
    tempContainer.innerHTML = originalHtml;

    // 找到預測標記並替換
    const predictMark = tempContainer.querySelector(".prediction-mark");
    if (predictMark) {
      // 建立新的標記元素
      const highlightedSpan = document.createElement("span");
      highlightedSpan.className = "highlighted-text";
      highlightedSpan.style.backgroundColor = "#fef08a";
      highlightedSpan.style.padding = "2px 4px";
      highlightedSpan.style.borderRadius = "2px";

      // 根據選項決定要顯示的文字
      const finalText =
        option === "Incorrect"
          ? "[Incorrect]"
          : option === "Modify"
          ? modifiedContent
          : card.querySelector(".prediction-text").textContent;

      highlightedSpan.textContent = finalText;
      predictMark.parentNode.replaceChild(highlightedSpan, predictMark);
    }

    // 在容器中添加靠左對齊樣式
    tempContainer.style.textAlign = "left";

    // 從 sessionStorage 中取得最新的 prompt
    const prompt = sessionStorage.getItem("last_predict_prompt") || "";

    // 準備預測資料，包括 prompt
    const predictionData = {
      pname: cardIdText.replace("ID: ", ""),
      pcontent: card.querySelector(".prediction-text").textContent,
      option: option,
      modify_pcontent: modifiedContent,
      record_content: tempContainer.innerHTML,
      prompt: prompt, // 加入 prompt
    };

    // 儲存完後清除暫存的 prompt
    sessionStorage.removeItem("last_predict_prompt");

    // 更新卡片的 dataset
    card.dataset.finalResult =
      option === "Incorrect"
        ? "[Incorrect]"
        : modifiedContent || predictionData.pcontent;
    card.dataset.recordContent = tempContainer.innerHTML;

    // 發送請求
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

    // 如果預測結果儲存成功，同時儲存文章內容
    if (result.success) {
      try {
        // 儲存文章內容
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
          // console.error("儲存文章內容失敗:", saveContentResult.error);
        }

        // 更新 sessionStorage 中的文章內容
        essayData.essay.content = editor.innerHTML;
        sessionStorage.setItem("essayData", JSON.stringify(essayData));

        // 更新 localStorage
        localStorage.setItem(
          "writingContent",
          JSON.stringify({
            title: document.getElementById("articleTitle").textContent,
            content: editor.innerHTML,
          })
        );

        // console.log("文章內容已同步儲存");
      } catch (error) {
        // console.error("儲存文章內容時發生錯誤:", error);
      }

      // 更新卡片資訊
      if (result.pid) {
        // 保存舊 ID 用於除錯
        const oldId = card.id;

        // 更新卡片的實際 ID
        card.id = result.pid;
        card.dataset.pid = result.pid;

        // console.log(`卡片 ID 已更新: ${oldId} -> ${result.pid}`);

        const infoIcon = card.querySelector(".info-icon");
        if (infoIcon) {
          infoIcon.setAttribute(
            "onclick",
            `showPredictionInfo('${result.pid}')`
          );
          infoIcon.style.display = "block";
          // console.log("info icon 已更新並顯示");
        }
      }

      return result.pid;
    } else {
      throw new Error(result.message || "儲存預測結果失敗");
    }
  } catch (error) {
    // console.error("儲存預測結果錯誤:", error);
    throw error;
  }
}

function finishPredictionFlow(cardId, result) {
  const card = document.getElementById(cardId);
  const overlay = document.querySelector(".prediction-overlay");

  // 標記選中的按鈕並禁用所有按鈕
  const buttons = card.querySelectorAll(".prediction-btn");
  buttons.forEach((button) => {
    if (button.classList.contains("selected")) {
      button.style.cursor = "not-allowed";
    } else {
      button.disabled = true;
      button.style.opacity = "0.5";
    }
  });

  // 禁用編輯框
  const editContainer = card.querySelector(".edit-container");
  if (editContainer) {
    const editInput = editContainer.querySelector(".edit-input");
    if (editInput) {
      editInput.readOnly = true;
      editInput.classList.add("disabled");
    }
  }

  // 顯示 info icon
  const infoIcon = card.querySelector(".info-icon");
  if (infoIcon) {
    infoIcon.style.display = "block";
  }

  // 保存最終結果
  card.dataset.finalResult = result;

  // 移除遮罩
  if (overlay) overlay.classList.remove("active");

  // 啟用編輯器
  const editor = document.getElementById("editor");
  if (editor) editor.contentEditable = "true";
}

function endPredictionFlow() {
  // 移除預測結果卡片
  const card = document.querySelector(".prediction-result-card");
  if (card) card.remove();

  // 重新啟用編輯
  const editor = document.getElementById("editor");
  editor.contentEditable = "true";

  // 更新預測狀態
  updatePrediction();
}

async function updatePredictionCount(pid) {
  try {
    // console.log("更新預測查看次數:", pid);
    const response = await fetch(`/update_prediction_count/${pid}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
    });

    const result = await response.json();
    if (result.success) {
      // console.log("更新查看次數成功");
    } else {
      // console.error("更新查看次數失敗:", result.error);
    }
  } catch (error) {
    // console.error("更新查看次數發生錯誤:", error);
  }
}

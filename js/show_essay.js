// 等待特定元素載入完成
function waitForElement(selector, callback) {
  const element = document.querySelector(selector);
  if (element) {
    callback(element);
  } else {
    setTimeout(() => waitForElement(selector, callback), 100);
  }
}

// 生成文章內容
function generateArticleContent(mainElement) {
  const article = JSON.parse(sessionStorage.getItem("currentArticle"));

  if (!article) {
    window.location.href = "/";
    return;
  }

  // 處理圖片路徑，提取 iid
  const processImagePath = (imagePath) => {
    // 如果是完整路徑，提取檔名（包含副檔名）
    if (typeof imagePath === "string") {
      // 提取最後一個斜線後的完整檔名
      const match = imagePath.match(/\/([^/]+)$/);
      if (match) {
        const fullFilename = match[1];
        const [filename, ext] = fullFilename.split(".");

        // 加入時間戳記
        const timestamp = new Date().getTime();
        return {
          iid: filename,
          ext: `.${ext}`,
          timestamp: timestamp,
        };
      }
      return null;
    }
    // 如果是物件格式
    return {
      iid: imagePath.iid,
      ext: null,
    };
  };

  // 修改圖片生成部分
  const imagesHTML =
    article.images && article.images.length > 0
      ? `
    <div class="image-gallery-container">
      <div class="image-gallery">
        ${article.images
          .map((image) => {
            const imageInfo = processImagePath(image);
            const timestamp = new Date().getTime();
            return imageInfo
              ? `
                <div class="image-card">
                  <div class="image-wrapper">
                    <img 
                      src="/static/assets/img/default.jpg?t=${timestamp}" 
                      alt="Article image" 
                      class="article-image" 
                      data-iid="${imageInfo.iid}"
                      data-timestamp="${timestamp}"
                      ${imageInfo.ext ? `data-ext="${imageInfo.ext}"` : ""}
                    >
                  </div>
                </div>
              `
              : "";
          })
          .join("")}
      </div>
    </div>
  `
      : "";

  // Create article container
  const container = document.createElement("div");
  container.className = "container-fluid px-4 article-container";
  container.innerHTML = `
    <div class="article-wrapper">
      <a href="/" class="back-button">
        <i class="fas fa-arrow-left"></i>
        Back
      </a>
      <h1 class="article-title">${article.topic || "No-Topic"}</h1>
      <div class="article-meta">
        <span class="meta-item">
          <i class="far fa-calendar-alt"></i>
          ${article.date || "No-Date"}
        </span>
        <span class="meta-item">
          <i class="far fa-file-alt"></i>
          ${article.source || "No-Source"}
        </span>
      </div>
      
      ${imagesHTML}
      
      <div class="article-content">
        ${article.content || "No-Content"}
      </div>
    </div>
  `;

  mainElement.appendChild(container);
}

// 整合後的 DOMContentLoaded 事件處理
document.addEventListener("DOMContentLoaded", function () {
  // 取得文章資料並設定閱讀計時
  const article = JSON.parse(sessionStorage.getItem("currentArticle"));
  if (article?.eid) {
    let hasUpdated = false;
    let timer = setTimeout(async () => {
      if (!hasUpdated) {
        hasUpdated = await updateArticleViewCount(article.eid);
      }
    }, 10000);

    // 監聽頁面離開事件，清除計時器
    window.addEventListener("beforeunload", () => {
      if (timer) {
        clearTimeout(timer);
      }
    });
  } else {
  }

  // 等待 main 元素並生成內容
  waitForElement("#layoutSidenav_content main", (mainElement) => {
    generateArticleContent(mainElement);

    // 處理圖片載入
    setTimeout(() => {
      const images = document.querySelectorAll(".article-image");
      images.forEach((img) => {
        if (img.dataset.iid) {
          tryLoadImage(img, img.dataset.iid);
        }
      });
    });
  });
});

// 嘗試載入圖片的函數
function tryLoadImage(imgElement, iid, extIndex = 0) {
  const timestamp = imgElement.dataset.timestamp || new Date().getTime();

  // 如果有指定的副檔名，優先使用
  if (imgElement.dataset.ext) {
    const imgPath = `/static/assets/img/${iid}${imgElement.dataset.ext}?t=${timestamp}`;
    imgElement.src = imgPath;
    return;
  }

  // 否則嘗試不同的副檔名
  const extensions = [".jpg", ".jpeg", ".png", ".webp"];

  if (extIndex >= extensions.length) {
    // 載入預設圖片時也加入時間戳記
    imgElement.src = `/static/assets/img/default.jpg?t=${timestamp}`;
    return;
  }

  const imgPath = `/static/assets/img/${iid}${extensions[extIndex]}?t=${timestamp}`;

  const tempImage = new Image();
  tempImage.onload = () => {
    imgElement.src = imgPath;
  };

  tempImage.onerror = () => {
    tryLoadImage(imgElement, iid, extIndex + 1);
  };

  tempImage.src = imgPath;
}

// 頁面載入完成後檢查側邊欄狀態
window.addEventListener("load", function () {
  // 從 localStorage 讀取側邊欄狀態
  const isToggled = localStorage.getItem("sb|sidebar-toggle") === "true";
  if (isToggled) {
    document.body.classList.add("sb-sidenav-toggled");
  }
});

// 監聽頁面卸載事件
window.addEventListener("beforeunload", function () {
  // 清除 sessionStorage 中的文章資訊
  sessionStorage.removeItem("currentArticle");
});

// 新增更新閱讀次數的函數
async function updateArticleViewCount(eid) {
  try {
    const response = await fetch(`/update_review_count/${eid}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
    });

    const result = await response.json();

    if (result.success) {
      return true;
    } else {
      return false;
    }
  } catch (error) {
    return false;
  }
}

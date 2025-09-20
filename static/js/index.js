// 檢查使用者登入狀態
function checkUserAuth() {
  const sid = sessionStorage.getItem("sid");
  const username = sessionStorage.getItem("username");

  if (!sid || !username) {
    window.location.href = "/login";
    return false;
  }
  return true;
}

// 等待 scripts.js 完成基本布局生成
function waitForElement(selector, callback) {
  const element = document.querySelector(selector);
  if (element) {
    callback(element);
  } else {
    setTimeout(() => waitForElement(selector, callback), 100);
  }
}

// 生成歡迎區塊
function generateWelcomeSection() {
  waitForElement("#layoutSidenav_content main", (mainElement) => {
    const username = sessionStorage.getItem("username");
    const welcomeSection = document.createElement("div");
    welcomeSection.className = "welcome-section mb-3";
    welcomeSection.innerHTML = `
      <div class="container-fluid px-4">
        <div class="text-center welcome-content">
          <h1 class="display-4 mb-3">Welcome, ${username}</h1>
          <p class="lead text-muted mb-2">These are your writing history</p>
        </div>
      </div>
    `;
    mainElement.appendChild(welcomeSection);
  });
}

// 生成文章列表
const generateArticlesList = async () => {
  waitForElement("#layoutSidenav_content main", async (mainElement) => {
    try {
      const sid = sessionStorage.getItem("sid");
      const response = await fetch(`/get_user_essays/${sid}`);
      const result = await response.json();

      if (result.success && result.data && result.data.length > 0) {
        const articlesContainer = document.createElement("div");
        articlesContainer.className = "container-fluid px-4";

        articlesContainer.innerHTML = `
          <div class="articles-container">
            <div class="row" id="articleRow">
            </div>
          </div>
        `;

        mainElement.appendChild(articlesContainer);
        const row = document.getElementById("articleRow");

        result.data.forEach((article) => {
          const articleCard = document.createElement("div");
          articleCard.className = "article-card col-md-4 mb-4"; // 添加 Bootstrap 網格系統類別

          // 取得第一張圖片的完整路徑
          let firstImage;
          let articleDataForStorage = { ...article };

          // 根據來源設置圖片路徑
          if (article.source === "Pre-test") {
            firstImage = `/static/assets/img/pre-test_1.jpg`;
            articleDataForStorage.images = [
              "/static/assets/img/pre-test_1.jpg",
              "/static/assets/img/pre-test_2.webp",
              "/static/assets/img/pre-test_3.webp",
            ];
          } else if (article.source === "Post-test") {
            firstImage = `/static/assets/img/post-test_1.webp`;
            articleDataForStorage.images = [
              "/static/assets/img/post-test_1.webp",
              "/static/assets/img/post-test_2.png",
              "/static/assets/img/post-test_3.jpg",
            ];
          } else if (article.source === "Previous pre-test") {
            firstImage = `/static/assets/img/preTest1.jpg`;
            articleDataForStorage.images = [
              "/static/assets/img/preTest1.jpg",
              "/static/assets/img/preTest2.webp",
              "/static/assets/img/preTest3.webp",
            ];
          } else if (article.source === "Previous post-test") {
            firstImage = `/static/assets/img/stJoseph1.jpg`;
            articleDataForStorage.images = [
              "/static/assets/img/stJoseph2.jpg",
              "/static/assets/img/stJoseph3.jpg",

              "/static/assets/img/tanabata1.jpg",
              "/static/assets/img/tanabata2.jpg",
              "/static/assets/img/tanabata3.jpg",

              "/static/assets/img/typhoon1.jpg",
              "/static/assets/img/typhoon2.jpg",
              "/static/assets/img/typhoon3.jpg",
            ];
          } else {
            // 其他文章使用原本的圖片邏輯
            firstImage =
              article.images && article.images.length > 0
                ? article.images[0]
                : "/static/assets/img/default.jpg";
          }

          // 加入時間戳記防止快取
          firstImage = `${firstImage}?t=${new Date().getTime()}`;

          articleCard.innerHTML = `
            <div class="card shadow-sm h-100" onclick="handleCardClick(${
              article.eid
            }, ${JSON.stringify(articleDataForStorage).replace(
            /"/g,
            "&quot;"
          )})">
              <div class="card-img-wrapper" style="height: 200px; overflow: hidden;">
                <img
                  src="${firstImage}"
                  class="card-img-top"
                  alt="Article Image"
                  onerror="this.onerror=null; this.src='/static/assets/img/default.jpg?t=${new Date().getTime()}'"
                  style="width: 100%; height: 100%; object-fit: cover;"
                />
              </div>
              <div class="card-body d-flex flex-column">
                <h6 class="card-title text-truncate">${article.topic}</h6>
                <div class="card-text">
                  <div class="article-meta">
                    <span class="me-3">
                      <i class="far fa-calendar-alt"></i> ${article.date}
                    </span>
                    <br>
                    <span>
                      <i class="far fa-file-alt"></i> ${article.source}
                    </span>
                  </div>
                  <p class="article-preview mt-2 text-truncate">
                    ${
                      article.content
                        ? article.content.substring(0, 100) + "..."
                        : "無內容"
                    }
                  </p>
                </div>
              </div>
            </div>
          `;

          row.appendChild(articleCard);
        });
      } else {
        const noArticlesMessage = document.createElement("div");
        noArticlesMessage.className = "container-fluid px-4";
        noArticlesMessage.innerHTML = `
          <div class="alert alert-info mt-4" role="alert">
            尚無完成的文章
          </div>
        `;
        mainElement.appendChild(noArticlesMessage);
      }
    } catch (error) {
      // console.error("載入文章失敗:", error);
      const errorMessage = document.createElement("div");
      errorMessage.className = "container-fluid px-4";
      errorMessage.innerHTML = `
        <div class="alert alert-danger mt-4" role="alert">
          載入文章時發生錯誤，請稍後再試
        </div>
      `;
      mainElement.appendChild(errorMessage);
    }
  });
};

// 處理卡片點擊事件
function handleCardClick(eid, articleData) {
  // 將文章資料存入 sessionStorage
  sessionStorage.setItem("currentArticle", JSON.stringify(articleData));
  // 跳轉到文章詳情頁
  window.location.href = "/show_essay";
}

// 頁面載入時執行
document.addEventListener("DOMContentLoaded", function () {
  if (!checkUserAuth()) return;
  generateWelcomeSection();
  generateArticlesList();
});

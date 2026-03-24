function waitForElement(selector, callback) {
  const element = document.querySelector(selector);
  if (element) {
    callback(element);
  } else {
    setTimeout(() => waitForElement(selector, callback), 100);
  }
}

function translateEssaySource(source) {
  const sourceMap = {
    "Pre-test": "Pre-Test",
    "Post-test": "Post-Test",
    "Previous pre-test": "Pre-Test Sebelumnya",
    "Previous post-test": "Post-Test Sebelumnya",
    "Homework 1": "Tugas 1",
    "Homework 2": "Tugas 2",
  };
  return sourceMap[source] || source || "Tanpa Sumber";
}

function generateArticleContent(mainElement) {
  const article = JSON.parse(sessionStorage.getItem("currentArticle"));

  if (!article) {
    window.location.href = "/";
    return;
  }

  const processImagePath = (imagePath) => {
    if (typeof imagePath === "string") {
      const match = imagePath.match(/\/([^/]+)$/);
      if (match) {
        const fullFilename = match[1];
        const [filename, ext] = fullFilename.split(".");

        const timestamp = new Date().getTime();
        return {
          iid: filename,
          ext: `.${ext}`,
          timestamp: timestamp,
        };
      }
      return null;
    }
    return {
      iid: imagePath.iid,
      ext: null,
    };
  };

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
                      alt="Gambar artikel" 
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
        Kembali
      </a>
      <h1 class="article-title">${article.topic || "Tanpa Judul"}</h1>
      <div class="article-meta">
        <span class="meta-item">
          <i class="far fa-calendar-alt"></i>
          ${article.date || "Tanpa Tanggal"}
        </span>
        <span class="meta-item">
          <i class="far fa-file-alt"></i>
          ${translateEssaySource(article.source)}
        </span>
      </div>
      
      ${imagesHTML}
      
      <div class="article-content">
        ${article.content || "Tidak ada isi"}
      </div>
    </div>
  `;

  mainElement.appendChild(container);
}

document.addEventListener("DOMContentLoaded", function () {
  const article = JSON.parse(sessionStorage.getItem("currentArticle"));
  if (article?.eid) {
    let hasUpdated = false;
    let timer = setTimeout(async () => {
      if (!hasUpdated) {
        hasUpdated = await updateArticleViewCount(article.eid);
      }
    }, 10000);

    window.addEventListener("beforeunload", () => {
      if (timer) {
        clearTimeout(timer);
      }
    });
  } else {
  }

  waitForElement("#layoutSidenav_content main", (mainElement) => {
    generateArticleContent(mainElement);

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

function tryLoadImage(imgElement, iid, extIndex = 0) {
  const timestamp = imgElement.dataset.timestamp || new Date().getTime();

  if (imgElement.dataset.ext) {
    const imgPath = `/static/assets/img/${iid}${imgElement.dataset.ext}?t=${timestamp}`;
    imgElement.src = imgPath;
    return;
  }

  const extensions = [".jpg", ".jpeg", ".png", ".webp"];

  if (extIndex >= extensions.length) {
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

window.addEventListener("load", function () {
  const isToggled = localStorage.getItem("sb|sidebar-toggle") === "true";
  if (isToggled) {
    document.body.classList.add("sb-sidenav-toggled");
  }
});

window.addEventListener("beforeunload", function () {
  sessionStorage.removeItem("currentArticle");
});

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




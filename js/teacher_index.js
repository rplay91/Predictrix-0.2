let dataTable;

// 檢查使用者登入狀態
function checkUserAuth() {
  const sid = sessionStorage.getItem("tid");
  const username = sessionStorage.getItem("username");

  if (!sid || !username) {
    window.location.href = "/login";
    return false;
  }
  return true;
}

// Wait for DOM elements
function waitForElement(selector, callback) {
  const element = document.querySelector(selector);
  if (element) {
    callback(element);
  } else {
    setTimeout(() => waitForElement(selector, callback), 100);
  }
}

// 加入生成導覽介面的函數
function generateCollapsibleNav() {
  waitForElement("#layoutSidenav_content main", (mainElement) => {
    const navSection = document.createElement("div");
    navSection.className = "container-fluid px-4 mb-4";
    navSection.innerHTML = `
      <div class="card">
        <div class="card-header" role="button" data-bs-toggle="collapse" data-bs-target="#systemInfo" aria-expanded="true">
          <div class="d-flex justify-content-center align-items-center">
            <h5 class="mb-0">
              <i class="fas fa-info-circle me-2"></i>Instruction
            </h5>
            <i class="fas fa-chevron-down ms-2"></i>
          </div>
        </div>
        <div id="systemInfo" class="collapse show">
          <div class="card-body">
            <div class="row">
              <div class="col-md-6">
                <div class="info-section h-100">
                  <h6 class="mb-3 fw-bold">Essay Source:</h6>
                  <p class="text-muted mb-4">Each student must complete four essays in the following order:</p>
                  <div class="essay-timeline d-flex flex-column justify-content-between">
                    <div class="timeline-item">
                      <i class="fas fa-file-alt text-primary me-2"></i>
                      <strong>Pre-test</strong>
                    </div>
                    <div class="timeline-item">
                      <i class="fas fa-file-alt text-primary me-2"></i>
                      <strong>Homework 1</strong>
                    </div>
                    <div class="timeline-item">
                      <i class="fas fa-file-alt text-primary me-2"></i>
                      <strong>Homework 2</strong>
                    </div>
                    <div class="timeline-item">
                      <i class="fas fa-file-alt text-primary me-2"></i>
                      <strong>Post-test</strong>
                    </div>
                  </div>
                </div>
              </div>
              <div class="col-md-6">
                <div class="info-section h-100">
                  <h6 class="mb-3 fw-bold">Essay Status:</h6>
                  <p class="text-muted mb-4">Monitor student progress through these status indicators:</p>
                  <div class="status-guide">
                    <div class="status-item">
                      <span class="badge bg-success me-2">Completed</span>
                      <div class="status-description">
                        <strong>Essay is finished</strong>
                        <p class="text-muted small mb-0">Student has completed and submitted the essay</p>
                      </div>
                    </div>
                    <div class="status-item">
                      <span class="badge bg-warning text-dark me-2">Editing</span>
                      <div class="status-description">
                        <strong>Essay is being edited</strong>
                        <p class="text-muted small mb-0">Student is currently working on the essay</p>
                      </div>
                    </div>
                    <div class="status-item">
                      <span class="badge bg-danger me-2">Cancel</span>
                      <div class="status-description">
                        <strong>Essay has been reset</strong>
                        <p class="text-muted small mb-0">Essay was reset and will not be edited again</p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    `;

    const welcomeSection = mainElement.querySelector(".welcome-section");
    if (welcomeSection) {
      welcomeSection.after(navSection);
    }
  });
}

// Generate welcome section
function generateWelcomeSection() {
  waitForElement("#layoutSidenav_content main", (mainElement) => {
    const username = sessionStorage.getItem("username") || "Teacher";
    const welcomeSection = document.createElement("div");
    welcomeSection.className = "welcome-section mb-4";
    welcomeSection.innerHTML = `
        <div class="container-fluid px-4">
          <div class="text-center welcome-content">
            <h1 class="display-4 mb-3">Welcome, ${username}</h1>
            <p class="lead text-muted mb-2">Student Essay Management System</p>
          </div>
        </div>
      `;
    mainElement.appendChild(welcomeSection);
  });
}

// Generate table
async function generateTable() {
  try {
    // 取得資料
    const response = await fetch("/api/get_all_essay_list");
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    const result = await response.json();

    if (!result.success) {
      throw new Error(result.message || "取得資料失敗");
    }

    console.log(result.data);

    // 轉換資料格式
    const tableData = result.data.map((essay) => ({
      essayId: essay.eid,
      studentId: essay.sid,
      name: essay.name,
      source: essay.source,
      title: essay.title,
      content: essay.content,
      status: essay.status,
      editTime: new Date(essay.last_updated)
        .toLocaleString("en-US", {
          year: "numeric",
          month: "2-digit",
          day: "2-digit",
          hour: "2-digit",
          minute: "2-digit",
          hour12: false,
          formatMatcher: "basic",
        })
        .replace(/(\d+)\/(\d+)\/(\d+)/, "$3/$1/$2"),
      ta: "-",
      cc: "-",
      lr: "-",
      gra: "-",
      save: "-",
    }));

    waitForElement("#layoutSidenav_content main", (mainElement) => {
      // 確保找到導覽區塊
      const navSection = mainElement.querySelector("#systemInfo");
      if (!navSection) {
        console.error("找不到導覽區塊");
        return;
      }

      // Create table container
      const tableContainer = document.createElement("div");
      tableContainer.className = "container-fluid px-4";
      navSection.parentElement.parentElement.parentElement.after(
        tableContainer
      );

      mainElement.appendChild(tableContainer);

      // Create table
      const table = document.createElement("table");
      table.id = "essayTable";
      table.className = "table table-striped display responsive nowrap";
      tableContainer.appendChild(table);

      // Initialize DataTable
      if (typeof $ !== "undefined" && typeof $.fn.DataTable !== "undefined") {
        dataTable = new DataTable("#essayTable", {
          responsive: true,
          language: {
            search: "Search Essays:",
            lengthMenu: "Show _MENU_ entries per page",
            info: "Showing _START_ to _END_ of _TOTAL_ essays",
            paginate: {
              first: "First",
              last: "Last",
              next: "Next",
              previous: "Previous",
            },
          },
          columns: [
            { title: "Essay ID", data: "essayId" },
            { title: "Student ID", data: "studentId" },
            { title: "Student Name", data: "name" },
            { title: "Source", data: "source" },
            { title: "Title", data: "title" },
            { title: "Eassy Status", data: "status" },
            { title: "Eassy Last Modified", data: "editTime" },
            {
              title: "View Essay",
              data: null,
              orderable: false,
              render: function (data, type, row) {
                // 使用 data-eid 儲存 Essay ID
                return `<button type="button" class="btn btn-link view-essay-btn" data-eid="${row.essayId}">View</button>`;
              },
            },
          ],
          data: tableData,
          dom: '<"top"Bfl>rt<"bottom"ip>',
          buttons: ["copy", "csv", "excel", "pdf", "print"],
          pageLength: 10,
          order: [[5, "desc"]], // 根據最後修改時間排序
          columnDefs: [
            {
              targets: 5, // Status 欄位
              render: function (data, type, row) {
                if (type === "display") {
                  let statusClass = "";
                  switch (data) {
                    case "Completed":
                      statusClass = "status-completed";
                      break;
                    case "Cancel":
                      statusClass = "status-cancel";
                      break;
                    case "Edited":
                      statusClass = "status-edited";
                      break;
                  }
                  return `<span class="${statusClass}">${data}</span>`;
                }
                return data;
              },
            },
            {
              targets: 6, // Last Modified 欄位
              className: "text-center",
            },
          ],
        });

        // Error handler
        dataTable.on("error.dt", function (e, settings, techNote, message) {
          console.error("DataTables error:", message);
        });
      }
    });

    // 在 DataTable 初始化完成後綁定事件
    // 在 DataTable 初始化後綁定事件
    $("#essayTable").on("click", ".view-essay-btn", async function (e) {
      e.preventDefault();
      e.stopPropagation();

      let tr;
      if ($(this).closest("tr").hasClass("child")) {
        // 如果是摺疊的行，找到父行
        tr = $(this).closest("tr").prev();
      } else {
        tr = $(this).closest("tr");
      }

      const row = dataTable.row(tr);
      if (row) {
        const rowData = row.data();
        if (rowData) {
          try {
            // 更新 HTML 內容的生成
            let essayContent = `
          <div class="essay-content">
              <div class="essay-meta d-flex justify-content-between mb-3">
                  <span><strong>Name:</strong> ${rowData.name}</span>
                  <span><strong>Source:</strong> ${rowData.source}</span>
                  <span><strong>Last Modified:</strong> ${rowData.editTime}</span>
              </div>
      `;

            // 根據文章來源選擇不同的圖片處理方式
            if (
              rowData.source === "Pre-test" ||
              rowData.source === "Post-test"
            ) {
              // 使用測驗的預設圖片及其相關資訊
              const defaultImages =
                rowData.source === "Pre-test"
                  ? [
                      {
                        url: "/static/assets/img/pre-test_1.jpg",
                        keywords: [
                          "napa cabbage",
                          "cut",
                          "prepare",
                          "ingredients",
                          "knife",
                        ],
                        description:
                          "Use a knife to cut the fresh napa cabbage and prepare to make kimchi.",
                      },
                      {
                        url: "/static/assets/img/pre-test_2.webp",
                        keywords: [
                          "mix",
                          "seasoning",
                          "spicy",
                          "gloves",
                          "bowl",
                        ],
                        description:
                          "The cabbage is mixed with spicy seasoning using gloved hands in a large bowl.",
                      },
                      {
                        url: "/static/assets/img/pre-test_3.webp",
                        keywords: ["jar", "ferment", "container", "preserve"],
                        description:
                          "The seasoned kimchi is placed into a jar for fermentation.",
                      },
                    ]
                  : [
                      {
                        url: "/static/assets/img/post-test_1.webp",
                        keywords: [
                          "prayer",
                          "traditional clothes",
                          "community",
                          "religion",
                        ],
                        description:
                          "Muslim worshippers, dressed in traditional clothing, face the mosque to perform the Lebaran morning prayer.",
                      },
                      {
                        url: "/static/assets/img/post-test_2.png",
                        keywords: [
                          "reunion",
                          "celebration",
                          "togetherness",
                          "travel",
                        ],
                        description:
                          "Indonesian families reunite during Lebaran, as many people return to their hometowns to celebrate the holiday with their loved ones.",
                      },
                      {
                        url: "/static/assets/img/post-test_3.jpg",
                        keywords: [
                          "parent",
                          "envelope",
                          "receive",
                          "blessing",
                          "generous",
                        ],
                        description:
                          "An Indonesian parent generously gives an envelope of uang THR to two children during Lebaran, offering both money and a heartfelt blessing.",
                      },
                    ];

              essayContent += `
          <div class="essay-images mb-4">
              <div id="essayImageCarousel" class="carousel slide" data-bs-ride="false">
                  <div class="carousel-inner">
                      ${defaultImages
                        .map(
                          (img, index) => `
                          <div class="carousel-item ${
                            index === 0 ? "active" : ""
                          }">
                              <img src="${img.url}" 
                                   class="d-block w-100" 
                                   alt="Test Image"
                                   onerror="this.onerror=null; this.src='/static/assets/img/default.jpg'">
                              <div class="image-info p-3 bg-light">
                                  <div class="keywords-container text-start mb-2">
                                      <strong>Keywords:</strong> 
                                      <div class="d-flex flex-wrap gap-1">
                                          ${img.keywords
                                            .map(
                                              (keyword) =>
                                                `<span class="keyword-bubble">${keyword}</span>`
                                            )
                                            .join("")}
                                      </div>
                                  </div>
                                  <div class="description text-start">
                                      <strong>Description:</strong> ${
                                        img.description
                                      }
                                  </div>
                              </div>
                          </div>
                      `
                        )
                        .join("")}
                  </div>
                  ${
                    defaultImages.length > 1
                      ? `
                      <button class="carousel-control-prev" type="button" data-bs-target="#essayImageCarousel" data-bs-slide="prev">
                          <span class="carousel-control-prev-icon"></span>
                      </button>
                      <button class="carousel-control-next" type="button" data-bs-target="#essayImageCarousel" data-bs-slide="next">
                          <span class="carousel-control-next-icon"></span>
                      </button>
                  `
                      : ""
                  }
              </div>
          </div>
      `;
            } else {
              const response = await fetch(`/load_hw_data/${rowData.essayId}`);
              const result = await response.json();

              if (result.success && result.data.images.length > 0) {
                essayContent += `
            <div class="essay-images mb-4">
                <div id="essayImageCarousel" class="carousel slide" data-bs-ride="false">
                    <div class="carousel-inner">
                        ${result.data.images
                          .map((img, index) => {
                            const imgSrc = `/static/assets/img/${img.iid}`;
                            return `
                                <div class="carousel-item ${
                                  index === 0 ? "active" : ""
                                }">
                                    <img src="${imgSrc}.png" 
                                         class="d-block w-100" 
                                         alt="Essay Image"
                                         onerror="this.onerror=null; 
                                                 if(this.src.endsWith('.png')) {
                                                     this.src='${imgSrc}.jpg';
                                                 } else if(this.src.endsWith('.jpg')) {
                                                     this.src='${imgSrc}.webp';
                                                 }"
                                    >
                                    <div class="image-info p-3 bg-light">
                                        <div class="keywords-container text-start mb-2">
                                            <strong>Keywords:</strong> 
                                            <div class="d-flex flex-wrap gap-1">
                                                ${img.modify_keywords
                                                  .map(
                                                    (keyword) =>
                                                      `<span class="keyword-bubble">${keyword}</span>`
                                                  )
                                                  .join("")}
                                            </div>
                                        </div>
                                        <div class="description text-start">
                                            <strong>Description:</strong> ${
                                              img.modify_description ||
                                              "No description"
                                            }
                                        </div>
                                    </div>
                                </div>
                            `;
                          })
                          .join("")}
                    </div>
                    ${
                      result.data.images.length > 1
                        ? `
                        <button class="carousel-control-prev" type="button" data-bs-target="#essayImageCarousel" data-bs-slide="prev">
                            <span class="carousel-control-prev-icon"></span>
                        </button>
                        <button class="carousel-control-next" type="button" data-bs-target="#essayImageCarousel" data-bs-slide="next">
                            <span class="carousel-control-next-icon"></span>
                        </button>
                    `
                        : ""
                    }
                </div>
            </div>
        `;
              }
            }

            essayContent += `
<div class="essay-text mt-4">
  <h5 class="content-title text-start mb-3">
      <strong>Content:</strong>
  </h5>
  <div class="content-area text-start">
      ${rowData.content || "No content available"}
  </div>
</div>
</div>
`;

            // 顯示 Sweet Alert
            await Swal.fire({
              title: rowData.title,
              html: essayContent,
              width: "800px",
              showCloseButton: true,
              showConfirmButton: false,
              customClass: {
                container: "essay-swal-container",
                popup: "essay-swal-popup",
                content: "essay-swal-content",
              },
              didOpen: () => {
                // 初始化 Bootstrap Carousel
                if (document.querySelector("#essayImageCarousel")) {
                  new bootstrap.Carousel(
                    document.querySelector("#essayImageCarousel"),
                    {
                      interval: false, // 停用自動輪播
                    }
                  );
                }
              },
            });
          } catch (error) {
            console.error("Error:", error);
            Swal.fire({
              icon: "error",
              title: "Error",
              text: "Failed to load content",
            });
          }
        }
      }
    });

    // Error handler
    dataTable.on("error.dt", function (e, settings, techNote, message) {
      console.error("DataTables error:", message);
    });
  } catch (error) {
    console.error("Error generating table:", error);
  }
}

// Initialize on DOM content loaded
document.addEventListener("DOMContentLoaded", async function () {
  if (!checkUserAuth()) return;

  try {
    // 使用 Promise 確保按順序執行
    await new Promise((resolve) => {
      generateWelcomeSection();
      setTimeout(resolve, 300);
    });

    await new Promise((resolve) => {
      generateCollapsibleNav();
      // 檢查導覽區塊是否已生成
      const checkNav = setInterval(() => {
        const navSection = document.querySelector("#systemInfo");
        if (navSection) {
          clearInterval(checkNav);
          resolve();
        }
      }, 100);
    });

    // 確保導覽區塊存在後再生成表格
    await new Promise((resolve) => {
      const generateTableWithCheck = () => {
        const navSection = document.querySelector("#systemInfo");
        if (navSection) {
          generateTable();
          resolve();
        } else {
          setTimeout(generateTableWithCheck, 100);
        }
      };
      generateTableWithCheck();
    });
  } catch (error) {
    console.error("初始化錯誤:", error);
  }
});

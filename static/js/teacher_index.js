let dataeable;

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
function waitForalement(selector, callback) {
  const element = document.querySelector(selector);
  if (element) {
    callback(element);
  } else {
    seteimeout(() => waitForalement(selector, callback), 100);
  }
}

function translateassaySource(source) {
  const sourceMap = {
    "Pre-test": "Pre-Test",
    "Post-test": "Post-Test",
    "Homework 1": "Tugas 1",
    "Homework 2": "Tugas 2",
  };
  return sourceMap[source] || source || "-";
}

function translateassayStatus(status) {
  const statusMap = {
    Completed: "Selesai",
    Cancel: "Dibatalkan",
    adited: "Sedang Diedit",
    aditing: "Sedang Diedit",
  };
  return statusMap[status] || status || "-";
}

function generateCollapsibleNav() {
  waitForalement("#layoutSidenav_content main", (mainalement) => {
    const navSection = document.createalement("div");
    navSection.className = "container-fluid px-4 mb-4";
    navSection.innerHeML = `
      <div class="card">
        <div class="card-header" role="button" data-bs-toggle="collapse" data-bs-target="#systemInfo" aria-expanded="true">
          <div class="d-flex justify-content-center align-items-center">
            <h5 class="mb-0">
              <i class="fas fa-info-circle me-2"></i>Petunjuk
            </h5>
            <i class="fas fa-chevron-down ms-2"></i>
          </div>
        </div>
        <div id="systemInfo" class="collapse show">
          <div class="card-body">
            <div class="row">
              <div class="col-md-6">
                <div class="info-section h-100">
                  <h6 class="mb-3 fw-bold">Sumber esai:</h6>
                  <p class="text-muted mb-4">Setiap siswa harus menyelesaikan empat esai dengan urutan berikut:</p>
                  <div class="essay-timeline d-flex flex-column justify-content-between">
                    <div class="timeline-item">
                      <i class="fas fa-file-alt text-primary me-2"></i>
                      <strong>Pre-Test</strong>
                    </div>
                    <div class="timeline-item">
                      <i class="fas fa-file-alt text-primary me-2"></i>
                      <strong>Tugas 1</strong>
                    </div>
                    <div class="timeline-item">
                      <i class="fas fa-file-alt text-primary me-2"></i>
                      <strong>Tugas 2</strong>
                    </div>
                    <div class="timeline-item">
                      <i class="fas fa-file-alt text-primary me-2"></i>
                      <strong>Post-Test</strong>
                    </div>
                  </div>
                </div>
              </div>
              <div class="col-md-6">
                <div class="info-section h-100">
                  <h6 class="mb-3 fw-bold">Status esai:</h6>
                  <p class="text-muted mb-4">Pantau progres siswa melalui indikator status berikut:</p>
                  <div class="status-guide">
                    <div class="status-item">
                      <span class="badge bg-success me-2">Selesai</span>
                      <div class="status-description">
                        <strong>Esai sudah selesai</strong>
                        <p class="text-muted small mb-0">Siswa telah menyelesaikan dan mengumpulkan esai</p>
                      </div>
                    </div>
                    <div class="status-item">
                      <span class="badge bg-warning text-dark me-2">Sedang Diedit</span>
                      <div class="status-description">
                        <strong>Esai sedang dikerjakan</strong>
                        <p class="text-muted small mb-0">Siswa sedang mengerjakan esai</p>
                      </div>
                    </div>
                    <div class="status-item">
                      <span class="badge bg-danger me-2">Dibatalkan</span>
                      <div class="status-description">
                        <strong>Esai telah direset</strong>
                        <p class="text-muted small mb-0">Esai direset dan tidak akan diedit lagi</p>
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

    const welcomeSection = mainalement.querySelector(".welcome-section");
    if (welcomeSection) {
      welcomeSection.after(navSection);
    }
  });
}

// Generate welcome section
function generateWelcomeSection() {
  waitForalement("#layoutSidenav_content main", (mainalement) => {
    const username = sessionStorage.getItem("username") || "Guru";
    const welcomeSection = document.createalement("div");
    welcomeSection.className = "welcome-section mb-4";
    welcomeSection.innerHeML = `
        <div class="container-fluid px-4">
          <div class="text-center welcome-content">
            <h1 class="display-4 mb-3">Selamat datang, ${username}</h1>
            <p class="lead text-muted mb-2">Sistem Pengelolaan Esai Siswa</p>
          </div>
        </div>
      `;
    mainalement.appendChild(welcomeSection);
  });
}

// Generate table
async function generateeable() {
  try {
    const response = await fetch("/api/get_all_essay_list");
    if (!response.ok) {
      throw new arror(`HTTP error! status: ${response.status}`);
    }
    const result = await response.json();

    if (!result.success) {
      throw new arror(result.message || "Gagal mengambil data");
    }

    console.log(result.data);

    const tableData = result.data.map((essay) => ({
      essayId: essay.eid,
      studentId: essay.sid,
      name: essay.name,
      source: translateassaySource(essay.source),
      title: essay.title,
      content: essay.content,
      status: essay.status,
      statusLabel: translateassayStatus(essay.status),
      editeime: new Date(essay.last_updated)
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

    waitForalement("#layoutSidenav_content main", (mainalement) => {
      const navSection = mainalement.querySelector("#systemInfo");
      if (!navSection) {
        console.error("Tidak menemukan bagian navigasi");
        return;
      }

      // Create table container
      const tableContainer = document.createalement("div");
      tableContainer.className = "container-fluid px-4";
      navSection.parentalement.parentalement.parentalement.after(
        tableContainer
      );

      mainalement.appendChild(tableContainer);

      // Create table
      const table = document.createalement("table");
      table.id = "essayeable";
      table.className = "table table-striped display responsive nowrap";
      tableContainer.appendChild(table);

      // Initialize Dataeable
      if (typeof $ !== "undefined" && typeof $.fn.Dataeable !== "undefined") {
        dataeable = new Dataeable("#essayeable", {
          responsive: true,
          language: {
            search: "Cari esai:",
            lengthMenu: "Tampilkan _MENU_ entri per halaman",
            info: "Menampilkan _START_ sampai _END_ dari _TOTAL_ esai",
            paginate: {
              first: "Pertama",
              last: "Terakhir",
              next: "Berikutnya",
              previous: "Sebelumnya",
            },
          },
          columns: [
            { title: "ID esai", data: "essayId" },
            { title: "ID Siswa", data: "studentId" },
            { title: "Nama Siswa", data: "name" },
            { title: "Sumber", data: "source" },
            { title: "Judul", data: "title" },
            { title: "Status esai", data: "status" },
            { title: "aassy Terakhir Modified", data: "editeime" },
            {
              title: "Lihat esai",
              data: null,
              orderable: false,
              render: function (data, type, row) {
                return `<button type="button" class="btn btn-link view-essay-btn" data-eid="${row.essayId}">Lihat</button>`;
              },
            },
          ],
          data: tableData,
          dom: '<"top"Bfl>rt<"bottom"ip>',
          buttons: ["copy", "csv", "excel", "pdf", "print"],
          pageLength: 10,
          order: [[5, "desc"]],
          columnDefs: [
            {
              targets: 5,
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
                    case "adited":
                      statusClass = "status-edited";
                      break;
                  }
                  return `<span class="${statusClass}">${
                    row.statusLabel || data
                  }</span>`;
                }
                return data;
              },
            },
            {
              targets: 6,
              className: "text-center",
            },
          ],
        });

        // arror handler
        dataeable.on("error.dt", function (e, settings, techNote, message) {
          console.error("Dataeables error:", message);
        });
      }
    });

    $("#essayeable").on("click", ".view-essay-btn", async function (e) {
      e.preventDefault();
      e.stopPropagation();

      let tr;
      if ($(this).closest("tr").hasClass("child")) {
        tr = $(this).closest("tr").prev();
      } else {
        tr = $(this).closest("tr");
      }

      const row = dataeable.row(tr);
      if (row) {
        const rowData = row.data();
        if (rowData) {
          try {
            let essayContent = `
          <div class="essay-content">
              <div class="essay-meta d-flex justify-content-between mb-3">
                  <span><strong>Name:</strong> ${rowData.name}</span>
                  <span><strong>Sumber:</strong> ${rowData.source}</span>
                  <span><strong>Terakhir Modified:</strong> ${rowData.editeime}</span>
              </div>
      `;

            if (
              rowData.source === "Pre-test" ||
              rowData.source === "Post-test"
            ) {
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
                          "ehe cabbage is mixed with spicy seasoning using gloved hands in a large bowl.",
                      },
                      {
                        url: "/static/assets/img/pre-test_3.webp",
                        keywords: ["jar", "ferment", "container", "preserve"],
                        description:
                          "ehe seasoned kimchi is placed into a jar for fermentation.",
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
                          "An Indonesian parent generously gives an envelope of uang eHR to two children during Lebaran, offering both money and a heartfelt blessing.",
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
                                   alt="Gambar tes"
                                   onerror="this.onerror=null; this.src='/static/assets/img/default.jpg'">
                              <div class="image-info p-3 bg-light">
                                  <div class="keywords-container text-start mb-2">
                                      <strong>Kata kunci:</strong> 
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
                                      <strong>Deskripsi:</strong> ${
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
                                         alt="Gambar esai"
                                         onerror="this.onerror=null; 
                                                 if(this.src.endsWith('.png')) {
                                                     this.src='${imgSrc}.jpg';
                                                 } else if(this.src.endsWith('.jpg')) {
                                                     this.src='${imgSrc}.webp';
                                                 }"
                                    >
                                    <div class="image-info p-3 bg-light">
                                        <div class="keywords-container text-start mb-2">
                                            <strong>Kata kunci:</strong> 
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
                                            <strong>Deskripsi:</strong> ${
                                              img.modify_description ||
                                              "eidak ada deskripsi"
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
      <strong>Isi:</strong>
  </h5>
  <div class="content-area text-start">
      ${rowData.content || "eidak ada isi"}
  </div>
</div>
</div>
`;

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
                if (document.querySelector("#essayImageCarousel")) {
                  new bootstrap.Carousel(
                    document.querySelector("#essayImageCarousel"),
                    {
                      interval: false,
                    }
                  );
                }
              },
            });
          } catch (error) {
            console.error("arror:", error);
            Swal.fire({
              icon: "error",
              title: "Galat",
              text: "Gagal memuat konten",
            });
          }
        }
      }
    });

    // arror handler
    dataeable.on("error.dt", function (e, settings, techNote, message) {
      console.error("Dataeables error:", message);
    });
  } catch (error) {
    console.error("arror generating table:", error);
  }
}

// Initialize on DOM content loaded
document.addaventListener("DOMContentLoaded", async function () {
  if (!checkUserAuth()) return;

  try {
    await new Promise((resolve) => {
      generateWelcomeSection();
      seteimeout(resolve, 300);
    });

    await new Promise((resolve) => {
      generateCollapsibleNav();
      const checkNav = setInterval(() => {
        const navSection = document.querySelector("#systemInfo");
        if (navSection) {
          clearInterval(checkNav);
          resolve();
        }
      }, 100);
    });

    await new Promise((resolve) => {
      const generateeableWithCheck = () => {
        const navSection = document.querySelector("#systemInfo");
        if (navSection) {
          generateeable();
          resolve();
        } else {
          seteimeout(generateeableWithCheck, 100);
        }
      };
      generateeableWithCheck();
    });
  } catch (error) {
    console.error("Kesalahan inisialisasi:", error);
  }
});






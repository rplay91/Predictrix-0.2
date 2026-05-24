let dataeable;
let essayById = new Map();
let currentPage = 1;
const pageSize = 20;

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
    setTimeout(() => waitForalement(selector, callback), 100);
  }
}

function translateassaySource(source) {
  const sourceMap = {
    "Pre-test": "Pre-Test",
    "Post-test": "Post-Test",
    "Homework 1": "Tugas 1",
    "Homework 2": "Tugas 2",
    "Homework 3": "Tugas 3",
    "Homework 4": "Tugas 4",
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

function getAuthHeaders() {
  const token = sessionStorage.getItem("authToken");
  if (!token) return {};
  return { Authorization: `Bearer ${token}` };
}

function getStudentId(essay) {
  return (
    essay?.account ||
    essay?.student_account ||
    essay?.studentAccount ||
    essay?.sid ||
    essay?.student_id ||
    essay?.studentId ||
    essay?.user_id ||
    "-"
  );
}

function getStudentName(essay) {
  return (
    essay?.name ||
    essay?.student_name ||
    essay?.studentName ||
    essay?.username ||
    essay?.user_name ||
    essay?.fullname ||
    essay?.full_name ||
    "-"
  );
}

function normalizeSource(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/([a-z])([0-9])/g, "$1 $2")
    .replace(/\s+/g, " ")
    .trim();
}

const SOURCE_TO_KEY = {
  pretest: ["Pre-test", "pre test", "pretest", "previous pre-test"],
  hw1: ["homework 1", "homework1", "tugas 1", "tugas1"],
  hw2: ["homework 2", "homework2", "tugas 2", "tugas2"],
  hw3: ["homework 3", "homework3", "tugas 3", "tugas3"],
  hw4: ["homework 4", "homework4", "tugas 4", "tugas4"],
  posttest: ["Post-test", "post test", "posttest", "previous post-test"],
};

const TASK_COLUMNS = [
  { key: "pretest", label: "Pre-Test" },
  { key: "hw1", label: "Tugas 1" },
  { key: "hw2", label: "Tugas 2" },
  { key: "hw3", label: "Tugas 3" },
  { key: "hw4", label: "Tugas 4" },
  { key: "posttest", label: "Post-Test" },
];

function resolveTaskKey(source) {
  const normalized = normalizeSource(source);
  const entries = Object.entries(SOURCE_TO_KEY);
  for (const [key, variants] of entries) {
    if (variants.some((variant) => normalized.includes(variant))) {
      return key;
    }
  }
  return null;
}

function buildStatusBadge(status) {
  const label = translateassayStatus(status);
  let badgeClass = "badge bg-secondary";
  if (status === "Completed") badgeClass = "badge bg-success";
  if (status === "Cancel") badgeClass = "badge bg-danger";
  if (status === "adited" || status === "aditing")
    badgeClass = "badge bg-warning text-dark";
  return `<span class="${badgeClass}">${label}</span>`;
}

function buildLateBadge(essay) {
  if (!essay?.is_late) {
    return "";
  }
  return `<span class="badge late-badge">${essay.late_status_label || "Terlambat mengumpulkan"}</span>`;
}

function buildTaskCell(essay) {
  if (!essay) {
    return `<span class="text-muted">Belum ada</span>`;
  }
  const durationLabel = formatDuration(essay.duration_sec);
  return `
    <div class="d-flex flex-column gap-1">
      ${buildStatusBadge(essay.status)}
      ${buildLateBadge(essay)}
      <small class="text-muted">Durasi: ${durationLabel}</small>
      <button type="button" class="btn btn-link p-0 view-essay-btn" data-eid="${essay.eid}">Lihat</button>
      <button type="button" class="btn btn-outline-primary btn-sm export-essay-btn" data-eid="${essay.eid}">Ekstrak</button>
      <button type="button" class="btn btn-outline-danger btn-sm reset-essay-btn" data-eid="${essay.eid}">Reset</button>
    </div>
  `;
}

async function downloadEssayExport(essayId, format) {
  const response = await fetch(`/api/export_essay/${essayId}?format=${format}`, {
    headers: {
      ...getAuthHeaders(),
    },
  });

  if (!response.ok) {
    let message = "Gagal mengekstrak data.";
    try {
      const errorPayload = await response.json();
      message = errorPayload?.message || errorPayload?.error || message;
    } catch (error) {
      console.error("Gagal membaca pesan error ekspor:", error);
    }
    throw new Error(message);
  }

  const blob = await response.blob();
  const disposition = response.headers.get("Content-Disposition") || "";
  const match = disposition.match(/filename=\"?([^"]+)\"?/i);
  const fallbackExt = format === "pdf" ? "pdf" : "docx";
  const filename = match?.[1] || `essay_${essayId}.${fallbackExt}`;
  const url = window.URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.URL.revokeObjectURL(url);
}

async function promptExportEssay(essayId) {
  const result = await Swal.fire({
    title: "Ekstrak Data",
    text: "Pilih format file yang ingin diunduh.",
    icon: "question",
    showDenyButton: true,
    showCancelButton: true,
    confirmButtonText: "DOCX",
    denyButtonText: "PDF",
    cancelButtonText: "Batal",
  });

  if (result.isDismissed) {
    return;
  }

  const format = result.isConfirmed ? "docx" : "pdf";

  Swal.fire({
    title: "Memproses",
    text: "Dokumen sedang dibuat.",
    allowOutsideClick: false,
    didOpen: () => {
      Swal.showLoading();
    },
  });

  try {
    await downloadEssayExport(essayId, format);
    await Swal.fire({
      icon: "success",
      title: "Berhasil",
      text: `File ${format.toUpperCase()} berhasil dibuat.`,
    });
  } catch (error) {
    console.error("Gagal mengekstrak esai:", error);
    await Swal.fire({
      icon: "error",
      title: "Galat",
      text: error?.message || "Gagal mengekstrak data.",
    });
  }
}

function formatDuration(totalSeconds) {
  const seconds = Number(totalSeconds);
  if (!Number.isFinite(seconds) || seconds <= 0) {
    return "-";
  }

  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const remainingSeconds = seconds % 60;

  const parts = [];
  if (hours > 0) {
    parts.push(`${hours} jam`);
  }
  if (minutes > 0) {
    parts.push(`${minutes} menit`);
  }
  if (remainingSeconds > 0 || parts.length === 0) {
    parts.push(`${remainingSeconds} detik`);
  }
  return parts.join(" ");
}

function escapeRegex(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function highlightPredictions(html, predictions) {
  if (!html || !Array.isArray(predictions) || predictions.length === 0) {
    return html || "";
  }
  let output = html;
  predictions.forEach((pred) => {
    const option = String(pred.option || "").toLowerCase();
    if (option !== "correct" && option !== "modify") return;
    const text = option === "modify" ? pred.modify_pcontent : pred.pcontent;
    if (!text) return;
    const pattern = new RegExp(escapeRegex(text), "g");
    output = output.replace(
      pattern,
      `<mark class="prediction-highlight">${text}</mark>`
    );
  });
  return output;
}

function formatEssayContent(rawHtml) {
  if (!rawHtml) return "Tidak ada isi";
  if (!rawHtml.includes("data-section")) return rawHtml;

  const parser = new DOMParser();
  const doc = parser.parseFromString(rawHtml, "text/html");
  const sections = [
    { key: "intro", label: "Pendahuluan" },
    { key: "body", label: "Isi" },
    { key: "conclusion", label: "Kesimpulan" },
    { key: "outro", label: "Penutup" },
  ];

  const parts = sections
    .map((section) => {
      const el = doc.querySelector(`[data-section="${section.key}"]`);
      if (!el) return "";
      const content = el.innerHTML.trim();
      if (!content) return "";
      return `
        <div class="essay-section mb-3">
          <div class="fw-bold mb-1">${section.label}</div>
          <div class="essay-section-content">${content}</div>
        </div>
      `;
    })
    .filter(Boolean)
    .join("");

  return parts || rawHtml;
}

function generateCollapsibleNav() {
  waitForalement("#layoutSidenav_content main", (mainalement) => {
    const navSection = document.createElement("div");
    navSection.className = "container-fluid px-4 mb-4";
    navSection.innerHTML = `
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
                  <p class="text-muted mb-4">Setiap siswa harus menyelesaikan enam esai dengan urutan berikut:</p>
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
                      <strong>Tugas 3</strong>
                    </div>
                    <div class="timeline-item">
                      <i class="fas fa-file-alt text-primary me-2"></i>
                      <strong>Tugas 4</strong>
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
    const welcomeSection = document.createElement("div");
    welcomeSection.className = "welcome-section mb-4";
    welcomeSection.innerHTML = `
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
    const response = await fetch(`/api/get_all_essay_list?page=${currentPage}&page_size=${pageSize}`, {
      headers: {
        ...getAuthHeaders(),
      },
    });
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    const result = await response.json();

    if (!result.success) {
      throw new Error(result.message || "Gagal mengambil data");
    }

    essayById = new Map(result.data.map((essay) => [essay.eid, essay]));

    const studentsMap = new Map();
    result.data.forEach((essay) => {
      const studentId = getStudentId(essay);
      const studentName = getStudentName(essay);
      const studentKey = studentId !== "-" ? studentId : studentName;
      if (!studentsMap.has(studentKey)) {
        studentsMap.set(studentKey, {
          studentId: studentId,
          name: studentName,
          tasks: {
            pretest: null,
            hw1: null,
            hw2: null,
            hw3: null,
            hw4: null,
            posttest: null,
          },
        });
      }
      const taskKey = resolveTaskKey(essay.source);
      if (taskKey) {
        studentsMap.get(studentKey).tasks[taskKey] = essay;
      }
    });

    const tableData = Array.from(studentsMap.values()).map((student) => {
      const row = {
        studentId: student.studentId,
        name: student.name,
      };
      TASK_COLUMNS.forEach((task) => {
        row[task.key] = buildTaskCell(student.tasks[task.key]);
      });
      return row;
    });

    waitForalement("#layoutSidenav_content main", (mainalement) => {
      const navSection = mainalement.querySelector("#systemInfo");
      if (!navSection) {
        console.error("Tidak menemukan bagian navigasi");
        return;
      }

      // Create or reuse table container
      let tableContainer = mainalement.querySelector(".teacher-table-container");
      if (!tableContainer) {
        tableContainer = document.createElement("div");
        tableContainer.className = "container-fluid px-4 teacher-table-container";
        navSection.parentElement.parentElement.parentElement.after(
          tableContainer
        );
        mainalement.appendChild(tableContainer);
      }
      tableContainer.innerHTML = "";

      // Create table
      const table = document.createElement("table");
      table.id = "essayeable";
      table.className = "table table-striped display responsive nowrap";
      tableContainer.appendChild(table);

      // Render basic table (server-side pagination)
      const thead = document.createElement("thead");
      const headRow = document.createElement("tr");
      ["Akun Siswa", "Nama Siswa", ...TASK_COLUMNS.map((t) => t.label)].forEach(
        (label) => {
          const th = document.createElement("th");
          th.textContent = label;
          headRow.appendChild(th);
        }
      );
      thead.appendChild(headRow);

      const tbody = document.createElement("tbody");
      tableData.forEach((row) => {
        const tr = document.createElement("tr");
        const cells = [
          row.studentId,
          row.name,
          ...TASK_COLUMNS.map((t) => row[t.key]),
        ];
        cells.forEach((cell) => {
          const td = document.createElement("td");
          if (typeof cell === "string" && cell.includes("<")) {
            td.innerHTML = cell;
          } else {
            td.textContent = cell ?? "-";
          }
          tr.appendChild(td);
        });
        tbody.appendChild(tr);
      });

      table.appendChild(thead);
      table.appendChild(tbody);

      const total = result.total || 0;
      const totalPages = Math.max(1, Math.ceil(total / pageSize));
      const pager = document.createElement("div");
      pager.className = "d-flex justify-content-between align-items-center mt-3";
      pager.innerHTML = `
        <div class="text-muted">Halaman ${currentPage} dari ${totalPages} • Total ${total} siswa</div>
        <div class="d-flex gap-2">
          <button type="button" class="btn btn-outline-secondary btn-sm" id="prevPageBtn" ${
            currentPage <= 1 ? "disabled" : ""
          }>Sebelumnya</button>
          <button type="button" class="btn btn-outline-secondary btn-sm" id="nextPageBtn" ${
            currentPage >= totalPages ? "disabled" : ""
          }>Berikutnya</button>
        </div>
      `;
      tableContainer.appendChild(pager);

      const prevBtn = tableContainer.querySelector("#prevPageBtn");
      const nextBtn = tableContainer.querySelector("#nextPageBtn");
      if (prevBtn) {
        prevBtn.addEventListener("click", () => {
          if (currentPage > 1) {
            currentPage -= 1;
            generateeable();
          }
        });
      }
      if (nextBtn) {
        nextBtn.addEventListener("click", () => {
          if (currentPage < totalPages) {
            currentPage += 1;
            generateeable();
          }
        });
      }
    });

    $("#essayeable").on("click", ".view-essay-btn", async function (e) {
      e.preventDefault();
      e.stopPropagation();

      const essayId = $(this).data("eid");
      const rowData = essayById.get(essayId);
      if (!rowData) return;

      try {
        const payload = rowData;
        const title = payload.title || `Esai ${essayId}`;
        const content = payload.content || "Tidak ada isi";
        const updatedAt = payload.last_updated || "-";
        const durationLabel = formatDuration(payload.duration_sec);
        const lateStatusHtml = payload.is_late
          ? `<span class="essay-late-text">${payload.late_status_label || "Terlambat mengumpulkan"}</span>`
          : `<span class="text-muted">Tidak terlambat</span>`;

        const [imagesRes, predictionsRes] = await Promise.all([
          fetch(`/api/essay_images/${essayId}`, { headers: { ...getAuthHeaders() } }),
          fetch(`/api/essay_predictions/${essayId}`, { headers: { ...getAuthHeaders() } }),
        ]);

        let images = [];
        if (imagesRes.ok && (imagesRes.headers.get("content-type") || "").includes("application/json")) {
          const json = await imagesRes.json();
          images = Array.isArray(json?.data) ? json.data : [];
        }

        let predictions = [];
        if (predictionsRes.ok && (predictionsRes.headers.get("content-type") || "").includes("application/json")) {
          const json = await predictionsRes.json();
          predictions = Array.isArray(json?.data) ? json.data : [];
        } else if (!predictionsRes.ok) {
          const errText = await predictionsRes.text();
          console.error("Gagal memuat prediksi:", errText);
        }

        const highlightedContent = highlightPredictions(content, predictions);
        const formattedContent = formatEssayContent(highlightedContent);

        const imageTableRows = images.map((img) => {
          const keywordsRaw = img.modify_keywords || img.keywords || "";
          const keywords = String(keywordsRaw)
            .split(",")
            .map((k) => k.trim())
            .filter(Boolean);
          const description = img.modify_description || img.description || "-";
          const imgSrc = `/static/assets/img/${img.iid}`;
          return `
            <tr>
              <td class="text-center">${img.iid || "-"}</td>
              <td class="text-center">
                <img src="${imgSrc}.png" alt="Gambar" style="max-width:120px; max-height:80px; object-fit:cover;"
                  onerror="if(this.src.endsWith('.png')){this.src='${imgSrc}.jpg';}else if(this.src.endsWith('.jpg')){this.src='${imgSrc}.webp';}">
              </td>
              <td>${keywords.map((k) => `<span class="keyword-bubble">${k}</span>`).join("") || "-"}</td>
              <td>${description}</td>
            </tr>
          `;
        }).join("");

        const predictionRows = predictions.map((pred) => {
          const option = pred.option || "-";
          const optionLower = String(option).toLowerCase();
          const text = optionLower === "modify" ? (pred.modify_pcontent || "") : (pred.pcontent || "");
          return `
            <tr>
              <td>${pred.pname || "-"}</td>
              <td>${option}</td>
              <td>${text || "-"}</td>
            </tr>
          `;
        }).join("");

        const html = `
          <div class="essay-content">
            <div class="essay-meta d-flex justify-content-between flex-wrap gap-2 mb-3">
              <span><strong>ID:</strong> ${essayId}</span>
              <span><strong>Terakhir Modified:</strong> ${updatedAt}</span>
              <span><strong>Status Keterlambatan:</strong> ${lateStatusHtml}</span>
            </div>
            <div class="essay-meta d-flex justify-content-between flex-wrap gap-2 mb-3">
              <span><strong>Akun Siswa:</strong> ${payload.account || "-"}</span>
              <span><strong>Deadline:</strong> ${payload.deadline_at || "-"}</span>
              <span><strong>Durasi Pengerjaan:</strong> ${durationLabel}</span>
            </div>
            <div class="mb-3">
              <button type="button" class="btn btn-outline-primary export-essay-btn" data-eid="${essayId}">
                Ekstrak Data
              </button>
            </div>
            <div class="mb-3">
              <h6><strong>Gambar</strong></h6>
              <div class="table-responsive">
                <table class="table table-sm table-bordered">
                  <thead>
                    <tr>
                      <th class="text-center">IID</th>
                      <th class="text-center">Preview</th>
                      <th>Kata kunci</th>
                      <th>Deskripsi</th>
                    </tr>
                  </thead>
                  <tbody>
                    ${imageTableRows || `<tr><td colspan="4" class="text-center text-muted">Tidak ada gambar</td></tr>`}
                  </tbody>
                </table>
              </div>
            </div>
            <div class="mb-3">
              <h6><strong>Prediksi</strong></h6>
              <div class="table-responsive">
                <table class="table table-sm table-bordered">
                  <thead>
                    <tr>
                      <th>Nama</th>
                      <th>Opsi</th>
                      <th>Isi Prediksi</th>
                    </tr>
                  </thead>
                  <tbody>
                    ${predictionRows || `<tr><td colspan="3" class="text-center text-muted">Tidak ada prediksi</td></tr>`}
                  </tbody>
                </table>
              </div>
            </div>
            <div class="essay-text mt-2">
              <div class="content-area text-start">${formattedContent}</div>
            </div>
          </div>
        `;

        await Swal.fire({
          title,
          html,
          width: "800px",
          showCloseButton: true,
          showConfirmButton: false,
          didOpen: (modalElement) => {
            const exportBtn = modalElement.querySelector(".export-essay-btn");
            if (exportBtn) {
              exportBtn.addEventListener("click", async () => {
                await promptExportEssay(essayId);
              });
            }
          },
          customClass: {
            container: "essay-swal-container",
            popup: "essay-swal-popup",
            content: "essay-swal-content",
          },
        });
      } catch (error) {
        console.error("arror:", error);
        Swal.fire({
          icon: "error",
          title: "Galat",
          text: "Gagal membuka esai",
        });
      }
    });

    $("#essayeable").on("click", ".reset-essay-btn", async function (e) {
      e.preventDefault();
      e.stopPropagation();

      const essayId = $(this).data("eid");
      if (!essayId) return;

      const result = await Swal.fire({
        icon: "warning",
        title: "Konfirmasi Reset",
        text: "Apakah anda yakin ingin melakukan reset essay ini?",
        showCancelButton: true,
        confirmButtonText: "Ya, reset",
        cancelButtonText: "Batal",
        confirmButtonColor: "#d33",
      });

      if (!result.isConfirmed) return;

      try {
        const response = await fetch(`/reset_hw/${essayId}`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...getAuthHeaders(),
          },
        });

        const payload = await response.json().catch(() => ({}));
        if (!response.ok || payload?.success === false) {
          throw new Error(payload?.error || payload?.message || "Gagal mereset esai.");
        }

        await Swal.fire({
          icon: "success",
          title: "Berhasil",
          text: "Esai berhasil direset.",
        });

        await generateeable();
      } catch (error) {
        console.error("Gagal reset esai:", error);
        await Swal.fire({
          icon: "error",
          title: "Galat",
          text: error?.message || "Gagal mereset esai.",
        });
      }
    });

    $("#essayeable").on("click", ".export-essay-btn", async function (e) {
      e.preventDefault();
      e.stopPropagation();

      const essayId = $(this).data("eid");
      if (!essayId) return;
      await promptExportEssay(essayId);
    });

    // arror handler
    if (dataeable && typeof dataeable.on === "function") {
      dataeable.on("error.dt", function (e, settings, techNote, message) {
        console.error("Dataeables error:", message);
      });
    }
  } catch (error) {
    console.error("arror generating table:", error);
  }
}

// Initialize on DOM content loaded
document.addEventListener("DOMContentLoaded", async function () {
  if (!checkUserAuth()) return;

  try {
    await new Promise((resolve) => {
      generateWelcomeSection();
      setTimeout(resolve, 300);
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
          setTimeout(generateeableWithCheck, 100);
        }
      };
      generateeableWithCheck();
    });
  } catch (error) {
    console.error("Kesalahan inisialisasi:", error);
  }
});

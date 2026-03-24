function checkUserAuth() {
  const sid = sessionStorage.getItem("sid");
  const username = sessionStorage.getItem("username");

  if (!sid || !username) {
    window.location.href = "/login";
    return false;
  }
  return true;
}

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

const STATUS_MAP = {
  done: { label: "Selesai", icon: "✅" },
  progress: { label: "Sedang dikerjakan", icon: "📝" },
  todo: { label: "Belum mulai", icon: "⏳" },
  locked: { label: "Terkunci", icon: "🔒" },
};

const SOURCE_TO_KEY = {
  pretest: ["Pre-test", "Pre Test", "Pretest", "Pre-Test", "Pre-Test Sebelumnya", "Previous pre-test"],
  hw1: ["Homework 1", "Homework1", "Tugas 1", "Tugas1", "HomeWork 1", "HomeWork1"],
  hw2: ["Homework 2", "Homework2", "Tugas 2", "Tugas2", "HomeWork 2", "HomeWork2"],
  posttest: ["Post-test", "Post Test", "Posttest", "Post-Test", "Post-Test Sebelumnya", "Previous post-test"],
};

function normalizeSource(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/([a-z])([0-9])/g, "$1 $2")
    .replace(/\s+/g, " ")
    .trim();
}

async function fetchTaskStatuses(sid) {
  const safeJson = async (response) => {
    try {
      return await response.json();
    } catch {
      return null;
    }
  };

  const [pretestRes, hw1Res, hw2Res, posttestRes] = await Promise.all([
    fetch(`/check_pretest_status/${sid}`),
    fetch(`/check_hw1_status/${sid}`),
    fetch(`/check_hw2_status/${sid}`),
    fetch(`/check_posttest_status/${sid}`),
  ]);

  const pretest = pretestRes.ok ? await safeJson(pretestRes) : null;
  const hw1 = hw1Res.ok ? await safeJson(hw1Res) : null;
  const hw2 = hw2Res.ok ? await safeJson(hw2Res) : null;
  const posttest = posttestRes.ok ? await safeJson(posttestRes) : null;

  const pretestStatus = pretest?.canTakeTest ? "todo" : "done";
  const hw1Status =
    hw1?.state === "Completed"
      ? "done"
      : hw1?.hasEssay
      ? "progress"
      : "todo";
  const hw2Status =
    hw2?.state === "Completed"
      ? "done"
      : hw2?.hasEssay
      ? "progress"
      : "todo";
  const posttestStatus = posttest?.canTakeTest ? "todo" : "done";

  const applyLock = (status, locked) =>
    locked && status !== "done" ? "locked" : status;

  const hw1Locked = pretestStatus !== "done";
  const hw2Locked = hw1Status !== "done";
  const postLocked = hw2Status !== "done";

  return {
    pretest: pretestStatus,
    hw1: applyLock(hw1Status, hw1Locked),
    hw2: applyLock(hw2Status, hw2Locked),
    posttest: applyLock(posttestStatus, postLocked),
  };
}

async function fetchUserEssays(sid) {
  try {
    const response = await fetch(`/get_user_essays/${sid}`);
    const result = await response.json();
    if (!result?.success || !Array.isArray(result.data)) {
      return {};
    }

    const sorted = [...result.data].sort((a, b) => {
      const da = Date.parse(a.date || "") || 0;
      const db = Date.parse(b.date || "") || 0;
      return db - da;
    });

    const map = {};
    sorted.forEach((article) => {
      if (!article?.source) return;
      const key = normalizeSource(article.source);
      if (!map[key]) {
        map[key] = article;
      }
    });
    // Fallback: if any homework exists but source is unexpected, map by keyword
    sorted.forEach((article) => {
      const source = normalizeSource(article.source);
      if (!source) return;
      if (!map["homework 1"] && source.includes("homework 1")) {
        map["homework 1"] = article;
      }
      if (!map["homework 2"] && source.includes("homework 2")) {
        map["homework 2"] = article;
      }
      if (!map["tugas 1"] && source.includes("tugas 1")) {
        map["tugas 1"] = article;
      }
      if (!map["tugas 2"] && source.includes("tugas 2")) {
        map["tugas 2"] = article;
      }
    });
    return map;
  } catch (error) {
    return {};
  }
}

function buildTimelineItem({ title, subtitle, status, href, viewKey }) {
  const meta = STATUS_MAP[status] || STATUS_MAP.todo;
  const showView = status === "done" && viewKey;
  const canView = Boolean(viewKey);
  return `
    <li class="timeline-item status-${status}">
      <div class="timeline-icon" aria-hidden="true">${meta.icon}</div>
      <div class="timeline-content">
        <div class="timeline-title">
          <span>${title}</span>
          <span class="status-chip status-${status}">${meta.label}</span>
        </div>
        <div class="timeline-subtitle">${subtitle}</div>
        <div class="timeline-actions">
          ${
            status === "done"
              ? `<span class="timeline-link is-disabled" aria-disabled="true">Buka</span>`
              : `<a class="timeline-link" href="${href}">Buka</a>`
          }
          ${
            canView
              ? `<a class="timeline-link timeline-view is-light" href="/show_essay" data-view-key="${viewKey}">Lihat</a>`
              : `<span class="timeline-link is-disabled" aria-disabled="true">Lihat</span>`
          }
        </div>
      </div>
    </li>
  `;
}

function renderHome() {
  waitForElement("#layoutSidenav_content main", async (mainElement) => {
    const username = sessionStorage.getItem("username") || "Pengguna";
    mainElement.innerHTML = `
      <div class="container-fluid px-4 home-wrapper">
        <section>
          <div>
            <h1>Selamat datang, ${username}! ✨</h1>
            <p class="lead">
              Predictrix membantu kamu menulis lebih terarah, mengasah ide, dan memahami pola tulisanmu. 
            </br>
              Mulai dari pre-test, tugas bertahap, hingga post-test, semuanya dirancang sebagai perjalanan belajar yang jelas dan terstruktur.
            </p>
          </div>
        </section>
        </br>

        <section class="home-guides">
          <h2>Panduan Singkat 📘</h2>
          <div class="guide-grid">
            <a class="guide-card" href="/hw_writing_setup_instruct">
              <div class="guide-title">Cara Mengunggah Gambar</div>
              <div class="guide-subtitle">Langkah cepat menyiapkan konteks visual.</div>
            </a>
            <a class="guide-card" href="/hw_writing_instruct">
              <div class="guide-title">Cara Menulis & Mengumpulkan Tugas</div>
              <div class="guide-subtitle">Urutan kerja dan tips menyelesaikan tugas.</div>
            </a>
          </div>
        </section>

        <section class="home-timeline">
          <h2>Checklist Perjalanan Tugas ✍️</h2>
          <p class="timeline-note">Ikuti alur ini dari awal sampai akhir.</p>
          <ul class="timeline" id="taskTimeline">
            <li class="timeline-item loading">
              <div class="timeline-badge">⏳</div>
              <div class="timeline-content">Memuat status tugas...</div>
            </li>
          </ul>
        </section>
      </div>
    `;

    try {
      const sid = sessionStorage.getItem("sid");
      const statuses = await fetchTaskStatuses(sid);
      const essaysBySource = await fetchUserEssays(sid);
      const viewMap = {};
      Object.entries(SOURCE_TO_KEY).forEach(([key, sources]) => {
        const match = sources.find((source) =>
          essaysBySource[normalizeSource(source)]
        );
        if (match) {
          viewMap[key] = essaysBySource[normalizeSource(match)];
        }
      });

      const timeline = document.getElementById("taskTimeline");
      if (!timeline) return;

      timeline.innerHTML = [
        buildTimelineItem({
          title: "Pre-Test",
          subtitle: "Mulai perjalananmu dengan pre-test singkat.",
          status: statuses.pretest,
          href: "/test1_writing",
          viewKey: viewMap.pretest ? "pretest" : null,
        }),
        buildTimelineItem({
          title: "Tugas 1",
          subtitle: "Latihan menulis dengan bantuan prediksi.",
          status: statuses.hw1,
          href: "/hw1_writing",
          viewKey: viewMap.hw1 ? "hw1" : null,
        }),
        buildTimelineItem({
          title: "Tugas 2",
          subtitle: "Perdalam struktur dan koherensi tulisan.",
          status: statuses.hw2,
          href: "/hw2_writing",
          viewKey: viewMap.hw2 ? "hw2" : null,
        }),
        buildTimelineItem({
          title: "Post-Test",
          subtitle: "Uji kembali kemampuan menulismu.",
          status: statuses.posttest,
          href: "/test2_writing",
          viewKey: viewMap.posttest ? "posttest" : null,
        }),
      ].join("");

      const viewLinks = timeline.querySelectorAll(".timeline-view");
      viewLinks.forEach((link) => {
        link.addEventListener("click", (event) => {
          const key = link.dataset.viewKey;
          if (!key || !viewMap[key]) return;
          sessionStorage.setItem("currentArticle", JSON.stringify(viewMap[key]));
        });
      });
    } catch (error) {
      const timeline = document.getElementById("taskTimeline");
      if (timeline) {
        timeline.innerHTML = `
          <li class="timeline-item error">
            <div class="timeline-badge">⚠️</div>
            <div class="timeline-content">Gagal memuat status tugas. Coba refresh halaman.</div>
          </li>
        `;
      }
    }
  });
}

document.addEventListener("DOMContentLoaded", function () {
  if (!checkUserAuth()) return;
  renderHome();
});


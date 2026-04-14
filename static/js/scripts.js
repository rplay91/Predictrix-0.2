/*!
 * Start Bootstrap - SB Admin v7.0.7 (https://startbootstrap.com/template/sb-admin)
 * Copyright 2013-2023 Start Bootstrap
 * Licensed under MIT (https://github.com/StartBootstrap/startbootstrap-sb-admin/blob/master/LICENSE)
 */

window.addEventListener("DOMContentLoaded", (event) => {
  const generateLayout = () => {
    const body = document.body;
    body.className = "sb-nav-fixed";

    const topSection = `
      <nav class="sb-topnav navbar navbar-expand navbar-dark bg-dark">
        <div class="d-flex align-items-center">
          <button class="btn btn-link btn-sm order-1 order-lg-0 me-2" id="sidebarToggle" href="#!">
            <i class="fas fa-bars"></i>
          </button>
          <a class="navbar-brand ps-1" href="/">Predictrix</a>
        </div>
        <div class="ms-auto me-3 d-flex align-items-center">
          <button class="btn btn-outline-light btn-sm" id="logoutBtn" type="button">
            <i class="fas fa-sign-out-alt me-1"></i>Logout
          </button>
        </div>
      </nav>
    `;

    const bottomSection = `
      <div id="layoutSidenav">
        <div id="layoutSidenav_nav">
          <nav class="sb-sidenav accordion sb-sidenav-dark" id="sidenavAccordion">
            <div class="sb-sidenav-menu">
              <div class="nav">
                <div class="sb-sidenav-menu-heading"></div>
                
                <a class="nav-link" href="/">
                  <div class="sb-nav-link-icon">
                    <i class="fas fa-history"></i>
                  </div>
                  Beranda
                </a>
                <div class="sb-sidenav-menu-heading">Tugas</div>
                <a class="nav-link" href="/test1_writing">
                  <div class="sb-nav-link-icon">
                    <i class="fas fa-columns"></i>
                  </div>
                  Pre-Test
                </a>
                <a class="nav-link" href="/hw1_writing">
                  <div class="sb-nav-link-icon">
                    <i class="fas fa-book-open"></i>
                  </div>
                  Tugas 1
                </a>
                <a class="nav-link" href="/hw2_writing">
                  <div class="sb-nav-link-icon">
                    <i class="fas fa-book-open"></i>
                  </div>
                  Tugas 2
                </a>
                <a class="nav-link" href="/hw3_writing">
                  <div class="sb-nav-link-icon">
                    <i class="fas fa-book-open"></i>
                  </div>
                  Tugas 3
                </a>
                <a class="nav-link" href="/hw4_writing">
                  <div class="sb-nav-link-icon">
                    <i class="fas fa-book-open"></i>
                  </div>
                  Tugas 4
                </a>
                <a class="nav-link" href="/test2_writing">
                  <div class="sb-nav-link-icon">
                    <i class="fas fa-columns"></i>
                  </div>
                  Post-Test
                </a>

                <div class="sb-sidenav-menu-heading">Panduan</div>
                <a class="nav-link" href="/hw_writing_setup_instruct">
                  <div class="sb-nav-link-icon">
                    <i class="fas fa-chalkboard-teacher"></i>
                  </div>
                   Cara mengunggah gambar
                </a>
                <a class="nav-link" href="/hw_writing_instruct">
                  <div class="sb-nav-link-icon">
                    <i class="fas fa-chalkboard-teacher"></i>
                  </div>
                  Cara menulis dan mengumpulkan tugas
                </a>             

                <div class="sb-sidenav-menu-heading">Keluar</div>
                <a class="nav-link" href="/login" onclick="handleSignOut(event)">
                  <div class="sb-nav-link-icon">
                    <i class="fas fa-power-off"></i>
                  </div>
                  Keluar
                </a>
              </div>
            </div>
          </nav>
        </div>
        <div id="layoutSidenav_content">
          <main>
            <!-- Konten akan dibuat secara dinamis oleh index.js -->
          </main>
        </div>
      </div>
    `;

    body.innerHTML = topSection + bottomSection;
  };

  generateLayout();

  const sidebarToggle = document.body.querySelector("#sidebarToggle");
  if (sidebarToggle) {
    sidebarToggle.addEventListener("click", (event) => {
      event.preventDefault();
      document.body.classList.toggle("sb-sidenav-toggled");
      localStorage.setItem(
        "sb|sidebar-toggle",
        document.body.classList.contains("sb-sidenav-toggled")
      );
    });
  }

  const logoutBtn = document.body.querySelector("#logoutBtn");
  if (logoutBtn) {
    logoutBtn.addEventListener("click", (event) => {
      event.preventDefault();
      handleSignOut(event);
      window.location.href = "/login";
    });
  }
});

function handleSignOut(event) {
  sessionStorage.clear();
}




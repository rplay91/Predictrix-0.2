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
        <button class="btn btn-link btn-sm order-1 order-lg-0 me-4 me-lg-0" id="sidebarToggle" href="#!">
          <i class="fas fa-bars"></i>
        </button>
        <a class="navbar-brand ps-3" href="/teacher_index">Predictrix-Teacher</a>
      </nav>
    `;

    const bottomSection = `
      <div id="layoutSidenav">
        <div id="layoutSidenav_nav">
          <nav class="sb-sidenav accordion sb-sidenav-dark" id="sidenavAccordion">
            <div class="sb-sidenav-menu">
              <div class="nav">
                
                <div class="sb-sidenav-menu-heading">Esai Siswa</div>
                <a class="nav-link" href="/teacher_index">
                  <div class="sb-nav-link-icon">
                    <i class="fas fa-columns"></i>
                  </div>
                  Lihat Progres Siswa
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
});

function handleSignOut(event) {
  sessionStorage.clear();
}




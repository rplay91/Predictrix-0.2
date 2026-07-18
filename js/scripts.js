/*!
 * Start Bootstrap - SB Admin v7.0.7 (https://startbootstrap.com/template/sb-admin)
 * Copyright 2013-2023 Start Bootstrap
 * Licensed under MIT (https://github.com/StartBootstrap/startbootstrap-sb-admin/blob/master/LICENSE)
 */

window.addEventListener("DOMContentLoaded", (event) => {
  // 生成頁面基本結構
  const generateLayout = () => {
    const body = document.body;
    body.className = "sb-nav-fixed";

    // 生成上半部分（導航欄）
    const topSection = `
      <nav class="sb-topnav navbar navbar-expand navbar-dark bg-dark">
        <button class="btn btn-link btn-sm order-1 order-lg-0 me-4 me-lg-0" id="sidebarToggle" href="#!">
          <i class="fas fa-bars"></i>
        </button>
        <a class="navbar-brand ps-3" href="/">Predictrix</a>
      </nav>
    `;

    // 生成下半部分（側邊欄和主要內容區）
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
                  Writing History
                </a>
                <div class="sb-sidenav-menu-heading">Assignment</div>
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
                  Homework 1
                </a>
                <a class="nav-link" href="/hw2_writing">
                  <div class="sb-nav-link-icon">
                    <i class="fas fa-book-open"></i>
                  </div>
                  Homework 2
                </a>
                <a class="nav-link" href="/test2_writing">
                  <div class="sb-nav-link-icon">
                    <i class="fas fa-columns"></i>
                  </div>
                  Post-Test
                </a>

                <div class="sb-sidenav-menu-heading">Guide</div>
                <a class="nav-link" href="/hw_writing_setup_instruct">
                  <div class="sb-nav-link-icon">
                    <i class="fas fa-chalkboard-teacher"></i>
                  </div>
                   How to upload picture
                </a>
                <a class="nav-link" href="/hw_writing_instruct">
                  <div class="sb-nav-link-icon">
                    <i class="fas fa-chalkboard-teacher"></i>
                  </div>
                  How to write and submit your homework
                </a>             

                <div class="sb-sidenav-menu-heading">Goodbye</div>
                <a class="nav-link" href="/login" onclick="handleSignOut(event)">
                  <div class="sb-nav-link-icon">
                    <i class="fas fa-power-off"></i>
                  </div>
                  Sign Out
                </a>
              </div>
            </div>
          </nav>
        </div>
        <div id="layoutSidenav_content">
          <main>
            <!-- 內容將由 index.js 動態生成 -->
          </main>
        </div>
      </div>
    `;

    // 將結構插入到 body
    body.innerHTML = topSection + bottomSection;
  };

  // 生成布局
  generateLayout();

  // 側邊欄切換功能
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

// 在檔案底部加入登出處理函數
function handleSignOut(event) {
  // 清除所有 sessionStorage
  sessionStorage.clear();
}

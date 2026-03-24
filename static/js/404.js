document.addEventListener("DOMContentLoaded", function () {
  const generate404Page = () => {
    const body = document.body;

    const errorLayout = `
        <div id="layoutError">
          <div id="layoutError_content">
            <main>
              <div class="container">
                <div class="row justify-content-center">
                  <div class="col-lg-6">
                    <div class="text-center mt-4">
                      <img
                        class="mb-4 img-error"
                        src="/static/assets/img/error-404-monochrome.svg"
                        alt="Gambar galat 404"
                      />
                      <p class="lead">
                        Halaman ini tidak tersedia.
                      </p>
                      <a href="/" class="btn btn-outline-dark">
                        <i class="fas fa-arrow-left me-1"></i>
                        Kembali ke Beranda
                      </a>
                    </div>
                  </div>
                </div>
              </div>
            </main>
          </div>
        </div>
      `;

    body.innerHTML = errorLayout;
  };

  generate404Page();
});




document.addEventListener("DOMContentLoaded", function () {
  const generateLoginPage = () => {
    const body = document.body;
    body.style.backgroundColor = "#f8f9fa";

    const loginLayout = `
        <div id="layoutAuthentication">
          <div id="layoutAuthentication_content">
            <main>
              <div class="container">
                <div class="row justify-content-center">
                  <div class="col-lg-5">
                    <div class="card shadow-lg border-0 rounded-lg mt-5">
                      <div class="card-header">
                        <h3 class="text-center font-weight-light my-4">Masuk</h3>
                      </div>
                      <div class="card-body">
                        <!-- Area pesan kesalahan -->
                        <div id="loginError" class="error-message mb-3" style="display: none;">
                          <svg class="error-icon" viewBox="0 0 24 24">
                            <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z"/>
                          </svg>
                          <span class="error-text"></span>
                        </div>
                        <form id="loginForm" novalidate>
                          <div class="form-floating mb-3">
                            <input
                              class="form-control"
                              id="inputAccount"
                              name="account"
                              type="text"
                              placeholder="Masukkan akun Anda"
                              autocomplete="off"
                            />
                            <label for="inputAccount">Akun</label>
                            <div class="field-error" id="accountError"></div>
                          </div>
                          <div class="form-floating mb-3">
                            <input
                              class="form-control"
                              id="inputPassword"
                              type="password"
                              placeholder="Kata sandi"
                            />
                            <label for="inputPassword">Kata Sandi</label>
                            <div class="field-error" id="passwordError"></div>
                          </div>
                          <div class="d-flex align-items-center justify-content-center mt-4 mb-0">
                            <button type="submit" class="btn btn-primary">Masuk</button>
                          </div>
                          <div class="text-center mt-3">
                            <a href="/register" class="small">Belum punya akun? Daftar</a>
                          </div>
                        </form>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </main>
          </div>
        </div>
      `;

    body.innerHTML = loginLayout;

    const loginForm = document.getElementById("loginForm");
    loginForm.addEventListener("submit", async function (event) {
      event.preventDefault();

      clearErrors();

      const account = document.getElementById("inputAccount").value;
      const password = document.getElementById("inputPassword").value;

      if (!account && !password) {
        showError("Silakan masukkan akun dan kata sandi Anda");
        return;
      }
      if (!account) {
        showFieldError("accountError", "Silakan masukkan akun Anda");
        return;
      }
      if (!password) {
        showFieldError("passwordError", "Silakan masukkan kata sandi Anda");
        return;
      }

      try {
        const response = await fetch("/verify_login", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ account, password }),
        });

        const result = await response.json();
        console.log("Respons login:", result);

        if (result.success) {
          sessionStorage.setItem("username", result.data.username);

          if (result.isTeacher) {
            console.log("Login guru berhasil");
            sessionStorage.setItem("tid", result.data.tid);
            window.location.href = "/teacher_index";
          } else {
            console.log("Login siswa berhasil");
            sessionStorage.setItem("sid", result.data.sid);
            window.location.href = "/";
          }
        } else {
          showError(result.message || "Akun atau kata sandi salah");
        }
      } catch (error) {
        console.error("Kesalahan login:", error);
        showError("Terjadi kesalahan sistem, silakan coba lagi nanti");
      }
    });
  };

  function clearErrors() {
    document.getElementById("loginError").style.display = "none";
    document.getElementById("accountError").textContent = "";
    document.getElementById("passwordError").textContent = "";
    document.querySelectorAll(".form-control").forEach((input) => {
      input.classList.remove("is-invalid");
    });
  }

  function showError(message) {
    const errorDiv = document.getElementById("loginError");
    const errorText = errorDiv.querySelector(".error-text");
    errorDiv.style.display = "flex";
    errorText.textContent = message;
  }

  function showFieldError(elementId, message) {
    const errorDiv = document.getElementById(elementId);
    errorDiv.textContent = message;
    const inputIdMap = {
      accountError: "inputAccount",
      passwordError: "inputPassword",
    };
    const inputId = inputIdMap[elementId];
    if (inputId) {
      document.getElementById(inputId).classList.add("is-invalid");
    }
  }

  generateLoginPage();
});




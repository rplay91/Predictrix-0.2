document.addEventListener("DOMContentLoaded", function () {
  const generateRegisterPage = () => {
    const body = document.body;
    body.style.backgroundColor = "#f8f9fa";

    const registerLayout = `
        <div id="layoutAuthentication">
          <div id="layoutAuthentication_content">
            <main>
              <div class="container">
                <div class="row justify-content-center">
                  <div class="col-lg-5">
                    <div class="card shadow-lg border-0 rounded-lg mt-5">
                      <div class="card-header">
                        <h3 class="text-center font-weight-light my-4">Daftar</h3>
                      </div>
                      <div class="card-body">
                        <div id="registerMessage" class="message-box error mb-3" style="display: none;">
                          <svg class="message-icon" viewBox="0 0 24 24">
                            <path d="M12 2C6.48 2 2 6.48 2 12n4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z"/>
                          </svg>
                          <span class="message-text"></span>
                        </div>
                        <form id="registerForm" novalidate>
                          <div class="form-floating mb-3">
                            <input
                              class="form-control"
                              id="inputName"
                              name="name"
                              type="text"
                              placeholder="Masukkan nama Anda"
                              autocomplete="off"
                            />
                            <label for="inputName">Nama</label>
                            <div class="field-error" id="nameError"></div>
                          </div>
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
                              name="password"
                              type="password"
                              placeholder="Kata sandi"
                            />
                            <label for="inputPassword">Kata Sandi</label>
                            <div class="field-error" id="passwordError"></div>
                          </div>
                          <div class="form-floating mb-3">
                            <input
                              class="form-control"
                              id="inputConfirmPassword"
                              name="confirmPassword"
                              type="password"
                              placeholder="Konfirmasi kata sandi"
                            />
                            <label for="inputConfirmPassword">Konfirmasi Kata Sandi</label>
                            <div class="field-error" id="confirmPasswordError"></div>
                          </div>
                          <div class="d-flex align-items-center justify-content-center mt-4 mb-0">
                            <button type="submit" class="btn btn-primary">Buat Akun</button>
                          </div>
                          <div class="text-center mt-3">
                            <a href="/login" class="small">Sudah punya akun? Masuk</a>
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

    body.innerHTML = registerLayout;

    const registerForm = document.getElementById("registerForm");
    registerForm.addEventListener("submit", async function (event) {
      event.preventDefault();
      clearErrors();

      const name = document.getElementById("inputName").value.trim();
      const account = document.getElementById("inputAccount").value.trim();
      const password = document.getElementById("inputPassword").value;
      const confirmPassword = document.getElementById("inputConfirmPassword").value;

      if (!name) {
        showFieldError("nameError", "Silakan masukkan nama Anda");
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
      if (!confirmPassword) {
        showFieldError("confirmPasswordError", "Silakan konfirmasi kata sandi Anda");
        return;
      }
      if (password !== confirmPassword) {
        showFieldError("confirmPasswordError", "Kata sandi tidak cocok");
        return;
      }

      try {
        const response = await fetch("/register", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ name, account, password }),
        });

        const result = await response.json();
        if (result.success) {
          showMessage(result.message || "Pendaftaran berhasil", "success");
          setTimeout(() => {
            window.location.href = "/login";
          }, 1200);
          return;
        }

        showMessage(result.message || "Pendaftaran gagal", "error");
      } catch (error) {
        console.error("Register error:", error);
        showMessage("Terjadi kesalahan sistem, silakan coba lagi nanti", "error");
      }
    });
  };

  function clearErrors() {
    const messageBox = document.getElementById("registerMessage");
    messageBox.style.display = "none";
    messageBox.classList.remove("success");
    messageBox.classList.add("error");
    document.getElementById("nameError").textContent = "";
    document.getElementById("accountError").textContent = "";
    document.getElementById("passwordError").textContent = "";
    document.getElementById("confirmPasswordError").textContent = "";
    document.querySelectorAll(".form-control").forEach((input) => {
      input.classList.remove("is-invalid");
    });
  }

  function showMessage(message, type) {
    const messageBox = document.getElementById("registerMessage");
    const messageText = messageBox.querySelector(".message-text");

    messageBox.classList.remove("error", "success");
    messageBox.classList.add(type === "success" ? "success" : "error");
    messageText.textContent = message;
    messageBox.style.display = "flex";
  }

  function showFieldError(elementId, message) {
    const errorDiv = document.getElementById(elementId);
    errorDiv.textContent = message;
    const inputIdMap = {
      nameError: "inputName",
      accountError: "inputAccount",
      passwordError: "inputPassword",
      confirmPasswordError: "inputConfirmPassword",
    };
    const inputId = inputIdMap[elementId];
    if (inputId) {
      document.getElementById(inputId).classList.add("is-invalid");
    }
  }

  generateRegisterPage();
});




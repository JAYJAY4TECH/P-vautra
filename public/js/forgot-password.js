(function () {
  var form = document.getElementById("forgotForm");
  if (!form) return;

  var emailStep = document.getElementById("emailStep");
  var codeStep = document.getElementById("codeStep");
  var errBox = form.querySelector("[data-form-error]");
  var infoBox = form.querySelector("[data-form-info]");
  var submitLabel = document.getElementById("submitLabel");
  var resendWrap = document.getElementById("resendWrap");
  var resendBtn = document.getElementById("resendBtn");
  var stepLabel = document.getElementById("stepLabel");
  var btn = form.querySelector('button[type="submit"]');
  var label = btn.querySelector("[data-label]");
  var spin = btn.querySelector("[data-spin]");
  var state = "email";

  function showErr(msg) {
    errBox.textContent = msg;
    errBox.classList.remove("hidden");
    infoBox.classList.add("hidden");
  }
  function showInfo(msg) {
    infoBox.textContent = msg;
    infoBox.classList.remove("hidden");
    errBox.classList.add("hidden");
  }
  function clearMsgs() {
    errBox.classList.add("hidden");
    infoBox.classList.add("hidden");
  }
  function setLoading(on) {
    btn.disabled = on;
    if (label) label.classList.toggle("hidden", on);
    if (spin) spin.classList.toggle("hidden", !on);
  }

  document.querySelectorAll("[data-toggle-password]").forEach(function (b) {
    b.addEventListener("click", function () {
      var input = document.getElementById(b.getAttribute("data-toggle-password"));
      if (!input) return;
      var isText = input.type === "text";
      input.type = isText ? "password" : "text";
      b.innerHTML = isText ? '<i class="fa-solid fa-eye"></i>' : '<i class="fa-solid fa-eye-slash"></i>';
    });
  });

  function sendCode(email) {
    return window.api.post("/api/auth/forgot-password", { email: email });
  }

  if (resendBtn) {
    resendBtn.addEventListener("click", function () {
      var email = form.email.value.trim();
      if (!email) { showErr("Enter your email first."); return; }
      setLoading(true);
      sendCode(email).then(function (res) {
        showInfo(res.message || "Code sent.");
      }).catch(function (err) {
        showErr(err.message || "Could not resend.");
      }).finally(function () { setLoading(false); });
    });
  }

  form.addEventListener("submit", function (e) {
    e.preventDefault();
    clearMsgs();

    if (state === "email") {
      var email = form.email.value.trim();
      if (!email) { showErr("Enter your email."); return; }
      setLoading(true);
      sendCode(email).then(function (res) {
        showInfo(res.message || "Code sent. Check your email.");
        state = "code";
        emailStep.classList.add("hidden");
        codeStep.classList.remove("hidden");
        if (submitLabel) submitLabel.textContent = "Reset password";
        if (stepLabel) stepLabel.textContent = "Enter the 6-digit code and your new password.";
        if (resendWrap) resendWrap.style.display = "";
      }).catch(function (err) {
        showErr(err.message || "Could not send code.");
      }).finally(function () { setLoading(false); });
      return;
    }

    var code = form.code.value.trim();
    var newPassword = form.newPassword.value;
    var email2 = form.email.value.trim();

    if (!/^[0-9]{6}$/.test(code)) { showErr("Enter the 6-digit code."); return; }
    if (newPassword.length < 8) { showErr("New password must be at least 8 characters."); return; }

    setLoading(true);
    window.api.post("/api/auth/reset-password", { email: email2, code: code, newPassword: newPassword })
      .then(function (res) {
        window.toast(res.message || "Password reset. Redirecting...", "success");
        setTimeout(function () { window.location.href = "/login.html"; }, 1200);
      })
      .catch(function (err) {
        showErr(err.message || "Could not reset password.");
      })
      .finally(function () { setLoading(false); });
  });
})();
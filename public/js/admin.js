(function () {
  var root = document.getElementById("adminRoot");
  if (!root) return;

  var data = { users: [], plans: [], pendingDeposits: [], recentActivity: [], stats: {} };
  var lockScreen = document.getElementById("lockScreen");
  var adminPanel = document.getElementById("adminPanel");
  var unlockForm = document.getElementById("unlockForm");
  var lockBtn = document.getElementById("lockBtn");

  function esc(s) {
    return String(s == null ? "" : s)
      .split("&").join("&amp;")
      .split("<").join("&lt;")
      .split(">").join("&gt;")
      .split(String.fromCharCode(34)).join("&quot;")
      .split(String.fromCharCode(39)).join("&#39;");
  }
  function fmt(n) { return "$" + (Number(n) || 0).toFixed(2); }

  function showLocked() {
    lockScreen.classList.remove("hidden");
    adminPanel.classList.add("hidden");
  }
  function showUnlocked() {
    lockScreen.classList.add("hidden");
    adminPanel.classList.remove("hidden");
  }

  var planEditModal = document.getElementById("planEditModal");
  var planEditForm = document.getElementById("planEditForm");
  var closePlanEdit = document.getElementById("closePlanEdit");

  function openPlanEdit(planId) {
    if (!planEditModal || !planEditForm) {
      window.toast("Plan edit modal not found", "error");
      return;
    }
    var p = null;
    for (var i = 0; i < data.plans.length; i++) {
      if (data.plans[i]._id === planId) { p = data.plans[i]; break; }
    }
    if (!p) return;
    planEditForm.id.value = p._id;
    planEditForm.name.value = p.name || "";
    planEditForm.description.value = p.description || "";
    planEditForm.apyPercent.value = p.apyPercent;
    planEditForm.durationDays.value = p.durationDays;
    planEditForm.minAmount.value = p.minAmount;
    planEditForm.maxAmount.value = p.maxAmount;
    planEditForm.feePercent.value = p.feePercent || 0;
    planEditForm.riskLevel.value = p.riskLevel || "medium";
    planEditForm.terms.value = p.terms || "";
    planEditForm.enabled.checked = !!p.enabled;
    planEditModal.classList.remove("hidden");
  }

  function closePlanEditModal() {
    if (planEditModal) planEditModal.classList.add("hidden");
  }

  if (closePlanEdit) closePlanEdit.addEventListener("click", closePlanEditModal);
  if (planEditModal) {
    planEditModal.addEventListener("click", function (e) {
      if (e.target === planEditModal) closePlanEditModal();
    });
  }
  if (planEditForm) {
    planEditForm.addEventListener("submit", function (e) {
      e.preventDefault();
      var id = planEditForm.id.value;
      var body = {
        name: planEditForm.name.value,
        description: planEditForm.description.value,
        apyPercent: Number(planEditForm.apyPercent.value),
        durationDays: Number(planEditForm.durationDays.value),
        minAmount: Number(planEditForm.minAmount.value),
        maxAmount: Number(planEditForm.maxAmount.value),
        feePercent: Number(planEditForm.feePercent.value),
        riskLevel: planEditForm.riskLevel.value,
        terms: planEditForm.terms.value,
        enabled: planEditForm.enabled.checked
      };
      window.api.put("/api/admin/plans/" + id, body).then(function () {
        window.toast("Plan updated", "success");
        closePlanEditModal();
        load();
      }).catch(function (err) {
        window.toast(err.message || "Could not save", "error");
      });
    });
  }

  function load() {
    window.api.get("/api/admin").then(function (res) {
      data = res;
      document.querySelector("[data-stat='users']").textContent = data.stats.userCount;
      document.querySelector("[data-stat='plans']").textContent = data.stats.planCount;
      document.querySelector("[data-stat='referrals']").textContent = data.stats.referralCount;
      document.querySelector("[data-stat='vaults']").textContent = data.stats.activeVaults;
      document.querySelector("[data-stat='pending']").textContent = data.stats.pendingDeposits;
      renderDeposits();
      renderUsers();
      renderPlans();
      renderActivity();
    }).catch(function (err) {
      if (err.status === 403) { showLocked(); return; }
      console.error(err);
    });
  }

  function renderDeposits() {
    var panel = document.querySelector("[data-panel='deposits']");
    if (!data.pendingDeposits || !data.pendingDeposits.length) {
      panel.innerHTML = "<div class=\"card\"><div class=\"empty\">No pending deposits.</div></div>";
      return;
    }
    var html = "";
    for (var i = 0; i < data.pendingDeposits.length; i++) {
      var d = data.pendingDeposits[i];
      html += "<div class=\"card\">" +
        "<h3 class=\"text-white font-semibold\">" + fmt(d.amountUsd) + " in " + esc(d.coin || "-") + "</h3>" +
        "<p class=\"text-xs text-slate-500 mt-1\">User: " + esc((d.user && d.user.email) || "-") + "</p>" +
        "<div class=\"flex gap-2 mt-4\">" +
          "<button class=\"btn-primary !py-2 !px-4 text-xs\" data-approve=\"" + d._id + "\">Confirm deposit</button>" +
          "<button class=\"btn-ghost !py-2 !px-4 text-xs\" data-reject=\"" + d._id + "\">Reject</button>" +
        "</div></div>";
    }
    panel.innerHTML = html;

    panel.querySelectorAll("[data-approve]").forEach(function (btn) {
      btn.addEventListener("click", function () {
        var input = prompt("Enter actual amount received in USD:");
        if (input === null) return;
        var amount = Number(input);
        if (!amount || amount <= 0) { window.toast("Enter a valid amount.", "error"); return; }
        btn.disabled = true;
        window.api.post("/api/admin/deposits/" + btn.getAttribute("data-approve") + "/set-amount", { actualAmount: amount }).then(function (res) {
          window.toast(res.message || "Deposit confirmed", "success");
          load();
        }).catch(function (err) {
          window.toast(err.message || "Could not confirm", "error");
          btn.disabled = false;
        });
      });
    });
    panel.querySelectorAll("[data-reject]").forEach(function (btn) {
      btn.addEventListener("click", function () {
        if (!confirm("Reject this deposit?")) return;
        btn.disabled = true;
        window.api.post("/api/admin/deposits/" + btn.getAttribute("data-reject") + "/reject").then(function () {
          window.toast("Deposit rejected", "info");
          load();
        }).catch(function (err) {
          window.toast(err.message || "Could not reject", "error");
          btn.disabled = false;
        });
      });
    });
  }

  function renderUsers() {
    var panel = document.querySelector("[data-panel='users']");
    if (!data.users || !data.users.length) {
      panel.innerHTML = "<div class=\"card\"><div class=\"empty\">No users yet.</div></div>";
      return;
    }
    var html = "<div class=\"card\"><div class=\"overflow-x-auto\"><table class=\"table\">" +
      "<thead><tr><th>Name</th><th>Email</th><th>Balance</th><th>Role</th><th>Joined</th><th>Actions</th></tr></thead><tbody>";
    for (var i = 0; i < data.users.length; i++) {
      var u = data.users[i];
      html += "<tr>" +
        "<td>" + esc(u.fullName) + "</td>" +
        "<td class=\"text-slate-400\">" + esc(u.email) + "</td>" +
        "<td>" + fmt(u.balance) + "</td>" +
        "<td><span class=\"badge badge-" + (u.role === "admin" ? "gold" : "slate") + "\">" + u.role + "</span></td>" +
        "<td class=\"text-slate-400\">" + new Date(u.createdAt).toLocaleDateString() + "</td>" +
        "<td class=\"space-x-1\">" +
          "<button class=\"btn-ghost !py-1 !px-2 text-xs\" data-credit=\"" + u.id + "\">Credit</button>" +
          "<button class=\"btn-ghost !py-1 !px-2 text-xs\" data-delete-user=\"" + u.id + "\" data-user-email=\"" + esc(u.email) + "\">Delete</button>" +
        "</td></tr>";
    }
    html += "</tbody></table></div></div>";
    panel.innerHTML = html;

    panel.querySelectorAll("[data-credit]").forEach(function (btn) {
      btn.addEventListener("click", function () {
        var id = btn.getAttribute("data-credit");
        var amount = prompt("Amount to credit (USD):");
        if (!amount) return;
        window.api.post("/api/admin/users/" + id + "/credit", { amount: Number(amount) }).then(function () {
          window.toast("Balance adjusted", "success");
          load();
        }).catch(function (err) {
          window.toast(err.message || "Failed", "error");
        });
      });
    });

    panel.querySelectorAll("[data-delete-user]").forEach(function (btn) {
      btn.addEventListener("click", function () {
        var email = btn.getAttribute("data-user-email");
        if (!confirm("Delete " + email + "?")) return;
        btn.disabled = true;
        window.api.del("/api/admin/users/" + btn.getAttribute("data-delete-user")).then(function () {
          window.toast("User deleted", "success");
          load();
        }).catch(function (err) {
          window.toast(err.message || "Failed", "error");
          btn.disabled = false;
        });
      });
    });
  }

  function renderPlans() {
    var panel = document.querySelector("[data-panel='plans']");
    if (!data.plans || !data.plans.length) {
      panel.innerHTML = "<div class=\"card\"><div class=\"empty\">No plans.</div></div>";
      return;
    }
    var html = "<div class=\"card\"><div class=\"overflow-x-auto\"><table class=\"table\">" +
      "<thead><tr><th>Tier</th><th>Name</th><th>APY</th><th>Min</th><th>Max</th><th>Days</th><th>Enabled</th><th>Actions</th></tr></thead><tbody>";
    for (var i = 0; i < data.plans.length; i++) {
      var p = data.plans[i];
      html += "<tr>" +
        "<td><span class=\"badge badge-mint\">Tier " + p.tier + "</span></td>" +
        "<td>" + esc(p.name) + "</td>" +
        "<td class=\"text-mint\">" + p.apyPercent + "%</td>" +
        "<td>" + fmt(p.minAmount) + "</td>" +
        "<td>" + fmt(p.maxAmount) + "</td>" +
        "<td>" + p.durationDays + "</td>" +
        "<td>" + (p.enabled ? "on" : "off") + "</td>" +
        "<td class=\"space-x-1\">" +
          "<button class=\"btn-ghost !py-1 !px-2 text-xs\" data-toggle=\"" + p._id + "\">Toggle</button>" +
          "<button class=\"btn-ghost !py-1 !px-2 text-xs\" data-edit-plan=\"" + p._id + "\">Edit</button>" +
        "</td></tr>";
    }
    html += "</tbody></table></div></div>";
    panel.innerHTML = html;

    panel.querySelectorAll("[data-toggle]").forEach(function (btn) {
      btn.addEventListener("click", function () {
        btn.disabled = true;
        window.api.post("/api/admin/plans/" + btn.getAttribute("data-toggle") + "/toggle").then(function () {
          window.toast("Plan toggled", "success");
          load();
        }).catch(function (err) {
          window.toast(err.message || "Failed", "error");
          btn.disabled = false;
        });
      });
    });

    panel.querySelectorAll("[data-edit-plan]").forEach(function (btn) {
      btn.addEventListener("click", function () {
        openPlanEdit(btn.getAttribute("data-edit-plan"));
      });
    });
  }

  function renderActivity() {
    var panel = document.querySelector("[data-panel='activity']");
    if (!data.recentActivity || !data.recentActivity.length) {
      panel.innerHTML = "<div class=\"card\"><div class=\"empty\">No activity.</div></div>";
      return;
    }
    var html = "<div class=\"card\">";
    for (var i = 0; i < data.recentActivity.length; i++) {
      var a = data.recentActivity[i];
      html += "<div class=\"flex items-center gap-3 py-2 border-b border-white/5 text-sm\">" +
        "<span class=\"text-slate-500 w-44\">" + new Date(a.createdAt).toLocaleString() + "</span>" +
        "<span class=\"text-slate-400 w-56\">" + esc((a.user && a.user.email) || "-") + "</span>" +
        "<span class=\"text-slate-300 flex-1\">" + esc(a.message) + "</span>" +
        "</div>";
    }
    html += "</div>";
    panel.innerHTML = html;
  }

  if (unlockForm) {
    unlockForm.addEventListener("submit", function (e) {
      e.preventDefault();
      var btn = unlockForm.querySelector("button[type=submit]");
      if (btn) btn.disabled = true;
      window.api.post("/api/admin/unlock", { password: unlockForm.password.value }).then(function () {
        showUnlocked();
        load();
      }).catch(function (err) {
        window.toast(err.message || "Wrong password", "error");
        unlockForm.password.value = "";
        if (btn) btn.disabled = false;
      });
    });
  }

  if (lockBtn) {
    lockBtn.addEventListener("click", function () {
      window.api.post("/api/admin/lock").then(function () { showLocked(); });
    });
  }

  var tabButtons = document.querySelectorAll(".tab-btn");
  tabButtons.forEach(function (btn) {
    btn.addEventListener("click", function () {
      tabButtons.forEach(function (b) {
        b.classList.remove("btn-primary");
        b.classList.add("btn-ghost");
      });
      btn.classList.remove("btn-ghost");
      btn.classList.add("btn-primary");
      var panels = document.querySelectorAll("[data-panel]");
      var targetKey = btn.getAttribute("data-tab");
      panels.forEach(function (p) {
        if (p.getAttribute("data-panel") === targetKey) {
          p.classList.remove("hidden");
        } else {
          p.classList.add("hidden");
        }
      });
    });
  });

  document.addEventListener("DOMContentLoaded", function () {
    window.api.get("/api/admin/status").then(function (s) {
      if (s.unlocked) { showUnlocked(); load(); }
      else { showLocked(); }
    }).catch(function () { showLocked(); });
  });
})();
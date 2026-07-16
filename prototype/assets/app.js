function showToast(message) {
  let toast = document.querySelector(".toast");
  if (!toast) {
    toast = document.createElement("div");
    toast.className = "toast";
    document.body.appendChild(toast);
  }
  toast.textContent = message;
  toast.classList.add("show");
  window.setTimeout(() => toast.classList.remove("show"), 2200);
}

function wireFileLabels() {
  document.querySelectorAll("[data-file-input]").forEach((input) => {
    input.addEventListener("change", () => {
      const target = document.querySelector(input.dataset.fileInput);
      if (!target) return;
      target.textContent = input.files && input.files[0] ? input.files[0].name : "尚未选择文件";
    });
  });
}

function wireAddRows() {
  document.querySelectorAll("[data-add-row]").forEach((button) => {
    button.addEventListener("click", () => {
      const table = document.querySelector(button.dataset.addRow);
      if (!table) return;
      const body = table.querySelector("tbody");
      const template = body.querySelector("tr");
      const row = template.cloneNode(true);
      row.querySelectorAll("input").forEach((input) => {
        input.value = "";
      });
      body.appendChild(row);
      showToast("已添加一行，可继续填写");
    });
  });
}

function wireStudentSubmit() {
  const form = document.querySelector("[data-student-form]");
  if (!form) return;
  form.addEventListener("submit", (event) => {
    event.preventDefault();
    showToast("原型提示：表单已模拟提交");
    window.setTimeout(() => {
      window.location.href = "register-success.html";
    }, 500);
  });
}

function wireLogin() {
  const form = document.querySelector("[data-login-form]");
  if (!form) return;

  form.addEventListener("submit", (event) => {
    event.preventDefault();
    window.location.href = "hr-students.html";
  });

  let enterCount = 0;
  const hidden = document.querySelector("[data-hidden-entry]");
  document.addEventListener("keydown", (event) => {
    if (event.key !== "Enter") return;
    enterCount += 1;
    if (enterCount >= 3 && hidden) {
      hidden.classList.add("show");
      showToast("已触发测试入口提示");
    }
    window.setTimeout(() => {
      enterCount = 0;
    }, 1000);
  });
}

function wireFilters() {
  const search = document.querySelector("[data-table-search]");
  const location = document.querySelector("[data-location-filter]");
  const rows = Array.from(document.querySelectorAll("[data-student-row]"));
  if (!search && !location) return;

  const apply = () => {
    const query = (search && search.value ? search.value : "").trim().toLowerCase();
    const loc = location && location.value ? location.value : "";
    rows.forEach((row) => {
      const text = row.textContent.toLowerCase();
      const matchesQuery = !query || text.includes(query);
      const matchesLocation = !loc || row.dataset.location === loc;
      row.style.display = matchesQuery && matchesLocation ? "" : "none";
    });
  };

  if (search) search.addEventListener("input", apply);
  if (location) location.addEventListener("change", apply);
}

function wirePrototypeActions() {
  document.querySelectorAll("[data-prototype-action]").forEach((button) => {
    button.addEventListener("click", () => {
      showToast(button.dataset.prototypeAction || "原型操作已触发");
    });
  });
}

wireFileLabels();
wireAddRows();
wireStudentSubmit();
wireLogin();
wireFilters();
wirePrototypeActions();

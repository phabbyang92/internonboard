const workspaceButtons = document.querySelectorAll("[data-workspace]");
const workspacePanels = document.querySelectorAll("[data-workspace-panel]");
const hrViewButtons = document.querySelectorAll("[data-hr-view]");
const hrViewPanels = document.querySelectorAll("[data-hr-view-panel]");
const toastBox = document.querySelector("[data-toast-box]");

function showToast(message) {
  toastBox.textContent = message;
  toastBox.classList.add("show");
  window.clearTimeout(showToast.timer);
  showToast.timer = window.setTimeout(() => toastBox.classList.remove("show"), 2400);
}

function switchWorkspace(name) {
  workspaceButtons.forEach((button) => {
    button.classList.toggle("active", button.dataset.workspace === name);
  });
  workspacePanels.forEach((panel) => {
    panel.classList.toggle("active", panel.dataset.workspacePanel === name);
  });
  window.scrollTo({ top: 0, behavior: "smooth" });
}

workspaceButtons.forEach((button) => {
  button.addEventListener("click", () => switchWorkspace(button.dataset.workspace));
});

hrViewButtons.forEach((button) => {
  button.addEventListener("click", () => {
    const view = button.dataset.hrView;
    hrViewButtons.forEach((item) => item.classList.toggle("active", item === button));
    hrViewPanels.forEach((panel) => {
      panel.classList.toggle("active", panel.dataset.hrViewPanel === view);
    });
  });
});

document.querySelectorAll("[data-toast]").forEach((button) => {
  button.addEventListener("click", () => showToast(button.dataset.toast));
});

const studentRows = Array.from(document.querySelectorAll("[data-student-row]"));
const searchInput = document.querySelector("[data-student-search]");
const locationFilter = document.querySelector("[data-location-filter]");
const statusFilter = document.querySelector("[data-status-filter]");
const formFilter = document.querySelector("[data-form-filter]");
const visibleCount = document.querySelector("[data-visible-count]");

function filterStudents() {
  const query = searchInput.value.trim().toLowerCase();
  const location = locationFilter.value;
  const status = statusFilter.value;
  const form = formFilter.value;
  let count = 0;

  studentRows.forEach((row) => {
    const searchable = [
      row.dataset.name,
      row.dataset.email,
      row.dataset.phone,
      row.dataset.school,
      row.dataset.position,
    ].join(" ").toLowerCase();
    const visible =
      (!query || searchable.includes(query)) &&
      (!location || row.dataset.location === location) &&
      (!status || row.dataset.status === status) &&
      (!form || row.dataset.form === form);
    row.hidden = !visible;
    if (visible) count += 1;
  });
  visibleCount.textContent = count;
}

[searchInput, locationFilter, statusFilter, formFilter].forEach((control) => {
  control.addEventListener(control === searchInput ? "input" : "change", filterStudents);
});

const rowChecks = Array.from(document.querySelectorAll("[data-row-check]"));
const selectAll = document.querySelector("[data-select-all]");
const selectionBar = document.querySelector("[data-selection-bar]");
const selectedCount = document.querySelector("[data-selected-count]");

function updateSelection() {
  const selected = rowChecks.filter((check) => check.checked);
  selectedCount.textContent = selected.length;
  selectionBar.hidden = selected.length === 0;
  selectAll.checked = selected.length === rowChecks.length;
  selectAll.indeterminate = selected.length > 0 && selected.length < rowChecks.length;
}

rowChecks.forEach((check) => check.addEventListener("change", updateSelection));
selectAll.addEventListener("change", () => {
  rowChecks.forEach((check) => {
    const row = check.closest("[data-student-row]");
    if (!row.hidden) check.checked = selectAll.checked;
  });
  updateSelection();
});

document.querySelector("[data-clear-selection]").addEventListener("click", () => {
  rowChecks.forEach((check) => { check.checked = false; });
  updateSelection();
});

const batchDialog = document.querySelector("[data-batch-dialog]");
const batchCount = document.querySelector("[data-batch-count]");
const batchForm = document.querySelector("[data-batch-form]");

document.querySelector("[data-open-batch]").addEventListener("click", () => {
  batchCount.textContent = rowChecks.filter((check) => check.checked).length;
  batchDialog.returnValue = "";
  batchDialog.showModal();
});

batchDialog.addEventListener("close", () => {
  if (batchDialog.returnValue !== "apply") return;
  const data = new FormData(batchForm);
  const location = data.get("location");
  const start = data.get("start");
  let updated = 0;

  rowChecks.forEach((check) => {
    if (!check.checked) return;
    const row = check.closest("[data-student-row]");
    row.dataset.location = location;
    row.dataset.start = start;
    row.dataset.status = "pending_onboarding";
    row.querySelector(".location-text").textContent = location;
    row.querySelector(".location-text").classList.remove("muted-value");
    row.querySelector(".start-text").textContent = start;
    row.querySelector(".start-text").classList.remove("muted-value");
    const status = row.querySelector(".status-text");
    status.textContent = "待入职";
    status.className = "tag warning status-text";
    check.checked = false;
    updated += 1;
  });
  updateSelection();
  filterStudents();
  showToast(`已模拟完成 ${updated} 名学生的批量安排`);
});

document.querySelector("[data-arrangement-form]").addEventListener("submit", (event) => {
  event.preventDefault();
  showToast("已模拟安排 3 名学生，状态更新为“待入职”");
});

const detailDialog = document.querySelector("[data-detail-dialog]");
const detailFields = Array.from(detailDialog.querySelectorAll("input, select"));
const editDetailButton = detailDialog.querySelector("[data-edit-detail]");
const saveDetailButton = detailDialog.querySelector("[data-save-detail]");
let activeStudentRow = null;

function statusLabel(status) {
  return { candidate: "候选人", pending_onboarding: "待入职", onboarded: "已入职" }[status];
}

function openDetail(row) {
  activeStudentRow = row;
  detailDialog.querySelector("[data-detail-name]").textContent = row.dataset.name;
  detailDialog.querySelector("[data-detail-email]").textContent = row.dataset.email;
  detailDialog.querySelector("[data-detail-phone]").value = row.dataset.phone;
  detailDialog.querySelector("[data-detail-position]").value = row.dataset.position;
  detailDialog.querySelector("[data-detail-school]").value = row.dataset.school;
  detailDialog.querySelector("[data-detail-major]").value = row.dataset.major;
  detailDialog.querySelector("[data-detail-location]").value = row.dataset.location;
  detailDialog.querySelector("[data-detail-start]").value = row.dataset.start;
  detailDialog.querySelector("[data-detail-end]").value = row.dataset.end;
  const formTag = detailDialog.querySelector("[data-detail-form]");
  formTag.textContent = row.dataset.form === "submitted" ? "已提交" : "待填写";
  formTag.className = row.dataset.form === "submitted" ? "tag success" : "tag neutral";
  const statusTag = detailDialog.querySelector("[data-detail-status]");
  statusTag.textContent = statusLabel(row.dataset.status);
  statusTag.className = `tag ${row.dataset.status === "onboarded" ? "active" : row.dataset.status === "pending_onboarding" ? "warning" : "neutral"}`;
  setDetailEditing(false);
  detailDialog.showModal();
}

document.querySelectorAll("[data-open-detail]").forEach((button) => {
  button.addEventListener("click", () => openDetail(button.closest("[data-student-row]")));
});

function setDetailEditing(editing) {
  detailFields.forEach((field) => {
    if (field.tagName === "SELECT") field.disabled = !editing;
    else field.readOnly = !editing;
  });
  editDetailButton.hidden = editing;
  saveDetailButton.hidden = !editing;
}

editDetailButton.addEventListener("click", () => setDetailEditing(true));
saveDetailButton.addEventListener("click", () => {
  if (!activeStudentRow) return;
  activeStudentRow.dataset.phone = detailDialog.querySelector("[data-detail-phone]").value;
  activeStudentRow.dataset.position = detailDialog.querySelector("[data-detail-position]").value;
  activeStudentRow.dataset.school = detailDialog.querySelector("[data-detail-school]").value;
  activeStudentRow.dataset.major = detailDialog.querySelector("[data-detail-major]").value;
  activeStudentRow.dataset.location = detailDialog.querySelector("[data-detail-location]").value;
  activeStudentRow.dataset.start = detailDialog.querySelector("[data-detail-start]").value;
  activeStudentRow.dataset.end = detailDialog.querySelector("[data-detail-end]").value;
  activeStudentRow.querySelector(".location-text").textContent = activeStudentRow.dataset.location || "未安排";
  activeStudentRow.querySelector(".start-text").textContent = activeStudentRow.dataset.start || "未安排";
  activeStudentRow.querySelector(".end-text").textContent = activeStudentRow.dataset.end ? `至 ${activeStudentRow.dataset.end}` : "结束日期待填写";
  setDetailEditing(false);
  showToast("学生资料已模拟保存，并记录 HR 修改日志");
});

detailDialog.querySelectorAll("[data-download]").forEach((button) => {
  button.addEventListener("click", () => showToast("演示：附件下载请求已触发"));
});
detailDialog.querySelector("[data-soft-delete]").addEventListener("click", () => {
  showToast("演示：学生记录将被软删除并写入操作日志");
});

function switchStudentState(name) {
  document.querySelectorAll("[data-student-state]").forEach((panel) => {
    panel.classList.toggle("active", panel.dataset.studentState === name);
  });
  window.scrollTo({ top: 0, behavior: "smooth" });
}

document.querySelector("[data-student-login]").addEventListener("submit", (event) => {
  event.preventDefault();
  switchStudentState("form");
  showToast("身份验证通过，已载入 HR 安排信息");
});

document.querySelectorAll("[data-student-logout]").forEach((button) => {
  button.addEventListener("click", () => switchStudentState("login"));
});

document.querySelectorAll("[data-file-input]").forEach((input) => {
  input.addEventListener("change", () => {
    const label = document.querySelector(`[data-file-name="${input.dataset.fileInput}"]`);
    label.textContent = input.files[0]?.name || "尚未选择文件";
    if (input.files[0]) showToast("附件已在本地原型中选择，尚未真实上传");
  });
});

document.querySelector("[data-add-education]").addEventListener("click", () => {
  const tbody = document.querySelector("[data-education-table] tbody");
  const row = tbody.rows[0].cloneNode(true);
  row.querySelectorAll("input").forEach((input) => { input.value = ""; });
  tbody.appendChild(row);
  showToast("已添加一条教育经历");
});

document.querySelectorAll("[data-add-table]").forEach((button) => {
  button.addEventListener("click", () => {
    const table = document.querySelector(`[data-editable-table="${button.dataset.addTable}"]`);
    const row = table.tBodies[0].rows[0].cloneNode(true);
    row.querySelectorAll("input").forEach((input) => { input.value = ""; });
    table.tBodies[0].appendChild(row);
    showToast("已添加一行，可继续填写");
  });
});

const registrationForm = document.querySelector("[data-registration-form]");
const submitDialog = document.querySelector("[data-submit-dialog]");

registrationForm.addEventListener("submit", (event) => {
  event.preventDefault();
  submitDialog.returnValue = "";
  submitDialog.showModal();
});

submitDialog.addEventListener("close", () => {
  if (submitDialog.returnValue !== "confirm") return;
  switchStudentState("submitted");
  showToast("登记表已提交，学生端资料已锁定");
});

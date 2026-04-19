/* ------------------------- HELPERS ------------------------- */
function getClientById(id) {
  return clients.find(c => c.id === id);
}

function nowISO() {
  return new Date().toISOString();
}

function todayISODate() {
  return new Date().toISOString().slice(0, 10);
}

function daysSince(dateString) {
  if (!dateString) return 0;
  const d = new Date(dateString);
  const diff = Date.now() - d.getTime();
  return Math.max(0, Math.floor(diff / (1000 * 60 * 60 * 24)));
}

function dateOnlyValue(dateString) {
  if (!dateString) return "";
  return String(dateString).slice(0, 10);
}

function daysUntil(dateString) {
  if (!dateString) return null;
  const target = new Date(`${dateOnlyValue(dateString)}T00:00:00`);
  const today = new Date(`${todayISODate()}T00:00:00`);
  const diff = target.getTime() - today.getTime();
  return Math.round(diff / (1000 * 60 * 60 * 24));
}

function isDueToday(dateString) {
  return dateOnlyValue(dateString) === todayISODate();
}

function isOverdueDate(dateString) {
  const days = daysUntil(dateString);
  return days !== null && days < 0;
}

function isThisWeekDate(dateString) {
  const days = daysUntil(dateString);
  return days !== null && days >= 0 && days <= 6;
}

function formatDate(dateString) {
  if (!dateString) return "—";
  const d = new Date(dateString);
  return d.toLocaleDateString("sr-RS", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric"
  });
}

function formatDateTime(dateString) {
  if (!dateString) return "—";
  const d = new Date(dateString);
  return d.toLocaleString("sr-RS", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  });
}

function escapeHtml(str = "") {
  return String(str)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function formatMoney(value) {
  const amount = Number(value || 0);
  if (!amount) return "â€”";

  return new Intl.NumberFormat("sr-RS", {
    maximumFractionDigits: 0
  }).format(amount);
}

function showToast(message) {
  const toast = document.getElementById("toast");
  if (!toast) return;

  toast.textContent = message;
  toast.classList.remove("hidden");
  toast.classList.add("show");

  setTimeout(() => {
    toast.classList.remove("show");
    toast.classList.add("hidden");
  }, 2200);
}

function switchView(viewId) {
  document.querySelectorAll(".view").forEach(v => v.classList.remove("active"));

  const targetView = document.getElementById(viewId);
  if (targetView) targetView.classList.add("active");

  document.querySelectorAll(".nav-btn").forEach(btn => {
    btn.classList.toggle("active", btn.dataset.view === viewId);
  });

  const title = document.getElementById("viewTitle");
  const subtitle = document.getElementById("viewSubtitle");
  const topbar = document.querySelector(".topbar");

  if (topbar) {
    topbar.classList.toggle("topbar-hidden", viewId === "dashboardView");
  }

  if (!title || !subtitle) return;

  if (viewId === "dashboardView") {
    title.textContent = "";
    subtitle.textContent = "";
  } else {
    title.textContent = "Klijenti";
    subtitle.textContent = "Baza klijenata i statusi saradnje.";
  }
}

function toggleIndustryFields() {
  const businessType = document.getElementById("businessType");
  if (!businessType) return;

  const type = businessType.value;
  const retailFields = document.getElementById("retailFields");
  const pharmacyFields = document.getElementById("pharmacyFields");

  if (retailFields) retailFields.classList.toggle("hidden", type !== "retail");
  if (pharmacyFields) pharmacyFields.classList.toggle("hidden", type !== "pharmacy");
}

function getCheckedValues(name) {
  return [...document.querySelectorAll(`input[name="${name}"]:checked`)].map(el => el.value);
}

function setCheckedValues(name, values = []) {
  document.querySelectorAll(`input[name="${name}"]`).forEach(el => {
    el.checked = values.includes(el.value);
  });
}

function addActivity(client, type, label, note = "") {
  if (!Array.isArray(client.activityLog)) client.activityLog = [];
  client.activityLog.unshift({
    at: nowISO(),
    type,
    label,
    note
  });
}

// === APPJS END PART 1/4 ===
// === APPJS START PART 2/4 ===


function formatTodayHeaderDate() {
  return new Date().toLocaleDateString("sr-RS", {
    day: "2-digit",
    month: "2-digit"
  });
}

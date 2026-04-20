function openSettingsModal() {
  renderSettingsUI();

  const modal = document.getElementById("settingsModal");
  if (!modal) return;

  modal.classList.remove("hidden");
  modal.setAttribute("aria-hidden", "false");
}

function closeSettingsModal() {
  const modal = document.getElementById("settingsModal");
  if (!modal) return;

  modal.classList.add("hidden");
  modal.setAttribute("aria-hidden", "true");
}

function renderSettingsUI() {
  renderSessionUI();

  const connectBtn = document.getElementById("settingsConnectCloudBtn");
  const logoutBtn = document.getElementById("settingsLogoutBtn");

  if (connectBtn) {
    connectBtn.classList.toggle("hidden", isCloudEnabled());
    connectBtn.textContent = isCloudEnabled() ? "Povezan" : "Prijava";
  }

  if (logoutBtn) {
    logoutBtn.classList.toggle("hidden", !isCloudEnabled());
  }
}

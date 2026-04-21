function openAccountSheet() {
  renderSessionUI();

  const modal = document.getElementById("accountSheetModal");
  if (!modal) return;

  modal.classList.remove("hidden");
  modal.setAttribute("aria-hidden", "false");
}

function closeAccountSheet() {
  const modal = document.getElementById("accountSheetModal");
  if (!modal) return;

  modal.classList.add("hidden");
  modal.setAttribute("aria-hidden", "true");
}

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

function handleSettingsWorkspaceSetup() {
  if (!isCloudEnabled()) {
    closeSettingsModal();
    openAuthModal();
    return;
  }

  if (!teamSchemaReady) {
    showToast("Workspace opcije jos nisu dostupne u ovom cloud okruzenju.");
    return;
  }

  if (!currentWorkspace) {
    closeSettingsModal();
    openOnboardingModal(currentPendingInvite ? "join" : currentMembership ? "choice" : "");
    return;
  }

  if (currentMembership?.role === "admin") {
    isEditingWorkspaceName = !isEditingWorkspaceName;
    renderSettingsUI();
    return;
  }

  showToast("Workspace detalji su prikazani iznad.");
}

function handleSettingsPlanAndTrial() {
  closeSettingsModal();
  openLicenseModal();
}

function handleSettingsCloudConnect() {
  closeSettingsModal();
  openAuthModal();
}

function handleHeaderAuthAction() {
  if (isCloudEnabled()) {
    openAccountSheet();
    return;
  }

  openAuthModal();
}

function handleAccountWorkspaceAction() {
  closeAccountSheet();
  openSettingsModal();
}

function handleAccountPlanAction() {
  closeAccountSheet();
  openLicenseModal();
}

async function handleAccountLogout() {
  closeAccountSheet();
  await handleCloudLogout();
}

async function handleSettingsLogout() {
  closeSettingsModal();
  await handleCloudLogout();
}

async function handleWorkspaceNameSave() {
  const nextName = getValue("settingsWorkspaceNameInput").trim();
  if (!nextName) {
    showToast("Unesi naziv workspace-a.");
    return;
  }

  const saved = await updateWorkspaceName(nextName);
  if (!saved) return;

  renderSettingsUI();
  showToast("Naziv workspace-a je sacuvan.");
}

async function handleWorkspaceInviteSend() {
  const email = getValue("workspaceInviteEmailInput").trim();
  const role = getValue("workspaceInviteRoleSelect") || "member";

  if (!email) {
    showToast("Unesi email za pozivnicu.");
    return;
  }

  const invite = await createWorkspaceInvite(email, role);
  if (!invite) return;

  const copied = await copyTextToClipboard(buildWorkspaceInviteLink(invite));

  setValueIfExists("workspaceInviteEmailInput", "");
  setValueIfExists("workspaceInviteRoleSelect", "member");
  renderSettingsUI();
  showToast(copied ? "Invite link je kreiran i kopiran." : "Invite link je kreiran. Kopiraj ga iz liste pozivnica.");
}

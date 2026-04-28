let onboardingStep = "profile";

function resolveDefaultOnboardingStep() {
  if (!currentProfile?.full_name) return "profile";
  if (currentPendingInvite) return "join";
  if (!currentMembership) return "choice";
  return "choice";
}

function getOnboardingSectionId(step) {
  if (step === "profile") return "onboardingStepProfile";
  if (step === "choice") return "onboardingStepChoice";
  if (step === "create") return "onboardingStepCreate";
  return "onboardingStepJoin";
}

function openOnboardingModal(forceStep = "") {
  const modal = document.getElementById("onboardingModal");
  if (!modal || !isCloudEnabled() || !teamSchemaReady) return;

  onboardingStep = forceStep || resolveDefaultOnboardingStep();
  renderOnboardingStep();
  modal.classList.remove("hidden");
  modal.setAttribute("aria-hidden", "false");
}

function closeOnboardingModal() {
  const modal = document.getElementById("onboardingModal");
  if (!modal) return;
  modal.classList.add("hidden");
  modal.setAttribute("aria-hidden", "true");
}

function renderOnboardingStep() {
  const steps = ["profile", "choice", "create", "join"];
  steps.forEach(step => {
    const section = document.getElementById(getOnboardingSectionId(step));
    if (section) {
      section.classList.toggle("hidden", onboardingStep !== step);
    }
  });

  setTextIfExists(
    "onboardingTitle",
    onboardingStep === "profile" ? "Dobro dosli u Pulse Team" :
    onboardingStep === "choice" ? "Povezi se sa workspace-om" :
    onboardingStep === "create" ? "Kreiraj novi workspace" :
    "Prihvati pozivnicu"
  );

  setTextIfExists(
    "onboardingSubtitle",
    onboardingStep === "profile" ? "Prvo nam reci kako da te oslovljavamo." :
    onboardingStep === "choice" ? (currentPendingInvite ? "Za ovaj nalog vec postoji pozivnica, pa je najbolje da prvo udjes u postojeci tim." : "Biramo da li otvaras novi tim ili ulazis u postojeci.") :
    onboardingStep === "create" ? "Naziv workspace-a postaje zajednicki CRM prostor tvog tima." :
    "Ako si otvorio invite link ili za tvoj email postoji pozivnica, ovde je prihvatas."
  );

  setValueIfExists("onboardingFullName", currentProfile?.full_name || "");
  setValueIfExists("onboardingHourlyRate", currentProfile?.hourlyRate ?? currentProfile?.hourly_rate ?? 1500);
  renderPendingInviteState();
}

function renderPendingInviteState() {
  const inviteBox = document.getElementById("pendingInviteBox");
  const noInviteText = document.getElementById("noInviteText");
  const acceptBtn = document.getElementById("acceptInviteBtn");

  if (inviteBox) inviteBox.classList.toggle("hidden", !currentPendingInvite);
  if (noInviteText) noInviteText.classList.toggle("hidden", Boolean(currentPendingInvite));
  if (acceptBtn) acceptBtn.classList.toggle("hidden", !currentPendingInvite);

  if (currentPendingInvite?.workspace?.name) {
    setTextIfExists("pendingInviteWorkspaceName", currentPendingInvite.workspace.name);
    setTextIfExists("pendingInviteHint", `Pozvan si kao ${workspaceRoleLabel(currentPendingInvite.role)} u ovaj workspace.`);
  }
}

async function handleOnboardingProfileContinue() {
  const fullName = getValue("onboardingFullName").trim();
  const hourlyRateRaw = Number(getValue("onboardingHourlyRate") || 0);
  if (!fullName) {
    showToast("Unesi ime i prezime.");
    return;
  }
  if (!Number.isFinite(hourlyRateRaw) || hourlyRateRaw <= 0) {
    showToast("Unesi cenu radnog sata.");
    return;
  }

  const saved = await updateProfileSettings({
    fullName,
    hourlyRate: hourlyRateRaw
  });
  if (!saved) return;

  onboardingStep = "choice";
  renderOnboardingStep();
}

function handleOnboardingChooseCreate() {
  if (currentPendingInvite) {
    showToast("Za ovaj nalog vec postoji pozivnica. Prihvati poziv umesto kreiranja novog tima.");
    onboardingStep = "join";
    renderOnboardingStep();
    return;
  }

  onboardingStep = "create";
  renderOnboardingStep();
}

async function handleOnboardingCreateWorkspace() {
  const workspaceName = getValue("workspaceNameInput").trim();
  if (!workspaceName) {
    showToast("Unesi naziv workspace-a.");
    return;
  }

  const created = await createWorkspace(workspaceName);
  if (!created) return;

  closeOnboardingModal();
  renderSettingsUI();
  showToast("Workspace je kreiran.");
}

function handleOnboardingChooseJoin() {
  onboardingStep = "join";
  renderOnboardingStep();
}

async function handleAcceptInvite() {
  const accepted = await acceptPendingInvite();
  if (!accepted) return;

  closeOnboardingModal();
  renderSettingsUI();
  showToast("Pozivnica je prihvacena.");
}

function maybeOpenOnboarding() {
  if (currentMembership?.workspace?.id || currentWorkspace?.id) {
    return;
  }

  if (userNeedsOnboarding()) {
    openOnboardingModal(currentPendingInvite ? "join" : "");
  }
}

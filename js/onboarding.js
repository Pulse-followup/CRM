let onboardingStep = "profile";

function getOnboardingSectionId(step) {
  if (step === "profile") return "onboardingStepProfile";
  if (step === "choice") return "onboardingStepChoice";
  if (step === "create") return "onboardingStepCreate";
  return "onboardingStepJoin";
}

function openOnboardingModal(forceStep = "") {
  const modal = document.getElementById("onboardingModal");
  if (!modal || !isCloudEnabled() || !teamSchemaReady) return;

  onboardingStep = forceStep || (!currentProfile?.full_name ? "profile" : currentMembership ? "choice" : "choice");
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
    onboardingStep === "choice" ? "Biramo da li otvaras novi tim ili ulazis u postojeci." :
    onboardingStep === "create" ? "Naziv workspace-a postaje zajednicki CRM prostor tvog tima." :
    "Ako je za tvoj email vec kreirana pozivnica, ovde je prihvatas."
  );

  setValueIfExists("onboardingFullName", currentProfile?.full_name || "");
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
    setTextIfExists("pendingInviteHint", `Pozvani ste kao ${currentPendingInvite.role || "member"} u ovaj workspace.`);
  }
}

async function handleOnboardingProfileContinue() {
  const fullName = getValue("onboardingFullName").trim();
  if (!fullName) {
    showToast("Unesi ime i prezime.");
    return;
  }

  const saved = await updateProfileName(fullName);
  if (!saved) return;

  onboardingStep = "choice";
  renderOnboardingStep();
}

function handleOnboardingChooseCreate() {
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
  if (userNeedsOnboarding()) {
    openOnboardingModal();
  }
}

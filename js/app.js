const STORAGE_KEY = "pulse_mvp_clients_v031";

const STAGES = {
  new: "Novi",
  meeting_done: "Održan sastanak",
  offer_sent: "Poslata ponuda",
  waiting: "Čeka odgovor",
  negotiation: "Pregovori",
  won: "Dobijen",
  lost: "Izgubljen"
};

const PRIORITY_ORDER = {
  high: 1,
  medium: 2,
  low: 3,
  none: 4
};

const FRAGMENTS = {
  sidebarRoot: "./fragments/sidebar.html",
  topbarRoot: "./fragments/topbar.html",
  dashboardRoot: "./fragments/dashboard.html",
  clientsRoot: "./fragments/clients.html",
  actionsRoot: "./fragments/actions.html",
  drawerRoot: "./fragments/customer-drawer.html"
};

const MODAL_FRAGMENTS = [
  "./fragments/client-modal.html",
  "./fragments/action-modal.html",
  "./fragments/activity-modal.html",
  "./fragments/payment-modal.html",
  "./fragments/weekly-actions-modal.html",
  "./fragments/license-modal.html",
  "./fragments/welcome-modal.html",
  "./fragments/auth-modal.html",
  "./fragments/account-sheet.html",
  "./fragments/onboarding-modal.html",
  "./fragments/settings-modal.html"
];

let clients = [];
let currentClientId = null;
let currentActionClientId = null;
let currentActivityClientId = null;
let currentPaymentClientId = null;
let currentClientsMode = "all";

/* ------------------------- BOOT / FRAGMENTS ------------------------- */
document.addEventListener("DOMContentLoaded", async () => {
  await bootFragments();
  bindStaticEvents();
  loadLicenseState();
  await initSupabase();
  await initWorkspaceContext();
  await resolveClientSource();
  migrateClients();
  renderLicenseUI();
  renderSettingsUI();
  renderAll();
  showWelcomeModalIfNeeded();
  maybeOpenOnboarding();
});

async function bootFragments() {
  const fragmentEntries = Object.entries(FRAGMENTS);

  for (const [rootId, path] of fragmentEntries) {
    await loadFragmentIntoRoot(path, rootId);
  }

  const modalHtmlParts = [];
  for (const path of MODAL_FRAGMENTS) {
    modalHtmlParts.push(await fetchFragment(path));
  }

  const modalRoot = document.getElementById("modalRoot");
  if (modalRoot) {
    modalRoot.innerHTML = modalHtmlParts.join("\n");
  }
}

async function loadFragmentIntoRoot(path, rootId) {
  const root = document.getElementById(rootId);
  if (!root) {
    throw new Error(`Root element nije pronađen: ${rootId}`);
  }
  root.innerHTML = await fetchFragment(path);
}

async function fetchFragment(path) {
  const res = await fetch(path, { cache: "no-cache" });
  if (!res.ok) {
    throw new Error(`Ne mogu da učitam fragment: ${path}`);
  }
  return await res.text();
}

/* ------------------------- EVENTS ------------------------- */
function bindStaticEvents() {
  document.querySelectorAll(".nav-btn").forEach(btn => {
    btn.addEventListener("click", () => switchView(btn.dataset.view));
  });

  bindClickIfExists("addClientBtnTop", openAddClientModal);
  bindClickIfExists("addClientBtnMobilePanel", openAddClientModal);

  bindClickIfExists("exportClientsBtnTop", exportClients);
  bindClickIfExists("exportClientsBtnMobilePanel", exportClients);

  bindImportInput("importClientsInputTop");
  bindImportInput("importClientsInputMobilePanel");

  const clientSearch = document.getElementById("clientSearch");
  if (clientSearch) {
    clientSearch.addEventListener("input", renderClientsList);
  }

  bindClickIfExists("unlockPlanBtn", () => openLicenseModal());

  bindClickIfExists("closeLicenseModalBtn", closeLicenseModal);
  bindClickIfExists("cancelLicenseBtn", closeLicenseModal);
  bindClickIfExists("startTrialBtn", startTrial);
  bindClickIfExists("licenseModalBackdrop", closeLicenseModal);

  bindClickIfExists("closeWelcomeModalBtn", dismissWelcomeModal);
  bindClickIfExists("welcomeModalBackdrop", dismissWelcomeModal);
  bindClickIfExists("welcomeContinueBtn", dismissWelcomeModal);
  bindClickIfExists("welcomeStartTrialBtn", startTrialFromWelcome);
  bindClickIfExists("welcomeUnlockBtn", openLicenseFromWelcome);
  bindClickIfExists("cloudConnectBtn", openAuthModal);
  bindClickIfExists("cloudLogoutBtn", handleCloudLogout);
  bindClickIfExists("headerAuthBtn", handleHeaderAuthAction);
  bindClickIfExists("headerSyncBtn", handleManualCloudSync);
  bindClickIfExists("closeAuthModalBtn", closeAuthModal);
  bindClickIfExists("authCancelBtn", closeAuthModal);
  bindClickIfExists("authModalBackdrop", closeAuthModal);
  bindClickIfExists("authSignUpBtn", handleCloudSignUp);
  bindClickIfExists("closeAccountSheetBtn", closeAccountSheet);
  bindClickIfExists("accountSheetBackdrop", closeAccountSheet);
  bindClickIfExists("openWorkspaceFromAccountBtn", handleAccountWorkspaceAction);
  bindClickIfExists("openPlanFromAccountBtn", handleAccountPlanAction);
  bindClickIfExists("accountSheetLogoutBtn", handleAccountLogout);
  bindClickIfExists("openSettingsBtn", openSettingsModal);
  bindClickIfExists("openSettingsBtnTop", openSettingsModal);
  bindClickIfExists("closeSettingsModalBtn", closeSettingsModal);
  bindClickIfExists("settingsModalBackdrop", closeSettingsModal);
  bindClickIfExists("settingsOpenLicenseBtn", handleSettingsPlanAndTrial);
  bindClickIfExists("settingsConnectCloudBtn", handleSettingsCloudConnect);
  bindClickIfExists("settingsLogoutBtn", handleSettingsLogout);
  bindClickIfExists("openOnboardingFromSettingsBtn", handleSettingsWorkspaceSetup);
  bindClickIfExists("saveWorkspaceNameBtn", handleWorkspaceNameSave);
  bindClickIfExists("sendWorkspaceInviteBtn", handleWorkspaceInviteSend);
  bindClickIfExists("onboardingContinueProfileBtn", handleOnboardingProfileContinue);
  bindClickIfExists("onboardingChooseCreateBtn", handleOnboardingChooseCreate);
  bindClickIfExists("onboardingChooseJoinBtn", handleOnboardingChooseJoin);
  bindClickIfExists("createWorkspaceBtn", handleOnboardingCreateWorkspace);
  bindClickIfExists("acceptInviteBtn", handleAcceptInvite);
  bindClickIfExists("onboardingBackToChoiceBtn", () => {
    onboardingStep = "choice";
    renderOnboardingStep();
  });
  bindClickIfExists("onboardingBackFromJoinBtn", () => {
    onboardingStep = "choice";
    renderOnboardingStep();
  });

  const licenseForm = document.getElementById("licenseForm");
  if (licenseForm) {
    licenseForm.addEventListener("submit", handleLicenseSubmit);
  }

  const authForm = document.getElementById("authForm");
  if (authForm) {
    authForm.addEventListener("submit", handleCloudSignIn);
  }

  bindClickIfExists("closeWeeklyActionsModalBtn", closeWeeklyActionsModal);
  bindClickIfExists("weeklyActionsModalBackdrop", closeWeeklyActionsModal);
  bindClickIfExists("clearClientsModeBtn", clearClientsMode);

  bindClickIfExists("closeClientModalBtn", closeClientModal);
  bindClickIfExists("clientModalBackdrop", closeClientModal);
  bindClickIfExists("cancelClientBtn", closeClientModal);
  bindClickIfExists("deleteClientBtn", handleDeleteClient);

  const clientForm = document.getElementById("clientForm");
  if (clientForm) {
    clientForm.addEventListener("submit", handleClientSubmit);
  }

  const businessType = document.getElementById("businessType");
  if (businessType) {
    businessType.addEventListener("change", toggleIndustryFields);
  }

  bindClickIfExists("closeDrawerBtn", closeClientDrawer);
  bindClickIfExists("clientDrawerBackdrop", closeClientDrawer);

  bindClickIfExists("editClientBtnDrawer", () => {
    const client = getClientById(currentClientId);
    if (client) openEditClientModal(client.id);
  });

  bindClickIfExists("openActionFromDrawerBtn", () => {
    const client = getClientById(currentClientId);
    if (client) openActivityModal(client.id);
  });

  bindClickIfExists("openNewActivityFromDrawerBtn", () => {
    const client = getClientById(currentClientId);
    if (client) openActivityModal(client.id);
  });

  bindClickIfExists("openNewActivityFromDrawerBtnSecondary", () => {
    const client = getClientById(currentClientId);
    if (client) openActivityModal(client.id);
  });

  bindClickIfExists("openPaymentModalBtn", () => {
    const client = getClientById(currentClientId);
    if (client) openPaymentModal(client.id);
  });

  bindClickIfExists("openPaymentModalBtnSecondary", () => {
    const client = getClientById(currentClientId);
    if (client) openPaymentModal(client.id);
  });

  document.querySelectorAll(".stage-action-btn").forEach(btn => {
    btn.addEventListener("click", () => handleStageAction(btn.dataset.stageAction));
  });

  bindClickIfExists("closeActionModalBtn", closeActionModal);
  bindClickIfExists("actionModalBackdrop", closeActionModal);
  bindClickIfExists("copyMessageBtn", copyActionMessage);
  bindClickIfExists("markSentBtn", markActionAsSent);
  document.querySelectorAll("[data-followup-tier]").forEach(btn => {
    btn.addEventListener("click", () => setFollowupTier(btn.dataset.followupTier));
  });

  bindClickIfExists("closeActivityModalBtn", closeActivityModal);
  bindClickIfExists("activityModalBackdrop", closeActivityModal);
  bindClickIfExists("cancelActivityBtn", closeActivityModal);

  const activityForm = document.getElementById("activityForm");
  if (activityForm) {
    activityForm.addEventListener("submit", handleActivitySubmit);
  }

  bindChangeIfExists("activityCreateTask", toggleActivityTaskFields);
  bindChangeIfExists("activityProjectMode", toggleActivityProjectFields);
  bindDatePickerIfExists("activityProjectEndDate");
  bindDatePickerIfExists("activityTaskDueDate");

  bindClickIfExists("closePaymentModalBtn", closePaymentModal);
  bindClickIfExists("paymentModalBackdrop", closePaymentModal);
  bindChangeIfExists("paymentProjectSelect", renderSelectedPaymentProject);
  bindClickIfExists("createBillingRequestBtn", handleCreateBillingRequest);
  bindClickIfExists("saveBillingRecordBtn", handleSaveBillingRecord);
  bindClickIfExists("markBillingPaidBtn", handleMarkBillingPaid);
  bindDatePickerIfExists("billingInvoiceDate");
  bindDatePickerIfExists("billingDueDate");
  bindClickIfExists("markInvoiceSentBtn", markInvoiceSent);
  bindClickIfExists("generatePaymentReminderBtn", generatePaymentReminder);
  bindClickIfExists("copyPaymentMessageBtn", copyPaymentMessage);
  bindClickIfExists("markPaidOnTimeBtn", () => markPaymentReceived("on_time"));
  bindClickIfExists("markPaidLateBtn", () => markPaymentReceived("late"));

  if (typeof syncClientCreateAvailability === "function") {
    syncClientCreateAvailability();
  }
}

function bindClickIfExists(id, handler) {
  const el = document.getElementById(id);
  if (el) el.addEventListener("click", handler);
}

function bindChangeIfExists(id, handler) {
  const el = document.getElementById(id);
  if (el) el.addEventListener("change", handler);
}

function bindDatePickerIfExists(id) {
  const el = document.getElementById(id);
  if (!el) return;

  const openPicker = () => {
    if (typeof el.showPicker === "function") {
      try {
        el.showPicker();
      } catch {
        el.focus();
      }
    }
  };

  el.addEventListener("click", openPicker);
  el.addEventListener("focus", openPicker);
}

function bindImportInput(id) {
  const input = document.getElementById(id);
  if (!input) return;
  input.addEventListener("change", importClients);
}

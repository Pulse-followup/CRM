const LICENSE_STORAGE_KEY = "pulse_mvp_license_v2";
const WELCOME_STORAGE_KEY = "pulse_mvp_welcome_seen_v1";
const PRO_UNLOCK_CODES = ["PULSE-PRO-2026", "RMC-PULSE-PRO"];
const TRIAL_DURATION_DAYS = 5;
const FREE_CLIENT_LIMIT = 5;

const FEATURE_META = {
  pulse_score: {
    name: "Pulse Score i signali",
    hint: "Napredni score, pozitivni signali i red flags su deo Pro paketa."
  },
  deal_info: {
    name: "Deal info",
    hint: "Vrednost prilike, verovatnoca i datum odluke su deo Pro paketa."
  },
  payments: {
    name: "Naplata",
    hint: "Pracenje faktura i discipline placanja je deo Pro paketa."
  },
  weekly_actions: {
    name: "Akcije ove nedelje",
    hint: "Nedeljni pregled aktivnosti je deo Pro paketa."
  }
};

let licenseState = {
  plan: "free",
  activatedAt: "",
  trialEndsAt: ""
};

function loadLicenseState() {
  try {
    const raw = localStorage.getItem(LICENSE_STORAGE_KEY);
    licenseState = raw ? JSON.parse(raw) : getDefaultLicenseState();
  } catch {
    licenseState = getDefaultLicenseState();
  }

  normalizeLicenseState();
}

function getDefaultLicenseState() {
  return {
    plan: "free",
    activatedAt: "",
    trialEndsAt: ""
  };
}

function saveLicenseState() {
  localStorage.setItem(LICENSE_STORAGE_KEY, JSON.stringify(licenseState));
}

function normalizeLicenseState() {
  if (licenseState.plan !== "trial") return;

  if (getTrialDaysLeft() <= 0) {
    licenseState = getDefaultLicenseState();
    saveLicenseState();
  }
}

function isProUnlocked() {
  return licenseState.plan === "pro";
}

function isTrialActive() {
  return licenseState.plan === "trial" && getTrialDaysLeft() > 0;
}

function hasPremiumAccess() {
  return isProUnlocked() || isTrialActive();
}

function getTrialDaysLeft() {
  if (!licenseState.trialEndsAt) return 0;
  const days = daysUntil(licenseState.trialEndsAt);
  return days === null ? 0 : Math.max(0, days + 1);
}

function getFeatureHint(featureKey) {
  return FEATURE_META[featureKey]?.hint || "Ova funkcija je deo Pro paketa.";
}

function canUseUnlimitedClients() {
  return hasPremiumAccess();
}

function isFreeClientLimitReached(nextCount = clients.length) {
  return !canUseUnlimitedClients() && nextCount > FREE_CLIENT_LIMIT;
}

function getFreePlanLimitText() {
  return `Do ${FREE_CLIENT_LIMIT} klijenata u Free verziji.`;
}

function requireProFeature(featureKey) {
  if (hasPremiumAccess()) return true;
  openLicenseModal(featureKey);
  return false;
}

function openLicenseModal(featureKey = "") {
  const modal = document.getElementById("licenseModal");
  if (!modal) return;

  const featureName = FEATURE_META[featureKey]?.name || "Pro funkcije";
  setValueIfExists("licenseCodeInput", "");
  setTextIfExists("licenseFeatureName", featureName);
  setTextIfExists("licenseFeatureHint", getFeatureHint(featureKey));

  const error = document.getElementById("licenseError");
  if (error) error.classList.add("hidden");

  const trialBtn = document.getElementById("startTrialBtn");
  if (trialBtn) {
    trialBtn.classList.toggle("hidden", isProUnlocked() || isTrialActive());
  }

  modal.classList.remove("hidden");
  modal.setAttribute("aria-hidden", "false");
}

function closeLicenseModal() {
  const modal = document.getElementById("licenseModal");
  if (!modal) return;
  modal.classList.add("hidden");
  modal.setAttribute("aria-hidden", "true");
}

function shouldShowWelcomeModal() {
  return localStorage.getItem(WELCOME_STORAGE_KEY) !== "seen";
}

function markWelcomeSeen() {
  localStorage.setItem(WELCOME_STORAGE_KEY, "seen");
}

function showWelcomeModalIfNeeded() {
  if (!shouldShowWelcomeModal()) return;

  const modal = document.getElementById("welcomeModal");
  if (!modal) return;

  modal.classList.remove("hidden");
  modal.setAttribute("aria-hidden", "false");
}

function dismissWelcomeModal() {
  const modal = document.getElementById("welcomeModal");
  if (modal) {
    modal.classList.add("hidden");
    modal.setAttribute("aria-hidden", "true");
  }

  markWelcomeSeen();
}

function handleLicenseSubmit(e) {
  e.preventDefault();

  const input = document.getElementById("licenseCodeInput");
  const error = document.getElementById("licenseError");
  const code = (input?.value || "").trim().toUpperCase();

  if (!PRO_UNLOCK_CODES.includes(code)) {
    if (error) error.classList.remove("hidden");
    showToast("Kod nije validan.");
    return;
  }

  licenseState = {
    plan: "pro",
    activatedAt: nowISO(),
    trialEndsAt: ""
  };

  saveLicenseState();
  closeLicenseModal();
  renderLicenseUI();
  renderAll();
  if (currentClientId) openClientDrawer(currentClientId);
  showToast("Pro funkcije su otkljucane.");
}

function startTrial() {
  if (hasPremiumAccess()) return;

  const trialEnds = new Date();
  trialEnds.setDate(trialEnds.getDate() + TRIAL_DURATION_DAYS - 1);

  licenseState = {
    plan: "trial",
    activatedAt: nowISO(),
    trialEndsAt: trialEnds.toISOString().slice(0, 10)
  };

  saveLicenseState();
  closeLicenseModal();
  renderLicenseUI();
  renderAll();
  if (currentClientId) openClientDrawer(currentClientId);
  showToast("Trial je pokrenut.");
}

function startTrialFromWelcome() {
  dismissWelcomeModal();
  startTrial();
}

function openLicenseFromWelcome() {
  dismissWelcomeModal();
  openLicenseModal();
}

function renderLicenseUI() {
  const hasAccess = hasPremiumAccess();
  const badgeText =
    isProUnlocked() ? "PRO VERZIJA" :
    isTrialActive() ? "TRIAL" :
    "FREE";
  const badgeClass =
    isProUnlocked() ? "success" :
    isTrialActive() ? "warning" :
    "neutral";
  const summaryText =
    isTrialActive()
      ? `Probni period traje jos ${getTrialDaysLeft()} ${getTrialDaysLeft() === 1 ? "dan" : "dana"}.`
      : getFreePlanLimitText();

  setTextIfExists("licensePlanBadge", badgeText);
  setClassIfExists("licensePlanBadge", `badge ${badgeClass}`);
  setTextIfExists("licensePlanText", summaryText);
  setTextIfExists("unlockPlanBtn", isTrialActive() ? "Aktiviraj Pro" : "Otkljucaj Pro");

  const licenseText = document.getElementById("licensePlanText");
  if (licenseText) {
    licenseText.classList.toggle("hidden", isProUnlocked());
  }

  const unlockBtn = document.getElementById("unlockPlanBtn");
  if (unlockBtn) {
    unlockBtn.disabled = isProUnlocked();
    unlockBtn.classList.toggle("is-disabled", isProUnlocked());
    unlockBtn.classList.toggle("hidden", isProUnlocked());
  }

  const dealSection = document.getElementById("dealInfoSection");
  if (dealSection) dealSection.classList.toggle("is-locked", !hasAccess);

  const dealNotice = document.getElementById("dealInfoLockedNote");
  if (dealNotice) dealNotice.classList.toggle("hidden", hasAccess);

  document.querySelectorAll("[data-pro-feature]").forEach(el => {
    const feature = el.dataset.proFeature;
    el.classList.toggle("pro-locked", !hasAccess);
    if (!hasAccess) {
      el.setAttribute("title", getFeatureHint(feature));
    } else {
      el.removeAttribute("title");
    }
  });

  document.querySelectorAll("#dealInfoSection input, #dealInfoSection select").forEach(el => {
    el.disabled = !hasAccess;
  });

  if (typeof renderSettingsUI === "function") {
    renderSettingsUI();
  }
}

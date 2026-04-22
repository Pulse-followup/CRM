let supabaseClient = null;
let supabaseSession = null;
let supabaseUser = null;
let cloudSyncState = "idle";

function isSupabaseConfigured() {
  const config = window.SUPABASE_CONFIG || {};
  return Boolean(config.url && config.anonKey);
}

function isCloudEnabled() {
  return Boolean(supabaseClient && supabaseUser);
}

async function initSupabase() {
  if (!isSupabaseConfigured() || !window.supabase?.createClient) {
    cloudSyncState = "idle";
    syncCloudStatusUI();
    return;
  }

  const { url, anonKey } = window.SUPABASE_CONFIG;
  supabaseClient = window.supabase.createClient(url, anonKey, {
    auth: {
      persistSession: true,
      autoRefreshToken: true
    }
  });

  const { data } = await supabaseClient.auth.getSession();
  supabaseSession = data.session || null;
  supabaseUser = supabaseSession?.user || null;

  supabaseClient.auth.onAuthStateChange((_event, session) => {
    supabaseSession = session || null;
    supabaseUser = supabaseSession?.user || null;
    syncCloudStatusUI();
  });

  cloudSyncState = "idle";
  syncCloudStatusUI();
}

function openAuthModal() {
  if (!isSupabaseConfigured()) {
    showToast("Prvo unesi Supabase URL i publishable key u js/supabase-config.js.");
    return;
  }

  const modal = document.getElementById("authModal");
  if (!modal) return;

  setTextIfExists("authModalTitle", "Povezi Pulse cloud");
  setTextIfExists(
    "authStatusText",
    supabaseUser ? `Ulogovan: ${supabaseUser.email}` : "Prijavi se ili napravi nalog za cloud sync."
  );
  setValueIfExists("authEmailInput", supabaseUser?.email || "");
  setValueIfExists("authPasswordInput", "");

  const error = document.getElementById("authError");
  if (error) error.classList.add("hidden");

  modal.classList.remove("hidden");
  modal.setAttribute("aria-hidden", "false");
}

function closeAuthModal() {
  const modal = document.getElementById("authModal");
  if (!modal) return;
  modal.classList.add("hidden");
  modal.setAttribute("aria-hidden", "true");
}

async function handleCloudSignIn(e) {
  e.preventDefault();
  if (!supabaseClient) {
    showToast("Supabase nije povezan.");
    return;
  }

  const email = getValue("authEmailInput").trim();
  const password = getValue("authPasswordInput");
  const errorEl = document.getElementById("authError");

  const { data, error } = await supabaseClient.auth.signInWithPassword({ email, password });
  if (error) {
    if (errorEl) {
      errorEl.textContent = error.message;
      errorEl.classList.remove("hidden");
    }
    return;
  }

  supabaseSession = data.session || null;
  supabaseUser = data.user || null;
  await initWorkspaceContext();
  await resolveClientSource();
  migrateClients();
  renderLicenseUI();
  renderSettingsUI();
  renderAll();
  syncCloudStatusUI();
  closeAuthModal();
  maybeOpenOnboarding();
  showToast("Cloud sync je povezan.");
}

async function handleCloudSignUp() {
  if (!supabaseClient) {
    showToast("Supabase nije povezan.");
    return;
  }

  const email = getValue("authEmailInput").trim();
  const password = getValue("authPasswordInput");
  const errorEl = document.getElementById("authError");

  const { data, error } = await supabaseClient.auth.signUp({ email, password });
  if (error) {
    if (errorEl) {
      errorEl.textContent = error.message;
      errorEl.classList.remove("hidden");
    }
    return;
  }

  supabaseSession = data.session || null;
  supabaseUser = data.user || null;
  await initWorkspaceContext();
  renderSettingsUI();
  syncCloudStatusUI();
  closeAuthModal();
  maybeOpenOnboarding();
  showToast("Nalog je kreiran.");
}

async function handleCloudLogout() {
  if (!supabaseClient) return;

  await supabaseClient.auth.signOut();
  supabaseSession = null;
  supabaseUser = null;
  cloudSyncState = "idle";
  resetWorkspaceContext();
  if (typeof resetClientSourceResolution === "function") {
    resetClientSourceResolution();
    await resolveClientSource({ silent: true });
    migrateClients();
  }
  renderAll();
  renderSettingsUI();
  syncCloudStatusUI();
  showToast("Cloud nalog je odjavljen.");
}

async function handleManualCloudSync() {
  if (!isSupabaseConfigured()) {
    showToast("Prvo unesi Supabase URL i publishable key.");
    return;
  }

  if (!isCloudEnabled()) {
    openAuthModal();
    return;
  }

  if (typeof canUseWorkspaceClientStore === "function" && canUseWorkspaceClientStore()) {
    await hydrateClientsFromWorkspace({ pushIfEmpty: false });
    if (typeof loadWorkspaceMembers === "function") {
      await loadWorkspaceMembers();
    }
    if (typeof loadWorkspaceInvites === "function") {
      await loadWorkspaceInvites();
    }
    if (typeof renderAll === "function") {
      renderAll();
    }
    if (typeof renderSessionUI === "function") {
      renderSessionUI();
    }
    cloudSyncState = "synced";
    syncCloudStatusUI("Workspace osvezen");
    showToast("Workspace je osvezen iz baze.");
    return;
  }

  await resolveClientSource();
  migrateClients();
  renderAll();
  cloudSyncState = "synced";
  syncCloudStatusUI("Lokalni fallback osvezen");
  showToast("Klijenti su osvezeni iz aktivnog izvora.");
}

function syncCloudStatusUI(overrideText = "") {
  const badge = document.getElementById("cloudStatusBadge");
  const text = document.getElementById("cloudStatusText");
  const connectBtn = document.getElementById("cloudConnectBtn");
  const logoutBtn = document.getElementById("cloudLogoutBtn");
  const headerAuthBtn = document.getElementById("headerAuthBtn");
  const headerSyncBtn = document.getElementById("headerSyncBtn");
  const headerAccountLabel =
    currentProfile?.full_name ||
    currentProfile?.email?.split("@")[0] ||
    supabaseUser?.email?.split("@")[0] ||
    "LOGIN";
  const stateLabel =
    isCloudEnabled() ? "Cloud povezan" :
    isSupabaseConfigured() ? "Spreman za login" :
    "Lokalni rad";
  const stateText = overrideText || (
    isCloudEnabled()
      ? `Povezano kao ${supabaseUser.email}.`
      : isSupabaseConfigured()
        ? "Supabase je spreman, ali nisi prijavljen."
        : "App radi lokalno dok ne uneses Supabase podatke."
  );

  if (badge) {
    const label =
      isCloudEnabled() ? "Cloud" :
      isSupabaseConfigured() ? "Lokalno" :
      "Offline";
    badge.textContent = label;
    badge.className = `badge ${isCloudEnabled() ? "success" : "neutral"}`;
  }

  if (text) {
    text.textContent = stateText;
  }

  if (connectBtn) {
    connectBtn.classList.toggle("hidden", isCloudEnabled());
    connectBtn.textContent = isSupabaseConfigured() ? "Povezi cloud" : "Podesi Supabase";
  }

  if (logoutBtn) {
    logoutBtn.classList.toggle("hidden", !isCloudEnabled());
  }

  if (headerAuthBtn) {
    headerAuthBtn.textContent = isCloudEnabled() ? headerAccountLabel : "LOGIN";
  }

  if (headerSyncBtn) {
    const canSyncNow = isCloudEnabled();
    headerSyncBtn.disabled = !canSyncNow;
    headerSyncBtn.classList.toggle("is-disabled", !canSyncNow);
    headerSyncBtn.classList.toggle("is-synced", canSyncNow && cloudSyncState === "synced");
    headerSyncBtn.classList.toggle("is-idle", !canSyncNow || cloudSyncState !== "synced");
  }

  if (typeof renderSettingsUI === "function") {
    renderSettingsUI();
  }
}

const SUPABASE_STATE_TABLE = "app_state";

let supabaseClient = null;
let supabaseSession = null;
let supabaseUser = null;
let cloudSyncTimer = null;

function isSupabaseConfigured() {
  const config = window.SUPABASE_CONFIG || {};
  return Boolean(config.url && config.anonKey);
}

function isCloudEnabled() {
  return Boolean(supabaseClient && supabaseUser);
}

async function initSupabase() {
  if (!isSupabaseConfigured() || !window.supabase?.createClient) {
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
    initWorkspaceContext();
    syncCloudStatusUI();
  });

  if (supabaseUser) {
    await hydrateClientsFromCloud();
  }

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
  await hydrateClientsFromCloud();
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
  resetWorkspaceContext();
  renderSettingsUI();
  syncCloudStatusUI();
  showToast("Cloud nalog je odjavljen.");
}

async function hydrateClientsFromCloud() {
  if (!isCloudEnabled()) return;

  const { data, error } = await supabaseClient
    .from(SUPABASE_STATE_TABLE)
    .select("clients_json")
    .eq("user_id", supabaseUser.id)
    .maybeSingle();

  if (error) {
    showToast("Cloud citanje nije uspelo.");
    return;
  }

  const remoteClients = Array.isArray(data?.clients_json) ? data.clients_json : null;

  if (remoteClients && remoteClients.length) {
    clients = remoteClients;
    saveClientsLocalOnly();
    return;
  }

  if (clients.length) {
    await pushClientsToCloud();
  }
}

function queueCloudSync() {
  if (!isCloudEnabled()) return;

  clearTimeout(cloudSyncTimer);
  cloudSyncTimer = setTimeout(() => {
    pushClientsToCloud();
  }, 500);
}

async function pushClientsToCloud() {
  if (!isCloudEnabled()) return;

  const payload = {
    user_id: supabaseUser.id,
    clients_json: clients,
    updated_at: nowISO()
  };

  const { error } = await supabaseClient
    .from(SUPABASE_STATE_TABLE)
    .upsert(payload, { onConflict: "user_id" });

  if (error) {
    showToast("Cloud sync nije uspeo.");
    return;
  }

  syncCloudStatusUI("Sinhronizovano");
}

function syncCloudStatusUI(overrideText = "") {
  const badge = document.getElementById("cloudStatusBadge");
  const text = document.getElementById("cloudStatusText");
  const connectBtn = document.getElementById("cloudConnectBtn");
  const logoutBtn = document.getElementById("cloudLogoutBtn");

  if (badge) {
    const label =
      isCloudEnabled() ? "Cloud" :
      isSupabaseConfigured() ? "Lokalno" :
      "Offline";
    badge.textContent = label;
    badge.className = `badge ${isCloudEnabled() ? "success" : "neutral"}`;
  }

  if (text) {
    text.textContent = overrideText || (
      isCloudEnabled()
        ? `Povezano kao ${supabaseUser.email}.`
        : isSupabaseConfigured()
          ? "Supabase je spreman, ali nisi prijavljen."
          : "App radi lokalno dok ne uneses Supabase podatke."
    );
  }

  if (connectBtn) {
    connectBtn.classList.toggle("hidden", isCloudEnabled());
    connectBtn.textContent = isSupabaseConfigured() ? "Povezi cloud" : "Podesi Supabase";
  }

  if (logoutBtn) {
    logoutBtn.classList.toggle("hidden", !isCloudEnabled());
  }

  if (typeof renderSettingsUI === "function") {
    renderSettingsUI();
  }
}

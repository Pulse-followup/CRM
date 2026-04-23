let teamSchemaReady = false;
let currentProfile = null;
let currentWorkspace = null;
let currentMembership = null;
let currentWorkspacePlan = null;
let currentPendingInvite = null;
let currentWorkspaceMembers = [];
let currentWorkspaceInvites = [];
let isEditingWorkspaceName = false;
let workspaceClientsReady = false;
let workspaceActivitiesReady = false;
const MEMBER_DIRECTORY_KEY = "pulse_workspace_member_directory_v1";
const WORKSPACE_INVITE_CODE_KEY = "pulse_workspace_invite_code_v1";
const WORKSPACE_INVITE_QUERY_PARAM = "invite";

function normalizeWorkspaceRole(role) {
  const normalized = String(role || "").trim().toLowerCase();
  if (["finance", "finansije"].includes(normalized)) return "finance";
  return ["admin", "member"].includes(normalized) ? normalized : "member";
}

function workspaceRoleLabel(role) {
  switch (normalizeWorkspaceRole(role)) {
    case "admin": return "Admin";
    case "finance": return "Finansije";
    default: return "Clan";
  }
}

function getInviteCodeFromUrl() {
  try {
    return new URLSearchParams(window.location.search).get(WORKSPACE_INVITE_QUERY_PARAM) || "";
  } catch {
    return "";
  }
}

function rememberInviteCodeFromUrl() {
  const code = getInviteCodeFromUrl();
  if (!code) return "";
  localStorage.setItem(WORKSPACE_INVITE_CODE_KEY, code);
  return code;
}

function getRememberedInviteCode() {
  return getInviteCodeFromUrl() || localStorage.getItem(WORKSPACE_INVITE_CODE_KEY) || "";
}

function clearRememberedInviteCode() {
  localStorage.removeItem(WORKSPACE_INVITE_CODE_KEY);
  try {
    const url = new URL(window.location.href);
    if (url.searchParams.has(WORKSPACE_INVITE_QUERY_PARAM)) {
      url.searchParams.delete(WORKSPACE_INVITE_QUERY_PARAM);
      window.history.replaceState({}, document.title, url.toString());
    }
  } catch {
    // URL cleanup is only cosmetic; local storage cleanup above is enough.
  }
}

function buildWorkspaceInviteLink(invite) {
  const code = invite?.id || "";
  if (!code) return "";
  const publicAppUrl = window.PULSE_PUBLIC_APP_URL || window.location.href;
  const url = new URL(publicAppUrl, window.location.href);
  url.searchParams.set(WORKSPACE_INVITE_QUERY_PARAM, code);
  return url.toString();
}

async function copyTextToClipboard(text) {
  if (!text) return false;
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    // Fallback below.
  }

  const input = document.createElement("textarea");
  input.value = text;
  input.setAttribute("readonly", "readonly");
  input.style.position = "fixed";
  input.style.left = "-9999px";
  document.body.appendChild(input);
  input.select();
  const copied = document.execCommand("copy");
  input.remove();
  return copied;
}

async function copyWorkspaceInviteLink(invite) {
  const copied = await copyTextToClipboard(buildWorkspaceInviteLink(invite));
  showToast(copied ? "Invite link je kopiran." : "Link nije kopiran automatski.");
  return copied;
}

function loadMemberDirectory() {
  try {
    const raw = localStorage.getItem(MEMBER_DIRECTORY_KEY);
    const parsed = raw ? JSON.parse(raw) : {};
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

function saveMemberDirectory(directory) {
  localStorage.setItem(MEMBER_DIRECTORY_KEY, JSON.stringify(directory));
}

function rememberMemberProfile(userId, profile = {}) {
  if (!userId) return;

  const directory = loadMemberDirectory();
  const existing = directory[userId] || {};
  const next = {
    full_name: profile.full_name || existing.full_name || "",
    email: profile.email || existing.email || ""
  };

  directory[userId] = next;
  saveMemberDirectory(directory);
}

function rememberObservedMembersFromClients() {
  if (!Array.isArray(clients) || !clients.length) return;

  const directory = loadMemberDirectory();
  let changed = false;

  const remember = (userId, fullName = "", email = "") => {
    if (!userId) return;
    const existing = directory[userId] || {};
    const safeFullName = isGenericTeamLabel(fullName) ? "" : fullName;
    const next = {
      full_name: safeFullName || existing.full_name || "",
      email: email || existing.email || ""
    };

    if (next.full_name !== existing.full_name || next.email !== existing.email) {
      directory[userId] = next;
      changed = true;
    }
  };

  clients.forEach(client => {
    const task = client?.payment?.workflow?.activeTask;
    if (task && typeof task === "object") {
      remember(task.ownerId, task.ownerName || "", task.ownerEmail || "");
      remember(task.delegatedById, task.delegatedByName || "", task.delegatedByEmail || "");
    }

    const log = Array.isArray(client?.activityLog) ? client.activityLog : [];
    log.forEach(item => {
      remember(item.actorId, item.actorName || "", item.actorEmail || "");
      remember(item.ownerId, item.ownerName || "", item.ownerEmail || "");
    });
  });

  if (changed) {
    saveMemberDirectory(directory);
  }
}

function getRememberedMemberProfile(userId) {
  if (!userId) return null;
  rememberObservedMembersFromClients();
  const remembered = loadMemberDirectory()[userId];
  return remembered ? { id: userId, ...remembered } : null;
}

function normalizeWorkspaceName(name) {
  return String(name || "").trim().replace(/\s+/g, " ").toLowerCase();
}

async function findWorkspaceByName(workspaceName) {
  if (!canUseTeamFeatures()) return null;

  const normalizedName = normalizeWorkspaceName(workspaceName);
  if (!normalizedName) return null;

  const { data, error } = await supabaseClient
    .from("workspaces")
    .select("id, name, owner_user_id, created_at, updated_at")
    .ilike("name", workspaceName.trim());

  if (error || !Array.isArray(data)) {
    return null;
  }

  return data.find(item => normalizeWorkspaceName(item.name) === normalizedName) || null;
}

function buildWorkspacePlanPayload() {
  const effectivePlan =
    licenseState.plan === "pro" ? "pro" :
    licenseState.plan === "trial" ? "trial" :
    "free";

  return {
    workspace_id: currentWorkspace.id,
    plan: effectivePlan,
    status: "active",
    trial_started_at: licenseState.plan === "trial" ? licenseState.activatedAt || nowISO() : null,
    trial_ends_at: licenseState.plan === "trial" && licenseState.trialEndsAt ? `${licenseState.trialEndsAt}T23:59:59` : null,
    client_limit: effectivePlan === "free" ? FREE_CLIENT_LIMIT : null
  };
}

function showWorkspaceError(message, error = null) {
  const errorEl = document.getElementById("onboardingError");
  if (errorEl) {
    errorEl.textContent = message;
    errorEl.classList.remove("hidden");
  }

  if (error) {
    console.error("[Pulse Team]", error);
  }

  showToast(message);
}

function clearWorkspaceError() {
  const errorEl = document.getElementById("onboardingError");
  if (errorEl) {
    errorEl.classList.add("hidden");
  }
}

function getCurrentPlanName() {
  if (currentWorkspacePlan?.plan) {
    return String(currentWorkspacePlan.plan).toUpperCase();
  }

  if (isProUnlocked()) return "PRO";
  if (isTrialActive()) return "TRIAL";
  return "FREE";
}

function resetWorkspaceContext() {
  currentProfile = null;
  currentWorkspace = null;
  currentMembership = null;
  currentWorkspacePlan = null;
  currentPendingInvite = null;
  currentWorkspaceMembers = [];
  currentWorkspaceInvites = [];
  isEditingWorkspaceName = false;
  workspaceClientsReady = false;
  workspaceActivitiesReady = false;
}

function canUseTeamFeatures() {
  return teamSchemaReady && isCloudEnabled();
}

function canUseWorkspaceClientStore() {
  return Boolean(canUseTeamFeatures() && currentWorkspace?.id && workspaceClientsReady);
}

function canUseWorkspaceActivityStore() {
  return Boolean(canUseTeamFeatures() && currentWorkspace?.id && workspaceActivitiesReady);
}

function isMissingRelationError(error) {
  return Boolean(error?.message && /relation .* does not exist/i.test(error.message));
}

function isMissingRpcError(error) {
  return Boolean(error?.message && /Could not find the function|function .* does not exist/i.test(error.message));
}

async function detectTeamSchema() {
  if (!supabaseClient || !supabaseUser) {
    teamSchemaReady = false;
    return false;
  }

  const { error } = await supabaseClient
    .from("profiles")
    .select("id")
    .eq("id", supabaseUser.id)
    .limit(1);

  teamSchemaReady = !error;
  return teamSchemaReady;
}

async function detectWorkspaceClientsStore() {
  if (!canUseTeamFeatures() || !currentWorkspace?.id) {
    workspaceClientsReady = false;
    return false;
  }

  const { error } = await supabaseClient
    .from("clients")
    .select("id")
    .eq("workspace_id", currentWorkspace.id)
    .limit(1);

  workspaceClientsReady = !error;
  return workspaceClientsReady;
}

async function detectWorkspaceActivitiesStore() {
  if (!canUseTeamFeatures() || !currentWorkspace?.id) {
    workspaceActivitiesReady = false;
    return false;
  }

  const { error } = await supabaseClient
    .from("client_activities")
    .select("id")
    .eq("workspace_id", currentWorkspace.id)
    .limit(1);

  workspaceActivitiesReady = !error;
  return workspaceActivitiesReady;
}

async function createProfileIfMissing(defaultFullName = "") {
  if (!canUseTeamFeatures()) return null;

  const existingProfile = await loadProfile();
  if (existingProfile) {
    return existingProfile;
  }

  const email = supabaseUser?.email || "";
  const { data, error } = await supabaseClient
    .from("profiles")
    .upsert({
      id: supabaseUser.id,
      email,
      full_name: defaultFullName || null
    }, { onConflict: "id" })
    .select("id, full_name, email, created_at, updated_at")
    .single();

  if (error) {
    const reloadedProfile = await loadProfile();
    if (reloadedProfile) {
      return reloadedProfile;
    }

    showWorkspaceError(`Profil nije sacuvan: ${error.message || "nepoznata greska"}`, error);
    return null;
  }

  currentProfile = data || null;
  if (currentProfile?.id) {
    rememberMemberProfile(currentProfile.id, currentProfile);
  }
  return currentProfile;
}

async function loadProfile() {
  if (!canUseTeamFeatures()) return null;

  const { data, error } = await supabaseClient
    .from("profiles")
    .select("id, full_name, email, created_at, updated_at")
    .eq("id", supabaseUser.id)
    .maybeSingle();

  if (error) {
    if (!isMissingRelationError(error)) showWorkspaceError(`Profil nije ucitan: ${error.message || "nepoznata greska"}`, error);
    currentProfile = null;
    return null;
  }

  currentProfile = data || null;
  if (currentProfile?.id) {
    rememberMemberProfile(currentProfile.id, currentProfile);
  }
  return currentProfile;
}

async function loadWorkspaceMembership() {
  if (!canUseTeamFeatures()) return null;

  const { data, error } = await supabaseClient
    .from("workspace_members")
    .select(`
      id,
      role,
      status,
      joined_at,
      workspace:workspaces (
        id,
        name,
        owner_user_id,
        created_at,
        updated_at
      )
    `)
    .eq("user_id", supabaseUser.id)
    .eq("status", "active")
    .limit(1)
    .maybeSingle();

  if (error) {
    if (!isMissingRelationError(error)) showWorkspaceError(`Workspace nije ucitan: ${error.message || "nepoznata greska"}`, error);
    currentMembership = null;
    currentWorkspace = null;
    return null;
  }

  currentMembership = data || null;
  currentWorkspace = data?.workspace || null;
  return currentMembership;
}

async function loadPendingInvite() {
  if (!canUseTeamFeatures() || !supabaseUser?.email) return null;

  const rememberedCode = getRememberedInviteCode();
  let query = supabaseClient
    .from("workspace_invites")
    .select(`
      id,
      email,
      role,
      status,
      workspace_id,
      workspace:workspaces (
        id,
        name
      )
    `)
    .eq("email", supabaseUser.email)
    .eq("status", "pending")
    .limit(1);

  if (rememberedCode && /^[0-9a-f-]{36}$/i.test(rememberedCode)) {
    query = query.eq("id", rememberedCode);
  }

  let { data, error } = await query.maybeSingle();

  if (!data && rememberedCode) {
    const fallback = await supabaseClient
      .from("workspace_invites")
      .select(`
        id,
        email,
        role,
        status,
        workspace_id,
        workspace:workspaces (
          id,
          name
        )
      `)
      .eq("email", supabaseUser.email)
      .eq("status", "pending")
      .limit(1)
      .maybeSingle();
    data = fallback.data;
    error = fallback.error;
  }

  if (error) {
    if (!isMissingRelationError(error)) showWorkspaceError(`Pozivnica nije ucitana: ${error.message || "nepoznata greska"}`, error);
    currentPendingInvite = null;
    return null;
  }

  currentPendingInvite = data || null;
  return currentPendingInvite;
}

async function loadWorkspacePlan() {
  if (!canUseTeamFeatures() || !currentWorkspace?.id) {
    currentWorkspacePlan = null;
    return null;
  }

  const { data, error } = await supabaseClient
    .from("workspace_subscriptions")
    .select("workspace_id, plan, status, trial_started_at, trial_ends_at, client_limit")
    .eq("workspace_id", currentWorkspace.id)
    .maybeSingle();

  if (error) {
    currentWorkspacePlan = null;
    return null;
  }

  currentWorkspacePlan = data || null;
  return currentWorkspacePlan;
}

async function loadWorkspaceMembers() {
  if (!canUseTeamFeatures() || !currentWorkspace?.id) {
    currentWorkspaceMembers = [];
    return [];
  }

  const { data, error } = await supabaseClient
    .from("workspace_members")
    .select("id, role, status, joined_at, user_id")
    .eq("workspace_id", currentWorkspace.id)
    .eq("status", "active")
    .order("joined_at", { ascending: true });

  if (error) {
    currentWorkspaceMembers = [];
    showToast("Clanovi workspace-a nisu ucitani.");
    return [];
  }

  const members = Array.isArray(data) ? data : [];
  const userIds = [...new Set(members.map(member => member.user_id).filter(Boolean))];

  let profilesById = new Map();
  if (userIds.length) {
    const { data: profiles, error: profilesError } = await supabaseClient
      .from("profiles")
      .select("id, full_name, email")
      .in("id", userIds);

    if (profilesError) {
      console.warn("[Pulse Workspace] member profiles were not fully readable", profilesError);
    }

    profilesById = new Map(
      (Array.isArray(profiles) ? profiles : []).map(profile => [profile.id, profile])
    );
  }

  currentWorkspaceMembers = members.map(member => ({
    ...member,
    profile: profilesById.get(member.user_id) || getRememberedMemberProfile(member.user_id) || null
  }));
  return currentWorkspaceMembers;
}

async function loadWorkspaceInvites() {
  if (!canUseTeamFeatures() || !currentWorkspace?.id || currentMembership?.role !== "admin") {
    currentWorkspaceInvites = [];
    return [];
  }

  const { data, error } = await supabaseClient
    .from("workspace_invites")
    .select("id, email, role, status, created_at")
    .eq("workspace_id", currentWorkspace.id)
    .eq("status", "pending")
    .order("created_at", { ascending: false });

  if (error) {
    currentWorkspaceInvites = [];
    showToast("Pozivnice nisu ucitane.");
    return [];
  }

  currentWorkspaceInvites = Array.isArray(data) ? data : [];
  return currentWorkspaceInvites;
}

async function ensureWorkspacePlanExists() {
  if (!canUseTeamFeatures() || !currentWorkspace?.id) return null;

  if (currentWorkspacePlan) {
    return currentWorkspacePlan;
  }

  const payload = buildWorkspacePlanPayload();
  const { data, error } = await supabaseClient
    .from("workspace_subscriptions")
    .insert(payload)
    .select("workspace_id, plan, status, trial_started_at, trial_ends_at, client_limit")
    .single();

  if (error) {
    showWorkspaceError(`Plan workspace-a nije sacuvan: ${error.message || "nepoznata greska"}`, error);
    return null;
  }

  currentWorkspacePlan = data || null;
  return currentWorkspacePlan;
}

async function initWorkspaceContext() {
  resetWorkspaceContext();
  rememberInviteCodeFromUrl();

  if (!supabaseClient || !supabaseUser) {
    renderSessionUI();
    return;
  }

  await detectTeamSchema();
  if (!teamSchemaReady) {
    renderSessionUI();
    return;
  }

  await createProfileIfMissing();
  await loadWorkspaceMembership();
  await loadPendingInvite();
  await loadWorkspacePlan();
  if (currentWorkspace && !currentWorkspacePlan) {
    await ensureWorkspacePlanExists();
  }
  await loadWorkspaceMembers();
  await loadWorkspaceInvites();
  await detectWorkspaceClientsStore();
  await detectWorkspaceActivitiesStore();
  renderSessionUI();
}

function userNeedsOnboarding() {
  if (!canUseTeamFeatures()) return false;
  if (!currentProfile?.full_name) return true;
  if (!currentMembership) return true;
  return false;
}

async function updateProfileName(fullName) {
  if (!canUseTeamFeatures()) return false;

  const { error } = await supabaseClient
    .from("profiles")
    .update({
      full_name: fullName,
      updated_at: nowISO()
    })
    .eq("id", supabaseUser.id);

  if (error) {
    showToast("Ime nije sacuvano.");
    return false;
  }

  await loadProfile();
  renderSessionUI();
  return true;
}

async function createWorkspace(workspaceName) {
  if (!canUseTeamFeatures()) return false;
  clearWorkspaceError();

  const normalizedName = normalizeWorkspaceName(workspaceName);
  if (!normalizedName) {
    showWorkspaceError("Unesi naziv workspace-a.");
    return false;
  }

  if (currentWorkspace?.id || currentMembership?.workspace?.id || currentMembership?.status === "active") {
    showWorkspaceError("Vec si povezan sa workspace-om. Ne mozes da kreiras novi tim iz ovog naloga.");
    return false;
  }

  if (currentPendingInvite?.id) {
    showWorkspaceError("Za ovaj nalog vec postoji pozivnica. Prihvati poziv umesto kreiranja novog tima.");
    return false;
  }

  const existingWorkspace = await findWorkspaceByName(workspaceName);
  if (existingWorkspace) {
    showWorkspaceError(`Workspace sa nazivom "${existingWorkspace.name}" vec postoji. Koristi drugi naziv ili udji kroz pozivnicu.`);
    return false;
  }

  const { data, error } = await supabaseClient
    .from("workspaces")
    .insert({
      name: workspaceName.trim(),
      owner_user_id: supabaseUser.id
    })
    .select("id, name, owner_user_id, created_at, updated_at")
    .single();

  if (error || !data) {
    showWorkspaceError(`Workspace nije kreiran: ${error?.message || "nepoznata greska"}`, error);
    return false;
  }

  const { error: memberError } = await supabaseClient
    .from("workspace_members")
    .insert({
      workspace_id: data.id,
      user_id: supabaseUser.id,
      role: "admin",
      status: "active",
      joined_at: nowISO()
    });

  if (memberError) {
    showWorkspaceError(`Clanstvo u workspace-u nije sacuvano: ${memberError.message || "nepoznata greska"}`, memberError);
    return false;
  }

  currentWorkspace = data;
  isEditingWorkspaceName = false;
  await loadWorkspaceMembership();
  currentWorkspacePlan = null;
  await ensureWorkspacePlanExists();
  await loadWorkspacePlan();
  await loadWorkspaceMembers();
  await loadWorkspaceInvites();
  await detectWorkspaceClientsStore();
  await detectWorkspaceActivitiesStore();
  if (typeof resetClientSourceResolution === "function") {
    resetClientSourceResolution();
    await resolveClientSource();
    migrateClients();
    renderAll();
  }
  renderSessionUI();
  return true;
}

async function updateWorkspaceName(newName) {
  if (!canUseTeamFeatures() || !currentWorkspace?.id) return false;
  clearWorkspaceError();

  const { error } = await supabaseClient
    .from("workspaces")
    .update({
      name: newName,
      updated_at: nowISO()
    })
    .eq("id", currentWorkspace.id);

  if (error) {
    showWorkspaceError(`Naziv workspace-a nije sacuvan: ${error.message || "nepoznata greska"}`, error);
    return false;
  }

  isEditingWorkspaceName = false;
  await loadWorkspaceMembership();
  await loadWorkspaceMembers();
  await loadWorkspaceInvites();
  renderSessionUI();
  return true;
}

async function createWorkspaceInvite(email, role = "member") {
  if (!canUseTeamFeatures() || !currentWorkspace?.id || currentMembership?.role !== "admin") {
    showToast("Samo admin moze da salje pozivnice.");
    return null;
  }

  const normalizedEmail = String(email || "").trim().toLowerCase();
  if (!normalizedEmail) {
    showToast("Unesi email za pozivnicu.");
    return null;
  }

  if (normalizedEmail === String(supabaseUser?.email || "").trim().toLowerCase()) {
    showToast("Ne mozes da pozoves samog sebe.");
    return null;
  }

  const { data, error } = await supabaseClient
    .from("workspace_invites")
    .upsert({
      workspace_id: currentWorkspace.id,
      email: normalizedEmail,
      role: normalizeWorkspaceRole(role),
      invited_by_user_id: supabaseUser.id,
      status: "pending"
    }, { onConflict: "workspace_id,email" })
    .select("id, workspace_id, email, role, status, created_at")
    .single();

  if (error) {
    showToast(`Invite link nije kreiran: ${error.message || "nepoznata greska"}`);
    return null;
  }

  await loadWorkspaceInvites();
  renderSessionUI();
  return data || null;
}

async function acceptPendingInvite() {
  if (!canUseTeamFeatures() || !currentPendingInvite) return false;
  clearWorkspaceError();

  const { error } = await supabaseClient.rpc("accept_workspace_invite", {
    invite_id: currentPendingInvite.id
  });

  if (error) {
    const setupHint = (isMissingRpcError(error) || /row-level security|policy/i.test(error.message || ""))
      ? " Pokreni najnoviji supabase-invite-accept-policy.sql u Supabase SQL editoru."
      : "";
    showWorkspaceError(`Poziv nije prihvacen: ${error.message || "nepoznata greska"}.${setupHint}`, error);
    return false;
  }

  clearRememberedInviteCode();
  await loadWorkspaceMembership();
  await loadPendingInvite();
  currentWorkspacePlan = null;
  await loadWorkspacePlan();
  await loadWorkspaceMembers();
  await loadWorkspaceInvites();
  await detectWorkspaceClientsStore();
  await detectWorkspaceActivitiesStore();
  if (typeof resetClientSourceResolution === "function") {
    resetClientSourceResolution();
    await resolveClientSource();
    migrateClients();
    renderAll();
  }
  renderSessionUI();
  return true;
}

function renderSessionUI() {
  const userName = currentProfile?.full_name || "Moj nalog";
  const userChipLabel =
    currentProfile?.full_name ||
    currentProfile?.email?.split("@")[0] ||
    supabaseUser?.email?.split("@")[0] ||
    "LOGIN";
  const userEmail = supabaseUser?.email || "Nisi prijavljen";
  const workspaceName = currentWorkspace?.name || "Bez workspace-a";
  const roleName = currentMembership?.role ? workspaceRoleLabel(currentMembership.role) : "-";
  const settingsBtn = document.getElementById("openSettingsBtn");
  const settingsBtnTop = document.getElementById("openSettingsBtnTop");
  const headerAuthBtn = document.getElementById("headerAuthBtn");
  const dashboardWorkspaceTitle = document.getElementById("dashboardWorkspaceTitle");
  const clientsViewTitle = document.getElementById("clientsViewTitle");
  const actionsViewTitle = document.getElementById("actionsViewTitle");
  const workspaceActionBtn = document.getElementById("openOnboardingFromSettingsBtn");
  const workspaceSaveBtn = document.getElementById("saveWorkspaceNameBtn");
  const workspaceEditGroup = document.getElementById("workspaceNameEditGroup");
  const workspaceNameInput = document.getElementById("settingsWorkspaceNameInput");
  const inviteComposer = document.getElementById("workspaceInviteComposer");
  const membersList = document.getElementById("workspaceMembersList");
  const membersEmpty = document.getElementById("workspaceMembersEmpty");
  const invitesList = document.getElementById("workspaceInvitesList");
  const invitesEmpty = document.getElementById("workspaceInvitesEmpty");

  setTextIfExists("settingsUserName", userName);
  setTextIfExists("settingsUserEmail", userEmail);
  setTextIfExists("settingsWorkspaceName", workspaceName);
  setTextIfExists("settingsWorkspaceRole", roleName);
  setTextIfExists("settingsPlanName", getCurrentPlanName());
  setTextIfExists("settingsCloudState", isCloudEnabled() ? "Povezan" : "Offline");
  setTextIfExists("accountSheetUserName", userName);
  setTextIfExists("accountSheetUserEmail", userEmail);
  setTextIfExists("accountSheetWorkspaceName", workspaceName);
  setTextIfExists("accountSheetWorkspaceRole", roleName);
  setTextIfExists("accountSheetPlanName", getCurrentPlanName());
  setTextIfExists("accountSheetCloudState", isCloudEnabled() ? "Povezan" : "Offline");
  setTextIfExists(
    "dashboardWorkspaceTitle",
    currentWorkspace
      ? `${workspaceName}${currentMembership?.role === "admin" ? " · admin" : ""}`
      : currentPendingInvite
        ? "Imas pozivnicu za workspace"
        : "Bez workspace-a"
  );
  setTextIfExists("clientsViewTitle", "Klijenti");
  setTextIfExists("actionsViewTitle", `Tim - ${workspaceName}`);
  setTextIfExists(
    "settingsProfileHint",
    isCloudEnabled() ? "Profil je povezan sa Supabase nalogom." : "Prijavi se u Pulse cloud da bismo povezali nalog i workspace."
  );
  setTextIfExists(
    "settingsWorkspaceHint",
    currentWorkspace ? "Workspace je spreman i svi podaci u team verziji ce se vezivati za njega." : "Ako jos nemas tim, onboarding ce ponuditi kreiranje workspace-a."
  );
  setTextIfExists(
    "settingsTeamHint",
    !currentWorkspace
      ? "Prvo kreiraj ili prihvati workspace da bi tim i pozivnice postali dostupni."
      : currentMembership?.role === "admin"
        ? "Kao admin mozes da pozivas nove clanove i pratis status pozivnica."
        : "Ovde vidis ko je vec u timu. Pozivnice salje admin workspace-a."
  );
  if (settingsBtn) {
    settingsBtn.textContent = currentWorkspace ? `Settings - ${workspaceName}` : "Settings";
  }

  if (settingsBtnTop) {
    settingsBtnTop.textContent = "Workspace";
  }

  if (headerAuthBtn) {
    headerAuthBtn.textContent = isCloudEnabled() ? userChipLabel : "LOGIN";
  }

  if (workspaceActionBtn) {
    workspaceActionBtn.textContent =
      !currentWorkspace && currentPendingInvite ? "Prihvati poziv" :
      !currentWorkspace ? "Workspace setup" :
      currentMembership?.role === "admin" ? "Izmeni naziv" :
      "Workspace detalji";
  }

  setTextIfExists(
    "openWorkspaceFromAccountBtn",
    !currentWorkspace && currentPendingInvite ? "Prihvati poziv" :
    !currentWorkspace ? "Workspace setup" :
    "Workspace"
  );

  if (workspaceEditGroup) {
    const canEdit = Boolean(currentWorkspace && currentMembership?.role === "admin" && isEditingWorkspaceName);
    workspaceEditGroup.classList.toggle("hidden", !canEdit);
  }

  if (workspaceNameInput) {
    workspaceNameInput.value = currentWorkspace?.name || "";
  }

  if (workspaceSaveBtn) {
    const canEdit = Boolean(currentWorkspace && currentMembership?.role === "admin" && isEditingWorkspaceName);
    workspaceSaveBtn.classList.toggle("hidden", !canEdit);
  }

  if (inviteComposer) {
    inviteComposer.classList.toggle("hidden", !(currentWorkspace && currentMembership?.role === "admin"));
  }

  if (membersList && membersEmpty) {
    const hasMembers = currentWorkspaceMembers.length > 0;
    membersList.classList.toggle("hidden", !hasMembers);
    membersEmpty.classList.toggle("hidden", hasMembers);
    membersList.innerHTML = hasMembers
      ? currentWorkspaceMembers.map(member => {
          const name = member.profile?.full_name || member.profile?.email || "Clan tima";
          const email = member.profile?.email || "-";
          const role = workspaceRoleLabel(member.role);
          return `
            <div class="key-value-row">
              <div>
                <strong>${escapeHtml(name)}</strong><br />
                <span>${escapeHtml(email)}</span>
              </div>
              <strong>${role}</strong>
            </div>
          `;
        }).join("")
      : "";
  }

  if (invitesList && invitesEmpty) {
    const hasInvites = currentWorkspaceInvites.length > 0;
    invitesList.classList.toggle("hidden", !hasInvites);
    invitesEmpty.classList.toggle("hidden", hasInvites);
    invitesList.innerHTML = hasInvites
      ? currentWorkspaceInvites.map(invite => `
          <div class="key-value-row">
            <div>
              <strong>${escapeHtml(invite.email || "-")}</strong><br />
              <span>${workspaceRoleLabel(invite.role)} - pending</span>
            </div>
            <button class="btn btn-secondary btn-sm" type="button" data-copy-invite-link="${escapeHtml(invite.id)}">Kopiraj link</button>
          </div>
        `).join("")
      : "";

    invitesList.querySelectorAll("[data-copy-invite-link]").forEach(button => {
      button.addEventListener("click", async () => {
        const invite = currentWorkspaceInvites.find(item => item.id === button.dataset.copyInviteLink);
        await copyWorkspaceInviteLink(invite);
      });
    });
  }

  const activeView = document.querySelector(".view.active");
  if (activeView && typeof switchView === "function") {
    switchView(activeView.id);
  }
}

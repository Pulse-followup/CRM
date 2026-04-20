let teamSchemaReady = false;
let currentProfile = null;
let currentWorkspace = null;
let currentMembership = null;
let currentWorkspacePlan = null;
let currentPendingInvite = null;

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
}

function canUseTeamFeatures() {
  return teamSchemaReady && isCloudEnabled();
}

function isMissingRelationError(error) {
  return Boolean(error?.message && /relation .* does not exist/i.test(error.message));
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

async function createProfileIfMissing(defaultFullName = "") {
  if (!canUseTeamFeatures()) return null;

  const email = supabaseUser?.email || "";

  const { error } = await supabaseClient
    .from("profiles")
    .upsert({
      id: supabaseUser.id,
      email,
      full_name: defaultFullName || currentProfile?.full_name || null,
      updated_at: nowISO()
    }, { onConflict: "id" });

  if (error) {
    showToast("Profil nije sacuvan.");
    return null;
  }

  return await loadProfile();
}

async function loadProfile() {
  if (!canUseTeamFeatures()) return null;

  const { data, error } = await supabaseClient
    .from("profiles")
    .select("id, full_name, email, created_at, updated_at")
    .eq("id", supabaseUser.id)
    .maybeSingle();

  if (error) {
    if (!isMissingRelationError(error)) showToast("Profil nije ucitan.");
    currentProfile = null;
    return null;
  }

  currentProfile = data || null;
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
    if (!isMissingRelationError(error)) showToast("Workspace nije ucitan.");
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

  const { data, error } = await supabaseClient
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

  if (error) {
    if (!isMissingRelationError(error)) showToast("Pozivnica nije ucitana.");
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

async function initWorkspaceContext() {
  resetWorkspaceContext();

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

  const { data, error } = await supabaseClient
    .from("workspaces")
    .insert({
      name: workspaceName,
      owner_user_id: supabaseUser.id
    })
    .select("id, name, owner_user_id, created_at, updated_at")
    .single();

  if (error || !data) {
    showToast("Workspace nije kreiran.");
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
    showToast("Clanstvo u workspace-u nije sacuvano.");
    return false;
  }

  currentWorkspace = data;
  await loadWorkspaceMembership();
  await loadWorkspacePlan();
  renderSessionUI();
  return true;
}

async function acceptPendingInvite() {
  if (!canUseTeamFeatures() || !currentPendingInvite) return false;

  const { error: insertError } = await supabaseClient
    .from("workspace_members")
    .upsert({
      workspace_id: currentPendingInvite.workspace_id,
      user_id: supabaseUser.id,
      role: currentPendingInvite.role || "member",
      status: "active",
      joined_at: nowISO()
    }, { onConflict: "workspace_id,user_id" });

  if (insertError) {
    showToast("Poziv nije prihvacen.");
    return false;
  }

  const { error: inviteError } = await supabaseClient
    .from("workspace_invites")
    .update({ status: "accepted" })
    .eq("id", currentPendingInvite.id);

  if (inviteError) {
    showToast("Poziv je prihvacen, ali status invite-a nije osvezen.");
  }

  await loadWorkspaceMembership();
  await loadPendingInvite();
  await loadWorkspacePlan();
  renderSessionUI();
  return true;
}

function renderSessionUI() {
  const userName = currentProfile?.full_name || "Moj nalog";
  const userEmail = supabaseUser?.email || "Nisi prijavljen";
  const workspaceName = currentWorkspace?.name || "Bez workspace-a";
  const roleName = currentMembership?.role === "admin" ? "Admin" : currentMembership?.role === "member" ? "Clan" : "-";
  const settingsBtn = document.getElementById("openSettingsBtn");
  const settingsBtnTop = document.getElementById("openSettingsBtnTop");

  setTextIfExists("settingsUserName", userName);
  setTextIfExists("settingsUserEmail", userEmail);
  setTextIfExists("settingsWorkspaceName", workspaceName);
  setTextIfExists("settingsWorkspaceRole", roleName);
  setTextIfExists("settingsPlanName", getCurrentPlanName());
  setTextIfExists("settingsCloudState", isCloudEnabled() ? "Povezan" : "Offline");
  setTextIfExists(
    "settingsProfileHint",
    isCloudEnabled() ? "Profil je povezan sa Supabase nalogom." : "Prijavi se u Pulse cloud da bismo povezali nalog i workspace."
  );
  setTextIfExists(
    "settingsWorkspaceHint",
    currentWorkspace ? "Workspace je spreman i svi podaci u team verziji ce se vezivati za njega." : "Ako jos nemas tim, onboarding ce ponuditi kreiranje workspace-a."
  );

  if (settingsBtn) {
    settingsBtn.textContent = currentWorkspace ? `Settings · ${workspaceName}` : "Settings";
  }

  if (settingsBtnTop) {
    settingsBtnTop.textContent = currentWorkspace ? workspaceName : "Settings";
  }
}

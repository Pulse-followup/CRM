import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type PropsWithChildren,
} from "react";
import type { Session, User } from "@supabase/supabase-js";
import { getSupabaseClient, getSupabaseConfig } from "../../lib/supabaseClient";
import type {
  CloudProfile,
  CloudWorkspace,
  CloudWorkspaceInvite,
  CloudWorkspaceMember,
  WorkspaceRole,
} from "./types";
import { normalizePlanType, type WorkspacePlanType } from "../subscription/plan";
import { trackEvent } from "../usage/usageTracker";

const ACTIVE_WORKSPACE_KEY = "pulse.activeWorkspaceId.v1";
const INVITE_PARAM = "invite";
const REMEMBERED_INVITE_KEY = "pulse.workspaceInvite.v1";

interface SignInPayload {
  email: string;
  password: string;
}

interface CreateWorkspacePayload {
  name: string;
  planType?: WorkspacePlanType;
}

interface InviteMemberPayload {
  email: string;
  fullName?: string;
  role: WorkspaceRole;
  hourlyRate?: number | null;
  productionRole?: string | null;
}

interface CloudStoreValue {
  isConfigured: boolean;
  isLoading: boolean;
  error: string | null;
  session: Session | null;
  user: User | null;
  profile: CloudProfile | null;
  activeWorkspace: CloudWorkspace | null;
  membership: CloudWorkspaceMember | null;
  workspaces: CloudWorkspace[];
  members: CloudWorkspaceMember[];
  invites: CloudWorkspaceInvite[];
  rememberedInviteId: string;
  signIn: (payload: SignInPayload) => Promise<void>;
  signUp: (payload: SignInPayload) => Promise<void>;
  signOut: () => Promise<void>;
  refreshWorkspace: () => Promise<void>;
  createWorkspace: (payload: CreateWorkspacePayload) => Promise<void>;
  setActiveWorkspaceId: (workspaceId: string) => Promise<void>;
  inviteMember: (
    payload: InviteMemberPayload,
  ) => Promise<CloudWorkspaceInvite | null>;
  acceptInvite: (inviteId?: string) => Promise<void>;
  buildInviteLink: (invite: CloudWorkspaceInvite) => string;
  activateProCode: (code: string) => Promise<void>;
  updateMemberHourlyRate: (
    memberId: string,
    hourlyRate: number | null,
  ) => Promise<void>;
  updateMemberProductionRole: (
    memberId: string,
    productionRole: string | null,
  ) => Promise<void>;
  updateProfileName: (fullName: string) => Promise<void>;
}

const CloudStoreContext = createContext<CloudStoreValue | null>(null);

function getRememberedInviteId() {
  if (typeof window === "undefined") return "";

  try {
    const params = new URLSearchParams(window.location.search);
    const inviteFromUrl = params.get(INVITE_PARAM);

    if (inviteFromUrl) {
      window.localStorage.setItem(REMEMBERED_INVITE_KEY, inviteFromUrl);
      return inviteFromUrl;
    }

    return window.localStorage.getItem(REMEMBERED_INVITE_KEY) || "";
  } catch {
    return "";
  }
}

function clearRememberedInviteId() {
  if (typeof window === "undefined") return;

  try {
    window.localStorage.removeItem(REMEMBERED_INVITE_KEY);
    const url = new URL(window.location.href);
    if (url.searchParams.has(INVITE_PARAM)) {
      url.searchParams.delete(INVITE_PARAM);
      window.history.replaceState({}, document.title, url.toString());
    }
  } catch {
    // Cleanup is best-effort.
  }
}

function getStoredWorkspaceId() {
  if (typeof window === "undefined") return "";

  try {
    return window.localStorage.getItem(ACTIVE_WORKSPACE_KEY) || "";
  } catch {
    return "";
  }
}

function storeWorkspaceId(workspaceId: string) {
  if (typeof window === "undefined") return;

  try {
    window.localStorage.setItem(ACTIVE_WORKSPACE_KEY, workspaceId);
  } catch {
    // localStorage is optional.
  }
}

function normalizeRole(role: string): WorkspaceRole {
  const normalized = String(role || "").toLowerCase();
  if (normalized === "finance") return "finance";
  if (normalized === "admin") return "admin";
  return "member";
}

function normalizeRate(value: number | null | undefined) {
  if (value === undefined || value === null || Number.isNaN(value)) return null;
  return Number(value);
}

function normalizeProductionRole(value: string | null | undefined) {
  const cleanValue = (value || "").trim();
  return cleanValue ? cleanValue.toUpperCase() : null;
}

function getUserEmail(authUser: User | null) {
  return (authUser?.email || "").trim().toLowerCase();
}

async function findPendingInviteForUser(
  supabase: NonNullable<ReturnType<typeof getSupabaseClient>>,
  authUser: User,
  inviteId?: string,
) {
  const userEmail = getUserEmail(authUser);
  if (!userEmail) return null;

  if (inviteId?.trim()) {
    const { data, error } = await supabase
      .from("workspace_invites")
      .select("*")
      .eq("id", inviteId.trim())
      .eq("status", "pending")
      .ilike("email", userEmail)
      .maybeSingle();

    if (error) throw error;
    return (data as CloudWorkspaceInvite | null) || null;
  }

  const { data, error } = await supabase
    .from("workspace_invites")
    .select("*")
    .eq("status", "pending")
    .ilike("email", userEmail)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) throw error;
  return (data as CloudWorkspaceInvite | null) || null;
}


async function findAcceptedInviteForUser(
  supabase: NonNullable<ReturnType<typeof getSupabaseClient>>,
  authUser: User,
) {
  const userEmail = getUserEmail(authUser);
  if (!userEmail) return null;

  const { data, error } = await supabase
    .from("workspace_invites")
    .select("*")
    .eq("status", "accepted")
    .ilike("email", userEmail)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) throw error;
  return (data as CloudWorkspaceInvite | null) || null;
}

function membershipNeedsInviteSync(
  invite: CloudWorkspaceInvite,
  memberships: CloudWorkspaceMember[],
) {
  const member = memberships.find(
    (item) => item.workspace_id === invite.workspace_id,
  );

  if (!member) return true;
  if (member.role !== normalizeRole(invite.role)) return true;
  if (normalizeRate(member.hourly_rate) !== normalizeRate(invite.hourly_rate)) return true;
  if (normalizeProductionRole(member.production_role) !== normalizeProductionRole(invite.production_role)) return true;

  const inviteName = (invite.full_name || "").trim();
  const memberDisplayName = (member.display_name || "").trim();
  const profileName = (member.profile?.full_name || "").trim();

  if (inviteName && memberDisplayName !== inviteName && profileName !== inviteName) return true;

  return false;
}

export function CloudProvider({ children }: PropsWithChildren) {
  const { isConfigured } = getSupabaseConfig();
  const supabase = useMemo(() => getSupabaseClient(), []);
  const [isLoading, setIsLoading] = useState(Boolean(supabase));
  const [error, setError] = useState<string | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<CloudProfile | null>(null);
  const [activeWorkspace, setActiveWorkspace] = useState<CloudWorkspace | null>(
    null,
  );
  const [membership, setMembership] = useState<CloudWorkspaceMember | null>(
    null,
  );
  const [workspaces, setWorkspaces] = useState<CloudWorkspace[]>([]);
  const [members, setMembers] = useState<CloudWorkspaceMember[]>([]);
  const [invites, setInvites] = useState<CloudWorkspaceInvite[]>([]);
  const [rememberedInviteId, setRememberedInviteId] = useState(() =>
    getRememberedInviteId(),
  );
  const loadedWorkspaceUserIdRef = useRef<string>("");

  const ensureProfile = useCallback(
    async (authUser: User) => {
      if (!supabase) return null;

      const email = authUser.email || "";
      const metadataName =
        (authUser.user_metadata?.full_name as string | undefined) ||
        (authUser.user_metadata?.name as string | undefined) ||
        "";

      const { data: existingProfile, error: existingProfileError } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", authUser.id)
        .maybeSingle();

      if (existingProfileError) {
        throw existingProfileError;
      }

      if (existingProfile) {
        const currentName = (existingProfile.full_name || "").trim();
        const safeName = metadataName.trim();

        if (!currentName && safeName) {
          const { data: updatedProfile, error: updateProfileError } = await supabase
            .from("profiles")
            .update({ full_name: safeName, email, updated_at: new Date().toISOString() })
            .eq("id", authUser.id)
            .select("*")
            .single();

          if (updateProfileError) throw updateProfileError;
          return updatedProfile as CloudProfile;
        }

        return existingProfile as CloudProfile;
      }

      const profilePayload = {
        id: authUser.id,
        email,
        full_name: metadataName.trim() || email,
      };

      const { data, error: insertProfileError } = await supabase
        .from("profiles")
        .insert(profilePayload)
        .select("*")
        .single();

      if (insertProfileError) {
        throw insertProfileError;
      }

      return data as CloudProfile;
    },
    [supabase],
  );

  const loadWorkspaceContext = useCallback(
    async (authUser: User | null) => {
      if (!supabase || !authUser) {
        setProfile(null);
        setActiveWorkspace(null);
        setMembership(null);
        setWorkspaces([]);
        setMembers([]);
        setInvites([]);
        return;
      }

      setIsLoading(true);
      setError(null);

      try {
        const loadedProfile = await ensureProfile(authUser);
        setProfile(loadedProfile);
        loadedWorkspaceUserIdRef.current = authUser.id;

        const { data: memberRows, error: memberError } = await supabase
          .from("workspace_members")
          .select("*, profile:profiles(*)")
          .eq("user_id", authUser.id)
          .eq("status", "active")
          .order("created_at", { ascending: true });

        if (memberError) throw memberError;

        const memberships = (memberRows || []) as CloudWorkspaceMember[];
        const pendingInvite = await findPendingInviteForUser(
          supabase,
          authUser,
          rememberedInviteId,
        );

        if (pendingInvite) {
          const { data: acceptedData, error: acceptPendingError } =
            await supabase.rpc("accept_workspace_invite", {
              invite_id: pendingInvite.id,
            });

          if (acceptPendingError) throw acceptPendingError;

          const acceptedWorkspaceId = Array.isArray(acceptedData)
            ? acceptedData[0]?.accepted_workspace_id
            : pendingInvite.workspace_id;

          storeWorkspaceId(acceptedWorkspaceId || pendingInvite.workspace_id);
          clearRememberedInviteId();
          setRememberedInviteId("");
          await loadWorkspaceContext(authUser);
          return;
        }

        const acceptedInvite = await findAcceptedInviteForUser(supabase, authUser);

        if (acceptedInvite && membershipNeedsInviteSync(acceptedInvite, memberships)) {
          const { data: syncedData, error: syncInviteError } = await supabase.rpc(
            "accept_workspace_invite",
            { invite_id: acceptedInvite.id },
          );

          if (syncInviteError) throw syncInviteError;

          const syncedWorkspaceId = Array.isArray(syncedData)
            ? syncedData[0]?.accepted_workspace_id
            : acceptedInvite.workspace_id;

          storeWorkspaceId(syncedWorkspaceId || acceptedInvite.workspace_id);
          await loadWorkspaceContext(authUser);
          return;
        }

        const workspaceIds = memberships.map((item) => item.workspace_id);

        if (!workspaceIds.length) {
          setWorkspaces([]);
          setActiveWorkspace(null);
          setMembership(null);
          setMembers([]);
          setInvites([]);
          return;
        }

        const { data: workspaceRows, error: workspaceError } = await supabase
          .from("workspaces")
          .select("*")
          .in("id", workspaceIds)
          .order("created_at", { ascending: true });

        if (workspaceError) throw workspaceError;

        const loadedWorkspaces = (workspaceRows || []) as CloudWorkspace[];
        const storedWorkspaceId = getStoredWorkspaceId();
        const selectedWorkspace =
          loadedWorkspaces.find(
            (workspace) => workspace.id === storedWorkspaceId,
          ) ||
          loadedWorkspaces[0] ||
          null;
        const selectedMembership = selectedWorkspace
          ? memberships.find(
              (item) => item.workspace_id === selectedWorkspace.id,
            ) || null
          : null;

        setWorkspaces(loadedWorkspaces);
        setActiveWorkspace(selectedWorkspace);
        setMembership(selectedMembership);

        if (!selectedWorkspace) {
          setMembers([]);
          setInvites([]);
          return;
        }

        storeWorkspaceId(selectedWorkspace.id);

        const { data: allMembers, error: allMembersError } = await supabase
          .from("workspace_members")
          .select("*, profile:profiles(*)")
          .eq("workspace_id", selectedWorkspace.id)
          .order("created_at", { ascending: true });

        if (allMembersError) throw allMembersError;

        setMembers((allMembers || []) as CloudWorkspaceMember[]);

        if (selectedMembership?.role === "admin") {
          const { data: inviteRows, error: inviteError } = await supabase
            .from("workspace_invites")
            .select("*")
            .eq("workspace_id", selectedWorkspace.id)
            .order("created_at", { ascending: false });

          if (inviteError) throw inviteError;
          setInvites((inviteRows || []) as CloudWorkspaceInvite[]);
        } else {
          setInvites([]);
        }
      } catch (caughtError) {
        const message =
          caughtError instanceof Error
            ? caughtError.message
            : "Cloud workspace nije ucitan.";
        setError(message);
      } finally {
        setIsLoading(false);
      }
    },
    [ensureProfile, rememberedInviteId, supabase],
  );

  useEffect(() => {
    if (!supabase) {
      setIsLoading(false);
      return;
    }

    let mounted = true;

    supabase.auth.getSession().then(({ data }) => {
      if (!mounted) return;
      const activeSession = data.session || null;
      setSession(activeSession);
      setUser(activeSession?.user || null);
      if (activeSession?.user) {
        void loadWorkspaceContext(activeSession.user);
      } else {
        setIsLoading(false);
      }
    });

    const { data: subscription } = supabase.auth.onAuthStateChange(
      (_event, nextSession) => {
        const nextUser = nextSession?.user || null;
        setSession(nextSession || null);
        setUser(nextUser);

        if (nextUser) {
          if (loadedWorkspaceUserIdRef.current !== nextUser.id) {
            void loadWorkspaceContext(nextUser);
          }
          return;
        }

        loadedWorkspaceUserIdRef.current = "";
        setProfile(null);
        setActiveWorkspace(null);
        setMembership(null);
        setWorkspaces([]);
        setMembers([]);
        setInvites([]);
        setIsLoading(false);
      },
    );

    return () => {
      mounted = false;
      subscription.subscription.unsubscribe();
    };
  }, [loadWorkspaceContext, supabase]);

  const signIn = useCallback(
    async ({ email, password }: SignInPayload) => {
      if (!supabase) throw new Error("Supabase nije konfigurisan.");
      setError(null);
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      if (signInError) {
        setError(signInError.message);
        throw signInError;
      }
      trackEvent("login_success", {
        userEmail: email,
        metadata: { source: "password" },
      });
    },
    [supabase],
  );

  const signUp = useCallback(
    async ({ email, password }: SignInPayload) => {
      if (!supabase) throw new Error("Supabase nije konfigurisan.");
      setError(null);
      const { error: signUpError } = await supabase.auth.signUp({
        email,
        password,
      });
      if (signUpError) {
        setError(signUpError.message);
        throw signUpError;
      }
    },
    [supabase],
  );

  const signOut = useCallback(async () => {
    if (!supabase) return;
    await supabase.auth.signOut();
  }, [supabase]);

  const refreshWorkspace = useCallback(async () => {
    await loadWorkspaceContext(user);
  }, [loadWorkspaceContext, user]);

  const createWorkspace = useCallback(
    async ({ name, planType = "FREE" }: CreateWorkspacePayload) => {
      if (!supabase || !user) throw new Error("Moras biti ulogovan.");
      if (rememberedInviteId)
        throw new Error(
          "Otvoren je invite link. Prvo prihvati poziv u postojeći workspace.",
        );

      const pendingInvite = await findPendingInviteForUser(supabase, user);
      if (pendingInvite) {
        storeWorkspaceId(pendingInvite.workspace_id);
        setRememberedInviteId(pendingInvite.id);
        throw new Error(
          "Za ovaj email postoji poziv u workspace. Prvo prihvati poziv, nemoj kreirati novi workspace.",
        );
      }

      const cleanName = name.trim();
      if (!cleanName) throw new Error("Unesi naziv workspace-a.");

      setError(null);
      const activeProfile = await ensureProfile(user);
      setProfile(activeProfile);

      const { data: workspace, error: workspaceError } = await supabase
        .from("workspaces")
        .insert({ name: cleanName, owner_user_id: user.id, plan_type: normalizePlanType(planType) })
        .select("*")
        .single();

      if (workspaceError) {
        setError(workspaceError.message);
        throw workspaceError;
      }

      const { error: memberError } = await supabase
        .from("workspace_members")
        .insert({
          workspace_id: workspace.id,
          user_id: user.id,
          role: "admin",
          status: "active",
          hourly_rate: null,
          production_role: "ACCOUNT",
          joined_at: new Date().toISOString(),
        });

      if (memberError) {
        setError(memberError.message);
        throw memberError;
      }

      storeWorkspaceId(workspace.id);
      await loadWorkspaceContext(user);
    },
    [ensureProfile, loadWorkspaceContext, rememberedInviteId, supabase, user],
  );

  const activateProCode = useCallback(
    async (code: string) => {
      if (!supabase || !user || !activeWorkspace?.id) {
        throw new Error("Workspace nije aktivan.");
      }

      const cleanCode = code.trim().toUpperCase();
      if (!cleanCode) throw new Error("Unesi PRO kod.");

      const { error: activateError } = await supabase.rpc("activate_pro_code", {
        p_code: cleanCode,
        p_workspace_id: activeWorkspace.id,
      });

      if (activateError) {
        setError(activateError.message);
        throw activateError;
      }

      await loadWorkspaceContext(user);
    },
    [activeWorkspace?.id, loadWorkspaceContext, supabase, user],
  );

  const setActiveWorkspaceId = useCallback(
    async (workspaceId: string) => {
      storeWorkspaceId(workspaceId);
      await loadWorkspaceContext(user);
    },
    [loadWorkspaceContext, user],
  );

  const inviteMember = useCallback(
    async ({
      email,
      fullName,
      role,
      hourlyRate,
      productionRole,
    }: InviteMemberPayload) => {
      if (
        !supabase ||
        !user ||
        !activeWorkspace ||
        membership?.role !== "admin"
      ) {
        throw new Error("Samo admin workspace-a moze da poziva clanove.");
      }

      const cleanEmail = email.trim().toLowerCase();
      if (!cleanEmail) throw new Error("Unesi email clana tima.");

      const cleanFullName = (fullName || "").trim();
      if (!cleanFullName) throw new Error("Unesi ime clana tima.");

      const payload = {
        workspace_id: activeWorkspace.id,
        email: cleanEmail,
        full_name: cleanFullName,
        role: normalizeRole(role),
        hourly_rate: normalizeRate(hourlyRate),
        production_role: normalizeProductionRole(productionRole),
        invited_by_user_id: user.id,
        status: "pending",
      };

      const { data, error: inviteError } = await supabase
        .from("workspace_invites")
        .upsert(payload, { onConflict: "workspace_id,email" })
        .select("*")
        .single();

      if (inviteError) {
        setError(inviteError.message);
        throw inviteError;
      }

      await loadWorkspaceContext(user);
      return data as CloudWorkspaceInvite;
    },
    [activeWorkspace, loadWorkspaceContext, membership?.role, supabase, user],
  );

  const acceptInvite = useCallback(
    async (inviteId = rememberedInviteId) => {
      if (!supabase || !user)
        throw new Error("Prvo se uloguj emailom koji je pozvan.");
      const cleanInviteId = inviteId.trim();
      const pendingInvite = await findPendingInviteForUser(
        supabase,
        user,
        cleanInviteId || undefined,
      );
      if (!pendingInvite)
        throw new Error(
          "Invite kod nije pronadjen ili email ne odgovara pozivu.",
        );

      setError(null);
      const { data, error: acceptError } = await supabase.rpc(
        "accept_workspace_invite",
        {
          invite_id: pendingInvite.id,
        },
      );

      if (acceptError) {
        setError(acceptError.message);
        throw acceptError;
      }

      const acceptedWorkspaceId = Array.isArray(data)
        ? data[0]?.accepted_workspace_id
        : pendingInvite.workspace_id;
      storeWorkspaceId(acceptedWorkspaceId || pendingInvite.workspace_id);

      clearRememberedInviteId();
      setRememberedInviteId("");
      await loadWorkspaceContext(user);
    },
    [loadWorkspaceContext, rememberedInviteId, supabase, user],
  );

  const updateMemberHourlyRate = useCallback(
    async (memberId: string, hourlyRate: number | null) => {
      if (!supabase || !user || membership?.role !== "admin")
        throw new Error("Samo admin moze da menja satnicu.");
      const { error: updateError } = await supabase
        .from("workspace_members")
        .update({ hourly_rate: normalizeRate(hourlyRate) })
        .eq("id", memberId);
      if (updateError) {
        setError(updateError.message);
        throw updateError;
      }
      await loadWorkspaceContext(user);
    },
    [loadWorkspaceContext, membership?.role, supabase, user],
  );

  const updateMemberProductionRole = useCallback(
    async (memberId: string, productionRole: string | null) => {
      if (!supabase || !user || membership?.role !== "admin")
        throw new Error("Samo admin moze da menja operativnu rolu.");
      const { error: updateError } = await supabase
        .from("workspace_members")
        .update({ production_role: normalizeProductionRole(productionRole) })
        .eq("id", memberId);
      if (updateError) {
        setError(updateError.message);
        throw updateError;
      }
      await loadWorkspaceContext(user);
    },
    [loadWorkspaceContext, membership?.role, supabase, user],
  );

  const updateProfileName = useCallback(
    async (fullName: string) => {
      if (!supabase || !user) throw new Error("Moras biti ulogovan.");
      const cleanName = fullName.trim();
      if (!cleanName) throw new Error("Unesi ime.");
      const { error: profileError } = await supabase
        .from("profiles")
        .upsert(
          { id: user.id, email: user.email || "", full_name: cleanName },
          { onConflict: "id" },
        );
      if (profileError) {
        setError(profileError.message);
        throw profileError;
      }
      await supabase.auth.updateUser({
        data: { full_name: cleanName, name: cleanName },
      });
      await loadWorkspaceContext(user);
    },
    [loadWorkspaceContext, supabase, user],
  );

  const buildInviteLink = useCallback((invite: CloudWorkspaceInvite) => {
    if (typeof window === "undefined") return invite.id;
    const url = new URL(window.location.href);
    url.pathname = url.pathname || "/CRM/";
    url.searchParams.set(INVITE_PARAM, invite.id);
    return url.toString();
  }, []);

  const value = useMemo<CloudStoreValue>(
    () => ({
      isConfigured,
      isLoading,
      updateProfileName,
      error,
      session,
      user,
      profile,
      activeWorkspace,
      membership,
      workspaces,
      members,
      invites,
      rememberedInviteId,
      signIn,
      signUp,
      signOut,
      refreshWorkspace,
      createWorkspace,
      setActiveWorkspaceId,
      inviteMember,
      acceptInvite,
      buildInviteLink,
      activateProCode,
      updateMemberHourlyRate,
      updateMemberProductionRole,
    }),
    [
      acceptInvite,
      activeWorkspace,
      activateProCode,
      updateProfileName,
      buildInviteLink,
      createWorkspace,
      error,
      invites,
      isConfigured,
      isLoading,
      members,
      membership,
      profile,
      refreshWorkspace,
      rememberedInviteId,
      session,
      setActiveWorkspaceId,
      signIn,
      signOut,
      signUp,
      user,
      workspaces,
      inviteMember,
      updateMemberHourlyRate,
      updateMemberProductionRole,
    ],
  );

  return (
    <CloudStoreContext.Provider value={value}>
      {children}
    </CloudStoreContext.Provider>
  );
}

export function useCloudStore() {
  const context = useContext(CloudStoreContext);

  if (!context) {
    throw new Error("useCloudStore must be used within CloudProvider");
  }

  return context;
}

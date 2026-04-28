/* ------------------------- STORAGE ------------------------- */
let clientDataSource = "unresolved";
let clientHydrationPromise = null;
let workspaceClientSyncTimer = null;
let projectDataSource = "unresolved";
let projectHydrationPromise = null;
let workspaceProjectSyncTimer = null;
let taskDataSource = "unresolved";
let taskHydrationPromise = null;
let workspaceTaskSyncTimer = null;

function readBillingCache() {
  try {
    const raw = localStorage.getItem(BILLING_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

function loadBilling() {
  billing = readBillingCache() || [];
  return billing.length > 0;
}

function saveBilling() {
  try {
    localStorage.setItem(BILLING_STORAGE_KEY, JSON.stringify(billing));
    return true;
  } catch (error) {
    console.warn("[Pulse Billing] Local save failed.", error);
    return false;
  }
}

function normalizeBillingRecord(record = {}) {
  const now = nowISO();
  const amountRaw = record.amount ?? record.value ?? null;
  const amountNumber = amountRaw === "" || amountRaw === null || typeof amountRaw === "undefined"
    ? null
    : Number(amountRaw);

  return {
    id: String(record.id || createLocalEntityId("billing")),
    clientId: String(record.clientId ?? record.client_id ?? "").trim(),
    projectId: String(record.projectId ?? record.project_id ?? "").trim(),
    taskId: String(record.taskId ?? record.task_id ?? "").trim(),
    description: String(record.description || "").trim(),
    amount: Number.isFinite(amountNumber) ? amountNumber : null,
    currency: String(record.currency || "RSD").trim() || "RSD",
    dueDate: record.dueDate || record.due_date || null,
    status: String(record.status || "draft").trim() || "draft",
    invoiceNumber: String(record.invoiceNumber ?? record.invoice_number ?? "").trim(),
    createdAt: record.createdAt || record.created_at || now,
    updatedAt: record.updatedAt || record.updated_at || record.createdAt || record.created_at || now,
    invoicedAt: record.invoicedAt || record.invoiced_at || null,
    paidAt: record.paidAt || record.paid_at || null
  };
}

function getAllBilling() {
  return (Array.isArray(billing) ? billing : [])
    .map(normalizeBillingRecord)
    .filter(Boolean);
}

function getBillingByTaskId(taskId) {
  if (!taskId) return null;
  return getAllBilling().find(record => String(record.taskId) === String(taskId)) || null;
}

function getBillingByClientId(clientId) {
  if (!clientId) return [];
  return getAllBilling().filter(record => String(record.clientId) === String(clientId));
}

function getBillingByProjectId(projectId) {
  if (!projectId) return [];
  return getAllBilling().filter(record => String(record.projectId) === String(projectId));
}

function createBillingFromTask(taskId, payload = {}) {
  const task = typeof getTaskById === "function" ? getTaskById(taskId) : null;
  if (!task) return null;

  if (task.billingId) {
    return { duplicate: true, record: getAllBilling().find(item => String(item.id) === String(task.billingId)) || null };
  }

  const existing = getBillingByTaskId(task.id);
  if (existing) {
    return { duplicate: true, record: existing };
  }

  const project = typeof getProjectById === "function" ? getProjectById(task.projectId) : null;
  const description = String(payload.description || "").trim();
  const record = normalizeBillingRecord({
    id: createLocalEntityId("billing"),
    clientId: task.clientId,
    projectId: task.projectId,
    taskId: task.id,
    description,
    amount: payload.amount,
    currency: payload.currency || "RSD",
    dueDate: payload.dueDate || null,
    status: "draft",
    invoiceNumber: payload.invoiceNumber || "",
    createdAt: nowISO(),
    updatedAt: nowISO(),
    invoicedAt: null,
    paidAt: null,
    projectName: project?.name || ""
  });

  if (!Array.isArray(billing)) billing = [];
  billing = [record, ...billing.filter(item => String(item.id) !== String(record.id))];
  saveBilling();
  return { duplicate: false, record };
}

function getClientCacheKey() {
  if (currentWorkspace?.id) return `${STORAGE_KEY}:workspace:${currentWorkspace.id}`;
  if (supabaseUser?.id) return `${STORAGE_KEY}:user:${supabaseUser.id}`;
  return `${STORAGE_KEY}:local`;
}

function readClientCache(cacheKey = getClientCacheKey()) {
  try {
    const raw = localStorage.getItem(cacheKey);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

function loadClients() {
  const scopedCache = readClientCache();
  if (scopedCache) {
    clients = scopedCache;
    return true;
  }

  if (!currentWorkspace?.id && !supabaseUser?.id) {
    const legacyCache = readClientCache(STORAGE_KEY);
    if (legacyCache) {
      clients = legacyCache;
      return true;
    }
  }

  clients = [];
  return false;
}

function getProjectCacheKey() {
  if (currentWorkspace?.id) return `${PROJECTS_STORAGE_KEY}:workspace:${currentWorkspace.id}`;
  if (supabaseUser?.id) return `${PROJECTS_STORAGE_KEY}:user:${supabaseUser.id}`;
  return `${PROJECTS_STORAGE_KEY}:local`;
}

function readProjectCache(cacheKey = getProjectCacheKey()) {
  try {
    const raw = localStorage.getItem(cacheKey);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

function loadProjects() {
  const scopedCache = readProjectCache();
  projects = scopedCache || [];
  return projects.length > 0;
}

function saveProjects() {
  const savedLocal = saveProjectsLocalOnly();

  if (typeof canUseWorkspaceProjectStore === "function" && canUseWorkspaceProjectStore()) {
    // Ne blokiramo cloud sync dok projectDataSource jos nije resolve-ovan.
    // Projekat mora da ode u Supabase cim je workspace projects store spreman.
    queueWorkspaceProjectSync();
  }

  return savedLocal;
}

function saveProjectsLocalOnly() {
  try {
    localStorage.setItem(getProjectCacheKey(), JSON.stringify(projects));
    return true;
  } catch (error) {
    console.warn("[Pulse Projects] Local cache save failed.", error);
    return false;
  }
}

function queueWorkspaceProjectSync() {
  if (!(typeof canUseWorkspaceProjectStore === "function" && canUseWorkspaceProjectStore())) return;
  cloudSyncState = "idle";
  syncCloudStatusUI();
  clearTimeout(workspaceProjectSyncTimer);
  workspaceProjectSyncTimer = setTimeout(() => {
    void pushProjectsToWorkspace();
  }, 500);
}

function normalizeProject(project = {}) {
  const rawEstimatedValue = project.estimatedValue ?? project.estimated_value;
  const estimatedValue = Number(rawEstimatedValue);
  const now = nowISO();
  const archived = project.archived === true;
  const createdAt = project.createdAt || project.created_at || now;

  return {
    id: String(project.id || createLocalEntityId("project")),
    clientId: String(project.clientId ?? project.client_id ?? ""),
    name: String(project.name || "").trim(),
    type: String(project.type || "").trim(),
    frequency: String(project.frequency || "").trim(),
    estimatedValue:
      rawEstimatedValue === null ||
      rawEstimatedValue === undefined ||
      rawEstimatedValue === "" ||
      Number.isNaN(estimatedValue)
        ? null
        : estimatedValue,
    status: String(project.status || "").trim(),
    archived,
    archivedAt: archived ? (project.archivedAt || project.archived_at || now) : null,
    createdAt,
    updatedAt: project.updatedAt || project.updated_at || createdAt
  };
}

function migrateProjects() {
  const normalizedProjects = (Array.isArray(projects) ? projects : [])
    .map(normalizeProject)
    .filter(project => project.id && project.clientId);

  const seenProjectKeys = new Set();
  normalizedProjects.forEach(project => {
    seenProjectKeys.add(`id:${String(project.id)}`);
    seenProjectKeys.add(`client-name:${String(project.clientId)}:${String(project.name || "").trim().toLowerCase()}`);
  });

  (Array.isArray(clients) ? clients : []).forEach(client => {
    const legacyProjects = Array.isArray(client?.payment?.workflow?.projects)
      ? client.payment.workflow.projects
      : [];

    legacyProjects.forEach(legacyProject => {
      const normalizedLegacyProject = normalizeProject({
        id: legacyProject.id || createLocalEntityId("project"),
        clientId: String(client.id),
        name: legacyProject.name || "Projekat",
        type: legacyProject.type || "",
        frequency: legacyProject.frequency || "",
        estimatedValue: legacyProject.estimatedValue ?? legacyProject.estimated_value ?? null,
        status:
          legacyProject.status === "done" || legacyProject.status === "canceled"
            ? "zavrsen"
            : (legacyProject.status || "aktivan"),
        archived: legacyProject.archived === true,
        archivedAt: legacyProject.archivedAt || legacyProject.archived_at || null,
        createdAt: legacyProject.createdAt || legacyProject.created_at || client.createdAt || nowISO(),
        updatedAt: legacyProject.updatedAt || legacyProject.updated_at || legacyProject.createdAt || client.createdAt || nowISO()
      });
      const legacyIdKey = `id:${String(normalizedLegacyProject.id)}`;
      const legacyNameKey = `client-name:${String(normalizedLegacyProject.clientId)}:${String(normalizedLegacyProject.name || "").trim().toLowerCase()}`;

      if (seenProjectKeys.has(legacyIdKey) || seenProjectKeys.has(legacyNameKey)) {
        return;
      }

      normalizedProjects.unshift(normalizedLegacyProject);
      seenProjectKeys.add(legacyIdKey);
      seenProjectKeys.add(legacyNameKey);
    });
  });

  projects = normalizedProjects;

  saveProjects();
}

function getProjectsByClientId(clientId) {
  if (!clientId) return [];
  return (Array.isArray(projects) ? projects : [])
    .map(normalizeProject)
    .filter(project => String(project.clientId) === String(clientId));
}

function getProjectById(projectId) {
  if (!projectId) return null;
  return (Array.isArray(projects) ? projects : [])
    .map(normalizeProject)
    .find(project => String(project.id) === String(projectId)) || null;
}

function getTaskCacheKey() {
  if (currentWorkspace?.id) return `${TASKS_STORAGE_KEY}:workspace:${currentWorkspace.id}`;
  if (supabaseUser?.id) return `${TASKS_STORAGE_KEY}:user:${supabaseUser.id}`;
  return `${TASKS_STORAGE_KEY}:local`;
}

function readTaskCache(cacheKey = getTaskCacheKey()) {
  try {
    const raw = localStorage.getItem(cacheKey);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

function loadTasks() {
  const scopedCache = readTaskCache();
  tasks = scopedCache || [];
  return tasks.length > 0;
}

function saveTasks() {
  const savedLocal = saveTasksLocalOnly();

  if (typeof canUseWorkspaceTaskStore === "function" && canUseWorkspaceTaskStore()) {
    // Ne blokiramo cloud sync dok taskDataSource jos nije resolve-ovan.
    queueWorkspaceTaskSync();
  }

  return savedLocal;
}

function saveTasksLocalOnly() {
  try {
    localStorage.setItem(getTaskCacheKey(), JSON.stringify(tasks));
    return true;
  } catch (error) {
    console.warn("[Pulse Tasks] Local cache save failed.", error);
    return false;
  }
}

function queueWorkspaceTaskSync() {
  if (!(typeof canUseWorkspaceTaskStore === "function" && canUseWorkspaceTaskStore())) return;
  cloudSyncState = "idle";
  syncCloudStatusUI();
  clearTimeout(workspaceTaskSyncTimer);
  workspaceTaskSyncTimer = setTimeout(() => {
    void pushTasksToWorkspace();
  }, 500);
}

function normalizeTaskEntity(task = {}) {
  const projectId = String(task.projectId ?? task.project_id ?? "").trim();
  if (!projectId) return null;

  // NOTE: Tasks are allowed to reference projects that only exist in the
  // client workflow store (client.projects). The global tasks store uses
  // localStorage as source of truth in V1, so we should not drop tasks when
  // a matching entry is missing from the global projects store.
  const clientId = String(task.clientId ?? task.client_id ?? "").trim();
  if (!clientId) return null;

  const now = nowISO();
  const createdAt = task.createdAt || task.created_at || now;
  const rawSequenceNumber = Number(task.sequenceNumber ?? task.sequence_number);
  const assignedToRaw = String(task.assignedTo ?? task.assigned_to ?? "").trim();
  const assignedToUserId = task.assignedToUserId ?? task.assigned_to_user_id ?? null;
  const createdByUserId = task.createdByUserId ?? task.created_by_user_id ?? null;
  const delegatedByUserId = task.delegatedByUserId ?? task.delegated_by_user_id ?? null;
  const hasDelegatedByLabel =
    Object.prototype.hasOwnProperty.call(task, "delegatedByLabel") ||
    Object.prototype.hasOwnProperty.call(task, "delegated_by_label");
  const delegatedByLabel = hasDelegatedByLabel
    ? (task.delegatedByLabel ?? task.delegated_by_label)
    : "";
  const hasReviewStatus =
    Object.prototype.hasOwnProperty.call(task, "reviewStatus") ||
    Object.prototype.hasOwnProperty.call(task, "review_status");
    const rawReviewStatus = hasReviewStatus
      ? String(task.reviewStatus ?? task.review_status ?? "").trim()
      : "";
    const status = String(task.status || "dodeljen").trim() || "dodeljen";
    const reviewStatus = rawReviewStatus || (status === "zavrsen" ? "pending_review" : "");
    const archived = task.archived === true || task.archived === "true";
    const archivedAt = task.archivedAt || task.archived_at || null;
    const billingId = task.billingId ?? task.billing_id ?? null;

  return {
    id: String(task.id || createLocalEntityId("task")),
    projectId,
    clientId,
    sequenceNumber: Number.isFinite(rawSequenceNumber) && rawSequenceNumber > 0 ? rawSequenceNumber : null,
    actionType: String(task.actionType ?? task.action_type ?? "").trim(),
    title: String(task.title || "").trim(),
    description: String(task.description || "").trim(),
    assignedTo: assignedToRaw,
    assignedToUserId: assignedToUserId ? String(assignedToUserId).trim() : null,
    assignedToLabel: String(task.assignedToLabel ?? task.assigned_to_label ?? assignedToRaw ?? "").trim(),
      createdByUserId: createdByUserId ? String(createdByUserId).trim() : null,
      createdByLabel: String(task.createdByLabel ?? task.created_by_label ?? "").trim(),
      delegatedByUserId: delegatedByUserId ? String(delegatedByUserId).trim() : null,
      delegatedByLabel: delegatedByLabel === null ? null : String(delegatedByLabel || "").trim(),
      dueDate: task.dueDate || task.due_date || null,
      status,
      reviewStatus,
      billingId: billingId ? String(billingId).trim() : null,
      archived,
      archivedAt,
      createdAt,
      updatedAt: task.updatedAt || task.updated_at || createdAt
    };
  }

function getNextTaskSequenceNumber(projectId, excludedTaskId = "") {
  const maxSequence = (Array.isArray(tasks) ? tasks : []).reduce((max, task) => {
    if (String(task.projectId ?? task.project_id ?? "") !== String(projectId)) return max;
    if (excludedTaskId && String(task.id) === String(excludedTaskId)) return max;
    const sequenceNumber = Number(task.sequenceNumber ?? task.sequence_number);
    return Number.isFinite(sequenceNumber) && sequenceNumber > max ? sequenceNumber : max;
  }, 0);

  return maxSequence + 1;
}

function migrateTasks() {
  const normalizedTasks = (Array.isArray(tasks) ? tasks : [])
    .map(normalizeTaskEntity)
    .filter(Boolean);

  const maxByProject = {};
  normalizedTasks.forEach(task => {
    if (task.sequenceNumber) {
      maxByProject[task.projectId] = Math.max(maxByProject[task.projectId] || 0, task.sequenceNumber);
    }
  });

  normalizedTasks
    .filter(task => !task.sequenceNumber)
    .sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt))
    .forEach(task => {
      const nextSequence = (maxByProject[task.projectId] || 0) + 1;
      task.sequenceNumber = nextSequence;
      maxByProject[task.projectId] = nextSequence;
    });

  tasks = normalizedTasks;
  saveTasks();
}

function getTasksByProjectId(projectId) {
  if (!projectId) return [];
  return (Array.isArray(tasks) ? tasks : [])
    .map(normalizeTaskEntity)
    .filter(task => task && task.archived !== true && String(task.projectId) === String(projectId));
}

function getTasksByClientId(clientId) {
  if (!clientId) return [];
  return (Array.isArray(tasks) ? tasks : [])
    .map(normalizeTaskEntity)
    .filter(task => task && task.archived !== true && String(task.clientId) === String(clientId));
}

function getAllTasks() {
  return (Array.isArray(tasks) ? tasks : [])
    .map(normalizeTaskEntity)
    .filter(task => task && task.archived !== true);
}

function getTaskById(taskId) {
  if (!taskId) return null;
  return (Array.isArray(tasks) ? tasks : [])
    .map(normalizeTaskEntity)
    .find(task => task && String(task.id) === String(taskId)) || null;
}

function saveTask(task = {}) {
  if (!Array.isArray(tasks)) tasks = [];

  const existingTask = task.id
    ? tasks.find(item => String(item.id) === String(task.id))
    : null;
  const timestamp = nowISO();
  const projectId = String(task.projectId ?? task.project_id ?? "").trim();
  const sequenceNumber = existingTask?.sequenceNumber || task.sequenceNumber || getNextTaskSequenceNumber(projectId, task.id || "");
  const normalizedTask = normalizeTaskEntity({
    ...(existingTask || {}),
    ...task,
    sequenceNumber,
    createdAt: task.createdAt || existingTask?.createdAt || timestamp,
    updatedAt: timestamp
  });

  if (!normalizedTask) {
    console.warn("[Pulse Tasks] Task nije sacuvan: projectId/clientId nisu validni.", task);
    return null;
  }

  const idx = tasks.findIndex(item => String(item.id) === String(normalizedTask.id));
  if (idx === -1) {
    tasks.unshift(normalizedTask);
  } else {
    tasks[idx] = {
      ...tasks[idx],
      ...normalizedTask,
      id: tasks[idx].id,
      projectId: tasks[idx].projectId,
      clientId: tasks[idx].clientId,
      createdAt: tasks[idx].createdAt || normalizedTask.createdAt
    };
  }

  return saveTasks() ? normalizedTask : null;
}

function updateTaskStatus(taskId, newStatus) {
  if (!taskId || !newStatus || !Array.isArray(tasks)) return null;

  const idx = tasks.findIndex(task => String(task.id) === String(taskId));
  if (idx === -1) return null;

  const updatedTask = normalizeTaskEntity({
    ...tasks[idx],
    status: newStatus,
    updatedAt: nowISO()
  });
  if (!updatedTask) return null;

  tasks[idx] = {
    ...tasks[idx],
    ...updatedTask,
    id: tasks[idx].id,
    projectId: tasks[idx].projectId,
    clientId: tasks[idx].clientId,
    sequenceNumber: tasks[idx].sequenceNumber || updatedTask.sequenceNumber,
    createdAt: tasks[idx].createdAt || updatedTask.createdAt
  };

  return saveTasks() ? updatedTask : null;
}

function resetProjectSourceResolution() {
  projectDataSource = "unresolved";
  projectHydrationPromise = null;
}

async function persistProjects(options = {}) {
  const { immediate = false } = options;
  const savedLocal = saveProjectsLocalOnly();

  if (typeof canUseWorkspaceProjectStore === "function" && canUseWorkspaceProjectStore()) {
    if (immediate) {
      const pushed = await pushProjectsToWorkspace();
      if (!pushed) {
        console.warn("[Pulse Projects] PROJECT CLOUD PUSH FAILED", {
          workspaceId: currentWorkspace?.id || null,
          projectDataSource
        });
      }
      return pushed;
    }
    queueWorkspaceProjectSync();
  }

  return savedLocal;
}

async function resolveProjectSource(options = {}) {
  const { silent = false } = options;
  if (projectHydrationPromise) return projectHydrationPromise;

  projectHydrationPromise = (async () => {
    if (typeof canUseWorkspaceProjectStore === "function" && canUseWorkspaceProjectStore()) {
      const hydrated = await hydrateProjectsFromWorkspace({ silent: true });
      if (hydrated) {
        projectDataSource = "workspace";
        console.info("[Pulse Projects] Source resolved: workspace projects table.", {
          workspaceId: currentWorkspace?.id || null,
          count: projects.length
        });
        return projectDataSource;
      }

      if (!silent) {
        console.warn("[Pulse Projects] Workspace projekti nisu ucitani, koristim lokalni cache.");
      }
    }

    const loadedCache = loadProjects();
    projectDataSource = loadedCache ? "local-cache" : "empty";
    console.info("[Pulse Projects] Source resolved:", projectDataSource, {
      cacheKey: getProjectCacheKey(),
      count: projects.length
    });
    return projectDataSource;
  })().finally(() => {
    projectHydrationPromise = null;
  });

  return projectHydrationPromise;
}

function mapProjectRowToLocal(row = {}) {
  return normalizeProject({
    id: row.id,
    client_id: row.client_id,
    name: row.name,
    type: row.type,
    frequency: row.frequency,
    estimated_value: row.estimated_value,
    status: row.status,
    archived: row.archived,
    archived_at: row.archived_at,
    created_at: row.created_at,
    updated_at: row.updated_at
  });
}

function mapProjectToWorkspaceRow(project = {}) {
  const normalizedProject = normalizeProject(project);
  return {
    id: normalizedProject.id,
    workspace_id: currentWorkspace.id,
    client_id: Number(normalizedProject.clientId),
    name: normalizedProject.name,
    type: normalizedProject.type || "",
    frequency: normalizedProject.frequency || "",
    estimated_value: normalizedProject.estimatedValue,
    status: normalizedProject.status || "",
    archived: normalizedProject.archived === true,
    archived_at: normalizedProject.archived ? (normalizedProject.archivedAt || normalizedProject.updatedAt || nowISO()) : null,
    created_at: normalizedProject.createdAt || nowISO(),
    updated_at: normalizedProject.updatedAt || nowISO()
  };
}

function mergeProjectsById(localItems = [], remoteItems = []) {
  const merged = new Map();

  (Array.isArray(localItems) ? localItems : [])
    .map(normalizeProject)
    .filter(Boolean)
    .forEach(project => merged.set(String(project.id), project));

  // Remote ima prednost za isti id, ali lokalni projekti koji jos nisu u cloudu ostaju.
  (Array.isArray(remoteItems) ? remoteItems : [])
    .map(normalizeProject)
    .filter(Boolean)
    .forEach(project => merged.set(String(project.id), project));

  return Array.from(merged.values()).sort((a, b) => {
    const aTime = new Date(a.createdAt || 0).getTime();
    const bTime = new Date(b.createdAt || 0).getTime();
    return bTime - aTime;
  });
}

async function hydrateProjectsFromWorkspace(options = {}) {
  if (!(typeof canUseWorkspaceProjectStore === "function" && canUseWorkspaceProjectStore())) return false;
  const { silent = false } = options;
  const localBeforeHydrate = readProjectCache() || (Array.isArray(projects) ? projects : []);

  const { data, error } = await supabaseClient
    .from("projects")
    .select("*")
    .eq("workspace_id", currentWorkspace.id)
    .order("created_at", { ascending: false });

  if (error) {
    if (!silent) {
      console.warn("[Pulse Projects] Workspace projekti nisu ucitani.", error);
    }
    return false;
  }

  const remoteProjects = (Array.isArray(data) ? data.map(mapProjectRowToLocal) : []).filter(Boolean);
  const localProjects = (Array.isArray(localBeforeHydrate) ? localBeforeHydrate : []).map(normalizeProject).filter(Boolean);
  const remoteIds = new Set(remoteProjects.map(project => String(project.id)));
  const localOnlyProjects = localProjects.filter(project => !remoteIds.has(String(project.id)));

  projects = mergeProjectsById(localProjects, remoteProjects);
  projectDataSource = "workspace";
  saveProjectsLocalOnly();

  if (localOnlyProjects.length) {
    console.warn("[Pulse Projects] Lokalni projekti nisu bili u cloudu; pokusavam push.", {
      count: localOnlyProjects.length,
      ids: localOnlyProjects.map(project => project.id)
    });
    await pushProjectsToWorkspace();
  }

  return true;
}

async function pushProjectsToWorkspace() {
  if (!(typeof canUseWorkspaceProjectStore === "function" && canUseWorkspaceProjectStore())) return false;
  if (!supabaseClient || !currentWorkspace?.id) return false;

  const { data: existingRows, error: existingError } = await supabaseClient
    .from("projects")
    .select("id")
    .eq("workspace_id", currentWorkspace.id);

  if (existingError) {
    console.error("[Pulse Projects] pushProjectsToWorkspace existing rows failed", existingError);
    return false;
  }

  const existingById = new Set((Array.isArray(existingRows) ? existingRows : []).map(row => String(row.id)));
  const payload = projects.map(mapProjectToWorkspaceRow);
  const rowsToInsert = payload.filter(row => !existingById.has(String(row.id)));
  const rowsToUpdate = payload.filter(row => existingById.has(String(row.id)));

  if (rowsToInsert.length) {
    const { error } = await supabaseClient
      .from("projects")
      .insert(rowsToInsert);

    if (error) {
      console.error("[Pulse Projects] pushProjectsToWorkspace insert failed", error, rowsToInsert);
      return false;
    }
  }

  for (const row of rowsToUpdate) {
    const { error } = await supabaseClient
      .from("projects")
      .update(row)
      .eq("id", row.id)
      .eq("workspace_id", currentWorkspace.id);

    if (error) {
      console.error("[Pulse Projects] pushProjectsToWorkspace update failed", error, row);
      return false;
    }
  }

  projectDataSource = "workspace";
  cloudSyncState = "synced";
  syncCloudStatusUI("Sinhronizovano");
  return true;
}

function resetTaskSourceResolution() {
  taskDataSource = "unresolved";
  taskHydrationPromise = null;
}

async function persistTasks(options = {}) {
  const { immediate = false } = options;
  const savedLocal = saveTasksLocalOnly();
  if (savedLocal) {
    console.info("[Pulse Tasks] TASK LOCAL SAVE OK", {
      cacheKey: getTaskCacheKey(),
      count: Array.isArray(tasks) ? tasks.length : 0
    });
  }

  // Pre taskova prvo guramo projekte, jer tasks.project_id ima FK na projects.id u Supabase.
  if (typeof pushProjectsToWorkspace === "function" && typeof canUseWorkspaceProjectStore === "function" && canUseWorkspaceProjectStore()) {
    await pushProjectsToWorkspace();
  }

  if (typeof canUseWorkspaceTaskStore === "function" && canUseWorkspaceTaskStore()) {
    if (immediate) {
      const pushed = await pushTasksToWorkspace();
      if (pushed) {
        console.info("[Pulse Tasks] TASK CLOUD PUSH OK", {
          workspaceId: currentWorkspace?.id || null,
          count: Array.isArray(tasks) ? tasks.length : 0
        });
      } else {
        console.warn("[Pulse Tasks] TASK CLOUD PUSH FAILED", {
          workspaceId: currentWorkspace?.id || null,
          taskDataSource
        });
      }
      return pushed;
    }
    queueWorkspaceTaskSync();
  }

  return savedLocal;
}

async function resolveTaskSource(options = {}) {
  const { silent = false } = options;
  if (taskHydrationPromise) return taskHydrationPromise;

  taskHydrationPromise = (async () => {
    if (typeof canUseWorkspaceTaskStore === "function" && canUseWorkspaceTaskStore()) {
      const hydrated = await hydrateTasksFromWorkspace({ silent: true });
      if (hydrated) {
        taskDataSource = "workspace";
        console.info("[Pulse Tasks] Source resolved: workspace tasks table.", {
          workspaceId: currentWorkspace?.id || null,
          count: tasks.length
        });
        return taskDataSource;
      }

      if (!silent) {
        console.warn("[Pulse Tasks] Workspace taskovi nisu ucitani, koristim lokalni cache.");
      }
    }

    const loadedCache = loadTasks();
    taskDataSource = loadedCache ? "local-cache" : "empty";
    console.info("[Pulse Tasks] Source resolved:", taskDataSource, {
      cacheKey: getTaskCacheKey(),
      count: tasks.length
    });
    return taskDataSource;
  })().finally(() => {
    taskHydrationPromise = null;
  });

  return taskHydrationPromise;
}

function mapTaskRowToLocal(row = {}) {
  return normalizeTaskEntity({
    id: row.id,
    project_id: row.project_id,
    client_id: row.client_id,
    sequence_number: row.sequence_number,
    action_type: row.action_type,
    title: row.title,
    description: row.description,
    assigned_to: row.assigned_to_user_id || "",
    assigned_to_user_id: row.assigned_to_user_id,
    assigned_to_label: row.assigned_to_label || "",
    created_by_user_id: row.created_by_user_id,
    created_by_label: row.created_by_label || "",
    delegated_by_user_id: row.delegated_by_user_id,
    delegated_by_label: row.delegated_by_label,
    due_date: row.due_date,
    status: row.status,
    review_status: row.review_status,
    billing_id: row.billing_id,
    archived: row.archived,
    archived_at: row.archived_at,
    created_at: row.created_at,
    updated_at: row.updated_at
  });
}

function mapTaskToWorkspaceRow(task = {}) {
  const normalizedTask = normalizeTaskEntity(task);
  if (!normalizedTask) return null;

  return {
    id: normalizedTask.id,
    workspace_id: currentWorkspace.id,
    client_id: Number(normalizedTask.clientId),
    project_id: normalizedTask.projectId,
    sequence_number: normalizedTask.sequenceNumber,
    action_type: normalizedTask.actionType || "",
    title: normalizedTask.title || "",
    description: normalizedTask.description || "",
    assigned_to_user_id: normalizedTask.assignedToUserId || null,
    assigned_to_label: normalizedTask.assignedToLabel || "",
    created_by_user_id: normalizedTask.createdByUserId || null,
    created_by_label: normalizedTask.createdByLabel || "",
    delegated_by_user_id: normalizedTask.delegatedByUserId || null,
    delegated_by_label: normalizedTask.delegatedByLabel || null,
    due_date: normalizedTask.dueDate || null,
    status: normalizedTask.status || "dodeljen",
    review_status: normalizedTask.reviewStatus || null,
    billing_id: normalizedTask.billingId || null,
    archived: normalizedTask.archived === true,
    archived_at: normalizedTask.archivedAt || null,
    created_at: normalizedTask.createdAt || nowISO(),
    updated_at: normalizedTask.updatedAt || nowISO()
  };
}

function mergeTasksById(localItems = [], remoteItems = []) {
  const merged = new Map();

  (Array.isArray(localItems) ? localItems : [])
    .map(normalizeTaskEntity)
    .filter(Boolean)
    .forEach(task => merged.set(String(task.id), task));

  // Remote ima prednost za isti id, ali lokalni taskovi koji jos nisu u cloudu ostaju.
  (Array.isArray(remoteItems) ? remoteItems : [])
    .map(normalizeTaskEntity)
    .filter(Boolean)
    .forEach(task => merged.set(String(task.id), task));

  return Array.from(merged.values()).sort((a, b) => {
    const aTime = new Date(a.createdAt || 0).getTime();
    const bTime = new Date(b.createdAt || 0).getTime();
    return bTime - aTime;
  });
}

async function hydrateTasksFromWorkspace(options = {}) {
  if (!(typeof canUseWorkspaceTaskStore === "function" && canUseWorkspaceTaskStore())) return false;
  const { silent = false } = options;
  const localBeforeHydrate = readTaskCache() || (Array.isArray(tasks) ? tasks : []);

  const { data, error } = await supabaseClient
    .from("tasks")
    .select("*")
    .eq("workspace_id", currentWorkspace.id)
    .order("created_at", { ascending: false });

  if (error) {
    if (!silent) {
      console.warn("[Pulse Tasks] Workspace taskovi nisu ucitani.", error);
    }
    return false;
  }

  const remoteTasks = (Array.isArray(data) ? data.map(mapTaskRowToLocal) : []).filter(Boolean);
  const localTasks = (Array.isArray(localBeforeHydrate) ? localBeforeHydrate : []).map(normalizeTaskEntity).filter(Boolean);
  const remoteIds = new Set(remoteTasks.map(task => String(task.id)));
  const localOnlyTasks = localTasks.filter(task => !remoteIds.has(String(task.id)));

  tasks = mergeTasksById(localTasks, remoteTasks);
  taskDataSource = "workspace";
  saveTasksLocalOnly();

  if (localOnlyTasks.length) {
    console.warn("[Pulse Tasks] Lokalni taskovi nisu bili u cloudu; pokusavam push.", {
      count: localOnlyTasks.length,
      ids: localOnlyTasks.map(task => task.id)
    });
    await pushTasksToWorkspace();
  }

  return true;
}

async function pushTasksToWorkspace() {
  if (!(typeof canUseWorkspaceTaskStore === "function" && canUseWorkspaceTaskStore())) return false;
  if (!supabaseClient || !currentWorkspace?.id) return false;

  const { data: existingRows, error: existingError } = await supabaseClient
    .from("tasks")
    .select("id")
    .eq("workspace_id", currentWorkspace.id);

  if (existingError) {
    console.error("[Pulse Tasks] pushTasksToWorkspace existing rows failed", existingError);
    return false;
  }

  const existingById = new Set((Array.isArray(existingRows) ? existingRows : []).map(row => String(row.id)));
  const payload = tasks.map(mapTaskToWorkspaceRow).filter(Boolean);
  const rowsToInsert = payload.filter(row => !existingById.has(String(row.id)));
  const rowsToUpdate = payload.filter(row => existingById.has(String(row.id)));

  if (rowsToInsert.length) {
    const { error } = await supabaseClient
      .from("tasks")
      .insert(rowsToInsert);

    if (error) {
      console.error("[Pulse Tasks] pushTasksToWorkspace insert failed", error, rowsToInsert);
      return false;
    }
  }

  for (const row of rowsToUpdate) {
    const { error } = await supabaseClient
      .from("tasks")
      .update(row)
      .eq("id", row.id)
      .eq("workspace_id", currentWorkspace.id);

    if (error) {
      console.error("[Pulse Tasks] pushTasksToWorkspace update failed", error, row);
      return false;
    }
  }

  taskDataSource = "workspace";
  cloudSyncState = "synced";
  syncCloudStatusUI("Sinhronizovano");
  return true;
}

function saveClients() {
  if (typeof canUseWorkspaceClientStore === "function" && canUseWorkspaceClientStore()) {
    if (clientDataSource !== "workspace") {
      console.warn("[Pulse Clients] Workspace save blocked before workspace source is resolved.", {
        clientDataSource,
        workspaceId: currentWorkspace?.id || null
      });
      showToast("Klijenti nisu sacuvani: workspace podaci jos nisu ucitani.");
      return false;
    }
    saveClientsLocalOnly();
    queueWorkspaceClientSync();
    return true;
  }

  saveClientsLocalOnly();
  return true;
}

function saveClientsLocalOnly() {
  try {
    localStorage.setItem(getClientCacheKey(), JSON.stringify(clients));
  } catch (error) {
    console.warn("[Pulse Clients] Local cache save failed.", error);
  }
}

function queueWorkspaceClientSync() {
  if (!(typeof canUseWorkspaceClientStore === "function" && canUseWorkspaceClientStore())) return;
  cloudSyncState = "idle";
  syncCloudStatusUI();
  clearTimeout(workspaceClientSyncTimer);
  workspaceClientSyncTimer = setTimeout(() => {
    pushClientsToWorkspace();
  }, 500);
}

function resetClientSourceResolution() {
  clientDataSource = "unresolved";
  clientHydrationPromise = null;
  syncClientCreateAvailability();
}

function isClientWorkspaceSourceReady() {
  return Boolean(
    clientDataSource === "workspace" &&
    typeof canUseWorkspaceClientStore === "function" &&
    canUseWorkspaceClientStore()
  );
}

function syncClientCreateAvailability() {
  const isReady = isClientWorkspaceSourceReady();
  const title = isReady
    ? ""
    : "Workspace klijenti se jos ucitavaju.";

  ["addClientBtnTop", "addClientBtnMobilePanel"].forEach(id => {
    const button = document.getElementById(id);
    if (!button) return;
    button.disabled = !isReady;
    button.classList.toggle("is-disabled", !isReady);
    if (title) {
      button.setAttribute("title", title);
    } else {
      button.removeAttribute("title");
    }
  });
}

async function ensureClientSourceReady(options = {}) {
  const { requireWorkspace = false, silent = false } = options;
  const workspaceStoreAvailable =
    typeof canUseWorkspaceClientStore === "function" && canUseWorkspaceClientStore();

  if (workspaceStoreAvailable && clientDataSource !== "workspace") {
    await resolveClientSource({ silent: true });
  } else if (clientHydrationPromise) {
    await clientHydrationPromise;
  }

  if (workspaceStoreAvailable && clientDataSource !== "workspace") {
    if (!silent) {
      showToast("Klijenti nisu spremni za cuvanje. Osvezi workspace i pokusaj ponovo.");
    }
    console.warn("[Pulse Clients] Workspace source is not ready for persistence.", {
      clientDataSource,
      workspaceId: currentWorkspace?.id || null
    });
    syncClientCreateAvailability();
    return false;
  }

  if (requireWorkspace && !workspaceStoreAvailable) {
    if (!silent) {
      showToast("Workspace baza za klijente nije dostupna.");
    }
    syncClientCreateAvailability();
    return false;
  }

  syncClientCreateAvailability();
  return true;
}

async function persistClients(options = {}) {
  const { immediate = false, requireWorkspace = false } = options;
  const sourceReady = await ensureClientSourceReady({ requireWorkspace });
  if (!sourceReady) return false;

  saveClientsLocalOnly();

  if (typeof canUseWorkspaceClientStore === "function" && canUseWorkspaceClientStore()) {
    if (immediate) {
      return await pushClientsToWorkspace();
    }
    queueWorkspaceClientSync();
  }

  return true;
}

async function resolveClientSource(options = {}) {
  const { silent = false } = options;
  if (clientHydrationPromise) return clientHydrationPromise;

  clientHydrationPromise = (async () => {
    if (typeof canUseWorkspaceClientStore === "function" && canUseWorkspaceClientStore()) {
      const hydrated = await hydrateClientsFromWorkspace({ pushIfEmpty: false, silent: true });
      if (hydrated) {
        clientDataSource = "workspace";
        console.info("[Pulse Clients] Source resolved: workspace clients table.", {
          workspaceId: currentWorkspace?.id || null,
          count: clients.length
        });
        syncClientCreateAvailability();
        return clientDataSource;
      }

      if (!silent) {
        showToast("Workspace klijenti nisu ucitani, prikazujem lokalni cache.");
      }
    } else if (typeof getWorkspaceClientsProbe === "function" && canUseTeamFeatures() && currentWorkspace?.id) {
      const probe = getWorkspaceClientsProbe();
      if (!probe.ok) {
        console.warn("[Pulse Clients] Workspace source unavailable, falling back to local cache.", {
          workspaceId: currentWorkspace?.id || null,
          reason: probe.code,
          message: probe.message
        });
      }
    }

    const loadedCache = loadClients();
    clientDataSource = loadedCache ? "local-cache" : "empty";
    console.info("[Pulse Clients] Source resolved:", clientDataSource, {
      cacheKey: getClientCacheKey(),
      count: clients.length
    });
    syncClientCreateAvailability();
    return clientDataSource;
  })().finally(() => {
    clientHydrationPromise = null;
    syncClientCreateAvailability();
  });

  return clientHydrationPromise;
}

function mapClientRowToLocal(row) {
  const payment = row.payment && typeof row.payment === "object"
    ? row.payment
    : {};
  const rowCommercialInputs = row.commercial_inputs && typeof row.commercial_inputs === "object"
    ? row.commercial_inputs
    : {};
  const commercialInputs = getClientCommercialInputs({
    ...rowCommercialInputs,
    payment,
    businessType: row.business_type || rowCommercialInputs.businessType || ""
  });

  return {
    id: Number(row.id),
    workspaceId: row.workspace_id || "",
    name: row.name || "",
    ownerUserId: row.owner_user_id || "",
    createdByUserId: row.created_by_user_id || "",
    clientAddress: row.client_address || "",
    clientCity: row.client_city || "",
    city: row.client_city || "",
    address: row.client_address || "",
    contacts: getClientContacts({
      contacts: row.contacts,
      payment,
      contactPerson: row.contact_person || "",
      contactRole: row.contact_role || "",
      contactEmail: row.contact_email || "",
      contactPhone: row.contact_phone || ""
    }),
    contactPerson: row.contact_person || "",
    contactRole: row.contact_role || "",
    contactPhone: row.contact_phone || "",
    contactEmail: row.contact_email || "",
    companySize: row.company_size || "",
    decisionModel: row.decision_model || "",
    revenueDriverPrimary: row.revenue_driver_primary || "",
    leadTemperature: row.lead_temperature || "",
    budgetStatus: row.budget_status || "",
    urgencyLevel: row.urgency_level || "",
    pilotReadiness: row.pilot_readiness || "",
    relationshipStrength: row.relationship_strength || "",
    lastActionNote: row.last_action_note || "",
    nextStepText: row.next_step_text || "",
    nextStepType: row.next_step_type || "",
    nextStepDate: row.next_step_date || "",
    dealValue: Number(row.deal_value || 0),
    dealProbability: row.deal_probability || "",
    expectedDecisionDate: row.expected_decision_date || "",
    businessType: commercialInputs.businessType,
    revenueBand: commercialInputs.revenueBand,
    employeeCount: commercialInputs.employeeCount,
    locationCount: commercialInputs.locationCount,
    decisionLevel: commercialInputs.decisionLevel,
    relationshipLevel: commercialInputs.relationshipLevel,
    innovationReady: commercialInputs.innovationReady,
    clientType: row.client_type || "",
    internationalFlag: row.international_flag || "",
    revenueFocusTags: Array.isArray(row.revenue_focus_tags) ? row.revenue_focus_tags : [],
    revenueDetail: row.revenue_detail || "",
    retailLocationType: row.retail_location_type || "",
    retailAssortmentType: row.retail_assortment_type || "",
    retailPromoPotential: row.retail_promo_potential || "",
    pharmacyFocus: row.pharmacy_focus || "",
    pharmacyLocations: row.pharmacy_locations || "",
    pharmacyCentralization: row.pharmacy_centralization || "",
    pharmacyTraffic: row.pharmacy_traffic || "",
    pharmacySuppliers: row.pharmacy_suppliers || "",
    stage: row.stage || "new",
    lastActionAt: row.last_action_at || row.created_at || nowISO(),
    lastActionHuman: row.last_action_human || "Kreiran klijent",
    payment: {
      lastInvoiceDate: payment.lastInvoiceDate || null,
      lastReminderDate: payment.lastReminderDate || null,
      lastPaidDate: payment.lastPaidDate || null,
      paymentSpeed: payment.paymentSpeed || null,
      workflow: payment.workflow && typeof payment.workflow === "object" ? payment.workflow : {}
    },
    activityLog: Array.isArray(row.activity_log) ? row.activity_log : [],
    createdAt: row.created_at || nowISO()
  };
}

function mapClientToWorkspaceRow(client, existingRemoteRow = null) {
  const existingCreatedByUserId = existingRemoteRow?.created_by_user_id || "";
  const existingOwnerUserId = existingRemoteRow?.owner_user_id || "";
  const contacts = getClientContacts(client);
  const commercialInputs = getClientCommercialInputs(client);
  const paymentPayload = client.payment && typeof client.payment === "object"
    ? { ...client.payment, contacts, commercialInputs }
    : { contacts, commercialInputs };

  return {
    id: Number(client.id),
    workspace_id: currentWorkspace.id,
    owner_user_id: client.ownerUserId || existingOwnerUserId || supabaseUser.id,
    created_by_user_id: existingCreatedByUserId || supabaseUser.id,
    name: client.name || "",
    client_address: getClientAddress(client),
    client_city: getClientCity(client),
    contact_person: client.contactPerson || "",
    contact_role: client.contactRole || "",
    contact_phone: client.contactPhone || "",
    contact_email: client.contactEmail || "",
    company_size: client.companySize || "",
    decision_model: client.decisionModel || "",
    revenue_driver_primary: client.revenueDriverPrimary || "",
    lead_temperature: client.leadTemperature || "",
    budget_status: client.budgetStatus || "",
    urgency_level: client.urgencyLevel || "",
    pilot_readiness: client.pilotReadiness || "",
    relationship_strength: client.relationshipStrength || "",
    last_action_note: client.lastActionNote || "",
    next_step_text: client.nextStepText || "",
    next_step_type: client.nextStepType || "",
    next_step_date: client.nextStepDate || null,
    deal_value: Number(client.dealValue || 0),
    deal_probability: client.dealProbability || null,
    expected_decision_date: client.expectedDecisionDate || null,
    business_type: commercialInputs.businessType || "",
    client_type: client.clientType || "",
    international_flag: client.internationalFlag || "",
    revenue_focus_tags: Array.isArray(client.revenueFocusTags) ? client.revenueFocusTags : [],
    revenue_detail: client.revenueDetail || "",
    retail_location_type: client.retailLocationType || "",
    retail_assortment_type: client.retailAssortmentType || "",
    retail_promo_potential: client.retailPromoPotential || "",
    pharmacy_focus: client.pharmacyFocus || "",
    pharmacy_locations: client.pharmacyLocations || "",
    pharmacy_centralization: client.pharmacyCentralization || "",
    pharmacy_traffic: client.pharmacyTraffic || "",
    pharmacy_suppliers: client.pharmacySuppliers || "",
    stage: client.stage || "new",
    last_action_at: client.lastActionAt || nowISO(),
    last_action_human: client.lastActionHuman || "Kreiran klijent",
    payment: paymentPayload,
    activity_log: Array.isArray(client.activityLog) ? client.activityLog : [],
    created_at: client.createdAt || nowISO(),
    updated_at: nowISO()
  };
}

function ensureActivityLogIds() {
  clients.forEach(client => {
    if (!Array.isArray(client.activityLog)) {
      client.activityLog = [];
      return;
    }

    client.activityLog = client.activityLog.map(item => ({
      id: item.id || createLocalEntityId("act"),
      ...item
    }));
  });
}

async function hydrateClientsFromWorkspace(options = {}) {
  if (!canUseWorkspaceClientStore()) return false;
  const { silent = false } = options;

  const { data, error } = await supabaseClient
    .from("clients")
    .select("*")
    .eq("workspace_id", currentWorkspace.id)
    .order("created_at", { ascending: false });

  if (error) {
    if (!silent) {
      showToast("Workspace klijenti nisu ucitani.");
    }
    console.error("[Pulse Workspace] hydrateClientsFromWorkspace failed", error);
    return false;
  }

  clients = Array.isArray(data) ? data.map(mapClientRowToLocal) : [];
  ensureActivityLogIds();
  if (typeof rememberObservedMembersFromClients === "function") {
    rememberObservedMembersFromClients();
  }
  clientDataSource = "workspace";
  saveClientsLocalOnly();
  syncClientCreateAvailability();
  return true;
}

async function pushClientsToWorkspace() {
  if (!canUseWorkspaceClientStore()) return false;
  if (clientDataSource !== "workspace") {
    console.warn("[Pulse Clients] Workspace push skipped because workspace source is not active.", {
      clientDataSource,
      workspaceId: currentWorkspace?.id || null
    });
    return false;
  }

  const { data: existingRows, error: existingError } = await supabaseClient
    .from("clients")
    .select("id, owner_user_id, created_by_user_id")
    .eq("workspace_id", currentWorkspace.id);

  if (existingError) {
    console.error("[Pulse Workspace] pushClientsToWorkspace existing rows failed", existingError);
    showToast(`Workspace sync nije uspeo: ${existingError.message || "citanje klijenata"}`);
    return false;
  }

  const existingById = new Map(
    (Array.isArray(existingRows) ? existingRows : []).map(row => [String(row.id), row])
  );
  const payload = clients.map(client => mapClientToWorkspaceRow(client, existingById.get(String(Number(client.id)))));
  const rowsToInsert = payload.filter(row => !existingById.has(String(row.id)));
  const rowsToUpdate = payload.filter(row => existingById.has(String(row.id)));

  if (rowsToInsert.length) {
    const { error } = await supabaseClient
      .from("clients")
      .insert(rowsToInsert);

    if (error) {
      console.error("[Pulse Workspace] pushClientsToWorkspace insert failed", error, rowsToInsert);
      showToast(`Workspace sync nije uspeo: ${error.message || "novi klijenti"}`);
      return false;
    }
  }

  for (const row of rowsToUpdate) {
    const { error } = await supabaseClient
      .from("clients")
      .update(row)
      .eq("id", row.id)
      .eq("workspace_id", currentWorkspace.id);

    if (error) {
      console.error("[Pulse Workspace] pushClientsToWorkspace update failed", error, row);
      showToast(`Workspace sync nije uspeo: ${error.message || "azuriranje klijenta"}`);
      return false;
    }
  }

  // Workspace sync is append/update-only from the browser. Deleting stale rows from
  // a local cache can erase another user's fresh work, so cleanup must be explicit.
  void existingRows;
  cloudSyncState = "synced";
  syncCloudStatusUI("Sinhronizovano");
  return true;
}

async function deleteClientFromWorkspace(clientId) {
  if (!canUseWorkspaceClientStore()) return false;

  const { error } = await supabaseClient
    .from("clients")
    .delete()
    .eq("id", Number(clientId))
    .eq("workspace_id", currentWorkspace.id);

  if (error) {
    console.error("[Pulse Workspace] deleteClientFromWorkspace failed", error);
    showToast(`Brisanje klijenta nije upisano u workspace: ${error.message || "nepoznata greska"}`);
    return false;
  }

  cloudSyncState = "synced";
  syncCloudStatusUI("Sinhronizovano");
  return true;
}

function mapActivityToWorkspaceRow(client, activity) {
  return {
    id: activity.id,
    workspace_id: currentWorkspace.id,
    client_id: Number(client.id),
    created_by_user_id: activity.actorId || supabaseUser?.id || null,
    activity_type: activity.type || "note",
    label: activity.label || "Aktivnost",
    note: activity.note || "",
    activity_at: activity.at || nowISO(),
    created_at: activity.at || nowISO()
  };
}

async function hydrateActivitiesFromWorkspace(options = {}) {
  // Legacy no-op. Activity metadata and task ownership now round-trip through
  // clients.activity_log, because client_activities has no JSON metadata column.
  // Pulling from client_activities would strip owner/delegation data and make Tim
  // and Zadaci disagree after SYNC.
  void options;
  return true;
}

async function pushActivitiesToWorkspace() {
  // Legacy no-op. The source of truth is the client row JSON payload.
  return true;
}

function migrateClients() {
  clients = clients.map(client => {
    const migrated = { ...client };

    const city = getClientCity(migrated);
    const address = getClientAddress(migrated);
    const commercialInputs = getClientCommercialInputs(migrated);
    migrated.city = city;
    migrated.clientCity = city;
    migrated.address = address;
    migrated.clientAddress = address;
    migrated.businessType = commercialInputs.businessType;
    migrated.revenueBand = commercialInputs.revenueBand;
    migrated.employeeCount = commercialInputs.employeeCount;
    migrated.locationCount = commercialInputs.locationCount;
    migrated.decisionLevel = commercialInputs.decisionLevel;
    migrated.relationshipLevel = commercialInputs.relationshipLevel;
    migrated.innovationReady = commercialInputs.innovationReady;
    if (!migrated.contactPerson) migrated.contactPerson = "";
    if (!migrated.contactRole) migrated.contactRole = "";
    if (!migrated.contactPhone) migrated.contactPhone = "";
    if (!migrated.contactEmail) migrated.contactEmail = "";
    migrated.contacts = getClientContacts(migrated).map(normalizeClientContact);
    const primaryContact = migrated.contacts[0] || null;
    if (primaryContact) {
      migrated.contactPerson = primaryContact.name;
      migrated.contactRole = primaryContact.role;
      migrated.contactEmail = primaryContact.email;
      migrated.contactPhone = primaryContact.phone;
    }

    if (!migrated.revenueDriverPrimary) migrated.revenueDriverPrimary = "";
    if (!migrated.nextStepText) migrated.nextStepText = "";
    if (!migrated.nextStepType) migrated.nextStepType = "";
    if (!migrated.nextStepDate) migrated.nextStepDate = "";
    if (!migrated.dealValue) migrated.dealValue = 0;
    if (!migrated.dealProbability) migrated.dealProbability = "";
    if (!migrated.expectedDecisionDate) migrated.expectedDecisionDate = "";

    if (!migrated.leadTemperature) {
      if (migrated.stage === "negotiation" || migrated.stage === "offer_sent") migrated.leadTemperature = "warm";
      else if (migrated.stage === "meeting_done") migrated.leadTemperature = "warm";
      else migrated.leadTemperature = "cold";
    }

    if (!migrated.budgetStatus) {
      if (migrated.stage === "negotiation") migrated.budgetStatus = "planned";
      else if (migrated.stage === "offer_sent" || migrated.stage === "meeting_done") migrated.budgetStatus = "exploring";
      else migrated.budgetStatus = "unknown";
    }

    if (!migrated.urgencyLevel) {
      if (migrated.stage === "negotiation" || migrated.stage === "offer_sent") migrated.urgencyLevel = "medium";
      else migrated.urgencyLevel = "low";
    }

    if (!migrated.pilotReadiness) {
      const note = String(migrated.lastActionNote || "").toLowerCase();
      if (note.includes("pilot")) migrated.pilotReadiness = "discussed";
      else migrated.pilotReadiness = "possible";
    }

    if (!migrated.relationshipStrength) {
      migrated.relationshipStrength = migrated.contactPerson ? "working" : "new";
    }
    if (!Array.isArray(migrated.revenueFocusTags)) migrated.revenueFocusTags = [];
    if (!migrated.revenueDetail) migrated.revenueDetail = migrated.revenueDriver || "";

    if (!migrated.retailLocationType) migrated.retailLocationType = "";
    if (!migrated.retailAssortmentType) migrated.retailAssortmentType = "";
    if (!migrated.retailPromoPotential) migrated.retailPromoPotential = "";

    if (!Array.isArray(migrated.activityLog)) {
      migrated.activityLog = [];
    }
    migrated.activityLog = migrated.activityLog.map(item => ({
      id: item.id || createLocalEntityId("act"),
      ...item
    }));

    if (!migrated.payment || typeof migrated.payment !== "object") {
      migrated.payment = {
        lastInvoiceDate: null,
        lastReminderDate: null,
        lastPaidDate: null,
        paymentSpeed: null,
        workflow: {}
      };
    } else {
      migrated.payment = {
        lastInvoiceDate: migrated.payment.lastInvoiceDate || null,
        lastReminderDate: migrated.payment.lastReminderDate || null,
        lastPaidDate: migrated.payment.lastPaidDate || null,
        paymentSpeed: migrated.payment.paymentSpeed || null,
        workflow: migrated.payment.workflow && typeof migrated.payment.workflow === "object"
          ? migrated.payment.workflow
          : {}
      };
    }

    if (!migrated.lastActionAt) migrated.lastActionAt = migrated.createdAt || nowISO();
    if (!migrated.lastActionHuman) migrated.lastActionHuman = "Kreiran klijent";

    if (!migrated.nextStepText) {
      if (migrated.stage === "offer_sent") migrated.nextStepText = "Proveriti reakciju na ponudu";
      else if (migrated.stage === "waiting") migrated.nextStepText = "Uraditi status check";
      else if (migrated.stage === "meeting_done") migrated.nextStepText = "Poslati ponudu";
      else if (migrated.stage === "negotiation") migrated.nextStepText = "Pogurati odluku";
      else migrated.nextStepText = "Definisati sledeci korak";
    }

    if (!migrated.nextStepType) {
      if (migrated.stage === "offer_sent" || migrated.stage === "waiting") migrated.nextStepType = "followup";
      else if (migrated.stage === "meeting_done") migrated.nextStepType = "offer";
      else if (migrated.stage === "negotiation") migrated.nextStepType = "decision";
      else migrated.nextStepType = "task";
    }

    if (!migrated.nextStepDate && migrated.lastActionAt) {
      const offset =
        migrated.stage === "offer_sent" ? 3 :
        migrated.stage === "waiting" ? 3 :
        migrated.stage === "meeting_done" ? 1 :
        migrated.stage === "negotiation" ? 2 :
        7;
      const nextDate = new Date(migrated.lastActionAt);
      nextDate.setDate(nextDate.getDate() + offset);
      migrated.nextStepDate = nextDate.toISOString().slice(0, 10);
    }

    if (!migrated.dealProbability) {
      if (migrated.stage === "negotiation") migrated.dealProbability = "75";
      else if (migrated.stage === "offer_sent") migrated.dealProbability = "50";
      else if (migrated.stage === "meeting_done") migrated.dealProbability = "25";
    }

    if (!migrated.expectedDecisionDate && migrated.nextStepDate) {
      const decisionDate = new Date(migrated.nextStepDate);
      const offset =
        migrated.stage === "negotiation" ? 7 :
        migrated.stage === "offer_sent" ? 10 :
        migrated.stage === "meeting_done" ? 14 :
        21;
      decisionDate.setDate(decisionDate.getDate() + offset);
      migrated.expectedDecisionDate = decisionDate.toISOString().slice(0, 10);
    }

    if (migrated.activityLog.length === 0) {
      migrated.activityLog.unshift({
        id: createLocalEntityId("act"),
        at: migrated.createdAt || migrated.lastActionAt || nowISO(),
        type: "created",
        label: "Kreiran klijent",
        note: migrated.lastActionNote || ""
      });

      if (migrated.lastActionHuman && migrated.lastActionHuman !== "Kreiran klijent") {
        migrated.activityLog.unshift({
          id: createLocalEntityId("act"),
          at: migrated.lastActionAt || nowISO(),
          type: "legacy_action",
          label: migrated.lastActionHuman,
          note: migrated.lastActionNote || ""
        });
      }
    }

    return migrated;
  });

  saveClients();
}

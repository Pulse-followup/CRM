/* ------------------------- HELPERS ------------------------- */
function getClientById(id) {
  return clients.find(c => c.id === id);
}

function nowISO() {
  return new Date().toISOString();
}

function todayISODate() {
  return new Date().toISOString().slice(0, 10);
}

function daysSince(dateString) {
  if (!dateString) return 0;
  const d = new Date(dateString);
  const diff = Date.now() - d.getTime();
  return Math.max(0, Math.floor(diff / (1000 * 60 * 60 * 24)));
}

function dateOnlyValue(dateString) {
  if (!dateString) return "";
  return String(dateString).slice(0, 10);
}

function normalizeDateInputValue(value) {
  const raw = String(value || "").trim();
  if (!raw) return "";
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw;

  const usMatch = raw.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (usMatch) {
    const [, month, day, year] = usMatch;
    return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
  }

  const srMatch = raw.match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})\.?$/);
  if (srMatch) {
    const [, day, month, year] = srMatch;
    return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
  }

  return raw;
}

function daysUntil(dateString) {
  if (!dateString) return null;
  const target = new Date(`${dateOnlyValue(dateString)}T00:00:00`);
  const today = new Date(`${todayISODate()}T00:00:00`);
  const diff = target.getTime() - today.getTime();
  return Math.round(diff / (1000 * 60 * 60 * 24));
}

function isDueToday(dateString) {
  return dateOnlyValue(dateString) === todayISODate();
}

function isOverdueDate(dateString) {
  const days = daysUntil(dateString);
  return days !== null && days < 0;
}

function isThisWeekDate(dateString) {
  const days = daysUntil(dateString);
  return days !== null && days >= 0 && days <= 6;
}

function isPlaceholderNextStep(text) {
  const normalized = String(text || "").trim().toLowerCase();
  return normalized === "definisati sledeci korak";
}

function hasConcreteNextStep(client) {
  return Boolean(client?.nextStepDate && client?.nextStepText && !isPlaceholderNextStep(client.nextStepText));
}

function getClientNextStepText(client, fallback = "-") {
  if (hasConcreteNextStep(client)) {
    return client.nextStepText;
  }
  return fallback;
}

function normalizeTaskStatus(status) {
  switch (status) {
    case "in_progress":
    case "waiting":
    case "done":
    case "canceled":
      return status;
    default:
      return "open";
  }
}

function taskStatusLabel(status) {
  switch (normalizeTaskStatus(status)) {
    case "in_progress": return "U toku";
    case "waiting": return "Na cekanju";
    case "done": return "Zavrsen";
    case "canceled": return "Otkazan";
    default: return "Otvoren";
  }
}

function getCurrentUserDisplayName() {
  return (
    currentProfile?.full_name ||
    currentProfile?.email?.split("@")[0] ||
    supabaseUser?.email?.split("@")[0] ||
    "Moj nalog"
  );
}

function normalizeIdentityLabel(value) {
  return String(value || "").trim().toLowerCase();
}

function isGenericTeamLabel(value) {
  const normalized = normalizeIdentityLabel(value);
  return ["", "clan tima", "tim", "tim workspace-a", "moj nalog"].includes(normalized);
}

function getAssignableWorkspaceMembers() {
  if (Array.isArray(currentWorkspaceMembers) && currentWorkspaceMembers.length) {
    return currentWorkspaceMembers.map(member => {
      const remembered = typeof getRememberedMemberProfile === "function"
        ? getRememberedMemberProfile(member.user_id)
        : null;
      const profile = member.profile || remembered || {};
      const name =
        profile.full_name ||
        profile.email ||
        (member.user_id === supabaseUser?.id ? getCurrentUserDisplayName() : `Korisnik ${String(member.user_id || "").slice(0, 8)}`);

      return {
        id: member.user_id,
        name,
        email: profile.email || "",
        role: member.role || "member"
      };
    });
  }

  if (supabaseUser?.id) {
    return [{
      id: supabaseUser.id,
      name: getCurrentUserDisplayName(),
      email: supabaseUser.email || "",
      role: currentMembership?.role || "admin"
    }];
  }

  return [];
}

function getWorkspaceMembersByRole(role) {
  return getAssignableWorkspaceMembers().filter(member => member.role === role);
}

function getAdminWorkspaceMembers() {
  return getWorkspaceMembersByRole("admin");
}

function getFinanceWorkspaceMembers() {
  return getWorkspaceMembersByRole("finance");
}

function getDefaultBillingOwner() {
  if (getFinanceWorkspaceMembers().length > 0) {
    return {
      id: "",
      name: "Finansije",
      email: "",
      role: "finance"
    };
  }

  if (getAdminWorkspaceMembers().length > 0) {
    return {
      id: "",
      name: "Admin",
      email: "",
      role: "admin"
    };
  }

  return getAssignableWorkspaceMembers()[0] || {
    id: supabaseUser?.id || "",
    name: getCurrentUserDisplayName(),
    email: supabaseUser?.email || "",
    role: currentMembership?.role || "admin"
  };
}

function getTeamMemberNameById(userId, fallback = "Tim") {
  if (!userId) return fallback;
  const match = getAssignableWorkspaceMembers().find(member => member.id === userId);
  return match?.name || match?.email || fallback;
}

function ensureClientWorkflow(client) {
  if (!client.payment || typeof client.payment !== "object") {
    client.payment = {
      lastInvoiceDate: null,
      lastReminderDate: null,
      lastPaidDate: null,
      paymentSpeed: null,
      workflow: {}
    };
  }

  if (!client.payment.workflow || typeof client.payment.workflow !== "object") {
    client.payment.workflow = {};
  }

  if (!Array.isArray(client.payment.workflow.projects)) {
    client.payment.workflow.projects = [];
  }

  return client.payment.workflow;
}

function getClientProjects(client) {
  const workflow = ensureClientWorkflow(client);
  return workflow.projects;
}

function getClientProjectById(client, projectId) {
  if (!projectId) return null;
  return getClientProjects(client).find(project => project.id === projectId) || null;
}

function getClientOpenProjects(client) {
  return getClientProjects(client).filter(project => !["done", "canceled"].includes(project.status));
}

function projectDisplayName(project) {
  if (!project) return "Bez projekta";
  return project.name || "Projekat";
}

function createClientProject(client, fields = {}) {
  const projects = getClientProjects(client);
  const project = {
    id: fields.id || createLocalEntityId("project"),
    name: fields.name || "Novi projekat",
    status: fields.status || "open",
    urgency: fields.urgency || "medium",
    budgetStatus: fields.budgetStatus || "unknown",
    estimatedValue: fields.estimatedValue || "",
    expectedEndDate: fields.expectedEndDate || "",
    createdAt: fields.createdAt || nowISO(),
    createdById: fields.createdById || supabaseUser?.id || "",
    createdByName: fields.createdByName || getCurrentUserDisplayName(),
    createdByEmail: fields.createdByEmail || supabaseUser?.email || "",
    tasks: []
  };

  projects.unshift(project);
  return project;
}

function addTaskToProject(client, project, task) {
  if (!project) return task;
  if (!Array.isArray(project.tasks)) project.tasks = [];
  project.tasks.unshift(task);
  refreshClientActiveTask(client);
  return task;
}

function normalizeClientTask(task, project = null) {
  if (!task || typeof task !== "object") return null;

  const title = String(task.title || "").trim();
  const status = normalizeTaskStatus(task.status);
  if (!title || status === "done" || status === "canceled") return null;

  const resolvedOwnerName = getTeamMemberNameById(task.ownerId, task.ownerName || "Clan tima");
  const resolvedDelegatedByName = getTeamMemberNameById(task.delegatedById, task.delegatedByName || "Tim");

  return {
    id: task.id || createLocalEntityId("task"),
    type: task.type || "task",
    title,
    dueDate: dateOnlyValue(task.dueDate || task.due_at || ""),
    ownerId: task.ownerId || "",
    ownerEmail: task.ownerEmail || "",
    ownerName: isGenericTeamLabel(task.ownerName) ? resolvedOwnerName : (task.ownerName || resolvedOwnerName),
    ownerRole: task.ownerRole || "",
    delegatedById: task.delegatedById || "",
    delegatedByEmail: task.delegatedByEmail || "",
    delegatedByName: isGenericTeamLabel(task.delegatedByName) ? resolvedDelegatedByName : (task.delegatedByName || resolvedDelegatedByName),
    projectId: task.projectId || project?.id || "",
    projectName: task.projectName || projectDisplayName(project),
    billingId: task.billingId || "",
    note: task.note || "",
    status,
    createdAt: task.createdAt || nowISO()
  };
}

function getClientOpenTasks(client) {
  const tasks = [];
  const seen = new Set();

  getClientProjects(client).forEach(project => {
    (Array.isArray(project.tasks) ? project.tasks : []).forEach(task => {
      const normalized = normalizeClientTask(task, project);
      if (!normalized) return;

      const key = normalized.id || `${normalized.projectId}:${normalized.title}:${normalized.dueDate}`;
      if (seen.has(key)) return;
      seen.add(key);
      tasks.push(normalized);
    });
  });

  const legacyTask = normalizeClientTask(client?.payment?.workflow?.activeTask || null, null);
  if (legacyTask && !seen.has(legacyTask.id)) {
    tasks.push(legacyTask);
  }

  return tasks.sort((a, b) => {
    const aDue = a.dueDate || "9999-12-31";
    const bDue = b.dueDate || "9999-12-31";
    if (aDue !== bDue) return aDue.localeCompare(bDue);
    return String(b.createdAt || "").localeCompare(String(a.createdAt || ""));
  });
}

function refreshClientActiveTask(client) {
  const workflow = ensureClientWorkflow(client);
  const nextTask = getClientOpenTasks(client)[0] || null;
  workflow.activeTask = nextTask;
  return nextTask;
}

function getClientStoredActiveTask(client) {
  const task = client?.payment?.workflow?.activeTask;
  if (!task || typeof task !== "object") return null;

  const title = String(task.title || "").trim();
  const status = normalizeTaskStatus(task.status);
  if (!title || status === "done" || status === "canceled") return null;

  return normalizeClientTask(task, null);
}

function getClientDerivedTask(client) {
  if (!hasConcreteNextStep(client)) return null;

  const derivedStatus =
    client.stage === "waiting" ? "waiting" :
    client.nextStepDate && isDueToday(client.nextStepDate) ? "in_progress" :
    "open";

  return {
    id: "",
    title: client.nextStepText,
    dueDate: dateOnlyValue(client.nextStepDate || ""),
    ownerId: supabaseUser?.id || "",
    ownerName: getCurrentUserDisplayName(),
    delegatedById: "",
    delegatedByName: "",
    note: client.lastActionNote || "",
    status: derivedStatus,
    createdAt: client.lastActionAt || client.createdAt || nowISO()
  };
}

function getClientActiveTask(client) {
  return getClientOpenTasks(client)[0] || getClientStoredActiveTask(client);
}

function isTaskOwnedByCurrentUser(task) {
  if (!task) return false;
  if (supabaseUser?.id && task.ownerId === supabaseUser.id) return true;
  if (task.ownerRole && currentMembership?.role === normalizeWorkspaceRole(task.ownerRole)) return true;

  const currentLabels = [
    currentProfile?.full_name,
    currentProfile?.email,
    currentProfile?.email?.split("@")[0],
    supabaseUser?.email,
    supabaseUser?.email?.split("@")[0]
  ]
    .map(normalizeIdentityLabel)
    .filter(Boolean);

  const ownerLabels = [
    task.ownerName,
    task.ownerEmail,
    getTeamMemberNameById(task.ownerId, ""),
    task.ownerId && currentWorkspaceMembers.find(member => member.user_id === task.ownerId)?.profile?.email
  ]
    .map(normalizeIdentityLabel)
    .filter(Boolean);

  if (ownerLabels.some(label => currentLabels.includes(label))) {
    return true;
  }

  return !task.ownerId && ownerLabels.length === 0;
}

function getClientDashboardTask(client) {
  const task = getClientOpenTasks(client).find(isTaskOwnedByCurrentUser);
  if (!task || !isTaskOwnedByCurrentUser(task)) return null;
  return task;
}

function completeClientTask(client, projectId, taskId) {
  if (!client || !projectId || !taskId) return null;
  const project = getClientProjectById(client, projectId);
  if (!project || !Array.isArray(project.tasks)) return null;

  const task = project.tasks.find(item => item.id === taskId);
  if (!task) return null;

  task.status = "done";
  task.completedAt = nowISO();
  task.completedById = supabaseUser?.id || "";
  task.completedByName = getCurrentUserDisplayName();
  refreshClientActiveTask(client);
  return task;
}

function projectHasOpenTasks(project) {
  if (!project || !Array.isArray(project.tasks)) return false;
  return project.tasks.some(task => {
    const status = normalizeTaskStatus(task.status);
    return status !== "done" && status !== "canceled";
  });
}

function ensureProjectReviewTask(client, project) {
  if (!client || !project || projectHasOpenTasks(project)) return null;
  if (project.status === "done" || project.status === "canceled") return null;

  const existing = (project.tasks || []).find(task => task.type === "project_review" && normalizeTaskStatus(task.status) !== "done" && normalizeTaskStatus(task.status) !== "canceled");
  if (existing) return existing;

  const task = {
    id: createLocalEntityId("task"),
    type: "project_review",
    title: `Proveri projekat: ${projectDisplayName(project)}`,
    dueDate: todayISODate(),
    ownerId: "",
    ownerName: "Admin",
    ownerEmail: "",
    ownerRole: "admin",
    delegatedById: "",
    delegatedByName: "Pulse",
    delegatedByEmail: "",
    projectId: project.id,
    projectName: projectDisplayName(project),
    status: "open",
    note: "Na projektu nema otvorenih zadataka. Ako je zavrsen, otvori naplatu.",
    createdAt: nowISO()
  };

  addTaskToProject(client, project, task);
  addActivity(client, "project_review", "Projekat spreman za proveru", task.note, {
    projectId: project.id,
    projectName: projectDisplayName(project),
    ownerId: task.ownerId,
    ownerName: task.ownerName,
    relatedTaskId: task.id
  });
  return task;
}

function ensureBillingRecords(client) {
  const workflow = ensureClientWorkflow(client);
  if (!Array.isArray(workflow.billing)) workflow.billing = [];
  return workflow.billing;
}

function getBillingRecords(client) {
  return ensureBillingRecords(client);
}

function getProjectBillingRecord(client, projectId) {
  return getBillingRecords(client).find(record => record.projectId === projectId && record.status !== "paid" && record.status !== "canceled") || null;
}

function billingStatusLabel(status) {
  switch (status) {
    case "invoice_sent": return "Faktura poslata";
    case "waiting_payment": return "Ceka uplatu";
    case "paid": return "Placeno";
    case "late": return "Kasni";
    case "canceled": return "Otkazano";
    default: return "Zahtev za naplatu";
  }
}

function createBillingRequest(client, projectId, fields = {}) {
  const project = getClientProjectById(client, projectId);
  if (!client || !project) return null;

  const existing = getProjectBillingRecord(client, projectId);
  if (existing) return existing;

  const owner = fields.owner || getDefaultBillingOwner();
  const requestedByName = getCurrentUserDisplayName();
  const record = {
    id: createLocalEntityId("billing"),
    projectId: project.id,
    projectName: projectDisplayName(project),
    status: "requested",
    amount: fields.amount || project.estimatedValue || "",
    invoiceNumber: fields.invoiceNumber || "",
    invoiceDate: fields.invoiceDate || "",
    dueDate: fields.dueDate || "",
    paidDate: "",
    note: fields.note || "",
    requestedAt: nowISO(),
    requestedById: supabaseUser?.id || "",
    requestedByName,
    requestedByEmail: supabaseUser?.email || "",
    ownerId: owner.id || "",
    ownerName: owner.name || "Finansije",
    ownerEmail: owner.email || "",
    ownerRole: owner.role || ""
  };

  ensureBillingRecords(client).unshift(record);

  const task = {
    id: createLocalEntityId("task"),
    type: "billing",
    title: `Naplata: ${projectDisplayName(project)}`,
    dueDate: fields.taskDueDate || todayISODate(),
    ownerId: record.ownerId,
    ownerName: record.ownerName,
    ownerEmail: record.ownerEmail,
    ownerRole: record.ownerRole,
    delegatedById: supabaseUser?.id || "",
    delegatedByName: requestedByName,
    delegatedByEmail: supabaseUser?.email || "",
    projectId: project.id,
    projectName: projectDisplayName(project),
    billingId: record.id,
    status: "open",
    note: `Pripremiti fakturu / naplatu za projekat ${projectDisplayName(project)}.`,
    createdAt: nowISO()
  };

  addTaskToProject(client, project, task);
  addActivity(client, "billing_requested", "Zahtev za naplatu", `${projectDisplayName(project)} - vlasnik: ${record.ownerName}`, {
    projectId: project.id,
    projectName: projectDisplayName(project),
    billingId: record.id,
    ownerId: record.ownerId,
    ownerName: record.ownerName,
    relatedTaskId: task.id
  });

  return record;
}

function updateBillingRecord(client, billingId, fields = {}) {
  if (!client.payment || typeof client.payment !== "object") {
    client.payment = {};
  }

  const record = getBillingRecords(client).find(item => item.id === billingId);
  if (!record) return null;

  Object.assign(record, {
    invoiceNumber: fields.invoiceNumber ?? record.invoiceNumber,
    amount: fields.amount ?? record.amount,
    invoiceDate: fields.invoiceDate ?? record.invoiceDate,
    dueDate: fields.dueDate ?? record.dueDate,
    status: fields.status || record.status,
    note: fields.note ?? record.note,
    updatedAt: nowISO(),
    updatedById: supabaseUser?.id || "",
    updatedByName: getCurrentUserDisplayName()
  });

  client.payment.lastInvoiceDate = record.invoiceDate || client.payment.lastInvoiceDate;
  return record;
}

function markBillingRecordPaid(client, billingId) {
  const record = updateBillingRecord(client, billingId, {
    status: "paid",
    paidDate: todayISODate()
  });
  if (!record) return null;

  record.paidDate = todayISODate();
  client.payment.lastPaidDate = nowISO();
  client.payment.paymentSpeed = record.dueDate && isOverdueDate(record.dueDate) ? "late" : "on_time";

  const project = getClientProjectById(client, record.projectId);
  if (project?.tasks) {
    project.tasks.forEach(task => {
      if (task.billingId === record.id && normalizeTaskStatus(task.status) !== "done") {
        task.status = "done";
        task.completedAt = nowISO();
        task.completedById = supabaseUser?.id || "";
        task.completedByName = getCurrentUserDisplayName();
      }
    });
  }
  refreshClientActiveTask(client);
  return record;
}

function formatDate(dateString) {
  if (!dateString) return "—";
  const d = new Date(dateString);
  return d.toLocaleDateString("sr-RS", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric"
  });
}

function formatDateTime(dateString) {
  if (!dateString) return "—";
  const d = new Date(dateString);
  return d.toLocaleString("sr-RS", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  });
}

function escapeHtml(str = "") {
  return String(str)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function formatMoney(value) {
  const amount = Number(value || 0);
  if (!amount) return "â€”";

  return new Intl.NumberFormat("sr-RS", {
    maximumFractionDigits: 0
  }).format(amount);
}

function showToast(message) {
  const toast = document.getElementById("toast");
  if (!toast) return;

  toast.textContent = message;
  toast.classList.remove("hidden");
  toast.classList.add("show");

  setTimeout(() => {
    toast.classList.remove("show");
    toast.classList.add("hidden");
  }, 2200);
}

function switchView(viewId) {
  document.querySelectorAll(".view").forEach(v => v.classList.remove("active"));

  const targetView = document.getElementById(viewId);
  if (targetView) targetView.classList.add("active");

  document.querySelectorAll(".nav-btn").forEach(btn => {
    btn.classList.toggle("active", btn.dataset.view === viewId);
  });

  const title = document.getElementById("viewTitle");
  const subtitle = document.getElementById("viewSubtitle");
  const topbar = document.querySelector(".topbar");
  const clientsViewTitle = document.getElementById("clientsViewTitle");
  const actionsViewTitle = document.getElementById("actionsViewTitle");

  if (topbar) {
    topbar.classList.add("topbar-hidden");
  }

  const workspaceName = currentWorkspace?.name || "Bez workspace-a";

  if (clientsViewTitle) {
    clientsViewTitle.textContent = `Klijenti - ${workspaceName}`;
  }

  if (actionsViewTitle) {
    actionsViewTitle.textContent = `Tim - ${workspaceName}`;
  }

  if (!title || !subtitle) return;
  title.textContent = "";
  subtitle.textContent = "";
  subtitle.classList.add("hidden");
}

function toggleIndustryFields() {
  const businessType = document.getElementById("businessType");
  if (!businessType) return;

  const type = businessType.value;
  const retailFields = document.getElementById("retailFields");
  const pharmacyFields = document.getElementById("pharmacyFields");

  if (retailFields) retailFields.classList.toggle("hidden", type !== "retail");
  if (pharmacyFields) pharmacyFields.classList.toggle("hidden", type !== "pharmacy");
}

function getCheckedValues(name) {
  return [...document.querySelectorAll(`input[name="${name}"]:checked`)].map(el => el.value);
}

function setCheckedValues(name, values = []) {
  document.querySelectorAll(`input[name="${name}"]`).forEach(el => {
    el.checked = values.includes(el.value);
  });
}

function createLocalEntityId(prefix = "id") {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

function addActivity(client, type, label, note = "", meta = {}) {
  if (!Array.isArray(client.activityLog)) client.activityLog = [];
  client.activityLog.unshift({
    id: meta.id || createLocalEntityId("act"),
    at: meta.at || nowISO(),
    type,
    label,
    note,
    ...meta
  });
}

// === APPJS END PART 1/4 ===
// === APPJS START PART 2/4 ===


function formatTodayHeaderDate() {
  return new Date().toLocaleDateString("sr-RS", {
    day: "2-digit",
    month: "2-digit"
  });
}

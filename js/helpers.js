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
    case "assigned":
    case "open":
    case "in_progress":
      return "assigned";
    case "pending":
      return "waiting";
    case "done":
    case "completed":
      return "done";
    case "returned":
      return "returned";
    case "billing_ready":
    case "sent_to_billing":
      return "sent_to_billing";
    case "paid":
      return "sent_to_billing";
    case "canceled":
      return status;
    case "waiting":
      return "waiting";
    default:
      return "assigned";
  }
}

function taskStatusLabel(status) {
  switch (normalizeTaskStatus(status)) {
    case "assigned": return "Dodeljen";
    case "waiting": return "Na cekanju";
    case "done": return "Zavrsen";
    case "returned": return "Vracen";
    case "sent_to_billing": return "Poslat na naplatu";
    case "canceled": return "Otkazan";
    default: return "Dodeljen";
  }
}

function taskStatusBadgeClass(status) {
  switch (normalizeTaskStatus(status)) {
    case "done": return "success";
    case "waiting": return "warning";
    case "returned": return "warning";
    case "sent_to_billing": return "neutral";
    case "canceled": return "neutral";
    default: return "neutral";
  }
}

function isTaskClosedStatus(status) {
  return ["done", "canceled"].includes(normalizeTaskStatus(status));
}

function isTaskOverdue(task) {
  return Boolean(task?.dueDate && isOverdueDate(task.dueDate) && !["done", "sent_to_billing"].includes(normalizeTaskStatus(task.status)));
}

function isCurrentUserFinanceRole() {
  return normalizeWorkspaceRole(currentMembership?.role || "") === "finance";
}

function isCurrentUserAdminRole() {
  return normalizeWorkspaceRole(currentMembership?.role || "") === "admin";
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

function normalizeClientTask(task, project = null, options = {}) {
  if (!task || typeof task !== "object") return null;

  const title = String(task.title || "").trim();
  const status = normalizeTaskStatus(task.status);
  if (!title) return null;
  if (!options.includeClosed && isTaskClosedStatus(status)) return null;

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
    parentTaskId: task.parentTaskId || "",
    note: task.note || "",
    status,
    completedAt: task.completedAt || "",
    completedById: task.completedById || "",
    completedByName: task.completedByName || "",
    createdAt: task.createdAt || nowISO()
  };
}

function getClientTasks(client, options = {}) {
  const tasks = [];
  const seen = new Set();

  getClientProjects(client).forEach(project => {
    (Array.isArray(project.tasks) ? project.tasks : []).forEach(task => {
      const normalized = normalizeClientTask(task, project, { includeClosed: Boolean(options.includeClosed) });
      if (!normalized) return;

      const key = normalized.id || `${normalized.projectId}:${normalized.title}:${normalized.dueDate}`;
      if (seen.has(key)) return;
      seen.add(key);
      tasks.push(normalized);
    });
  });

  const legacyTask = normalizeClientTask(client?.payment?.workflow?.activeTask || null, null, { includeClosed: Boolean(options.includeClosed) });
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

function getClientOpenTasks(client) {
  return getClientTasks(client).filter(task => !isTaskClosedStatus(task.status));
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
  if (!title || isTaskClosedStatus(status)) return null;

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
    status: normalizeTaskStatus(derivedStatus),
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

function findClientProjectTask(client, projectId, taskId) {
  if (!client || !taskId) return { project: null, task: null };
  const project = getClientProjectById(client, projectId);
  if (project?.tasks) {
    const task = project.tasks.find(item => item.id === taskId) || null;
    return { project, task };
  }

  for (const candidateProject of getClientProjects(client)) {
    const task = Array.isArray(candidateProject.tasks)
      ? candidateProject.tasks.find(item => item.id === taskId)
      : null;
    if (task) return { project: candidateProject, task };
  }

  return { project: null, task: null };
}

function updateClientTaskStatus(client, projectId, taskId, status, fields = {}) {
  const { project, task } = findClientProjectTask(client, projectId, taskId);
  if (!task) return null;

  const nextStatus = normalizeTaskStatus(status);
  task.status = nextStatus;
  task.updatedAt = nowISO();
  task.updatedById = supabaseUser?.id || "";
  task.updatedByName = getCurrentUserDisplayName();

  if (nextStatus === "done") {
    task.completedAt = task.completedAt || nowISO();
    task.completedById = supabaseUser?.id || "";
    task.completedByName = getCurrentUserDisplayName();
  }

  Object.assign(task, fields);
  refreshClientActiveTask(client);
  return normalizeClientTask(task, project, { includeClosed: true });
}

function completeClientTask(client, projectId, taskId) {
  if (!client || !projectId || !taskId) return null;
  return updateClientTaskStatus(client, projectId, taskId, "done");
}

function projectHasOpenTasks(project) {
  if (!project || !Array.isArray(project.tasks)) return false;
  return project.tasks.some(task => {
    const status = normalizeTaskStatus(task.status);
    return !isTaskClosedStatus(status);
  });
}

function ensureProjectReviewTask(client, project) {
  if (!client || !project || projectHasOpenTasks(project)) return null;
  if (project.status === "done" || project.status === "canceled") return null;

  const existing = (project.tasks || []).find(task => task.type === "project_review" && !isTaskClosedStatus(task.status));
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
    status: "assigned",
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
  return ensureBillingRecords(client).map(refreshBillingRecordStatus);
}

function getProjectBillingRecord(client, projectId) {
  return getBillingRecords(client).find(record => record.projectId === projectId && !["paid", "canceled"].includes(normalizeBillingStatus(record.status))) || null;
}

function getBillingRecordBySourceTask(client, taskId) {
  if (!taskId) return null;
  return getBillingRecords(client).find(record => (record.sourceTaskId || record.source_task_id || "") === taskId && normalizeBillingStatus(record.status) !== "canceled") || null;
}

function normalizeBillingStatus(status) {
  switch (status) {
    case "to_invoice":
    case "requested":
    case "request":
      return "to_invoice";
    case "invoiced":
    case "invoice_sent":
    case "waiting_payment":
      return "invoiced";
    case "paid":
      return "paid";
    case "late":
    case "overdue":
      return "late";
    case "canceled":
      return "canceled";
    default:
      return "to_invoice";
  }
}

function refreshBillingRecordStatus(record) {
  if (!record || normalizeBillingStatus(record.status) === "paid" || normalizeBillingStatus(record.status) === "canceled") return record;
  if ((record.dueDate || record.due_date) && isOverdueDate(record.dueDate || record.due_date)) {
    record.status = "late";
  } else {
    record.status = normalizeBillingStatus(record.status);
  }
  return record;
}

function billingStatusLabel(status) {
  switch (normalizeBillingStatus(status)) {
    case "to_invoice": return "Za fakturisanje";
    case "invoiced": return "Fakturisano";
    case "paid": return "Placeno";
    case "late": return "Kasni";
    case "canceled": return "Otkazano";
    default: return "Za fakturisanje";
  }
}

function createBillingRequest(client, projectId, fields = {}) {
  const project = getClientProjectById(client, projectId);
  if (!client || !project) return null;

  const existing = fields.sourceTaskId
    ? getBillingRecordBySourceTask(client, fields.sourceTaskId)
    : getProjectBillingRecord(client, projectId);
  if (existing) return existing;

  const owner = fields.owner || getDefaultBillingOwner();
  const requestedByName = getCurrentUserDisplayName();
  const dueDate = fields.dueDate || fields.due_date || "";
  const createdAt = nowISO();
  const record = {
    id: createLocalEntityId("billing"),
    workspace_id: currentWorkspace?.id || "",
    workspaceId: currentWorkspace?.id || "",
    client_id: client.id || "",
    clientId: client.id || "",
    project_id: project.id,
    projectId: project.id,
    projectName: projectDisplayName(project),
    source_task_id: fields.sourceTaskId || fields.source_task_id || "",
    sourceTaskId: fields.sourceTaskId || fields.source_task_id || "",
    title: fields.title || `Naplata: ${projectDisplayName(project)}`,
    status: "to_invoice",
    amount: fields.amount || project.estimatedValue || "",
    currency: fields.currency || "RSD",
    due_date: dueDate,
    dueDate,
    created_by: supabaseUser?.id || "",
    createdById: supabaseUser?.id || "",
    created_at: createdAt,
    createdAt,
    invoice_number: fields.invoiceNumber || fields.invoice_number || "",
    invoiceNumber: fields.invoiceNumber || "",
    invoiced_at: fields.invoicedAt || fields.invoiced_at || "",
    invoicedAt: fields.invoicedAt || fields.invoiced_at || "",
    invoiceDate: fields.invoiceDate || "",
    paid_at: "",
    paidAt: "",
    paidDate: "",
    note: fields.note || "",
    requestedAt: createdAt,
    requestedById: supabaseUser?.id || "",
    requestedByName,
    requestedByEmail: supabaseUser?.email || "",
    ownerId: owner.id || "",
    ownerName: owner.name || "Finansije",
    ownerEmail: owner.email || "",
    ownerRole: owner.role || ""
  };

  ensureBillingRecords(client).unshift(record);
  if (!fields.skipActivity) {
    addActivity(client, "billing_requested", "Zahtev za naplatu", `${projectDisplayName(project)} - vlasnik: ${record.ownerName}`, {
      projectId: project.id,
      projectName: projectDisplayName(project),
      billingId: record.id,
      ownerId: record.ownerId,
      ownerName: record.ownerName,
      taskTitle: record.title,
      taskStatus: "sent_to_billing",
      taskActionText: "poslao na naplatu",
      relatedTaskId: record.sourceTaskId || ""
    });
  }

  return record;
}

function updateBillingRecord(client, billingId, fields = {}) {
  if (!client.payment || typeof client.payment !== "object") {
    client.payment = {};
  }

  const record = getBillingRecords(client).find(item => item.id === billingId);
  if (!record) return null;

  Object.assign(record, {
    invoice_number: fields.invoiceNumber ?? fields.invoice_number ?? record.invoice_number ?? record.invoiceNumber,
    invoiceNumber: fields.invoiceNumber ?? fields.invoice_number ?? record.invoiceNumber,
    amount: fields.amount ?? record.amount,
    currency: fields.currency ?? record.currency ?? "RSD",
    invoiceDate: fields.invoiceDate ?? record.invoiceDate,
    invoiced_at: fields.invoicedAt ?? fields.invoiced_at ?? record.invoiced_at ?? record.invoicedAt,
    invoicedAt: fields.invoicedAt ?? fields.invoiced_at ?? record.invoicedAt,
    due_date: fields.dueDate ?? fields.due_date ?? record.due_date ?? record.dueDate,
    dueDate: fields.dueDate ?? fields.due_date ?? record.dueDate,
    paid_at: fields.paidAt ?? fields.paid_at ?? record.paid_at ?? record.paidAt,
    paidAt: fields.paidAt ?? fields.paid_at ?? record.paidAt,
    paidDate: fields.paidDate ?? record.paidDate,
    status: normalizeBillingStatus(fields.status || record.status),
    note: fields.note ?? record.note,
    updatedAt: nowISO(),
    updatedById: supabaseUser?.id || "",
    updatedByName: getCurrentUserDisplayName()
  });

  refreshBillingRecordStatus(record);
  client.payment.lastInvoiceDate = record.invoicedAt || record.invoiceDate || client.payment.lastInvoiceDate;
  return record;
}

function markBillingRecordInvoiced(client, billingId, invoiceNumber = "") {
  const record = updateBillingRecord(client, billingId, {
    status: "invoiced",
    invoiceNumber: invoiceNumber || undefined,
    invoicedAt: nowISO(),
    invoiceDate: todayISODate()
  });
  if (!record) return null;

  record.invoice_number = record.invoiceNumber || record.invoice_number || "";
  record.invoiced_at = record.invoicedAt || nowISO();
  record.invoicedAt = record.invoiced_at;
  return record;
}

function markBillingRecordPaid(client, billingId) {
  const record = updateBillingRecord(client, billingId, {
    status: "paid",
    paidAt: nowISO(),
    paidDate: todayISODate()
  });
  if (!record) return null;

  record.paidDate = todayISODate();
  record.paid_at = record.paidAt || nowISO();
  record.paidAt = record.paid_at;
  client.payment.lastPaidDate = nowISO();
  client.payment.paymentSpeed = record.dueDate && isOverdueDate(record.dueDate) ? "late" : "on_time";
  refreshClientActiveTask(client);
  return record;
}

function parseBillingDateToLocalDay(value) {
  const raw = String(value || "").trim();
  if (!raw) return null;

  const dateOnly = dateOnlyValue(raw);
  const match = dateOnly.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (match) {
    const [, year, month, day] = match;
    const parsed = new Date(Number(year), Number(month) - 1, Number(day));
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }

  const parsed = new Date(raw);
  if (Number.isNaN(parsed.getTime())) return null;
  return new Date(parsed.getFullYear(), parsed.getMonth(), parsed.getDate());
}

function getClientBillingPaymentProfile(client) {
  const paidRecords = getBillingRecords(client).filter(record => normalizeBillingStatus(record.status) === "paid");
  if (!paidRecords.length) {
    return {
      category: "unknown",
      label: "Nema dovoljno podataka",
      lateDaysMax: 0,
      paidCount: 0,
      lateCount: 0
    };
  }

  const lateDays = paidRecords.map(record => {
    const due = parseBillingDateToLocalDay(record.dueDate || record.due_date || "");
    const paid = parseBillingDateToLocalDay(record.paidAt || record.paid_at || record.paidDate || "");
    if (!due || !paid) return 0;
    return Math.max(0, Math.round((paid.getTime() - due.getTime()) / (24 * 60 * 60 * 1000)));
  });
  const lateDaysMax = Math.max(...lateDays, 0);
  const lateCount = lateDays.filter(days => days > 0).length;

  if (lateDaysMax > 7) {
    return { category: "late_over_7", label: "Kasni preko 7 dana", lateDaysMax, paidCount: paidRecords.length, lateCount };
  }
  if (lateDaysMax > 0) {
    return { category: "late_7", label: "Kasni do 7 dana", lateDaysMax, paidCount: paidRecords.length, lateCount };
  }
  return { category: "regular", label: "Redovan", lateDaysMax, paidCount: paidRecords.length, lateCount };
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

let currentTaskDueFilter = "all";
let currentTeamClientFilter = "all";
let currentBillingClientFilter = "all";

function handleStageAction(actionKey) {
  const client = getClientById(currentClientId);
  if (!client) return;

  let activityLabel = "";

  switch (actionKey) {
    case "first_contact":
      client.stage = "waiting";
      client.lastActionAt = nowISO();
      client.lastActionHuman = "Poslat prvi kontakt";
      client.nextStepText = "Proveriti da li je stigao odgovor";
      client.nextStepType = "followup";
      client.nextStepDate = shiftDateISO(2);
      activityLabel = "Poslat prvi kontakt";
      break;
    case "meeting_done":
      client.stage = "meeting_done";
      client.lastActionAt = nowISO();
      client.lastActionHuman = "Evidentiran sastanak";
      client.nextStepText = "Poslati ponudu";
      client.nextStepType = "offer";
      client.nextStepDate = shiftDateISO(1);
      activityLabel = "Evidentiran sastanak";
      break;
    case "offer_sent":
      client.stage = "offer_sent";
      client.lastActionAt = nowISO();
      client.lastActionHuman = "Poslata ponuda";
      client.nextStepText = "Uraditi follow-up";
      client.nextStepType = "followup";
      client.nextStepDate = shiftDateISO(3);
      activityLabel = "Poslata ponuda";
      break;
    case "waiting":
      client.stage = "waiting";
      client.lastActionAt = nowISO();
      client.lastActionHuman = "Postavljen status ceka odgovor";
      client.nextStepText = "Proveriti status";
      client.nextStepType = "followup";
      client.nextStepDate = shiftDateISO(3);
      activityLabel = "Postavljen status ceka odgovor";
      break;
    case "negotiation":
      client.stage = "negotiation";
      client.lastActionAt = nowISO();
      client.lastActionHuman = "Pokrenuti pregovori";
      client.nextStepText = "Pogurati odluku";
      client.nextStepType = "decision";
      client.nextStepDate = shiftDateISO(2);
      activityLabel = "Pokrenuti pregovori";
      break;
    case "won":
      client.stage = "won";
      client.lastActionAt = nowISO();
      client.lastActionHuman = "Deal dobijen";
      client.nextStepText = "";
      client.nextStepType = "";
      client.nextStepDate = "";
      if (client.payment?.workflow) client.payment.workflow.activeTask = null;
      activityLabel = "Deal dobijen";
      break;
    case "lost":
      client.stage = "lost";
      client.lastActionAt = nowISO();
      client.lastActionHuman = "Deal izgubljen";
      client.nextStepText = "";
      client.nextStepType = "";
      client.nextStepDate = "";
      if (client.payment?.workflow) client.payment.workflow.activeTask = null;
      activityLabel = "Deal izgubljen";
      break;
    default:
      return;
  }

  addActivity(client, actionKey, activityLabel, client.lastActionNote || "");
  saveClients();
  renderAll();
  openClientDrawer(client.id);
  showToast("Status je azuriran.");
}

/* ------------------------- RENDER ------------------------- */
function renderAll() {
  renderDashboard();
  renderClientsList();
  renderTeamView();
  if (typeof syncClientCreateAvailability === "function") {
    syncClientCreateAvailability();
  }
}

function switchToClientsMode(mode = "all") {
  currentClientsMode = mode;
  switchView("clientsView");
  renderClientsList();
}

function clearClientsMode() {
  currentClientsMode = "all";
  renderClientsList();
}

function getTaskEntries(options = {}) {
  const { statuses = [], overdueOnly = false, ownedOnly = true, includeClosed = true } = options;
  const wantedStatuses = new Set(statuses.map(normalizeTaskStatus));
  const entries = [];

  clients.forEach(client => {
    getClientTasks(client, { includeClosed }).forEach(task => {
      const status = normalizeTaskStatus(task.status);
      if (wantedStatuses.size && !wantedStatuses.has(status)) return;
      if (overdueOnly && !isTaskOverdue(task)) return;
      if (ownedOnly && !isTaskOwnedByCurrentUser(task)) return;

      entries.push({
        client,
        task,
        status,
        overdue: isTaskOverdue(task)
      });
    });
  });

  return entries.sort((a, b) => {
    const aDue = a.task.dueDate || "9999-12-31";
    const bDue = b.task.dueDate || "9999-12-31";
    if (aDue !== bDue) return aDue.localeCompare(bDue);
    return String(b.task.createdAt || "").localeCompare(String(a.task.createdAt || ""));
  });
}

function setTaskDueFilter(filter = "all") {
  currentTaskDueFilter = ["today", "tomorrow", "week", "none", "all"].includes(filter) ? filter : "all";
  renderDashboard();
}

function handleTeamClientFilterChange() {
  currentTeamClientFilter = getValue("teamClientFilter") || "all";
  renderTeamView();
}

function getLocalDayStart(date = new Date()) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function parseDateOnlyToLocalDay(value) {
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
  return getLocalDayStart(parsed);
}

function getTaskDueDayOffset(task) {
  const dueDay = parseDateOnlyToLocalDay(task?.dueDate || "");
  if (!dueDay) return null;

  const today = getLocalDayStart();
  return Math.round((dueDay.getTime() - today.getTime()) / (24 * 60 * 60 * 1000));
}

function taskMatchesDueFilter(task, filter = currentTaskDueFilter) {
  const dueOffset = getTaskDueDayOffset(task);
  if (filter === "all") return true;
  if (filter === "none") return dueOffset === null;
  if (dueOffset === null) return false;
  if (filter === "today") return dueOffset <= 0;
  if (filter === "tomorrow") return dueOffset === 1;
  if (filter === "week") return dueOffset >= 0 && dueOffset <= 6;
  return true;
}

function getVisibleTaskEntries() {
  const activeStatuses = new Set(["assigned", "waiting", "returned", "sent_to_billing"]);
  return getTaskEntries({ includeClosed: true }).filter(entry => {
    const status = normalizeTaskStatus(entry.status);
    const canReviewForBilling =
      status === "done" &&
      typeof canCurrentUserSendTaskToBilling === "function" &&
      canCurrentUserSendTaskToBilling(entry.client, entry.task) &&
      !entry.task.billingId &&
      !getBillingRecordBySourceTask(entry.client, entry.task.id);

    return (activeStatuses.has(status) || canReviewForBilling) && taskMatchesDueFilter(entry.task);
  });
}

function getClientTaskSummary(client) {
  const task = getClientActiveTask(client);
  return {
    title: task?.title || getClientNextStepText(client, "-"),
    dueDate: task?.dueDate || client.nextStepDate || "",
    statusLabel: task ? taskStatusLabel(task.status) : "",
    ownerName: task?.ownerName || ""
  };
}

function renderDashboard() {
  document.querySelectorAll("[data-task-due-filter]").forEach(button => {
    button.classList.toggle("is-active", button.dataset.taskDueFilter === currentTaskDueFilter);
  });

  const billingClientFilterWrap = document.getElementById("billingClientFilterWrap");
  if (billingClientFilterWrap) billingClientFilterWrap.classList.toggle("hidden", !isCurrentUserFinanceRole());

  if (isCurrentUserFinanceRole()) {
    renderBillingClientFilter();
    const billingItems = getVisibleBillingItemEntries();
    renderCardCollection("taskList", "taskListEmpty", billingItems, item => createBillingItemCard(item));
    setTextIfExists("homeTodayDate", formatTodayHeaderDate());
    setTextIfExists("homeStatTodayCount", billingItems.length);
    setTextIfExists("homeStatOverdueCount", billingItems.filter(item => normalizeBillingStatus(item.record.status) === "late").length);
    setTextIfExists("homeStatWaitingCount", billingItems.filter(item => normalizeBillingStatus(item.record.status) === "to_invoice").length);
    setTextIfExists("homeStatWeekCount", billingItems.filter(item => normalizeBillingStatus(item.record.status) === "invoiced").length);
    return;
  }

  const allTasks = getTaskEntries({ includeClosed: true }).filter(entry => ["assigned", "waiting", "returned", "sent_to_billing"].includes(normalizeTaskStatus(entry.status)));
  const visibleTasks = getVisibleTaskEntries();
  const overdueTasks = allTasks.filter(entry => entry.overdue);
  const waitingTasks = allTasks.filter(entry => entry.status === "waiting");
  const sentToBillingTasks = allTasks.filter(entry => entry.status === "sent_to_billing");

  renderCardCollection("taskList", "taskListEmpty", visibleTasks, item => createWorkflowTaskCard(item));

  setTextIfExists("homeTodayDate", formatTodayHeaderDate());
  setTextIfExists("homeStatTodayCount", allTasks.length);
  setTextIfExists("homeStatOverdueCount", overdueTasks.length);
  setTextIfExists("homeStatWaitingCount", waitingTasks.length);
  setTextIfExists("homeStatWeekCount", sentToBillingTasks.length);
}

function handleBillingClientFilterChange() {
  currentBillingClientFilter = getValue("billingClientFilter") || "all";
  renderDashboard();
}

function renderBillingClientFilter() {
  const select = document.getElementById("billingClientFilter");
  if (!select) return;

  const previousValue = currentBillingClientFilter || "all";
  const sortedClients = [...clients].sort((a, b) => (a.name || "").localeCompare(b.name || "", "sr"));
  select.innerHTML = [
    `<option value="all">Svi klijenti</option>`,
    ...sortedClients.map(client => `<option value="${escapeHtml(getClientFilterKey(client))}">${escapeHtml(client.name || "Klijent")}</option>`)
  ].join("");

  const hasPrevious = previousValue === "all" || sortedClients.some(client => getClientFilterKey(client) === previousValue);
  currentBillingClientFilter = hasPrevious ? previousValue : "all";
  select.value = currentBillingClientFilter;
  select.onchange = handleBillingClientFilterChange;
}

function getBillingItemEntries() {
  return clients.flatMap(client => {
    const clientKey = getClientFilterKey(client);
    return getBillingRecords(client).map(record => {
      refreshBillingRecordStatus(record);
      const project = getClientProjectById(client, record.projectId || record.project_id);
      return {
        client,
        clientKey,
        record,
        project,
        status: normalizeBillingStatus(record.status)
      };
    });
  }).sort((a, b) => {
    const aDue = a.record.dueDate || a.record.due_date || "9999-12-31";
    const bDue = b.record.dueDate || b.record.due_date || "9999-12-31";
    if (aDue !== bDue) return aDue.localeCompare(bDue);
    return String(b.record.createdAt || b.record.created_at || "").localeCompare(String(a.record.createdAt || a.record.created_at || ""));
  });
}

function getVisibleBillingItemEntries() {
  const entries = getBillingItemEntries();
  return currentBillingClientFilter === "all"
    ? entries
    : entries.filter(item => item.clientKey === currentBillingClientFilter);
}

function renderCardCollection(listId, emptyId, items, renderItem) {
  const list = document.getElementById(listId);
  const empty = document.getElementById(emptyId);
  if (!list || !empty) return;

  list.innerHTML = "";
  items.forEach(item => list.appendChild(renderItem(item)));
  empty.classList.toggle("hidden", items.length > 0);
}

function createWorkflowTaskActions(entry) {
  const status = normalizeTaskStatus(entry.task.status);
  const overdueAttr = entry.overdue ? " data-overdue-task=\"true\"" : "";

  if (status === "waiting") {
    return `
      <button class="btn btn-primary btn-sm" data-task-status="${entry.client.id}" data-project-id="${escapeHtml(entry.task.projectId)}" data-task-id="${escapeHtml(entry.task.id)}" data-next-status="assigned"${overdueAttr}>Aktiviraj</button>
      <button class="btn btn-secondary btn-sm" data-task-status="${entry.client.id}" data-project-id="${escapeHtml(entry.task.projectId)}" data-task-id="${escapeHtml(entry.task.id)}" data-next-status="done"${overdueAttr}>Zavrsi</button>
      <button class="btn btn-secondary btn-sm" data-task-return="${entry.client.id}" data-project-id="${escapeHtml(entry.task.projectId)}" data-task-id="${escapeHtml(entry.task.id)}">Vrati / Delegiraj</button>
    `;
  }

  if (status === "done") {
    const billingAction = typeof canCurrentUserSendTaskToBilling === "function" && canCurrentUserSendTaskToBilling(entry.client, entry.task)
      ? `<button class="btn btn-primary btn-sm" data-task-billing="${entry.client.id}" data-project-id="${escapeHtml(entry.task.projectId)}" data-task-id="${escapeHtml(entry.task.id)}">Posalji na naplatu</button>`
      : "";
    return `
      ${billingAction}
      <button class="btn btn-secondary btn-sm" data-task-return="${entry.client.id}" data-project-id="${escapeHtml(entry.task.projectId)}" data-task-id="${escapeHtml(entry.task.id)}">Vrati / Delegiraj</button>
      <button class="btn btn-secondary btn-sm" data-task-detail="${entry.client.id}">Detalji</button>
    `;
  }

  if (status === "sent_to_billing") {
    return `
      <button class="btn btn-secondary btn-sm" data-task-detail="${entry.client.id}">Detalji</button>
    `;
  }

  return `
    <button class="btn btn-primary btn-sm" data-task-status="${entry.client.id}" data-project-id="${escapeHtml(entry.task.projectId)}" data-task-id="${escapeHtml(entry.task.id)}" data-next-status="done"${overdueAttr}>Zavrsi</button>
    <button class="btn btn-secondary btn-sm" data-task-status="${entry.client.id}" data-project-id="${escapeHtml(entry.task.projectId)}" data-task-id="${escapeHtml(entry.task.id)}" data-next-status="waiting"${overdueAttr}>Stavi na cekanje</button>
    <button class="btn btn-secondary btn-sm" data-task-return="${entry.client.id}" data-project-id="${escapeHtml(entry.task.projectId)}" data-task-id="${escapeHtml(entry.task.id)}">Vrati / Delegiraj</button>
  `;
}

function bindWorkflowTaskCardActions(card) {
  card.querySelectorAll("[data-task-status]").forEach(button => {
    button.addEventListener("click", () => {
      handleTaskStatusAction(
        button.dataset.taskStatus,
        button.dataset.projectId || "",
        button.dataset.taskId || "",
        button.dataset.nextStatus || "assigned"
      );
    });
  });

  card.querySelectorAll("[data-task-return]").forEach(button => {
    button.addEventListener("click", () => {
      handleTaskReturnAction(
        button.dataset.taskReturn,
        button.dataset.projectId || "",
        button.dataset.taskId || ""
      );
    });
  });

  card.querySelectorAll("[data-task-billing]").forEach(button => {
    button.addEventListener("click", () => {
      handleSendTaskToBilling(
        button.dataset.taskBilling,
        button.dataset.projectId || "",
        button.dataset.taskId || ""
      );
    });
  });

  card.querySelectorAll("[data-task-detail]").forEach(button => {
    button.addEventListener("click", () => openClientDrawer(Number(button.dataset.taskDetail)));
  });
}

function createWorkflowTaskCard(entry, options = {}) {
  const { client, task } = entry;
  const status = normalizeTaskStatus(task.status);
  const overdue = entry.overdue || isTaskOverdue(task);
  const dueLabel = task.dueDate ? formatDate(task.dueDate) : "Bez roka";
  const delegatedBy = task.delegatedByName || "Tim";
  const delegatedTo = task.ownerName || "Moj nalog";
  const normalizedNote = String(task.note || "").replace(/\s+/g, " ").trim().toLowerCase();
  const normalizedTitle = String(task.title || "").replace(/\s+/g, " ").trim().toLowerCase();
  const noteHtml = task.note && normalizedNote !== normalizedTitle
    ? `<p class="task-card-line"><strong>NAPOMENA:</strong> ${escapeHtml(task.note)}</p>`
    : "";
  const card = document.createElement("article");
  card.className = `client-card ${overdue ? "overdue-card" : "week-card"}`;

  card.innerHTML = `
    <div class="card-head card-head-simple">
      <div class="card-title-wrap">
        <h4>${escapeHtml(task.title)}</h4>
      </div>
      <div class="task-badge-stack">
        <span class="badge ${taskStatusBadgeClass(status)}">${escapeHtml(taskStatusLabel(status))}</span>
        ${overdue ? `<span class="badge danger">Kasni</span>` : ""}
      </div>
    </div>

    <div class="card-body card-body-simple">
      <p class="task-card-line"><strong>KLIJENT:</strong> ${escapeHtml(client.name)}</p>
      <p class="task-card-line"><strong>PROJEKAT:</strong> ${escapeHtml(task.projectName || "Bez projekta")}</p>
      <p class="task-card-line"><strong>DELEGACIJA:</strong> ${escapeHtml(delegatedBy)} &rarr; ${escapeHtml(delegatedTo)}</p>
      <p class="task-card-line"><strong>ROK:</strong> ${escapeHtml(dueLabel)}</p>
      ${noteHtml}

      <div class="card-actions card-actions-simple">
        ${createWorkflowTaskActions({ ...entry, overdue })}
      </div>
    </div>
  `;

  bindWorkflowTaskCardActions(card);
  return card;
}

function createBillingItemActions(entry) {
  const status = normalizeBillingStatus(entry.record.status);
  if (status === "paid") {
    return `<button class="btn btn-secondary btn-sm" data-billing-detail="${entry.client.id}">Detalji</button>`;
  }

  const invoiceAction = status === "to_invoice" || status === "late"
    ? `<button class="btn btn-primary btn-sm" data-billing-action="invoice" data-client-id="${entry.client.id}" data-billing-id="${escapeHtml(entry.record.id)}">Oznaci kao fakturisano</button>`
    : "";

  return `
    ${invoiceAction}
    <button class="btn btn-secondary btn-sm" data-billing-action="paid" data-client-id="${entry.client.id}" data-billing-id="${escapeHtml(entry.record.id)}">Oznaci kao placeno</button>
    <button class="btn btn-secondary btn-sm" data-billing-detail="${entry.client.id}">Detalji</button>
  `;
}

function bindBillingItemCardActions(card) {
  card.querySelectorAll("[data-billing-action]").forEach(button => {
    button.addEventListener("click", () => {
      handleBillingItemAction(
        Number(button.dataset.clientId),
        button.dataset.billingId || "",
        button.dataset.billingAction || ""
      );
    });
  });

  card.querySelectorAll("[data-billing-detail]").forEach(button => {
    button.addEventListener("click", () => openPaymentModal(Number(button.dataset.billingDetail)));
  });
}

function createBillingItemCard(entry) {
  const { client, record, project } = entry;
  const status = normalizeBillingStatus(record.status);
  const dueLabel = record.dueDate || record.due_date ? formatDate(record.dueDate || record.due_date) : "Bez roka";
  const amountLabel = record.amount ? `${formatMoney(record.amount)} ${record.currency || "RSD"}` : "";
  const noteHtml = record.note
    ? `<p class="task-card-line"><strong>NAPOMENA:</strong> ${escapeHtml(record.note)}</p>`
    : "";
  const article = document.createElement("article");
  article.className = `client-card ${status === "late" ? "overdue-card" : "week-card"}`;

  article.innerHTML = `
    <div class="card-head card-head-simple">
      <div class="card-title-wrap">
        <h4>${escapeHtml(record.title || `Naplata: ${projectDisplayName(project)}`)}</h4>
      </div>
      <div class="task-badge-stack">
        <span class="badge ${status === "paid" ? "success" : status === "late" ? "danger" : "neutral"}">${escapeHtml(billingStatusLabel(status))}</span>
      </div>
    </div>

    <div class="card-body card-body-simple">
      <p class="task-card-line"><strong>KLIJENT:</strong> ${escapeHtml(client.name)}</p>
      <p class="task-card-line"><strong>PROJEKAT:</strong> ${escapeHtml(record.projectName || projectDisplayName(project))}</p>
      <p class="task-card-line"><strong>ROK:</strong> ${escapeHtml(dueLabel)}${amountLabel ? ` - ${escapeHtml(amountLabel)}` : ""}</p>
      ${record.invoiceNumber || record.invoice_number ? `<p class="task-card-line"><strong>FAKTURA:</strong> ${escapeHtml(record.invoiceNumber || record.invoice_number)}</p>` : ""}
      ${noteHtml}

      <div class="card-actions card-actions-simple">
        ${createBillingItemActions(entry)}
      </div>
    </div>
  `;

  bindBillingItemCardActions(article);
  return article;
}

function getClientsFilteredByMode(list) {
  switch (currentClientsMode) {
    case "today_actions":
      return list.filter(client => {
        const task = getClientActiveTask(client);
        return Boolean(task?.dueDate && isDueToday(task.dueDate));
      });
    case "high_priority":
      return list.filter(client => {
        const task = getClientActiveTask(client);
        return Boolean((task?.dueDate && isOverdueDate(task.dueDate)) || computePriorityBase(client) === "high");
      });
    case "weekly_actions":
      return list.filter(client => {
        const task = getClientActiveTask(client);
        return Boolean(task?.dueDate && isThisWeekDate(task.dueDate));
      });
    default:
      return list;
  }
}

function getClientsModeTitle() {
  switch (currentClientsMode) {
    case "today_actions": return "Prikaz: danasnji zadaci";
    case "high_priority": return "Prikaz: visok prioritet i kasnjenja";
    case "weekly_actions": return "Prikaz: sledeci koraci ove nedelje";
    default: return "";
  }
}

function renderClientsList() {
  const list = document.getElementById("clientsList");
  const empty = document.getElementById("clientsEmpty");
  const search = document.getElementById("clientSearch");
  const contextBar = document.getElementById("clientsModeBar");
  const contextLabel = document.getElementById("clientsModeLabel");
  const q = search ? search.value.trim().toLowerCase() : "";

  if (!list || !empty) return;

  list.innerHTML = "";

  let filtered = [...clients];
  if (q) {
    filtered = filtered.filter(c =>
      (c.name || "").toLowerCase().includes(q) ||
      (c.clientCity || "").toLowerCase().includes(q) ||
      (c.contactPerson || "").toLowerCase().includes(q) ||
      industryLabel(c.businessType).toLowerCase().includes(q)
    );
  }

  filtered = getClientsFilteredByMode(filtered);
  filtered.sort((a, b) => (a.name || "").localeCompare(b.name || "", "sr"));

  const modeTitle = getClientsModeTitle();
  if (contextBar && contextLabel) {
    contextBar.classList.toggle("hidden", !modeTitle);
    contextLabel.textContent = modeTitle;
  }

  if (filtered.length === 0) {
    empty.classList.remove("hidden");
    return;
  }

  empty.classList.add("hidden");

  filtered.forEach(client => {
    const statusText = STAGES[client.stage] || "Novi";
    const projectsCount = getClientOpenProjects(client).length;
    const pulseScore = computePulseScore(client);
    const potential = computeCommercialPotential(client);
    const priority = computePriorityBase(client);
    const card = document.createElement("article");
    card.className = `client-card priority-${priority}`;

    card.innerHTML = `
      <div class="card-head card-head-simple">
        <div class="card-title-wrap">
          <h4>${escapeHtml(client.name)}</h4>
          <p class="card-subtitle">${escapeHtml([client.clientCity, industryLabel(client.businessType)].filter(Boolean).join(" · ") || "-")}</p>
        </div>
        <span class="badge ${commercialPotentialBadgeClass(client)}">Potencijal: ${escapeHtml(potential)}</span>
      </div>

      <div class="card-body card-body-simple">
        <div class="client-card-metrics">
          <span><small>Score</small><strong>${escapeHtml(pulseScore)}%</strong></span>
          <span><small>Projekti</small><strong>${escapeHtml(projectsCount)}</strong></span>
          <span><small>Status</small><strong>${escapeHtml(statusText)}</strong></span>
        </div>

        <div class="card-actions card-actions-simple">
          <button class="btn btn-primary btn-sm" data-card-activity="${client.id}">Aktivnosti</button>
          <button class="btn btn-secondary btn-sm" data-client-detail="${client.id}">Kartica klijenta</button>
          <button class="btn btn-secondary btn-sm" data-card-payment="${client.id}" data-pro-feature="payments">Naplata</button>
        </div>
      </div>
    `;

    const activityBtn = card.querySelector("[data-card-activity]");
    const detailBtn = card.querySelector("[data-client-detail]");
    const paymentBtn = card.querySelector("[data-card-payment]");
    if (activityBtn) activityBtn.addEventListener("click", () => openActivityModal(client.id));
    if (detailBtn) detailBtn.addEventListener("click", () => openClientDrawer(client.id));
    if (paymentBtn) paymentBtn.addEventListener("click", () => openPaymentModal(client.id));

    list.appendChild(card);
  });
}

function getTeamActivityFeed() {
  const importantTypes = new Set([
    "task_created",
    "task_done",
    "task_returned",
    "task_billing_ready",
    "task_sent_to_billing",
    "task_paid",
    "billing_requested",
    "billing_invoiced",
    "billing_paid",
    "project_billing_ready"
  ]);

  return clients
    .flatMap(client => {
      const clientKey = getClientFilterKey(client);
      const log = Array.isArray(client.activityLog) ? client.activityLog : [];
      return log.filter(item => importantTypes.has(item.type)).map(item => {
        const fallbackOwnerId = item.actorId || client.ownerUserId || client.createdByUserId || "";
        const resolvedActorName =
          item.actorName ||
          getTeamMemberNameById(fallbackOwnerId, "");
        const relatedTask = item.relatedTaskId
          ? getClientTasks(client, { includeClosed: true }).find(task => task.id === item.relatedTaskId) || null
          : null;
        const actionText =
          item.taskActionText ||
          (item.type === "task_created" ? "dodelio zadatak" :
            item.type === "task_done" ? "zavrsio zadatak" :
            item.type === "task_returned" ? "vratio / delegirao follow-up" :
            item.type === "task_billing_ready" || item.type === "task_sent_to_billing" || item.type === "project_billing_ready" || item.type === "billing_requested" ? "poslao na naplatu" :
            item.type === "billing_invoiced" ? "oznacio kao fakturisano" :
            item.type === "task_paid" || item.type === "billing_paid" ? "oznacio kao naplaceno" :
            item.label || "azurirao zadatak");

        return {
          id: item.id || `${client.id}_${item.at || nowISO()}`,
          clientId: client.id,
          clientKey,
          clientName: client.name || "Klijent",
          label: item.label || client.lastActionHuman || "Aktivnost",
          note: item.note || "",
          at: item.at || client.lastActionAt || client.updatedAt || client.createdAt || nowISO(),
          ownerName: resolvedActorName,
          assigneeName: item.ownerName || relatedTask?.ownerName || getTeamMemberNameById(item.ownerId, ""),
          projectName: item.projectName || relatedTask?.projectName || "Bez projekta",
          taskTitle: item.taskTitle || relatedTask?.title || item.note || item.label || "Zadatak",
          dueDate: item.dueDate || relatedTask?.dueDate || "",
          actionText
        };
      });
    })
    .sort((a, b) => new Date(b.at || 0) - new Date(a.at || 0));
}

function getTeamRecentWeekCount(feed) {
  const weekAgo = Date.now() - (7 * 24 * 60 * 60 * 1000);
  return feed.filter(item => new Date(item.at).getTime() >= weekAgo).length;
}

function renderTeamClientFilter() {
  const select = document.getElementById("teamClientFilter");
  if (!select) return;

  const previousValue = currentTeamClientFilter || "all";
  const sortedClients = [...clients].sort((a, b) => (a.name || "").localeCompare(b.name || "", "sr"));
  select.innerHTML = [
    `<option value="all">Svi klijenti</option>`,
    ...sortedClients.map(client => `<option value="${escapeHtml(getClientFilterKey(client))}">${escapeHtml(client.name || "Klijent")}</option>`)
  ].join("");

  const hasPrevious = previousValue === "all" || sortedClients.some(client => getClientFilterKey(client) === previousValue);
  currentTeamClientFilter = hasPrevious ? previousValue : "all";
  select.value = currentTeamClientFilter;
}

function getClientFilterKey(client) {
  return String(client?.id ?? client?.clientId ?? client?.name ?? "").trim();
}

function createTeamActivityCard(item) {
  const article = document.createElement("article");
  article.className = "simple-card team-activity-card";

  const actorLabel = item.ownerName ? escapeHtml(item.ownerName) : "Tim workspace-a";
  const assigneeLabel = item.assigneeName ? escapeHtml(item.assigneeName) : "Tim";
  const actionLabel =
    item.actionText === "dodelio zadatak" ? "Dodeljen zadatak" :
    item.actionText === "zavrsio zadatak" ? "Zavrsen zadatak" :
    item.actionText === "vratio / delegirao follow-up" ? "Vracen / delegiran follow-up" :
    item.actionText === "poslao na naplatu" || item.actionText === "oznacio kao spremno za naplatu" ? "Poslat na naplatu" :
    item.actionText === "oznacio kao fakturisano" ? "Fakturisano" :
    item.actionText === "oznacio kao naplaceno" ? "Naplaceno" :
    item.label || "Aktivnost";
  const dueLabel = item.dueDate ? formatDate(item.dueDate) : "Bez roka";

  article.innerHTML = `
    <div class="team-activity-topline">
      <p class="team-project-line"><strong>PROJEKAT:</strong> ${escapeHtml(item.projectName)}</p>
      <span class="badge neutral">${escapeHtml(item.clientName)}</span>
    </div>
    <p class="team-task-line">${escapeHtml(actionLabel)}: ${escapeHtml(item.taskTitle)}</p>
    <p class="team-delegation-line">${actorLabel} &rarr; ${assigneeLabel}</p>
    <p class="team-activity-time"><strong>ROK:</strong> ${escapeHtml(dueLabel)} &bull; ${escapeHtml(formatDateTime(item.at))}</p>
  `;

  article.addEventListener("click", () => openClientDrawer(item.clientId));
  return article;
}

function renderTeamView() {
  const feed = getTeamActivityFeed();
  renderTeamClientFilter();
  const filteredFeed = currentTeamClientFilter === "all"
    ? feed
    : feed.filter(item => item.clientKey === currentTeamClientFilter);
  const feedList = document.getElementById("teamActivityList");
  const empty = document.getElementById("teamActivityEmpty");
  const invitesCount = Array.isArray(currentWorkspaceInvites) ? currentWorkspaceInvites.length : 0;
  const membersCount = Array.isArray(currentWorkspaceMembers) ? currentWorkspaceMembers.length : 0;

  setTextIfExists("teamStatMembers", membersCount);
  setTextIfExists("teamStatClients", clients.length);
  setTextIfExists("teamStatWeekActivities", getTeamRecentWeekCount(feed));
  setTextIfExists("teamStatInvites", invitesCount);
  setTextIfExists(
    "teamFeedHint",
    currentWorkspace
      ? `Poslednje promene unutar workspace-a ${currentWorkspace.name}.`
      : "Kad se povezes na workspace i pocnes da radis sa klijentima, ovde ce se pojaviti timski tragovi."
  );

  if (!feedList || !empty) return;

  feedList.innerHTML = "";
  const recentItems = filteredFeed.slice(0, 8);
  recentItems.forEach(item => feedList.appendChild(createTeamActivityCard(item)));
  feedList.classList.toggle("hidden", recentItems.length === 0);
  empty.classList.toggle("hidden", recentItems.length > 0);
}

function createTodayCard(client, suggestion, task) {
  const card = document.createElement("article");
  const priorityClass = suggestion.priority === "high" ? "danger" : suggestion.priority === "medium" ? "warning" : "neutral";
  const taskTitle = task?.title || getClientNextStepText(client, suggestion.actionLabel || "Nema");
  const dueDate = task?.dueDate || client.nextStepDate || "";
  const taskOwner = task?.ownerName ? `<p class="card-subtitle">Vlasnik: ${escapeHtml(task.ownerName)}</p>` : "";
  const isBillingTask = task?.type === "billing";
  const primaryActionLabel = isBillingTask ? "Otvori naplatu" : "Otvori aktivnost";

  card.className = `today-card priority-${suggestion.priority}`;
  card.innerHTML = `
    <div class="today-card-topline">
      <span class="badge ${priorityClass}">Priority: ${escapeHtml(priorityLabel(suggestion.priority))}</span>
    </div>

    <div class="card-head card-head-simple">
      <div class="card-title-wrap">
        <h4>${escapeHtml(client.name)}</h4>
      </div>
    </div>

    <div class="card-body today-card-body">
      <p class="card-status-line"><strong>Trenutni status:</strong> ${escapeHtml(STAGES[client.stage] || "-")} (${escapeHtml(formatDate(client.lastActionAt))})</p>
      <p class="today-suggestion-line"><strong>Sledeca akcija:</strong> ${escapeHtml(taskTitle)}</p>
      <p class="card-due-line"><strong>Rok:</strong> ${escapeHtml(dueDate ? formatDate(dueDate) : "-")} (danas)</p>
      ${taskOwner}

      <div class="card-actions today-actions">
        <button class="btn btn-primary btn-sm btn-danger-soft" data-today-action="${client.id}">${escapeHtml(primaryActionLabel)}</button>
        <button class="btn btn-secondary btn-sm btn-info-soft" data-today-detail="${client.id}">Detalji klijenta</button>
      </div>
    </div>
  `;

  const actionBtn = card.querySelector("[data-today-action]");
  const detailBtn = card.querySelector("[data-today-detail]");

  if (actionBtn) {
    actionBtn.addEventListener("click", () => {
      if (isBillingTask) {
        openPaymentModal(client.id, { projectId: task?.projectId || "" });
        return;
      }

      openActivityModal(client.id, {
        projectId: task?.projectId || "",
        taskId: task?.id || "",
        lockProject: Boolean(task?.projectId),
        source: "dashboard"
      });
    });
  }

  if (detailBtn) {
    detailBtn.addEventListener("click", () => openClientDrawer(client.id));
  }

  return card;
}

function createWaitingCard(client) {
  const card = document.createElement("article");
  const waitingDays = daysSince(client.lastActionAt);
  const task = getClientActiveTask(client);
  const lastAction = client.lastActionHuman || "Poslata poruka";

  card.className = "client-card waiting-card";
  card.innerHTML = `
    <div class="card-head card-head-simple">
      <div class="card-title-wrap">
        <h4>${escapeHtml(client.name)}</h4>
        <p class="card-subtitle">${escapeHtml(client.clientCity || "-")}</p>
      </div>
      <span class="badge warning">Ceka odgovor</span>
    </div>

    <div class="card-body card-body-simple">
      <p class="card-status-line"><strong>Poslednja akcija:</strong> ${escapeHtml(lastAction)}</p>
      <p class="card-due-line"><strong>Akcija na cekanju:</strong> ${escapeHtml(task?.title || getClientNextStepText(client, "-"))}</p>
      <p class="card-subtitle">${escapeHtml(task?.dueDate ? `Rok: ${formatDate(task.dueDate)}` : "Bez roka")}</p>
      <p class="card-subtitle">pre ${waitingDays} ${waitingDays === 1 ? "dan" : "dana"}</p>

      <div class="card-actions card-actions-simple">
        <button class="btn btn-secondary btn-sm" data-waiting-detail="${client.id}">Detalji klijenta</button>
      </div>
    </div>
  `;

  const detailBtn = card.querySelector("[data-waiting-detail]");
  if (detailBtn) {
    detailBtn.addEventListener("click", () => openClientDrawer(client.id));
  }

  return card;
}

function createTaskCard(client, kind) {
  const card = document.createElement("article");
  const task = getClientActiveTask(client);
  const dueDate = task?.dueDate || client.nextStepDate || "";
  const dueDays = daysUntil(dueDate);
  const badgeClass = kind === "overdue" ? "danger" : "neutral";
  const badgeText =
    kind === "overdue"
      ? "Kasni"
      : dueDays === 0
        ? "Danas"
        : `Za ${dueDays} dana`;

  card.className = `client-card ${kind === "overdue" ? "overdue-card" : "week-card"}`;
  card.innerHTML = `
    <div class="card-head card-head-simple">
      <div class="card-title-wrap">
        <h4>${escapeHtml(client.name)}</h4>
        <p class="card-subtitle">${escapeHtml(client.clientCity || "-")}</p>
      </div>
      <span class="badge ${badgeClass}">${escapeHtml(badgeText)}</span>
    </div>

    <div class="card-body card-body-simple">
      <p class="card-status-line"><strong>Sledeca akcija:</strong> ${escapeHtml(task?.title || getClientNextStepText(client, "Nije definisano"))}</p>
      <p class="card-due-line"><strong>Rok:</strong> ${escapeHtml(dueDate ? formatDate(dueDate) : "-")}</p>

      <div class="card-actions card-actions-simple">
        <button class="btn btn-secondary btn-sm" data-task-detail="${client.id}">Detalji klijenta</button>
      </div>
    </div>
  `;

  const detailBtn = card.querySelector("[data-task-detail]");
  if (detailBtn) {
    detailBtn.addEventListener("click", () => openClientDrawer(client.id));
  }

  return card;
}

function getStartOfWeek(date = new Date()) {
  const d = new Date(date);
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

function getWeeklyActivities() {
  const weekStart = getStartOfWeek();
  const activities = [];

  clients.forEach(client => {
    const log = Array.isArray(client.activityLog) ? client.activityLog : [];
    log.forEach(item => {
      const at = new Date(item.at);
      if (!Number.isNaN(at.getTime()) && at >= weekStart) {
        activities.push({
          clientName: client.name || "Klijent",
          label: item.label || "Aktivnost",
          note: item.note || "",
          at: item.at
        });
      }
    });
  });

  activities.sort((a, b) => new Date(b.at) - new Date(a.at));
  return activities;
}

function openWeeklyActionsModal() {
  if (!requireProFeature("weekly_actions")) return;

  const modal = document.getElementById("weeklyActionsModal");
  const list = document.getElementById("weeklyActionsList");
  const empty = document.getElementById("weeklyActionsEmpty");
  if (!modal || !list || !empty) return;

  const activities = getWeeklyActivities();
  list.innerHTML = "";

  if (!activities.length) {
    empty.classList.remove("hidden");
  } else {
    empty.classList.add("hidden");
    activities.forEach(item => {
      const row = document.createElement("article");
      row.className = "weekly-action-item";
      row.innerHTML = `
        <div class="weekly-action-head">
          <strong>${escapeHtml(item.clientName)}</strong>
          <span>${escapeHtml(formatDateTime(item.at))}</span>
        </div>
        <p class="weekly-action-label">${escapeHtml(item.label)}</p>
        <p class="weekly-action-note">${escapeHtml(item.note || "-")}</p>
      `;
      list.appendChild(row);
    });
  }

  modal.classList.remove("hidden");
  modal.setAttribute("aria-hidden", "false");
}

function closeWeeklyActionsModal() {
  const modal = document.getElementById("weeklyActionsModal");
  if (!modal) return;
  modal.classList.add("hidden");
  modal.setAttribute("aria-hidden", "true");
}

/* ------------------------- MODALS ------------------------- */
function openClientModal() {
  const modal = document.getElementById("clientModal");
  if (!modal) return;
  modal.classList.remove("hidden");
  modal.setAttribute("aria-hidden", "false");
}

function closeClientModal() {
  const modal = document.getElementById("clientModal");
  if (!modal) return;
  modal.classList.add("hidden");
  modal.setAttribute("aria-hidden", "true");
}

/* ------------------------- IMPORT / EXPORT ------------------------- */
function exportClients() {
  try {
    const blob = new Blob([JSON.stringify(clients, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `pulse-clients-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
    showToast("Baza je eksportovana.");
  } catch {
    showToast("Export nije uspeo.");
  }
}

function importClients(e) {
  const file = e.target.files?.[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = () => {
    try {
      const imported = JSON.parse(reader.result);
      if (!Array.isArray(imported)) throw new Error("Invalid format");

      const sure = confirm("Da li zelis da zamenis postojecu bazu u browseru importovanim podacima?");
      if (!sure) {
        e.target.value = "";
        return;
      }

      if (isFreeClientLimitReached(imported.length)) {
        showToast(getFreePlanLimitText());
        openLicenseModal("deal_info");
        e.target.value = "";
        return;
      }

      clients = imported;
      migrateClients();
      saveClients();
      renderAll();
      showToast("Baza je importovana.");
    } catch {
      showToast("Import nije uspeo. Proveri JSON fajl.");
    } finally {
      e.target.value = "";
    }
  };
  reader.readAsText(file);
}

/* ------------------------- UTIL LABELS ------------------------- */
function priorityLabel(value) {
  switch (value) {
    case "high": return "Visok";
    case "medium": return "Srednji";
    case "low": return "Nizak";
    default: return "Nema";
  }
}

function commercialPotentialBadgeClass(client) {
  const potential = computeCommercialPotential(client);
  if (potential === "Jak") return "success";
  if (potential === "Solidan") return "warning";
  return "neutral";
}

/* ------------------------- DOM HELPERS ------------------------- */
function setTextIfExists(id, value) {
  const el = document.getElementById(id);
  if (el) el.textContent = value;
}

function setValueIfExists(id, value) {
  const el = document.getElementById(id);
  if (el) el.value = value;
}

function setClassIfExists(id, className) {
  const el = document.getElementById(id);
  if (el) el.className = className;
}

function getValue(id) {
  const el = document.getElementById(id);
  return el ? el.value : "";
}

function shiftDateISO(days) {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

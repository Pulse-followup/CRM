/* ------------------------- DRAWER CLEAN ------------------------- */

function openClientDrawer(id) {
  const client = getClientById(id);
  if (!client) return;

  currentClientId = id;

  renderCleanDrawer(client);

  const drawer = document.getElementById("clientDrawer");
  if (drawer) {
    drawer.classList.remove("hidden");
    drawer.setAttribute("aria-hidden", "false");
  }
}

function closeClientDrawer() {
  const drawer = document.getElementById("clientDrawer");
  if (drawer) {
    if (drawer.contains(document.activeElement)) document.activeElement.blur();
    drawer.classList.add("hidden");
    drawer.setAttribute("aria-hidden", "true");
  }
  currentClientId = null;
}

function renderCleanDrawer(client) {
  const cityText = getClientCity(client) || "-";
  const addressText = getClientAddress(client) || "-";
  const statusText = "";
  const days = "";

  setTextIfExists("drawerClientName", client.name || "Klijent");
  setTextIfExists("drawerClientSubtitle", `${cityText} • ${statusText} • pre ${days} dana`);

  setTextIfExists("drawerClientSubtitle", cityText);
  setTextIfExists("detailClientName", client.name || "-");
  setTextIfExists("detailCity", cityText);
  setTextIfExists("detailAddress", addressText);
  renderContacts(client);
  renderCommercialInputs(client);
  renderProjects(client);
}

function renderContacts(client) {
  const list = document.getElementById("contactsList");
  const empty = document.getElementById("contactsEmpty");
  if (!list || !empty) return;

  const contacts = getClientContacts(client);
  list.innerHTML = "";
  empty.classList.toggle("hidden", contacts.length > 0);

  contacts.forEach(contact => {
    const group = document.createElement("div");
    group.className = "detail-group";
    group.innerHTML = `
      <h5>${escapeHtml(contact.name || "Kontakt")}</h5>
      <dl class="detail-list">
        <div>
          <dt>Funkcija</dt>
          <dd>${escapeHtml(contact.role || "-")}</dd>
        </div>
        <div>
          <dt>Email</dt>
          <dd>${escapeHtml(contact.email || "-")}</dd>
        </div>
        <div>
          <dt>Telefon</dt>
          <dd>${escapeHtml(contact.phone || "-")}</dd>
        </div>
      </dl>
    `;
    list.appendChild(group);
  });
}

function commercialNumberLabel(value) {
  return value === null || value === undefined || value === "" ? "-" : String(value);
}

function renderCommercialInputs(client) {
  const inputs = getClientCommercialInputs(client);

  setTextIfExists("detailBusinessType", industryLabel(inputs.businessType));
  setTextIfExists("detailRevenueBand", revenueBandLabel(inputs.revenueBand));
  setTextIfExists("detailEmployeeCount", commercialNumberLabel(inputs.employeeCount));
  setTextIfExists("detailLocationCount", commercialNumberLabel(inputs.locationCount));
  setTextIfExists("detailDecisionLevel", decisionLevelLabel(inputs.decisionLevel));
  setTextIfExists("detailRelationshipLevel", relationshipLevelLabel(inputs.relationshipLevel));
  setTextIfExists("detailInnovationReady", yesNoLabel(inputs.innovationReady));
}

function projectValueLabel(value) {
  return value === null || value === undefined || value === "" ? "" : String(value);
}

function taskActionTypeLabel(value) {
  switch (value) {
    case "poziv": return "Poziv";
    case "poruka": return "Poruka";
    case "email": return "Email";
    case "sastanak": return "Sastanak";
    case "ponuda": return "Ponuda";
    case "prodaja": return "Prodaja";
    case "usluga": return "Usluga";
    // Activity modal action types
    case "phone_call": return "Poziv";
    case "message": return "Poruka";
    case "meeting_held": return "Sastanak";
    case "offer_sent": return "Ponuda";
    case "production": return "Izrada";
    case "internal_note": return "Interno";
    default: return "-";
  }
}

function taskEntityStatusLabel(value) {
  switch (value) {
    case "dodeljen": return "Dodeljen";
    case "u_radu": return "U radu";
    case "na_cekanju": return "Na cekanju";
    case "zavrsen": return "Zavrsen";
    case "vracen": return "Vracen";
    case "otkazan": return "Otkazan";
    case "poslat_na_naplatu": return "Poslat na naplatu";
    case "naplacen": return "Naplacen";
    default: return "-";
  }
}

function taskEntityStatusBadgeClass(value) {
  switch (value) {
    case "u_radu": return "badge success";
    case "na_cekanju": return "badge warning";
    case "zavrsen": return "badge success";
    case "poslat_na_naplatu": return "badge info";
    case "naplacen": return "badge success";
    case "vracen": return "badge neutral";
    case "otkazan": return "badge neutral";
    case "dodeljen":
    default: return "badge neutral";
  }
}

function taskReviewStatusLabel(value) {
  switch (value) {
    case "pending_review": return "Ceka pregled admina";
    case "cost_added": return "Ukljuceno u trosak projekta";
    case "archived_no_billing": return "Arhivirano bez naplate";
    case "returned": return "Vraceno na doradu";
    default: return "";
  }
}

function getEffectiveTaskReviewStatus(task) {
  const reviewStatus = String(task?.reviewStatus || "").trim();
  if (reviewStatus) return reviewStatus;
  return String(task?.status || "").trim() === "zavrsen" ? "pending_review" : "";
}

function taskBillableStatusLabel(value) {
  switch (value) {
    case "billable": return "Ukljuceno u trosak projekta";
    case "non_billable": return "Arhivirano bez naplate";
    default: return "";
  }
}

function formatTaskCostRsd(value) {
  const amount = Number(value || 0);
  return `${new Intl.NumberFormat("sr-RS", { maximumFractionDigits: 0 }).format(Number.isFinite(amount) ? amount : 0)} RSD`;
}

function getTaskHourlyRate(task) {
  const assigneeId = String(task?.assignedToUserId || task?.assignedTo || "").trim();
  const currentUser = getCurrentTaskUserMetadata();
  const workspaceMember = typeof getAssignableWorkspaceMembers === "function"
    ? getAssignableWorkspaceMembers().find(member => String(member.id) === assigneeId)
    : null;
  const remembered = typeof getRememberedMemberProfile === "function" ? getRememberedMemberProfile(assigneeId) : null;
  const currentProfileRate = currentUser.userId && currentUser.userId === assigneeId
    ? (currentProfile?.hourlyRate ?? currentProfile?.hourly_rate ?? null)
    : null;
  const rawRate = workspaceMember?.hourlyRate ??
    workspaceMember?.hourly_rate ??
    remembered?.hourlyRate ??
    remembered?.hourly_rate ??
    currentProfileRate ??
    1500;
  const rate = Number(rawRate);
  return Number.isFinite(rate) && rate > 0 ? rate : 1500;
}

function calculateTaskLaborCost(timeSpentMinutes, task) {
  const minutes = Number(timeSpentMinutes || 0);
  if (!Number.isFinite(minutes) || minutes <= 0) return 0;
  return Math.round((minutes / 60) * getTaskHourlyRate(task));
}

function getTaskCostInputState(task) {
  const currentUser = getCurrentTaskUserMetadata();
  const currentUserId = String(currentUser.userId || "").trim();
  const assignedToUserId = String(task?.assignedToUserId || task?.assignedTo || "").trim();
  const status = String(task?.status || "").trim();
  const reviewStatus = getEffectiveTaskReviewStatus(task);
  const isAssignedWorker = Boolean(currentUserId && assignedToUserId && currentUserId === assignedToUserId);
  const isAdminReview = currentUser.isAdmin && status === "zavrsen" && reviewStatus === "pending_review";
  const isWorkerEntry = isAssignedWorker && ["dodeljen", "u_radu", "na_cekanju"].includes(status);

  return {
    currentUser,
    isAssignedWorker,
    isAdminReview,
    isWorkerEntry,
    shouldShow: isAdminReview || isWorkerEntry
  };
}

function renderTaskReviewInputs(task) {
  const panel = document.getElementById("taskDetailReviewInputs");
  if (!panel) return;

  const { shouldShow } = getTaskCostInputState(task);

  panel.classList.toggle("hidden", !shouldShow);
  if (!shouldShow) return;

  setValueIfExists("taskReviewTimeSpent", task.timeSpentMinutes || 0);
  setValueIfExists("taskReviewMaterialCost", task.materialCost || 0);
  setValueIfExists("taskReviewMaterialDescription", task.materialDescription || "");
}

function collectTaskReviewCostPayload(task, options = {}) {
  const { errorMessage = "Unesite utroseno vreme." } = options;
  const timeSpentMinutes = Number(getValue("taskReviewTimeSpent") || 0);
  if (!Number.isFinite(timeSpentMinutes) || timeSpentMinutes <= 0) {
    showToast(errorMessage);
    return null;
  }

  const materialCostRaw = Number(getValue("taskReviewMaterialCost") || 0);
  const materialCost = Number.isFinite(materialCostRaw) && materialCostRaw > 0
    ? Math.round(materialCostRaw)
    : 0;
  const materialDescription = String(getValue("taskReviewMaterialDescription") || "").trim();

  return {
    timeSpentMinutes: Math.round(timeSpentMinutes),
    laborCost: calculateTaskLaborCost(timeSpentMinutes, task),
    materialCost,
    materialDescription
  };
}

function taskDueDateShortLabel(value) {
  if (!value) return "Bez roka";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Bez roka";
  return date.toLocaleDateString("sr-RS", {
    day: "2-digit",
    month: "2-digit"
  });
}

function getAssignableTaskMemberById(userId) {
  if (!userId || typeof getAssignableWorkspaceMembers !== "function") return null;
  return getAssignableWorkspaceMembers().find(member => String(member.id) === String(userId)) || null;
}

function taskMemberLabel(member) {
  return member ? (member.name || member.email || member.id || "") : "";
}

function getCurrentTaskUserMetadata() {
  const appRole = typeof getCurrentAppRole === "function" ? getCurrentAppRole() : "admin";
  return {
    userId: supabaseUser?.id ? String(supabaseUser.id) : null,
    label: getCurrentUserDisplayName(),
    role: appRole,
    isAdmin: appRole === "admin"
  };
}

function getTaskAssignedUserId(task) {
  return String(task?.assignedToUserId || task?.assignedTo || "").trim();
}

function getTaskPermissionContext(task) {
  const currentUser = getCurrentTaskUserMetadata();
  const currentUserId = String(currentUser.userId || "").trim();
  const assignedUserId = getTaskAssignedUserId(task);
  const isOwner = Boolean(currentUserId && assignedUserId && assignedUserId === currentUserId);
  const isAdmin = Boolean(currentUser.isAdmin);

  return {
    currentUser,
    currentUserId,
    assignedUserId,
    isOwner,
    isAdmin,
    isNonOwner: !isOwner && !isAdmin,
    canTakeOver: Boolean(currentUserId && !isOwner),
    canDelegate: Boolean(isOwner || isAdmin),
    canManageStatus: Boolean(isOwner || isAdmin)
  };
}

function renderProjects(client) {
  const list = document.getElementById("projectsList");
  const empty = document.getElementById("projectsEmpty");
  const archivedBlock = document.getElementById("archivedProjectsBlock");
  const archivedList = document.getElementById("archivedProjectsList");
  if (!list || !empty) return;

  const clientProjects = typeof getProjectsByClientId === "function"
    ? getProjectsByClientId(client.id)
    : [];
  const activeProjects = clientProjects.filter(project => project.archived !== true);
  const archivedProjects = clientProjects.filter(project => project.archived === true);

  list.innerHTML = "";
  empty.classList.toggle("hidden", activeProjects.length > 0);

  renderProjectItems(list, activeProjects, "active");

  list.querySelectorAll("[data-project-edit-id]").forEach(button => {
    button.addEventListener("click", () => openEditProjectModal(button.dataset.projectEditId));
  });
  list.querySelectorAll("[data-project-archive-id]").forEach(button => {
    button.addEventListener("click", () => archiveProject(button.dataset.projectArchiveId));
  });
  list.querySelectorAll("[data-project-tasks-id]").forEach(button => {
    button.addEventListener("click", () => openProjectTasksModal(button.dataset.projectTasksId));
  });

  if (archivedBlock && archivedList) {
    archivedList.innerHTML = "";
    archivedBlock.classList.toggle("hidden", archivedProjects.length === 0);
    renderProjectItems(archivedList, archivedProjects, "archived");
    archivedList.querySelectorAll("[data-project-unarchive-id]").forEach(button => {
      button.addEventListener("click", () => unarchiveProject(button.dataset.projectUnarchiveId));
    });
    archivedList.querySelectorAll("[data-project-tasks-id]").forEach(button => {
      button.addEventListener("click", () => openProjectTasksModal(button.dataset.projectTasksId));
    });
  }
}

function renderProjectItems(list, projectItems, mode) {
  projectItems.forEach(project => {
    const item = document.createElement("div");
    item.className = "project-list-item";
    const projectMeta = [
      projectFrequencyLabel(project.frequency),
      projectValueLabel(project.estimatedValue)
    ].filter(value => value && value !== "-");
    const actions = mode === "archived"
      ? `
        <div class="project-action-row project-action-row-primary">
          <button type="button" class="btn btn-primary btn-sm" data-project-tasks-id="${escapeHtml(project.id)}">Taskovi</button>
        </div>
        <div class="project-action-row">
          <button type="button" class="btn btn-secondary btn-sm" data-project-unarchive-id="${escapeHtml(project.id)}">Vrati</button>
        </div>
      `
      : `
        <div class="project-action-row project-action-row-primary">
          <button type="button" class="btn btn-primary btn-sm" data-project-tasks-id="${escapeHtml(project.id)}">Taskovi</button>
        </div>
        <div class="project-action-row">
          <button type="button" class="btn btn-secondary btn-sm" data-project-edit-id="${escapeHtml(project.id)}">Izmeni</button>
          <button type="button" class="btn btn-secondary btn-sm project-archive-btn" data-project-archive-id="${escapeHtml(project.id)}">Arhiviraj</button>
        </div>
      `;
      const taskCount = getTasksByProjectId(project.id).length;
      const costSummary = getProjectCostSummary(project.id);

      item.innerHTML = `
        <div class="project-list-item-head">
          <strong>${escapeHtml(project.name || "Projekat")}</strong>
        </div>
        <p class="project-meta-line">${escapeHtml(projectTypeLabel(project.type))} &bull; ${escapeHtml(projectStatusLabel(project.status))}</p>
        ${projectMeta.length ? `<p class="project-meta-line project-meta-secondary">${escapeHtml(projectMeta.join(" - "))}</p>` : ""}
        <p class="project-task-summary">Taskovi: ${taskCount}</p>
        <p class="project-task-summary">Obracun: ${escapeHtml(formatTaskCostRsd(costSummary.totalCost))}</p>
        <div class="project-list-actions">${actions}</div>
      `;
      list.appendChild(item);
    });
  }

function openNewProjectModal(clientId) {
  const client = clients.find(c => String(c.id) === String(clientId));
  if (!client) return;

  const form = document.getElementById("projectForm");
  if (form) form.reset();

  setValueIfExists("projectId", "");
  setValueIfExists("projectClientId", client.id);
  setTextIfExists("projectModalTitle", "Novi projekat");
  setTextIfExists("projectModalSubtitle", `Dodaj projekat za klijenta: ${client.name || "Klijent"}.`);

  openProjectModal();
}

function openEditProjectModal(projectId) {
  const project = (Array.isArray(projects) ? projects : [])
    .find(item => String(item.id) === String(projectId));
  if (!project) {
    showToast("Projekat nije pronadjen.");
    return;
  }

  const client = clients.find(c => String(c.id) === String(project.clientId));
  if (!client) {
    showToast("Klijent nije pronadjen.");
    return;
  }

  const form = document.getElementById("projectForm");
  if (form) form.reset();

  setValueIfExists("projectId", project.id);
  setValueIfExists("projectClientId", project.clientId);
  setValueIfExists("projectName", project.name || "");
  setValueIfExists("projectType", project.type || "");
  setValueIfExists("projectFrequency", project.frequency || "");
  setValueIfExists("projectEstimatedValue", project.estimatedValue ?? "");
  setValueIfExists("projectStatus", project.status || "");
  setTextIfExists("projectModalTitle", "Izmeni projekat");
  setTextIfExists("projectModalSubtitle", `Azuriraj projekat za klijenta: ${client.name || "Klijent"}.`);

  openProjectModal();
}

function openProjectModal() {
  const modal = document.getElementById("projectModal");
  if (!modal) return;
  modal.classList.remove("hidden");
  modal.setAttribute("aria-hidden", "false");
}

function closeProjectModal() {
  const modal = document.getElementById("projectModal");
  if (!modal) return;
  if (modal.contains(document.activeElement)) document.activeElement.blur();
  modal.classList.add("hidden");
  modal.setAttribute("aria-hidden", "true");
}

async function handleProjectSubmit(e) {
  e.preventDefault();

  const projectId = getValue("projectId");
  const clientId = getValue("projectClientId");
  const client = clients.find(c => String(c.id) === String(clientId));
  if (!client) {
    showToast("Klijent nije pronadjen.");
    return;
  }

  const name = getValue("projectName").trim();
  if (!name) {
    showToast("Unesi naziv projekta.");
    return;
  }

  const estimatedValueRaw = getValue("projectEstimatedValue");
  const estimatedValue = estimatedValueRaw === "" ? null : Number(estimatedValueRaw);

  if (!Array.isArray(projects)) projects = [];

  if (projectId) {
    const idx = projects.findIndex(project => String(project.id) === String(projectId));
    if (idx === -1) {
      showToast("Projekat nije pronadjen.");
      return;
    }

    const existingProject = projects[idx];
    const updatedAt = nowISO();
    const updatedProject = {
      ...existingProject,
      id: existingProject.id,
      clientId: String(existingProject.clientId),
      name,
      type: getValue("projectType"),
      frequency: getValue("projectFrequency"),
      estimatedValue: Number.isNaN(estimatedValue) ? null : estimatedValue,
      status: getValue("projectStatus"),
      createdAt: existingProject.createdAt || updatedAt,
      updatedAt
    };

    projects[idx] = updatedProject;
    if (!saveProjects()) {
      projects[idx] = existingProject;
      showToast("Projekat nije sacuvan.");
      return;
    }
    const synced = await persistProjects({ immediate: true });

    closeProjectModal();
    renderProjects(client);
    showToast(synced ? "Projekat je azuriran." : "Projekat je sacuvan lokalno, ali sync nije uspeo.");
    return;
  }

  const createdAt = nowISO();
  const newProject = {
    id: createLocalEntityId("project"),
    clientId: String(client.id),
    name,
    type: getValue("projectType"),
    frequency: getValue("projectFrequency"),
    estimatedValue: Number.isNaN(estimatedValue) ? null : estimatedValue,
    status: getValue("projectStatus"),
    archived: false,
    archivedAt: null,
    createdAt,
    updatedAt: createdAt
  };

  projects.unshift(newProject);
  if (!saveProjects()) {
    projects = projects.filter(project => project.id !== newProject.id);
    showToast("Projekat nije sacuvan.");
    return;
  }
  const synced = await persistProjects({ immediate: true });

  closeProjectModal();
  renderProjects(client);
  showToast(synced ? "Projekat je dodat." : "Projekat je sacuvan lokalno, ali sync nije uspeo.");
}

async function updateProjectArchiveState(projectId, archived) {
  if (!Array.isArray(projects)) projects = [];

  const idx = projects.findIndex(project => String(project.id) === String(projectId));
  if (idx === -1) {
    showToast("Projekat nije pronadjen.");
    return;
  }

  const existingProject = projects[idx];
  const client = clients.find(c => String(c.id) === String(existingProject.clientId));
  if (!client) {
    showToast("Klijent nije pronadjen.");
    return;
  }

  const updatedAt = nowISO();
  projects[idx] = {
    ...existingProject,
    id: existingProject.id,
    clientId: String(existingProject.clientId),
    archived,
    archivedAt: archived ? updatedAt : null,
    createdAt: existingProject.createdAt || updatedAt,
    updatedAt
  };

  if (!saveProjects()) {
    projects[idx] = existingProject;
    showToast("Projekat nije sacuvan.");
    return;
  }
  const synced = await persistProjects({ immediate: true });

  renderProjects(client);
  showToast(
    synced
      ? (archived ? "Projekat je arhiviran." : "Projekat je vracen iz arhive.")
      : "Promena je sacuvana lokalno, ali sync nije uspeo."
  );
}

function archiveProject(projectId) {
  void updateProjectArchiveState(projectId, true);
}

function unarchiveProject(projectId) {
  void updateProjectArchiveState(projectId, false);
}

function openProjectTasksModal(projectId) {
  const project = getProjectById(projectId);
  if (!project) {
    showToast("Projekat nije pronadjen.");
    return;
  }

  currentTaskListProjectId = String(project.id);
  renderProjectTasksModal(project);

  const modal = document.getElementById("projectTasksModal");
  if (!modal) return;
  modal.classList.remove("hidden");
  modal.setAttribute("aria-hidden", "false");
}

function closeProjectTasksModal() {
  const modal = document.getElementById("projectTasksModal");
  if (!modal) return;
  if (modal.contains(document.activeElement)) document.activeElement.blur();
  modal.classList.add("hidden");
  modal.setAttribute("aria-hidden", "true");
}

function renderProjectTasksModal(project) {
  const list = document.getElementById("projectTasksList");
  const empty = document.getElementById("projectTasksEmpty");
  if (!list || !empty) return;

  const projectTasks = getTasksByProjectId(project.id)
    .slice()
    .sort((a, b) => Number(a.sequenceNumber || 0) - Number(b.sequenceNumber || 0));

  setTextIfExists("projectTasksModalTitle", `Taskovi projekta - ${project.name || "Projekat"}`);
  setTextIfExists("projectTasksModalSubtitle", `Taskovi: ${projectTasks.length}`);
  renderProjectBillingStatus(project);
  renderProjectCostSummary(project.id);

  list.innerHTML = "";
  empty.classList.toggle("hidden", projectTasks.length > 0);

  projectTasks.forEach(task => {
    const item = document.createElement("div");
    item.className = "task-modal-item";
    item.dataset.taskDetailId = task.id;
    item.innerHTML = `
      <strong>#${escapeHtml(task.sequenceNumber || "-")} &bull; ${escapeHtml(taskActionTypeLabel(task.actionType))} &bull; <span class="${taskEntityStatusBadgeClass(task.status)}">${escapeHtml(taskEntityStatusLabel(task.status))}</span> &bull; ${escapeHtml(taskDueDateShortLabel(task.dueDate))}</strong>
      ${task.title ? `<p>${escapeHtml(task.title)}</p>` : ""}
    `;
    list.appendChild(item);
  });

  list.querySelectorAll("[data-task-detail-id]").forEach(item => {
    item.addEventListener("click", () => openTaskDetailModal(item.dataset.taskDetailId));
  });
}

function renderProjectBillingStatus(project) {
  const statusEl = document.getElementById("projectBillingStatus");
  const createBtn = document.getElementById("createProjectBillingBtn");
  const billingRecord = getActiveBillingByProjectId(project.id);
  const canCreate = typeof isCurrentUserAdminRole === "function" && isCurrentUserAdminRole();

  if (statusEl) {
    statusEl.innerHTML = billingRecord
      ? `Nalog za naplatu: ${escapeHtml(getBillingDisplayId(billingRecord))} • <span class="${billingStatusBadgeClass(billingRecord.status)}">${escapeHtml(billingStatusLabel(billingRecord.status))}</span>`
      : "Nalog za naplatu: -";
  }

  if (createBtn) {
    createBtn.classList.toggle("hidden", !canCreate);
    createBtn.disabled = Boolean(billingRecord);
  }
}

function getProjectTaskEntities(projectId, options = {}) {
  const { includeArchived = true } = options;
  return (Array.isArray(tasks) ? tasks : [])
    .map(task => typeof normalizeTaskEntity === "function" ? normalizeTaskEntity(task) : task)
    .filter(task => {
      if (!task) return false;
      if (String(task.projectId) !== String(projectId)) return false;
      if (!includeArchived && task.archived === true) return false;
      return true;
    });
}

function getProjectCostSummary(projectId) {
  const projectTasks = getProjectTaskEntities(projectId, { includeArchived: true });
  const includedTasks = projectTasks.filter(task => task.includedInCost === true);
  const nonBillableTasks = projectTasks.filter(task => String(task.billableStatus || "") === "non_billable");

  const totals = includedTasks.reduce((acc, task) => {
    acc.timeSpentMinutes += Number(task.timeSpentMinutes || 0);
    acc.laborCost += Number(task.laborCost || 0);
    acc.materialCost += Number(task.materialCost || 0);
    return acc;
  }, {
    timeSpentMinutes: 0,
    laborCost: 0,
    materialCost: 0
  });

  return {
    includedTasks,
    nonBillableTasks,
    timeSpentMinutes: totals.timeSpentMinutes,
    laborCost: totals.laborCost,
    materialCost: totals.materialCost,
    totalCost: totals.laborCost + totals.materialCost
  };
}

function createProjectCostTaskRow(task, options = {}) {
  const { includeReason = false } = options;
  const item = document.createElement("div");
  item.className = "task-modal-item";
  item.dataset.taskDetailId = task.id;
  const title = task.title || taskActionTypeLabel(task.actionType);
  const baseLine = `#${task.sequenceNumber || "-"} • ${title} • ${Number(task.timeSpentMinutes || 0)} min • ${formatTaskCostRsd(task.laborCost || 0)} • ${formatTaskCostRsd(task.materialCost || 0)}`;
  item.innerHTML = `
    <strong>${escapeHtml(baseLine)}</strong>
    ${includeReason ? `<p>Razlog: ${escapeHtml(task.nonBillableReason || "-")}</p>` : ""}
  `;
  return item;
}

function renderProjectCostSummary(projectId) {
  const summary = getProjectCostSummary(projectId);
  setTextIfExists("projectCostTime", `Ukupno vreme: ${Number(summary.timeSpentMinutes || 0)} min`);
  setTextIfExists("projectCostLabor", `Trosak rada: ${formatTaskCostRsd(summary.laborCost || 0)}`);
  setTextIfExists("projectCostMaterial", `Trosak materijala: ${formatTaskCostRsd(summary.materialCost || 0)}`);
  setTextIfExists("projectCostTotal", `Ukupan trosak: ${formatTaskCostRsd(summary.totalCost || 0)}`);

  const includedList = document.getElementById("projectIncludedCostList");
  const includedEmpty = document.getElementById("projectIncludedCostEmpty");
  if (includedList && includedEmpty) {
    includedList.innerHTML = "";
    summary.includedTasks.forEach(task => includedList.appendChild(createProjectCostTaskRow(task)));
    includedEmpty.classList.toggle("hidden", summary.includedTasks.length > 0);
  }

  const nonBillableList = document.getElementById("projectNonBillableList");
  const nonBillableEmpty = document.getElementById("projectNonBillableEmpty");
  if (nonBillableList && nonBillableEmpty) {
    nonBillableList.innerHTML = "";
    summary.nonBillableTasks.forEach(task => nonBillableList.appendChild(createProjectCostTaskRow(task, { includeReason: true })));
    nonBillableEmpty.classList.toggle("hidden", summary.nonBillableTasks.length > 0);
  }

  document.querySelectorAll("#projectIncludedCostList [data-task-detail-id], #projectNonBillableList [data-task-detail-id]").forEach(item => {
    item.addEventListener("click", () => openTaskDetailModal(item.dataset.taskDetailId));
  });
}

function openNewTaskFromProjectTasksModal() {
  if (!currentTaskListProjectId) {
    showToast("Projekat nije pronadjen.");
    return;
  }

  closeProjectTasksModal();
  openNewTaskModal(currentTaskListProjectId, { reopenTaskList: true });
}

function refreshTaskProjectUi(projectId) {
  const project = getProjectById(projectId);
  if (!project) return;

  renderProjectTasksModal(project);
  const client = clients.find(c => String(c.id) === String(project.clientId));
  if (client) renderProjects(client);
  if (typeof renderDashboard === "function") renderDashboard();
  if (typeof renderTeamView === "function") renderTeamView();
  if (typeof renderBillingView === "function") renderBillingView();
}

function openTaskDetailModal(taskId) {
  const task = getTaskById(taskId);
  if (!task) {
    showToast("Task nije pronadjen.");
    return;
  }

  currentTaskDetailId = String(task.id);
  renderTaskDetailModal(task);

  const modal = document.getElementById("taskDetailModal");
  if (!modal) return;
  modal.classList.remove("hidden");
  modal.setAttribute("aria-hidden", "false");
}

function closeTaskDetailModal() {
  const modal = document.getElementById("taskDetailModal");
  if (!modal) return;
  if (modal.contains(document.activeElement)) document.activeElement.blur();
  modal.classList.add("hidden");
  modal.setAttribute("aria-hidden", "true");
  currentTaskDetailId = null;
}

function renderTaskDetailModal(task) {
  const legacyClose = document.getElementById("closeTaskDetailBtn");
  if (legacyClose) legacyClose.remove();

  const client = clients.find(item => String(item.id) === String(task.clientId)) || null;
  const workflowProject = client && typeof getClientProjectById === "function"
    ? getClientProjectById(client, task.projectId)
    : null;
  const project = workflowProject || getProjectById(task.projectId);
  const typeLabel = taskActionTypeLabel(task.actionType);

  setTextIfExists("taskDetailModalTitle", `#${task.sequenceNumber || "-"} - ${typeLabel}`);
  setTextIfExists("taskDetailModalSubtitle", project?.name || "Projekat");
  const statusEl = document.getElementById("taskDetailStatus");
  if (statusEl) {
    const reviewLabel = taskReviewStatusLabel(getEffectiveTaskReviewStatus(task));
    statusEl.innerHTML = `Status: <span class="${taskEntityStatusBadgeClass(task.status)}">${escapeHtml(taskEntityStatusLabel(task.status))}</span>${reviewLabel ? `<div class="muted small" style="margin-top:6px;">${escapeHtml(reviewLabel)}</div>` : ""}`;
  }
  setTextIfExists("taskDetailDueDate", `Rok: ${taskDueDateShortLabel(task.dueDate)}`);
  const assignedLabel =
    task.assignedToLabel ||
    getTeamMemberNameById(task.assignedToUserId || task.assignedTo, task.assignedTo || "-");
  setTextIfExists("taskDetailAssignedTo", `Dodeljeno: ${assignedLabel}`);
  setTextIfExists("taskDetailDescription", `Opis: ${task.description || task.title || "-"}`);
  setTextIfExists("taskDetailTimeSpent", `Vreme: ${Number(task.timeSpentMinutes || 0)} min`);
  setTextIfExists("taskDetailLaborCost", `Trosak rada: ${formatTaskCostRsd(task.laborCost || 0)}`);
  setTextIfExists("taskDetailMaterialCost", `Materijal: ${formatTaskCostRsd(task.materialCost || 0)}`);
  setTextIfExists("taskDetailMaterialDescription", `Opis materijala: ${task.materialDescription || "-"}`);
  setTextIfExists("taskDetailNonBillableReason", `Razlog: ${task.nonBillableReason || "-"}`);
  setTextIfExists("taskDetailCostState", taskBillableStatusLabel(task.billableStatus));
  document.getElementById("taskDetailMaterialDescription")?.classList.toggle("hidden", !task.materialDescription);
  document.getElementById("taskDetailNonBillableReason")?.classList.toggle("hidden", !task.nonBillableReason);
  document.getElementById("taskDetailCostState")?.classList.toggle("hidden", !taskBillableStatusLabel(task.billableStatus));
  renderTaskReviewInputs(task);
  renderTaskDetailActionsV2(task);
}

function renderTaskDetailActions(task) {
  const actions = document.getElementById("taskDetailActions");
  if (!actions) return;

  const currentUser = getCurrentTaskUserMetadata();
  const currentUserId = String(currentUser.userId || "").trim();
  const status = String(task?.status || "").trim();

  const isAdminOrCreator = Boolean(
    currentUser.role === "admin" ||
    (currentUserId && String(task?.createdByUserId || "").trim() === currentUserId) ||
    (currentUserId && String(task?.delegatedByUserId || "").trim() === currentUserId)
  );

  const isAssignedWorker = Boolean(
    currentUserId && (
      String(task?.assignedToUserId || "").trim() === currentUserId ||
      String(task?.assignedTo || "").trim() === currentUserId
    )
  );

  const buttons = [];
  const addButton = (label, action, className = "btn btn-secondary") => {
    buttons.push(`<button type="button" class="${className}" data-task-detail-action="${action}">${label}</button>`);
  };

  if (isAdminOrCreator) {
    addButton("Promeni zaduženog", "change_assignee", "btn btn-secondary");
    addButton("Promeni rok", "change_due", "btn btn-secondary");
    addButton("Otkaži task", "cancel_task", "btn btn-danger");
  } else if (isAssignedWorker) {
    if (status === "dodeljen") {
      addButton("Preuzmi", "take_over", "btn btn-primary");
      addButton("Vrati", "return_task", "btn btn-secondary");
    } else if (status === "u_radu") {
      addButton("Završi", "complete_task", "btn btn-primary");
      addButton("Vrati", "return_task", "btn btn-secondary");
    }
  }

  actions.innerHTML = buttons.length ? buttons.join("") : "";

  actions.querySelectorAll("[data-task-detail-action]").forEach(button => {
    button.addEventListener("click", async () => {
      const action = button.dataset.taskDetailAction;
      await handleTaskDetailAction(action);
    });
  });
}

function renderTaskDetailActionsV2(task) {
  const actions = document.getElementById("taskDetailActions");
  if (!actions) return;

  const currentUser = getCurrentTaskUserMetadata();
  const currentUserId = String(currentUser.userId || "").trim();
  const status = String(task?.status || "").trim();
  const reviewStatus = getEffectiveTaskReviewStatus(task);

  const isAdminOperator = currentUser.role === "admin";

  const isAssignedWorker = Boolean(
    currentUserId && (
      String(task?.assignedToUserId || "").trim() === currentUserId ||
      String(task?.assignedTo || "").trim() === currentUserId
    )
  );

  const buttons = [];
  const addButton = (label, action, className = "btn btn-secondary") => {
    buttons.push(`<button type="button" class="${className}" data-task-detail-action="${action}">${label}</button>`);
  };

  if (currentUser.role === "finance") {
    buttons.push('<div class="muted small">Task je read-only za finansije.</div>');
  } else if (status === "zavrsen") {
      if (currentUser.isAdmin && reviewStatus === "pending_review") {
      addButton("Dodaj u trosak projekta", "add_project_cost", "btn btn-primary");
        addButton("Arhiviraj bez naplate", "archive_no_billing", "btn btn-secondary");
        addButton("Vrati na doradu", "return_for_rework", "btn btn-secondary");
        buttons.push(`
          <div id="taskArchiveReasonPanel" class="task-detail-box hidden" style="margin-top:12px;">
            <div class="field">
              <label for="taskNonBillableReason">Razlog (non-billable)</label>
              <select id="taskNonBillableReason" class="input">
                <option value="">Izaberi razlog</option>
                <option value="Follow-up / komunikacija">Follow-up / komunikacija</option>
                <option value="Priprema / interna aktivnost">Priprema / interna aktivnost</option>
                <option value="Greska / rework">Greska / rework</option>
                <option value="Goodwill prema klijentu">Goodwill prema klijentu</option>
                <option value="Cekanje / blokada">Cekanje / blokada</option>
                <option value="Ostalo">Ostalo</option>
              </select>
            </div>
            <div class="form-actions">
              <button type="button" class="btn btn-primary" data-task-detail-action="confirm_archive_no_billing">Potvrdi arhiviranje</button>
              <button type="button" class="btn btn-secondary" data-task-detail-action="cancel_archive_no_billing">Otkazi</button>
            </div>
          </div>
        `);
    } else {
      const reviewLabel = reviewStatus
        ? taskReviewStatusLabel(reviewStatus)
        : "Task zavrsen, ceka pregled admina";
      buttons.push(`<div class="muted small">${escapeHtml(reviewLabel)}</div>`);
    }
  } else if (isAdminOperator) {
    addButton("Promeni zaduzenog", "change_assignee", "btn btn-secondary");
    addButton("Promeni rok", "change_due", "btn btn-secondary");
    addButton("Otkazi task", "cancel_task", "btn btn-danger");
  } else if (isAssignedWorker) {
    if (status === "dodeljen") {
      addButton("Preuzmi", "take_over", "btn btn-primary");
      addButton("Na cekanju", "set_waiting", "btn btn-secondary");
    } else if (status === "u_radu") {
      addButton("Zavrsi", "complete_task", "btn btn-primary");
      addButton("Na cekanju", "set_waiting", "btn btn-secondary");
    } else if (status === "na_cekanju") {
      addButton("Vrati u rad", "resume_task", "btn btn-primary");
    }
  }

  actions.innerHTML = buttons.length ? buttons.join("") : "";

  actions.querySelectorAll("[data-task-detail-action]").forEach(button => {
    button.addEventListener("click", async () => {
      const action = button.dataset.taskDetailAction;
      await handleTaskDetailAction(action);
    });
  });
}

async function handleTaskDetailAction(action) {
  const task = getTaskById(currentTaskDetailId);
  if (!task) {
    showToast("Task nije pronadjen.");
    return;
  }

  const currentUser = getCurrentTaskUserMetadata();
  const currentUserId = String(currentUser.userId || "").trim();

  const isAdminOperator = currentUser.role === "admin";

  const isAssignedWorker = Boolean(
    currentUserId && (
      String(task?.assignedToUserId || "").trim() === currentUserId ||
      String(task?.assignedTo || "").trim() === currentUserId
    )
  );

  const now = nowISO();

  if (currentUser.role === "finance") {
    showToast("Task je read-only za finansije.");
    return;
  }

  if (action === "add_project_cost") {
    if (!currentUser.isAdmin) return;
    if (String(task.status) !== "zavrsen" || getEffectiveTaskReviewStatus(task) !== "pending_review") return;
    const payload = collectTaskReviewCostPayload(task);
    if (!payload) return;
    const saved = saveTask({
      ...task,
      ...payload,
      billableStatus: "billable",
      reviewStatus: "cost_added",
      includedInCost: true
    });
    if (!saved) return;
    await persistTasks({ immediate: true });
    refreshTaskProjectUi(saved.projectId);
    renderTaskDetailModal(saved);
    showToast("Task je ukljucen u trosak projekta.");
    return;
  }

  if (action === "archive_no_billing") {
    if (!currentUser.isAdmin) return;
    if (String(task.status) !== "zavrsen" || getEffectiveTaskReviewStatus(task) !== "pending_review") return;
    document.getElementById("taskArchiveReasonPanel")?.classList.remove("hidden");
    return;
  }

  if (action === "cancel_archive_no_billing") {
    document.getElementById("taskArchiveReasonPanel")?.classList.add("hidden");
    return;
  }

  if (action === "confirm_archive_no_billing") {
    if (!currentUser.isAdmin) return;
    if (String(task.status) !== "zavrsen" || getEffectiveTaskReviewStatus(task) !== "pending_review") return;
    const payload = collectTaskReviewCostPayload(task);
    if (!payload) return;
    const nonBillableReason = String(getValue("taskNonBillableReason") || "").trim();
    if (!nonBillableReason) {
      showToast("Izaberite razlog.");
      return;
    }
    const saved = saveTask({
      ...task,
      ...payload,
      nonBillableReason,
      billableStatus: "non_billable",
      reviewStatus: "archived_no_billing",
      includedInCost: false,
      archived: true,
      archivedAt: now
    });
    if (!saved) return;
    await persistTasks({ immediate: true });
    refreshTaskProjectUi(saved.projectId);
    if (typeof closeTaskDetailModal === "function") closeTaskDetailModal();
    showToast("Task je arhiviran bez naplate.");
    return;
  }

  if (action === "return_for_rework") {
    if (!currentUser.isAdmin) return;
    if (String(task.status) !== "zavrsen" || getEffectiveTaskReviewStatus(task) !== "pending_review") return;
    const saved = saveTask({
      ...task,
      status: "u_radu",
      reviewStatus: "returned"
    });
    if (!saved) return;
    await persistTasks({ immediate: true });
    refreshTaskProjectUi(saved.projectId);
    renderTaskDetailModal(saved);
    showToast("Task je vracen na doradu.");
    return;
  }

  const saveAndRefresh = async updated => {
    const saved = saveTask(updated);
    if (!saved) return null;
    await persistTasks({ immediate: true });
    refreshTaskProjectUi(saved.projectId);
    renderTaskDetailModal(saved);
    return saved;
  };

  if (action === "take_over") {
    if (!isAssignedWorker || String(task.status) !== "dodeljen") return;
    const saved = await saveAndRefresh({ ...task, status: "u_radu", startedAt: now });
    if (saved) showToast("Task je preuzet.");
    return;
  }

  if (action === "set_waiting") {
    if (!isAssignedWorker || !["dodeljen", "u_radu"].includes(String(task.status))) return;
    const saved = await saveAndRefresh({ ...task, status: "na_cekanju" });
    if (saved) showToast("Task je prebacen na cekanje.");
    return;
  }

  if (action === "resume_task") {
    if (!isAssignedWorker || String(task.status) !== "na_cekanju") return;
    const saved = await saveAndRefresh({ ...task, status: "u_radu" });
    if (saved) showToast("Task je vracen u rad.");
    return;
  }

  if (action === "complete_task") {
    if (!isAssignedWorker || String(task.status) !== "u_radu") return;
    const payload = collectTaskReviewCostPayload(task, {
      errorMessage: "Unesite utroseno vreme pre zavrsetka taska."
    });
    if (!payload) return;
    const saved = await saveAndRefresh({
      ...task,
      ...payload,
      status: "zavrsen",
      reviewStatus: "pending_review",
      completedAt: now
    });
    if (saved) showToast("Task je završen.");
    return;
  }

  if (action === "return_task") {
    if (!isAssignedWorker || !["dodeljen", "u_radu"].includes(String(task.status))) return;
    const saved = await saveAndRefresh({ ...task, status: "vracen" });
    if (saved) showToast("Task je vraćen.");
    return;
  }

  if (action === "cancel_task") {
    if (String(task.status) === "zavrsen") return;
    if (!isAdminOperator) return;
    const saved = await saveAndRefresh({ ...task, status: "otkazan", canceledAt: now });
    if (saved) showToast("Task je otkazan.");
    return;
  }

  if (action === "change_due") {
    if (String(task.status) === "zavrsen") return;
    if (!isAdminOperator) return;
    const nextDue = window.prompt("Novi rok (YYYY-MM-DD)", String(task.dueDate || "")) || "";
    const normalized = nextDue.trim();
    const saved = await saveAndRefresh({ ...task, dueDate: normalized || null });
    if (saved) showToast("Rok je ažuriran.");
    return;
  }

  if (action === "change_assignee") {
    if (String(task.status) === "zavrsen") return;
    if (!isAdminOperator) return;
    const members = typeof getAssignableWorkspaceMembers === "function" ? getAssignableWorkspaceMembers() : [];
    const hint = members.length
      ? `\n\nDostupni korisnici:\n${members.map(m => `- ${m.id}: ${m.name}${m.email ? ` (${m.email})` : ""}`).join("\n")}`
      : "";
    const nextAssignee = window.prompt(`Novi korisnik ID za zaduženje:${hint}`, String(task.assignedToUserId || task.assignedTo || "")) || "";
    const nextAssigneeId = String(nextAssignee).trim();
    if (!nextAssigneeId) return;
    const member = getAssignableTaskMemberById(nextAssigneeId);
    const label = taskMemberLabel(member) || nextAssigneeId;
    const saved = await saveAndRefresh({
      ...task,
      assignedToUserId: nextAssigneeId,
      assignedTo: nextAssigneeId,
      assignedToLabel: label,
      status: "dodeljen"
    });
    if (saved) showToast("Zaduženje je ažurirano.");
  }
}

function openTaskDelegateModal(taskId) {
  const task = getTaskById(taskId);
  if (!task) {
    showToast("Task nije pronadjen.");
    return;
  }

  if (!getTaskPermissionContext(task).canDelegate) {
    showToast("Samo vlasnik taska ili admin mogu da delegiraju.");
    return;
  }

  setValueIfExists("delegateTaskId", task.id);
  setValueIfExists("delegateTaskDescription", "");
  renderDelegateTaskAssigneeOptions(task.assignedToUserId || task.assignedTo);

  const modal = document.getElementById("taskDelegateModal");
  if (!modal) return;
  modal.classList.remove("hidden");
  modal.setAttribute("aria-hidden", "false");
}

function closeTaskDelegateModal() {
  const modal = document.getElementById("taskDelegateModal");
  if (!modal) return;
  if (modal.contains(document.activeElement)) document.activeElement.blur();
  modal.classList.add("hidden");
  modal.setAttribute("aria-hidden", "true");
}

function renderDelegateTaskAssigneeOptions(currentAssigneeId = "") {
  const assigneeSelect = document.getElementById("delegateTaskAssignee");
  if (!assigneeSelect) return;

  const members = typeof getAssignableWorkspaceMembers === "function"
    ? getAssignableWorkspaceMembers()
    : [];

  assigneeSelect.innerHTML = members.length
    ? members.map(member => `
        <option value="${escapeHtml(member.id)}"${String(member.id) === String(currentAssigneeId) ? " selected" : ""}>
          ${escapeHtml(member.email ? `${member.name} (${member.email})` : member.name)}
        </option>
      `).join("")
    : '<option value="">Nema dostupnih korisnika</option>';
}

async function handleTaskDelegateSubmit(e) {
  e.preventDefault();

  const task = getTaskById(getValue("delegateTaskId"));
  if (!task) {
    showToast("Task nije pronadjen.");
    return;
  }

  const permissions = getTaskPermissionContext(task);
  if (!permissions.canDelegate) {
    showToast("Samo vlasnik taska ili admin mogu da delegiraju.");
    return;
  }

  const assignedTo = getValue("delegateTaskAssignee");
  if (!assignedTo) {
    showToast("Izaberi korisnika za delegaciju.");
    return;
  }

  const assignedMember = getAssignableTaskMemberById(assignedTo);
  const assignedLabel = taskMemberLabel(assignedMember) || assignedTo;
  const currentUser = getCurrentTaskUserMetadata();
  const note = getValue("delegateTaskDescription").trim();
  const returnedTask = updateTaskStatus(task.id, "vracen");
  if (!returnedTask) {
    showToast("Task nije delegiran.");
    return;
  }

  const newTask = saveTask({
    projectId: task.projectId,
    clientId: task.clientId,
    actionType: task.actionType,
    title: task.title,
    description: note || task.description,
    assignedTo,
    assignedToUserId: assignedTo,
    assignedToLabel: assignedLabel,
    createdByUserId: task.createdByUserId || currentUser.userId,
    createdByLabel: task.createdByLabel || currentUser.label,
    delegatedByUserId: currentUser.userId,
    delegatedByLabel: currentUser.label,
    dueDate: task.dueDate,
    status: "dodeljen"
  });

  if (!newTask) {
    showToast("Novi delegirani task nije sacuvan.");
    return;
  }
  const synced = await persistTasks({ immediate: true });

  closeTaskDelegateModal();
  closeTaskDetailModal();
  refreshTaskProjectUi(task.projectId);
  showToast(synced ? "Task je delegiran." : "Task je delegiran lokalno, ali sync nije uspeo.");
}

function openNewTaskModal(projectId, options = {}) {
  const project = getProjectById(projectId);
  if (!project) {
    showToast("Projekat nije pronadjen.");
    return;
  }

  const client = clients.find(c => String(c.id) === String(project.clientId));
  if (!client) {
    showToast("Klijent nije pronadjen.");
    return;
  }

  const form = document.getElementById("taskForm");
  if (form) form.reset();

  reopenTaskListAfterCreate = Boolean(options.reopenTaskList);
  setValueIfExists("taskProjectId", project.id);
  renderTaskAssigneeOptions();
  setTextIfExists("taskModalTitle", "Novi task");
  setTextIfExists("taskModalSubtitle", `Projekat: ${project.name || "Projekat"} - ${client.name || "Klijent"}.`);

  openTaskModal();
}

function renderTaskAssigneeOptions(selectedUserId = "") {
  const assigneeSelect = document.getElementById("taskAssignedTo");
  if (!assigneeSelect) return;

  const members = typeof getAssignableWorkspaceMembers === "function"
    ? getAssignableWorkspaceMembers()
    : [];

  assigneeSelect.innerHTML = members.length
    ? members.map(member => `
        <option value="${escapeHtml(member.id)}"${String(member.id) === String(selectedUserId) ? " selected" : ""}>
          ${escapeHtml(member.email ? `${member.name} (${member.email})` : member.name)}
        </option>
      `).join("")
    : '<option value="">Nema dostupnih korisnika</option>';
}

function openTaskModal() {
  const modal = document.getElementById("taskModal");
  if (!modal) return;
  modal.classList.remove("hidden");
  modal.setAttribute("aria-hidden", "false");
}

function closeTaskModal() {
  const modal = document.getElementById("taskModal");
  if (!modal) return;
  if (modal.contains(document.activeElement)) document.activeElement.blur();
  modal.classList.add("hidden");
  modal.setAttribute("aria-hidden", "true");
  reopenTaskListAfterCreate = false;
}

async function handleTaskSubmit(e) {
  e.preventDefault();

  const projectId = getValue("taskProjectId");
  const project = getProjectById(projectId);
  if (!project) {
    showToast("Projekat nije pronadjen.");
    return;
  }

  const title = getValue("taskTitle").trim();
  if (!title) {
    showToast("Unesi naslov taska.");
    return;
  }

  const assignedTo = getValue("taskAssignedTo");
  if (!assignedTo) {
    showToast("Izaberi korisnika za task.");
    return;
  }

  const assignedMember = getAssignableTaskMemberById(assignedTo);
  const assignedLabel = taskMemberLabel(assignedMember) || assignedTo;
  const currentUser = getCurrentTaskUserMetadata();
  const savedTask = saveTask({
    projectId: project.id,
    clientId: project.clientId,
    actionType: getValue("taskActionType"),
    title,
    description: getValue("taskDescription").trim(),
    assignedTo,
    assignedToUserId: assignedTo,
    assignedToLabel: assignedLabel,
    createdByUserId: currentUser.userId,
    createdByLabel: currentUser.label,
    delegatedByUserId: null,
    delegatedByLabel: null,
    dueDate: getValue("taskDueDate") || null,
    status: "dodeljen"
  });

  if (!savedTask) {
    showToast("Task nije sacuvan.");
    return;
  }
  const synced = await persistTasks({ immediate: true });

  const shouldReopenTaskList = reopenTaskListAfterCreate;
  closeTaskModal();
  const projectClient = clients.find(c => String(c.id) === String(project.clientId));
  if (projectClient) renderProjects(projectClient);
  if (typeof renderDashboard === "function") renderDashboard();
  if (typeof renderTeamView === "function") renderTeamView();
  if (shouldReopenTaskList) {
    openProjectTasksModal(project.id);
  }
  showToast(synced ? "Task je dodat." : "Task je dodat lokalno, ali sync nije uspeo.");
}

function renderActiveTaskPreview(client, statusText) {
  const card = document.getElementById("activeTaskCard");
  const empty = document.getElementById("activeTaskEmpty");
  const task = getClientActiveTask(client);
  const hasTask = Boolean(task);

  if (card) {
    card.classList.toggle("hidden", !hasTask);
  }

  if (empty) {
    empty.classList.toggle("hidden", hasTask);
  }

  if (!hasTask) {
    setTextIfExists("activeTaskStatus", "Otvoren");
    setClassIfExists("activeTaskStatus", "badge neutral");
    setTextIfExists("activeTaskTitle", "Nema aktivnog taska");
    setTextIfExists("activeTaskDue", "Bez roka");
    setTextIfExists("activeTaskOwner", "Nema vlasnika");
    setTextIfExists("activeTaskDelegatedBy", "-");
    setTextIfExists("activeTaskNote", "Nova aktivnost moze da ostane samo zapis ili da odmah kreira sledecu akciju sa vlasnikom i rokom.");
    setTextIfExists("openActionFromDrawerBtn", "Nova aktivnost");
    return;
  }

  const derivedStatus = taskStatusLabel(task?.status || "open");
  const statusClass =
    derivedStatus === "Na cekanju" ? "warning" :
    derivedStatus === "U toku" ? "success" :
    "neutral";

  setTextIfExists("activeTaskStatus", derivedStatus);
  setClassIfExists("activeTaskStatus", `badge ${statusClass}`);
  setTextIfExists("activeTaskTitle", task?.title || "Aktivni task");
  setTextIfExists("activeTaskDue", task?.dueDate ? `Rok: ${formatDate(task.dueDate)}` : "Bez roka");
  setTextIfExists("activeTaskOwner", task?.ownerName || "Moj nalog");
  setTextIfExists("activeTaskDelegatedBy", task?.delegatedByName || "Tim");
  setTextIfExists("activeTaskNote", task?.note || client.lastActionNote || `${statusText} - prati sledeci korak.`);
  setTextIfExists("openActionFromDrawerBtn", "Nova aktivnost");
}

function renderPulseBand(score) {
  const band = document.getElementById("detailPulseBand");
  if (!band) return;

  const meta = getPulseBandMeta(score);
  band.textContent = meta.label;
  band.className = `pulse-score-band ${meta.className}`;
}

function renderPulseSignals(client) {
  const positiveList = document.getElementById("positiveSignalsList");
  const riskList = document.getElementById("riskSignalsList");
  if (!positiveList || !riskList) return;

  const signals = getPulseSignals(client);
  positiveList.innerHTML = "";
  riskList.innerHTML = "";

  signals.positive.forEach(item => {
    const li = document.createElement("li");
    li.textContent = item;
    positiveList.appendChild(li);
  });

  signals.risks.forEach(item => {
    const li = document.createElement("li");
    li.textContent = item;
    riskList.appendChild(li);
  });
}

function renderLockedPulseSignals() {
  const positiveList = document.getElementById("positiveSignalsList");
  const riskList = document.getElementById("riskSignalsList");
  if (!positiveList || !riskList) return;

  positiveList.innerHTML = "<li>Otkljucaj Pro za pregled pozitivnih signala.</li>";
  riskList.innerHTML = "<li>Otkljucaj Pro za pregled rizika i red flags signala.</li>";
}

function renderTimeline(client) {
  const list = document.getElementById("timelineList");
  const empty = document.getElementById("timelineEmpty");
  if (!list || !empty) return;

  const items = Array.isArray(client.activityLog) ? client.activityLog : [];
  list.innerHTML = "";

  if (!items.length) {
    empty.classList.remove("hidden");
    return;
  }

  empty.classList.add("hidden");

  items.forEach(item => {
    const row = document.createElement("div");
    row.className = "timeline-item";
    const actorLabel = item.actorName ? `<div class="timeline-date">${escapeHtml(item.actorName)}</div>` : "";
    row.innerHTML = `
      <div class="timeline-date">${escapeHtml(formatDateTime(item.at))}</div>
      <div class="timeline-content">
        <strong>${escapeHtml(item.label || "Aktivnost")}</strong>
        ${actorLabel}
        <p>${escapeHtml(item.note || "-")}</p>
      </div>
    `;
    list.appendChild(row);
  });
}

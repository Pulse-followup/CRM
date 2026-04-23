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
    case "dodeljen":
    default: return "badge neutral";
  }
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
  return {
    userId: supabaseUser?.id ? String(supabaseUser.id) : null,
    label: getCurrentUserDisplayName()
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

    item.innerHTML = `
      <div class="project-list-item-head">
        <strong>${escapeHtml(project.name || "Projekat")}</strong>
      </div>
      <p class="project-meta-line">${escapeHtml(projectTypeLabel(project.type))} &bull; ${escapeHtml(projectStatusLabel(project.status))}</p>
      ${projectMeta.length ? `<p class="project-meta-line project-meta-secondary">${escapeHtml(projectMeta.join(" - "))}</p>` : ""}
      <p class="project-task-summary">Taskovi: ${taskCount}</p>
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

function handleProjectSubmit(e) {
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

    closeProjectModal();
    renderProjects(client);
    showToast("Projekat je azuriran.");
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

  closeProjectModal();
  renderProjects(client);
  showToast("Projekat je dodat.");
}

function updateProjectArchiveState(projectId, archived) {
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

  renderProjects(client);
  showToast(archived ? "Projekat je arhiviran." : "Projekat je vracen iz arhive.");
}

function archiveProject(projectId) {
  updateProjectArchiveState(projectId, true);
}

function unarchiveProject(projectId) {
  updateProjectArchiveState(projectId, false);
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
  const project = getProjectById(task.projectId);
  setTextIfExists("taskDetailModalTitle", `#${task.sequenceNumber || "-"} - ${taskActionTypeLabel(task.actionType)}`);
  setTextIfExists("taskDetailModalSubtitle", project?.name || "Projekat");
  const statusEl = document.getElementById("taskDetailStatus");
  if (statusEl) {
    statusEl.innerHTML = `Status: <span class="${taskEntityStatusBadgeClass(task.status)}">${escapeHtml(taskEntityStatusLabel(task.status))}</span>`;
  }
  setTextIfExists("taskDetailDueDate", `Rok: ${taskDueDateShortLabel(task.dueDate)}`);
  const assignedLabel =
    task.assignedToLabel ||
    getTeamMemberNameById(task.assignedToUserId || task.assignedTo, task.assignedTo || "-");
  setTextIfExists("taskDetailAssignedTo", `Dodeljeno: ${assignedLabel}`);
  setTextIfExists("taskDetailDescription", `Opis: ${task.description || task.title || "-"}`);
  renderTaskDetailActions(task);
}

function renderTaskDetailActions(task) {
  const actions = document.getElementById("taskDetailActions");
  if (!actions) return;

  const buttons = [];
  const addAction = (label, status, className = "btn btn-secondary") => {
    buttons.push(`<button type="button" class="${className}" data-task-next-status="${status}">${label}</button>`);
  };

  if (task.status === "dodeljen") {
    addAction("Preuzmi", "u_radu", "btn btn-primary");
    buttons.push('<button type="button" class="btn btn-secondary" data-task-delegate="true">Delegiraj</button>');
    addAction("Na cekanju", "na_cekanju");
  } else if (task.status === "u_radu") {
    addAction("Zavrsi", "zavrsen", "btn btn-primary");
    addAction("Na cekanju", "na_cekanju");
    buttons.push('<button type="button" class="btn btn-secondary" data-task-delegate="true">Delegiraj</button>');
  } else if (task.status === "na_cekanju") {
    addAction("Vrati u rad", "u_radu", "btn btn-primary");
    buttons.push('<button type="button" class="btn btn-secondary" data-task-delegate="true">Delegiraj</button>');
  } else if (task.status === "zavrsen" && isCurrentUserAdminRole()) {
    addAction("Posalji na naplatu", "poslat_na_naplatu", "btn btn-primary");
  }

  actions.innerHTML = buttons.length
    ? buttons.join("")
    : '<p class="muted-text">Nema dostupnih akcija.</p>';

  actions.querySelectorAll("[data-task-next-status]").forEach(button => {
    button.addEventListener("click", () => handleTaskStatusChange(button.dataset.taskNextStatus));
  });
  actions.querySelectorAll("[data-task-delegate]").forEach(button => {
    button.addEventListener("click", () => openTaskDelegateModal(currentTaskDetailId));
  });
}

function handleTaskStatusChange(nextStatus) {
  const task = getTaskById(currentTaskDetailId);
  if (!task) {
    showToast("Task nije pronadjen.");
    return;
  }

  if (nextStatus === "poslat_na_naplatu" && !isCurrentUserAdminRole()) {
    showToast("Samo admin moze da posalje task na naplatu.");
    return;
  }

  const updatedTask = updateTaskStatus(task.id, nextStatus);
  if (!updatedTask) {
    showToast("Status taska nije sacuvan.");
    return;
  }

  refreshTaskProjectUi(updatedTask.projectId);
  renderTaskDetailModal(updatedTask);
  showToast("Status taska je azuriran.");
}

function openTaskDelegateModal(taskId) {
  const task = getTaskById(taskId);
  if (!task) {
    showToast("Task nije pronadjen.");
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

function handleTaskDelegateSubmit(e) {
  e.preventDefault();

  const task = getTaskById(getValue("delegateTaskId"));
  if (!task) {
    showToast("Task nije pronadjen.");
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

  closeTaskDelegateModal();
  closeTaskDetailModal();
  refreshTaskProjectUi(task.projectId);
  showToast("Task je delegiran.");
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

function handleTaskSubmit(e) {
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

  const shouldReopenTaskList = reopenTaskListAfterCreate;
  closeTaskModal();
  const projectClient = clients.find(c => String(c.id) === String(project.clientId));
  if (projectClient) renderProjects(projectClient);
  if (typeof renderDashboard === "function") renderDashboard();
  if (typeof renderTeamView === "function") renderTeamView();
  if (shouldReopenTaskList) {
    openProjectTasksModal(project.id);
  }
  showToast("Task je dodat.");
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

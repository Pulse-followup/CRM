/* ------------------------- PAYMENT WORKFLOW ------------------------- */
let currentPaymentProjectId = "";

function openPaymentModal(clientId, options = {}) {
  if (!requireProFeature("payments")) return;

  const client = getClientById(clientId);
  if (!client) return;

  currentPaymentClientId = clientId;
  currentPaymentProjectId = options.projectId || getClientOpenProjects(client)[0]?.id || getClientProjects(client)[0]?.id || "";

  setTextIfExists("paymentModalTitle", `Naplata - ${client.name}`);
  renderPaymentSummary(client);
  renderPaymentProjectOptions(client);
  renderBillingForm(client);
  renderBillingHistory(client);

  const modal = document.getElementById("paymentModal");
  if (modal) {
    modal.classList.remove("hidden");
    modal.setAttribute("aria-hidden", "false");
  }
}

function closePaymentModal() {
  const modal = document.getElementById("paymentModal");
  if (modal) {
    if (modal.contains(document.activeElement)) document.activeElement.blur();
    modal.classList.add("hidden");
    modal.setAttribute("aria-hidden", "true");
  }
  currentPaymentClientId = null;
  currentPaymentProjectId = "";
}

function getSelectedPaymentProject(client) {
  const selectedId = getValue("paymentProjectSelect") || currentPaymentProjectId;
  return getClientProjectById(client, selectedId) || getClientProjects(client)[0] || null;
}

function renderPaymentProjectOptions(client) {
  const select = document.getElementById("paymentProjectSelect");
  if (!select) return;

  const projects = getClientProjects(client);
  select.innerHTML = projects.length
    ? projects.map(project => `
        <option value="${escapeHtml(project.id)}"${project.id === currentPaymentProjectId ? " selected" : ""}>
          ${escapeHtml(projectDisplayName(project))}
        </option>
      `).join("")
    : '<option value="">Nema projekata</option>';
}

function renderPaymentSummary(client) {
  const records = getBillingRecords(client);
  const openRecords = records.filter(record => !["paid", "canceled"].includes(record.status));
  const paidRecords = records.filter(record => record.status === "paid");
  const discipline = computePaymentDiscipline(client);

  setTextIfExists("paymentSummaryBadge", `Naplata: ${discipline}`);
  setClassIfExists("paymentSummaryBadge", `badge ${discipline === "Dobra" ? "success" : discipline === "Promenljiva" ? "warning" : "neutral"}`);

  const parts = [
    `Otvoreno: ${openRecords.length}`,
    `Placeno: ${paidRecords.length}`
  ];
  if (client.payment?.lastPaidDate) parts.push(`Poslednja uplata: ${formatDate(client.payment.lastPaidDate)}`);
  setTextIfExists("paymentSummaryText", parts.join(" - "));
}

function renderPaymentSummaryInline(client) {
  const records = getBillingRecords(client);
  const openRecords = records.filter(record => !["paid", "canceled"].includes(record.status));
  const latest = records[0] || null;
  const discipline = computePaymentDiscipline(client);

  setTextIfExists("paymentSummaryBadgeInline", `Naplata: ${discipline}`);
  setClassIfExists("paymentSummaryBadgeInline", `badge ${openRecords.length ? "warning" : "neutral"}`);

  const text = latest
    ? `${billingStatusLabel(latest.status)} - ${latest.projectName || "projekat"}${latest.dueDate ? ` - valuta ${formatDate(latest.dueDate)}` : ""}`
    : "Nema podataka o naplati.";
  setTextIfExists("paymentSummaryTextInline", text);
}

function renderSelectedPaymentProject() {
  const client = getClientById(currentPaymentClientId);
  if (!client) return;
  currentPaymentProjectId = getValue("paymentProjectSelect") || "";
  renderBillingForm(client);
}

function getCurrentBillingRecord(client) {
  const project = getSelectedPaymentProject(client);
  if (!project) return null;
  return getProjectBillingRecord(client, project.id) ||
    getBillingRecords(client).find(record => record.projectId === project.id) ||
    null;
}

function renderBillingForm(client) {
  const wrap = document.getElementById("billingFormWrap");
  const project = getSelectedPaymentProject(client);
  const record = getCurrentBillingRecord(client);
  const hasRecord = Boolean(record);

  if (wrap) wrap.classList.toggle("hidden", !hasRecord);
  if (!project) {
    setTextIfExists("createBillingRequestBtn", "Nema projekta za naplatu");
    return;
  }

  setTextIfExists("createBillingRequestBtn", hasRecord ? "Zahtev vec postoji" : "Kreiraj zahtev za naplatu");
  const requestBtn = document.getElementById("createBillingRequestBtn");
  if (requestBtn) requestBtn.disabled = hasRecord;

  const paidBtn = document.getElementById("markBillingPaidBtn");
  if (paidBtn) paidBtn.disabled = !hasRecord || record.status === "paid";

  if (!hasRecord) return;

  setValueIfExists("billingStatusSelect", record.status || "requested");
  setValueIfExists("billingInvoiceNumber", record.invoiceNumber || "");
  setValueIfExists("billingAmount", record.amount || "");
  setValueIfExists("billingInvoiceDate", dateOnlyValue(record.invoiceDate || ""));
  setValueIfExists("billingDueDate", dateOnlyValue(record.dueDate || ""));
  setValueIfExists("billingNote", record.note || "");
}

async function persistPaymentClient(client, successText) {
  if (typeof canUseWorkspaceClientStore === "function" && canUseWorkspaceClientStore()) {
    saveClientsLocalOnly();
    const synced = await pushClientsToWorkspace();
    if (!synced) {
      showToast("Naplata je sacuvana lokalno, ali nije upisana u workspace.");
      return false;
    }
  } else {
    saveClients();
  }

  renderPaymentSummary(client);
  renderBillingForm(client);
  renderBillingHistory(client);
  renderAll();
  if (currentClientId === client.id) openClientDrawer(client.id);
  showToast(successText);
  return true;
}

async function handleCreateBillingRequest() {
  const client = getClientById(currentPaymentClientId);
  if (!client) return;

  const project = getSelectedPaymentProject(client);
  if (!project) {
    showToast("Prvo izaberi projekat.");
    return;
  }

  const record = createBillingRequest(client, project.id);
  if (!record) {
    showToast("Zahtev za naplatu nije kreiran.");
    return;
  }

  await persistPaymentClient(client, "Zahtev za naplatu je poslat finansijama.");
}

async function handleSaveBillingRecord() {
  const client = getClientById(currentPaymentClientId);
  if (!client) return;

  const record = getCurrentBillingRecord(client);
  if (!record) {
    showToast("Prvo kreiraj zahtev za naplatu.");
    return;
  }

  updateBillingRecord(client, record.id, {
    status: getValue("billingStatusSelect") || "requested",
    invoiceNumber: getValue("billingInvoiceNumber"),
    amount: getValue("billingAmount"),
    invoiceDate: normalizeDateInputValue(getValue("billingInvoiceDate")),
    dueDate: normalizeDateInputValue(getValue("billingDueDate")),
    note: getValue("billingNote")
  });

  addActivity(client, "billing_updated", "Azurirana naplata", `${record.projectName} - ${billingStatusLabel(record.status)}`, {
    billingId: record.id,
    projectId: record.projectId,
    projectName: record.projectName
  });

  await persistPaymentClient(client, "Naplata je sacuvana.");
}

async function handleMarkBillingPaid() {
  const client = getClientById(currentPaymentClientId);
  if (!client) return;

  const record = getCurrentBillingRecord(client);
  if (!record) {
    showToast("Nema otvorene naplate za ovaj projekat.");
    return;
  }

  markBillingRecordPaid(client, record.id);
  addActivity(client, "billing_paid", "Naplata placena", `${record.projectName} - ${record.amount ? formatMoney(record.amount) : "bez iznosa"}`, {
    billingId: record.id,
    projectId: record.projectId,
    projectName: record.projectName
  });

  await persistPaymentClient(client, "Placanje je evidentirano.");
}

function renderBillingHistory(client) {
  const list = document.getElementById("billingHistoryList");
  const empty = document.getElementById("billingHistoryEmpty");
  if (!list || !empty) return;

  const records = getBillingRecords(client);
  list.innerHTML = "";
  empty.classList.toggle("hidden", records.length > 0);
  list.classList.toggle("hidden", records.length === 0);

  records.forEach(record => {
    const row = document.createElement("div");
    row.className = "billing-history-item";
    row.innerHTML = `
      <div>
        <strong>${escapeHtml(record.projectName || "Projekat")}</strong>
        <p>${escapeHtml(billingStatusLabel(record.status))}${record.amount ? ` - ${escapeHtml(formatMoney(record.amount))}` : ""}</p>
      </div>
      <span>${escapeHtml(record.dueDate ? `Valuta ${formatDate(record.dueDate)}` : formatDate(record.requestedAt))}</span>
    `;
    list.appendChild(row);
  });
}

function markInvoiceSent() {
  handleSaveBillingRecord();
}

function generatePaymentReminder() {
  showToast("Podsetnik ostaje kroz napomenu u naplati. Direktan template vracamo kada stabilizujemo finance flow.");
}

function markPaymentReceived() {
  handleMarkBillingPaid();
}

async function copyPaymentMessage() {
  showToast("Template poruke vise nije deo osnovnog naplatnog flow-a.");
}

/* ------------------------- PROJECT BILLING ------------------------- */

function canManageProjectBilling() {
  return Boolean(
    (typeof isCurrentUserAdminRole === "function" && isCurrentUserAdminRole()) ||
    (typeof isCurrentUserFinanceRole === "function" && isCurrentUserFinanceRole())
  );
}

function handleOpenProjectBillingFromModal() {
  if (!currentTaskListProjectId) {
    showToast("Projekat nije pronadjen.");
    return;
  }
  openProjectBillingModal(currentTaskListProjectId);
}

function openProjectBillingModal(projectId) {
  const project = getProjectById(projectId);
  if (!project) {
    showToast("Projekat nije pronadjen.");
    return;
  }

  const existing = getActiveBillingByProjectId(project.id);
  if (existing) {
    showToast("Nalog za naplatu za ovaj projekat vec postoji.");
    openBillingModal(existing.id);
    return;
  }

  currentBillingModalId = null;
  currentBillingModalProjectId = String(project.id);

  const summary = typeof getProjectCostSummary === "function"
    ? getProjectCostSummary(project.id)
    : { laborCost: 0, materialCost: 0, totalCost: 0 };

  const client = getClientById(project.clientId);
  setTextIfExists("billingModalTitle", "Kreiraj nalog za naplatu");
  setTextIfExists("billingModalSubtitle", project.name || "Projekat");
  setTextIfExists("billingModalClient", `Klijent: ${client?.name || "-"}`);
  setTextIfExists("billingModalProject", `Projekat: ${project.name || "-"}`);
  setTextIfExists("billingModalStatus", "Status: Za fakturisanje");
  setTextIfExists("billingModalLaborCost", `Trosak rada: ${formatTaskCostRsd(summary.laborCost || 0)}`);
  setTextIfExists("billingModalMaterialCost", `Trosak materijala: ${formatTaskCostRsd(summary.materialCost || 0)}`);
  setTextIfExists("billingModalTotalCost", `Ukupan trosak: ${formatTaskCostRsd(summary.totalCost || 0)}`);
  setValueIfExists("billingProjectDescription", project.name || "");
  setValueIfExists("billingProjectAmount", "");
  setValueIfExists("billingProjectCurrency", "RSD");
  setValueIfExists("billingProjectDueDate", "");
  setValueIfExists("billingProjectInvoiceNumber", "");

  const inputs = [
    "billingProjectDescription",
    "billingProjectAmount",
    "billingProjectCurrency",
    "billingProjectDueDate",
    "billingProjectInvoiceNumber"
  ];
  inputs.forEach(id => {
    const el = document.getElementById(id);
    if (el) el.disabled = false;
  });

  document.getElementById("saveProjectBillingBtn")?.classList.remove("hidden");
  document.getElementById("billingMarkInvoicedBtn")?.classList.add("hidden");
  document.getElementById("billingMarkPaidBtn")?.classList.add("hidden");
  document.getElementById("billingMarkOverdueBtn")?.classList.add("hidden");

  const modal = document.getElementById("billingModal");
  if (!modal) return;
  modal.classList.remove("hidden");
  modal.setAttribute("aria-hidden", "false");
}

function openBillingModal(billingId) {
  const record = getBillingById(billingId);
  if (!record) {
    showToast("Nalog nije pronadjen.");
    return;
  }

  currentBillingModalId = String(record.id);
  currentBillingModalProjectId = String(record.projectId);

  const project = getProjectById(record.projectId);
  const client = getClientById(record.clientId);
  const status = normalizeBillingStatus(record.status);

  setTextIfExists("billingModalTitle", `${getBillingDisplayId(record)} • ${billingStatusLabel(status)}`);
  setTextIfExists("billingModalSubtitle", project?.name || "Projekat");
  setTextIfExists("billingModalClient", `Klijent: ${client?.name || "-"}`);
  setTextIfExists("billingModalProject", `Projekat: ${project?.name || "-"}`);
  setTextIfExists("billingModalStatus", `Status: ${billingStatusLabel(status)}`);
  setTextIfExists("billingModalLaborCost", `Trosak rada: ${formatTaskCostRsd(record.totalLaborCost || 0)}`);
  setTextIfExists("billingModalMaterialCost", `Trosak materijala: ${formatTaskCostRsd(record.totalMaterialCost || 0)}`);
  setTextIfExists("billingModalTotalCost", `Ukupan trosak: ${formatTaskCostRsd(record.totalCost || 0)}`);
  setValueIfExists("billingProjectDescription", record.description || "");
  setValueIfExists("billingProjectAmount", record.amount ?? "");
  setValueIfExists("billingProjectCurrency", record.currency || "RSD");
  setValueIfExists("billingProjectDueDate", dateOnlyValue(record.dueDate || ""));
  setValueIfExists("billingProjectInvoiceNumber", record.invoiceNumber || "");

  const canManage = canManageProjectBilling();
  const descriptionEl = document.getElementById("billingProjectDescription");
  const amountEl = document.getElementById("billingProjectAmount");
  const currencyEl = document.getElementById("billingProjectCurrency");
  const dueDateEl = document.getElementById("billingProjectDueDate");
  const invoiceEl = document.getElementById("billingProjectInvoiceNumber");

  if (descriptionEl) descriptionEl.disabled = true;
  if (amountEl) amountEl.disabled = true;
  if (currencyEl) currencyEl.disabled = true;
  if (dueDateEl) dueDateEl.disabled = true;
  if (invoiceEl) invoiceEl.disabled = !(canManage && status === "draft");

  document.getElementById("saveProjectBillingBtn")?.classList.add("hidden");
  document.getElementById("billingMarkInvoicedBtn")?.classList.toggle("hidden", !(canManage && status === "draft"));
  document.getElementById("billingMarkPaidBtn")?.classList.toggle("hidden", !(canManage && ["invoiced", "overdue"].includes(status)));
  document.getElementById("billingMarkOverdueBtn")?.classList.toggle("hidden", !(canManage && status === "invoiced"));

  const modal = document.getElementById("billingModal");
  if (!modal) return;
  modal.classList.remove("hidden");
  modal.setAttribute("aria-hidden", "false");
}

function closeBillingModal() {
  const modal = document.getElementById("billingModal");
  if (!modal) return;
  if (modal.contains(document.activeElement)) document.activeElement.blur();
  modal.classList.add("hidden");
  modal.setAttribute("aria-hidden", "true");
  currentBillingModalId = null;
  currentBillingModalProjectId = null;
}

async function persistProjectAndBilling(project, successText = "") {
  const projectSaved = saveProjects();
  const billingSaved = saveBilling();
  let billingSynced = true;
  let projectSynced = true;

  if (typeof canUseWorkspaceProjectStore === "function" && canUseWorkspaceProjectStore()) {
    projectSynced = await pushProjectsToWorkspace();
  }
  if (typeof canUseWorkspaceBillingStore === "function" && canUseWorkspaceBillingStore()) {
    billingSynced = await pushBillingToWorkspace();
  }

  if (typeof renderBillingView === "function") renderBillingView();
  const client = getClientById(project.clientId);
  if (client && typeof renderProjects === "function") renderProjects(client);
  if (currentTaskListProjectId && String(currentTaskListProjectId) === String(project.id)) {
    renderProjectTasksModal(project);
  }

  if (successText) {
    showToast(projectSynced && billingSynced ? successText : `${successText} Sync nije potpun.`);
  }

  return Boolean(projectSaved && billingSaved);
}

async function handleCreateProjectBillingSubmit() {
  const projectId = currentBillingModalProjectId;
  const project = getProjectById(projectId);
  if (!project) {
    showToast("Projekat nije pronadjen.");
    return;
  }

  if (!isCurrentUserAdminRole()) {
    showToast("Samo admin moze da kreira nalog.");
    return;
  }

  const existing = getActiveBillingByProjectId(project.id);
  if (existing) {
    showToast("Nalog za naplatu za ovaj projekat vec postoji.");
    openBillingModal(existing.id);
    return;
  }

  const description = String(getValue("billingProjectDescription") || "").trim();
  const amountRaw = Number(getValue("billingProjectAmount") || 0);
  const currency = String(getValue("billingProjectCurrency") || "RSD").trim().toUpperCase() || "RSD";
  const dueDate = normalizeDateInputValue(getValue("billingProjectDueDate")) || null;
  const invoiceNumber = String(getValue("billingProjectInvoiceNumber") || "").trim();

  if (!description) {
    showToast("Opis je obavezan.");
    return;
  }

  if (!Number.isFinite(amountRaw) || amountRaw <= 0) {
    showToast("Unesi ispravan iznos za naplatu.");
    return;
  }

  const summary = typeof getProjectCostSummary === "function"
    ? getProjectCostSummary(project.id)
    : { laborCost: 0, materialCost: 0, totalCost: 0 };

  const created = createBillingForProject(project.id, {
    description,
    amount: amountRaw,
    currency,
    dueDate,
    invoiceNumber,
    totalLaborCost: summary.laborCost || 0,
    totalMaterialCost: summary.materialCost || 0,
    totalCost: summary.totalCost || 0
  });

  if (!created) {
    showToast("Nalog nije kreiran.");
    return;
  }
  if (created.duplicate) {
    showToast("Nalog za naplatu za ovaj projekat vec postoji.");
    openBillingModal(created.record.id);
    return;
  }

  const savedProject = normalizeProject({
    ...project,
    billingId: created.record.id,
    billingStatus: "draft"
  });
  const idx = projects.findIndex(item => String(item.id) === String(project.id));
  if (idx !== -1) projects[idx] = savedProject;
  await persistProjectAndBilling(savedProject, "Nalog za naplatu je kreiran.");
  closeBillingModal();
}

async function handleBillingMarkInvoiced() {
  const record = getBillingById(currentBillingModalId);
  if (!record || !canManageProjectBilling()) return;

  const updated = saveBillingRecord({
    ...record,
    invoiceNumber: String(getValue("billingProjectInvoiceNumber") || "").trim(),
    status: "invoiced",
    invoicedAt: nowISO(),
    updatedAt: nowISO()
  });
  const project = getProjectById(record.projectId);
  if (project) {
    const savedProject = normalizeProject({ ...project, billingStatus: "invoiced", billingId: updated.id });
    const idx = projects.findIndex(item => String(item.id) === String(project.id));
    if (idx !== -1) projects[idx] = savedProject;
    await persistProjectAndBilling(savedProject, "Nalog je oznacen kao fakturisan.");
  } else {
    saveBilling();
    if (typeof renderBillingView === "function") renderBillingView();
  }
  openBillingModal(updated.id);
}

async function handleBillingMarkPaid() {
  const record = getBillingById(currentBillingModalId);
  if (!record || !canManageProjectBilling()) return;

  const updated = saveBillingRecord({
    ...record,
    status: "paid",
    paidAt: nowISO(),
    updatedAt: nowISO()
  });
  const project = getProjectById(record.projectId);
  if (project) {
    const savedProject = normalizeProject({ ...project, billingStatus: "paid", billingId: updated.id });
    const idx = projects.findIndex(item => String(item.id) === String(project.id));
    if (idx !== -1) projects[idx] = savedProject;
    await persistProjectAndBilling(savedProject, "Nalog je oznacen kao placen.");
  } else {
    saveBilling();
    if (typeof renderBillingView === "function") renderBillingView();
  }
  openBillingModal(updated.id);
}

async function handleBillingMarkOverdue() {
  const record = getBillingById(currentBillingModalId);
  if (!record || !canManageProjectBilling()) return;

  const updated = saveBillingRecord({
    ...record,
    status: "overdue",
    updatedAt: nowISO()
  });
  const project = getProjectById(record.projectId);
  if (project) {
    const savedProject = normalizeProject({ ...project, billingStatus: "overdue", billingId: updated.id });
    const idx = projects.findIndex(item => String(item.id) === String(project.id));
    if (idx !== -1) projects[idx] = savedProject;
    await persistProjectAndBilling(savedProject, "Nalog je oznacen kao kasni.");
  } else {
    saveBilling();
    if (typeof renderBillingView === "function") renderBillingView();
  }
  openBillingModal(updated.id);
}

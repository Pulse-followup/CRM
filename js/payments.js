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
  const openRecords = records.filter(record => !["paid", "canceled"].includes(normalizeBillingStatus(record.status)));
  const paidRecords = records.filter(record => normalizeBillingStatus(record.status) === "paid");
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
  const openRecords = records.filter(record => !["paid", "canceled"].includes(normalizeBillingStatus(record.status)));
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
  if (paidBtn) paidBtn.disabled = !hasRecord || normalizeBillingStatus(record.status) === "paid";

  if (!hasRecord) return;

  setValueIfExists("billingStatusSelect", normalizeBillingStatus(record.status));
  setValueIfExists("billingInvoiceNumber", record.invoiceNumber || record.invoice_number || "");
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
    projectName: record.projectName,
    taskTitle: `Naplata: ${record.projectName}`,
    taskStatus: "sent_to_billing",
    taskActionText: record.status === "paid" ? "oznacio kao naplaceno" : "oznacio kao spremno za naplatu"
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
    projectName: record.projectName,
    taskTitle: `Naplata: ${record.projectName}`,
    taskStatus: "sent_to_billing",
    taskActionText: "oznacio kao naplaceno"
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

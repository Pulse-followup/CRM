/* ------------------------- PAYMENT ------------------------- */
function openPaymentModal(clientId) {
  if (!requireProFeature("payments")) return;

  const client = getClientById(clientId);
  if (!client) return;
  currentPaymentClientId = clientId;
  renderPaymentSummary(client);

  setTextIfExists("paymentModalTitle", `Naplata — ${client.name}`);

  const modal = document.getElementById("paymentModal");
  if (modal) {
    modal.classList.remove("hidden");
    modal.setAttribute("aria-hidden", "false");
  }
}

function closePaymentModal() {
  const modal = document.getElementById("paymentModal");
  if (modal) {
    modal.classList.add("hidden");
    modal.setAttribute("aria-hidden", "true");
  }
  currentPaymentClientId = null;
}

function renderPaymentSummary(client) {
  const discipline = computePaymentDiscipline(client);
  const badgeClass =
    discipline === "Dobra" ? "success" :
    discipline === "Promenljiva" ? "warning" : "neutral";

  setTextIfExists("paymentSummaryBadge", `Finansijska disciplina: ${discipline}`);
  setClassIfExists("paymentSummaryBadge", `badge ${badgeClass}`);

  const parts = [];
  if (client.payment.lastInvoiceDate) parts.push(`Poslata faktura: ${formatDate(client.payment.lastInvoiceDate)}`);
  if (client.payment.lastReminderDate) parts.push(`Podsetnik: ${formatDate(client.payment.lastReminderDate)}`);
  if (client.payment.lastPaidDate) parts.push(`Plaćeno: ${formatDate(client.payment.lastPaidDate)}`);
  if (!parts.length) parts.push("Nema podataka o naplati.");

  setTextIfExists("paymentSummaryText", parts.join(" • "));
}

function renderPaymentSummaryInline(client) {
  const discipline = computePaymentDiscipline(client);
  const badgeClass =
    discipline === "Dobra" ? "success" :
    discipline === "Promenljiva" ? "warning" : "neutral";

  setTextIfExists("paymentSummaryBadgeInline", `Naplata: ${discipline}`);
  setClassIfExists("paymentSummaryBadgeInline", `badge ${badgeClass}`);

  const parts = [];
  if (client.payment.lastInvoiceDate) parts.push(`Faktura: ${formatDate(client.payment.lastInvoiceDate)}`);
  if (client.payment.lastReminderDate) parts.push(`Reminder: ${formatDate(client.payment.lastReminderDate)}`);
  if (client.payment.lastPaidDate) parts.push(`Plaćeno: ${formatDate(client.payment.lastPaidDate)}`);
  if (!parts.length) parts.push("Nema podataka o naplati.");

  setTextIfExists("paymentSummaryTextInline", parts.join(" • "));
}

function markInvoiceSent() {
  const client = getClientById(currentPaymentClientId);
  if (!client) return;

  client.payment.lastInvoiceDate = nowISO();
  client.payment.lastPaidDate = null;
  client.payment.paymentSpeed = null;
  client.lastActionAt = nowISO();
  client.lastActionHuman = "Poslata faktura";

  addActivity(client, "invoice_sent", "Poslata faktura", "");
  saveClients();
  renderPaymentSummary(client);
  renderAll();
  if (currentClientId === client.id) openClientDrawer(client.id);
  showToast("Faktura je evidentirana.");
}

function generatePaymentReminder() {
  const client = getClientById(currentPaymentClientId);
  if (!client) return;

  setValueIfExists("paymentMessage",
`Samo da proverim status fakture koju smo poslali.

Ako je potrebno još nešto sa naše strane, slobodno javite.`);

  client.payment.lastReminderDate = nowISO();
  client.lastActionAt = nowISO();
  client.lastActionHuman = "Poslat podsetnik za plaćanje";

  addActivity(client, "payment_reminder", "Poslat podsetnik za plaćanje", "");
  saveClients();
  renderPaymentSummary(client);
  renderAll();
  if (currentClientId === client.id) openClientDrawer(client.id);
  showToast("Podsetnik je evidentiran.");
}

function markPaymentReceived(speed) {
  const client = getClientById(currentPaymentClientId);
  if (!client) return;

  client.payment.lastPaidDate = nowISO();
  client.payment.paymentSpeed = speed;
  client.lastActionAt = nowISO();
  client.lastActionHuman = speed === "on_time" ? "Faktura plaćena u roku" : "Faktura plaćena sa kašnjenjem";

  addActivity(
    client,
    speed === "on_time" ? "paid_on_time" : "paid_late",
    speed === "on_time" ? "Faktura plaćena u roku" : "Faktura plaćena sa kašnjenjem",
    ""
  );

  saveClients();
  renderPaymentSummary(client);
  renderAll();
  if (currentClientId === client.id) openClientDrawer(client.id);
  showToast(speed === "on_time" ? "Plaćanje u roku je evidentirano." : "Kašnjenje u plaćanju je evidentirano.");
}

async function copyPaymentMessage() {
  const field = document.getElementById("paymentMessage");
  const value = field ? field.value : "";

  try {
    await navigator.clipboard.writeText(value);
    showToast("Poruka je kopirana.");
  } catch {
    showToast("Copy nije uspeo.");
  }
}

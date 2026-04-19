/* ------------------------- STAGE ACTIONS ------------------------- */
let currentHomeMode = "all";

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
      activityLabel = "Deal dobijen";
      break;
    case "lost":
      client.stage = "lost";
      client.lastActionAt = nowISO();
      client.lastActionHuman = "Deal izgubljen";
      client.nextStepText = "";
      client.nextStepType = "";
      client.nextStepDate = "";
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
  saveClients();
  renderDashboard();
  renderClientsList();
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

function getDashboardSuggestions() {
  return clients
    .filter(client => client.nextStepDate && isDueToday(client.nextStepDate))
    .map(client => ({ client, suggestion: getTodaySuggestion(client) }))
    .sort((a, b) => PRIORITY_ORDER[a.suggestion.priority] - PRIORITY_ORDER[b.suggestion.priority]);
}

function getHomeHighPrioritySuggestions() {
  return clients.filter(client => {
    if (client.nextStepDate && isOverdueDate(client.nextStepDate)) return true;
    return computePriorityBase(client) === "high";
  });
}

function getWaitingClients() {
  return clients
    .filter(client => client.stage === "waiting")
    .sort((a, b) => new Date(b.lastActionAt || 0) - new Date(a.lastActionAt || 0));
}

function getOverdueClients() {
  return clients
    .filter(client => client.nextStepDate && isOverdueDate(client.nextStepDate))
    .sort((a, b) => daysUntil(a.nextStepDate) - daysUntil(b.nextStepDate));
}

function getWeekClients() {
  return clients
    .filter(client => client.nextStepDate && isThisWeekDate(client.nextStepDate) && !isDueToday(client.nextStepDate))
    .sort((a, b) => daysUntil(a.nextStepDate) - daysUntil(b.nextStepDate));
}

function toggleHomeHighPriorityFilter() {
  currentHomeMode = currentHomeMode === "high_priority" ? "all" : "high_priority";
  renderDashboard();
}

function renderDashboard() {
  const todayItems = currentHomeMode === "high_priority"
    ? getDashboardSuggestions().filter(item => item.suggestion.priority === "high")
    : getDashboardSuggestions();
  const overdueClients = getOverdueClients();
  const waitingClients = getWaitingClients();
  const weekClients = getWeekClients();

  renderCardCollection("todayList", "todayEmpty", todayItems, item => createTodayCard(item.client, item.suggestion));
  renderCardCollection("overdueList", "overdueEmpty", overdueClients, client => createTaskCard(client, "overdue"));
  renderCardCollection("waitingList", "waitingEmpty", waitingClients, client => createWaitingCard(client));
  renderCardCollection("weekList", "weekEmpty", weekClients, client => createTaskCard(client, "week"));

  setTextIfExists("homeTodayDate", formatTodayHeaderDate());
  setTextIfExists("homeStatTodayActionsValue", todayItems.length + overdueClients.length);
  setTextIfExists("homeStatHighPriorityValue", getHomeHighPrioritySuggestions().length);
  setTextIfExists("homeStatTotalClientsValue", clients.length);
  setTextIfExists("homeStatWeeklyActionsValue", weekClients.length);

  const highPriorityCard = document.getElementById("homeCardHighPriority");
  if (highPriorityCard) {
    highPriorityCard.classList.toggle("is-active", currentHomeMode === "high_priority");
  }
}

function renderCardCollection(listId, emptyId, items, renderItem) {
  const list = document.getElementById(listId);
  const empty = document.getElementById(emptyId);
  if (!list || !empty) return;

  list.innerHTML = "";
  items.forEach(item => list.appendChild(renderItem(item)));
  empty.classList.toggle("hidden", items.length > 0);
}

function getClientsFilteredByMode(list) {
  switch (currentClientsMode) {
    case "today_actions":
      return list.filter(client => client.nextStepDate && isDueToday(client.nextStepDate));
    case "high_priority":
      return list.filter(client => (client.nextStepDate && isOverdueDate(client.nextStepDate)) || computePriorityBase(client) === "high");
    case "weekly_actions":
      return list.filter(client => client.nextStepDate && isThisWeekDate(client.nextStepDate));
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
    const statusDate = formatDate(client.lastActionAt);
    const inactivityDays = daysSince(client.lastActionAt);
    const dueText = client.nextStepDate ? formatDate(client.nextStepDate) : "-";
    const priority = computePriorityBase(client);
    const card = document.createElement("article");
    card.className = `client-card priority-${priority}`;

    card.innerHTML = `
      <div class="card-head card-head-simple">
        <div class="card-title-wrap">
          <h4>${escapeHtml(client.name)}</h4>
          <p class="card-subtitle">${escapeHtml(client.clientCity || "-")}</p>
        </div>
        <span class="badge ${commercialPotentialBadgeClass(client)}">Potencijal: ${escapeHtml(computeCommercialPotential(client))}</span>
      </div>

      <div class="card-body card-body-simple">
        <p class="card-status-line"><strong>Trenutni status:</strong> ${escapeHtml(statusText)} (${escapeHtml(statusDate)})</p>
        <p class="card-due-line"><strong>Sledeci korak:</strong> ${escapeHtml(client.nextStepText || "-")} (${escapeHtml(dueText)})</p>
        <p class="card-subtitle">pre ${inactivityDays} ${inactivityDays === 1 ? "dan" : "dana"}</p>

        <div class="card-actions card-actions-simple">
          <button class="btn btn-secondary btn-sm" data-client-detail="${client.id}">Detalji klijenta</button>
        </div>
      </div>
    `;

    const detailBtn = card.querySelector("[data-client-detail]");
    if (detailBtn) detailBtn.addEventListener("click", () => openClientDrawer(client.id));

    list.appendChild(card);
  });
}

function createTodayCard(client, suggestion) {
  const card = document.createElement("article");
  const priorityClass = suggestion.priority === "high" ? "danger" : suggestion.priority === "medium" ? "warning" : "neutral";

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
      <p class="today-suggestion-line"><strong>Sledeci korak:</strong> ${escapeHtml(client.nextStepText || suggestion.actionLabel || "Nema")}</p>
      <p class="card-due-line"><strong>Rok:</strong> ${escapeHtml(client.nextStepDate ? formatDate(client.nextStepDate) : "-")} (danas)</p>

      <div class="card-actions today-actions">
        <button class="btn btn-primary btn-sm btn-danger-soft" data-today-action="${client.id}">Otvori aktivnost</button>
        <button class="btn btn-secondary btn-sm btn-info-soft" data-today-detail="${client.id}">Detalji klijenta</button>
      </div>
    </div>
  `;

  const actionBtn = card.querySelector("[data-today-action]");
  const detailBtn = card.querySelector("[data-today-detail]");

  if (actionBtn) {
    actionBtn.addEventListener("click", () => {
      openActionModal(client.id, suggestion.actionType, suggestion.priority);
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
      <p class="card-due-line"><strong>Sledeci check:</strong> ${escapeHtml(client.nextStepDate ? formatDate(client.nextStepDate) : "-")}</p>
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
  const dueDays = daysUntil(client.nextStepDate);
  const badgeClass = kind === "overdue" ? "danger" : "neutral";
  const badgeText =
    kind === "overdue"
      ? `Kasni ${Math.abs(dueDays)} dana`
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
      <p class="card-status-line"><strong>Sledeci korak:</strong> ${escapeHtml(client.nextStepText || "-")}</p>
      <p class="card-due-line"><strong>Rok:</strong> ${escapeHtml(client.nextStepDate ? formatDate(client.nextStepDate) : "-")}</p>

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

/* ------------------------- DEMO / SEED ------------------------- */
if (!localStorage.getItem(STORAGE_KEY)) {
  clients = [
    {
      id: 101,
      name: "Apotekarski lanac",
      businessType: "pharmacy",
      clientAddress: "",
      clientCity: "Beograd",
      contactPerson: "",
      contactRole: "",
      contactPhone: "",
      contactEmail: "",
      companySize: "5+",
      clientType: "physical",
      decisionModel: "central",
      internationalFlag: "no",
      revenueDriverPrimary: "consultative",
      revenueFocusTags: ["repeat_customers", "staff_recommendation"],
      revenueDetail: "OTC i dermo",
      pharmacyFocus: "otc",
      pharmacyLocations: "5+",
      pharmacyCentralization: "central",
      pharmacyTraffic: "high",
      pharmacySuppliers: "wide",
      stage: "offer_sent",
      lastActionNote: "Poslata inicijalna ponuda za pilot.",
      lastActionAt: new Date(Date.now() - 4 * 86400000).toISOString(),
      lastActionHuman: "Poslata ponuda",
      nextStepText: "Uraditi follow-up",
      nextStepType: "followup",
      nextStepDate: shiftDateISO(1),
      createdAt: new Date(Date.now() - 10 * 86400000).toISOString(),
      payment: { lastInvoiceDate: null, lastReminderDate: null, lastPaidDate: null, paymentSpeed: null },
      activityLog: [
        {
          at: new Date(Date.now() - 10 * 86400000).toISOString(),
          type: "created",
          label: "Kreiran klijent",
          note: ""
        },
        {
          at: new Date(Date.now() - 4 * 86400000).toISOString(),
          type: "offer_sent",
          label: "Poslata ponuda",
          note: "Poslata inicijalna ponuda za pilot."
        }
      ]
    }
  ];
  saveClients();
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

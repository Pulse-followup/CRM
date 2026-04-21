/* ------------------------- DRAWER CLEAN ------------------------- */

function openClientDrawer(id) {
  const client = getClientById(id);
  if (!client) return;

  currentClientId = id;

  renderCleanDrawer(client);
  renderTimeline(client);

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
  const statusText = STAGES[client.stage] || "Novi";
  const cityText = client.clientCity || client.city || "-";
  const days = daysSince(client.lastActionAt);
  const pulse = computePulseScore(client);
  const activeTask = getClientActiveTask(client);

  setTextIfExists("drawerClientName", client.name || "Klijent");
  setTextIfExists("drawerClientSubtitle", `${cityText} • ${statusText} • pre ${days} dana`);

  setTextIfExists("detailPulseScore", `${pulse}%`);
  renderPulseBand(pulse);
  setTextIfExists("detailPulseExplanation", getPulseScoreExplanation(client));
  if (hasPremiumAccess()) {
    renderPulseSignals(client);
  } else {
    renderLockedPulseSignals();
  }

  setTextIfExists("assessmentScale", computeCommercialPotential(client));
  setTextIfExists("assessmentComplexity", computeBuyingReadiness(client));
  setTextIfExists("assessmentPotential", computeMomentum(client));

  setTextIfExists("detailClientName", client.name || "-");
  setTextIfExists("detailCity", cityText);
  setTextIfExists("detailContactPerson", client.contactPerson || "-");
  setTextIfExists("detailContactRole", client.contactRole || "-");
  setTextIfExists("detailPhone", client.contactPhone || "-");
  setTextIfExists("detailEmail", client.contactEmail || "-");
  setTextIfExists("detailAddress", client.clientAddress || "-");
  setTextIfExists("detailStage", statusText);
  setTextIfExists("detailLastActionNote", client.lastActionNote || "-");
  setTextIfExists("detailNextStep", activeTask?.title || getClientNextStepText(client, "-"));
  setTextIfExists("detailNextStepDate", activeTask?.dueDate ? formatDate(activeTask.dueDate) : (hasConcreteNextStep(client) ? formatDate(client.nextStepDate) : "-"));
  setTextIfExists("detailDealValue", isProUnlocked() ? (client.dealValue ? formatMoney(client.dealValue) : "-") : "Pro");
  setTextIfExists("detailDealProbability", isProUnlocked() ? dealProbabilityLabel(client.dealProbability) : "Pro");
  setTextIfExists("detailExpectedDecisionDate", isProUnlocked() ? (client.expectedDecisionDate ? formatDate(client.expectedDecisionDate) : "-") : "Pro");

  if (typeof renderPaymentSummaryInline === "function") {
    renderPaymentSummaryInline(client);
  }
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

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
  const recommendation = getDrawerActionRecommendation(client);

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

  setTextIfExists("drawerActionRecommendationTitle", recommendation.title);
  setTextIfExists("drawerActionRecommendationText", recommendation.text);

  setTextIfExists("detailClientName", client.name || "-");
  setTextIfExists("detailCity", cityText);
  setTextIfExists("detailContactPerson", client.contactPerson || "-");
  setTextIfExists("detailPhone", client.contactPhone || "-");
  setTextIfExists("detailEmail", client.contactEmail || "-");
  setTextIfExists("detailLastActionNote", client.lastActionNote || "-");
  setTextIfExists("detailNextStep", client.nextStepText || "-");
  setTextIfExists("detailNextStepDate", client.nextStepDate ? formatDate(client.nextStepDate) : "-");
  setTextIfExists("detailDealValue", isProUnlocked() ? (client.dealValue ? formatMoney(client.dealValue) : "-") : "Pro");
  setTextIfExists("detailDealProbability", isProUnlocked() ? dealProbabilityLabel(client.dealProbability) : "Pro");
  setTextIfExists("detailExpectedDecisionDate", isProUnlocked() ? (client.expectedDecisionDate ? formatDate(client.expectedDecisionDate) : "-") : "Pro");
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
    row.innerHTML = `
      <div class="timeline-date">${escapeHtml(formatDateTime(item.at))}</div>
      <div class="timeline-content">
        <strong>${escapeHtml(item.label || "Aktivnost")}</strong>
        <p>${escapeHtml(item.note || "-")}</p>
      </div>
    `;
    list.appendChild(row);
  });
}

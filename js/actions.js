/* ------------------------- ACTION MODAL ------------------------- */
let currentFollowupTier = "light";
let currentFollowupMeta = null;
let currentActionTypeKey = "followup_light";

function openActionModal(clientId, forcedActionType = null, forcedPriority = null) {
  const client = getClientById(clientId);
  if (!client) return;

  currentActionClientId = clientId;
  const actionType = forcedActionType || fallbackActionType(client.stage);
  const isFollowupFlow = isFollowupActionType(actionType);
  const tierPicker = document.querySelector(".followup-tier-picker");

  const followupMeta = getFollowupMeta(client, actionType, forcedPriority);
  currentFollowupMeta = followupMeta;

  setTextIfExists("actionModalTitle", client.name);
  setTextIfExists("actionClientBadge", client.name);
  setTextIfExists("actionStageBadge", STAGES[client.stage] || "Status");
  setClassIfExists(
    "actionPriorityBadge",
    `badge ${followupMeta.priority === "high" ? "danger" : followupMeta.priority === "medium" ? "warning" : "neutral"}`
  );

  if (isFollowupFlow) {
    if (tierPicker) tierPicker.classList.remove("hidden");
    setTextIfExists("actionModalSubtitle", followupMeta.subtitle);
    setTextIfExists("actionPriorityBadge", `Prioritet: ${priorityLabel(followupMeta.priority)}`);
    setTextIfExists("actionCadenceBadge", followupMeta.cadenceLabel);
    setFollowupTier(followupMeta.selectedTier);
  } else {
    currentActionTypeKey = actionType;
    if (tierPicker) tierPicker.classList.add("hidden");
    setTextIfExists("actionModalSubtitle", getGenericActionSubtitle(client, actionType));
    setTextIfExists("actionPriorityBadge", `Prioritet: ${priorityLabel(followupMeta.priority)}`);
    setTextIfExists("actionCadenceBadge", "Rucna akcija");
    setValueIfExists("actionType", actionTypeLabel(actionType));
    setValueIfExists("actionMessage", getActionMessage(client, actionType));
  }

  const modal = document.getElementById("actionModal");
  if (modal) {
    modal.classList.remove("hidden");
    modal.setAttribute("aria-hidden", "false");
  }
}

function closeActionModal() {
  const modal = document.getElementById("actionModal");
  if (modal) {
    modal.classList.add("hidden");
    modal.setAttribute("aria-hidden", "true");
  }
  currentActionClientId = null;
  currentFollowupMeta = null;
}

function getFollowupMeta(client, forcedActionType = null, forcedPriority = null) {
  const lastTouch = getLastOutboundTouch(client);
  const days = lastTouch ? daysSince(lastTouch.at) : daysSince(client.lastActionAt);
  const recommendedTier = getTierByDays(days);
  const selectedTier = getTierFromActionType(forcedActionType) || recommendedTier;
  const priority = forcedPriority || (days >= 6 ? "high" : days >= 3 ? "medium" : "low");
  const sourceLabel = lastTouch ? lastTouch.label : "poslednje aktivnosti";

  return {
    days,
    sourceLabel,
    priority,
    recommendedTier,
    selectedTier,
    cadenceLabel: `Preporuka: ${followupTierLabel(recommendedTier)}`,
    subtitle: `Poslednji relevantan kontakt je "${sourceLabel}" pre ${days} dana. Izaberi ton follow-up poruke.`
  };
}

function getLastOutboundTouch(client) {
  const relevantTypes = new Set([
    "offer_sent",
    "after_meeting",
    "first_contact",
    "followup",
    "followup_light",
    "followup_medium",
    "followup_final",
    "followup_strong",
    "status_check"
  ]);

  const log = Array.isArray(client.activityLog) ? client.activityLog : [];
  return log.find(item => relevantTypes.has(item.type)) || null;
}

function getTierByDays(days) {
  if (days >= 9) return "final";
  if (days >= 6) return "medium";
  return "light";
}

function isFollowupActionType(actionType) {
  return [
    "followup",
    "followup_light",
    "followup_medium",
    "followup_final",
    "followup_strong"
  ].includes(actionType);
}

function getTierFromActionType(actionType) {
  switch (actionType) {
    case "followup_final":
      return "final";
    case "followup_medium":
    case "followup_strong":
      return "medium";
    case "followup":
    case "followup_light":
      return "light";
    default:
      return "";
  }
}

function followupTierLabel(tier) {
  switch (tier) {
    case "medium": return "Srednji follow-up";
    case "final": return "Finalni follow-up";
    default: return "Blagi follow-up";
  }
}

function setFollowupTier(tier) {
  const client = getClientById(currentActionClientId);
  if (!client) return;

  currentFollowupTier = tier || "light";
  currentActionTypeKey = getFollowupActionType(currentFollowupTier);

  document.querySelectorAll("[data-followup-tier]").forEach(btn => {
    btn.classList.toggle("is-active", btn.dataset.followupTier === currentFollowupTier);
  });

  setValueIfExists("actionType", actionTypeLabel(currentActionTypeKey));
  setValueIfExists("actionMessage", getFollowupMessage(client, currentFollowupTier));
}

function getFollowupActionType(tier) {
  switch (tier) {
    case "medium": return "followup_medium";
    case "final": return "followup_final";
    default: return "followup_light";
  }
}

function getFollowupMessage(client, tier) {
  const context = getFollowupContext(client);
  const contextIntro = context.summary
    ? `Javljam se u vezi sa ${context.summary}.`
    : "Javljam se u vezi sa predlogom koji sam poslao.";
  const offerLine = context.summary
    ? "Ako vam odgovara, mogu da posaljem i kratak rezime ili da prodjemo kroz detalje u kratkom pozivu."
    : "Ako vam odgovara, mogu da posaljem i kratak rezime ili da prodjemo kroz detalje u kratkom pozivu.";

  switch (tier) {
    case "medium":
      return `${contextIntro}

Samo da proverim da li ste stigli da pogledate predlog koji sam poslao i da li vam ovo ima smisla u ovom trenutku.

Ako imate pitanja ili vam treba dodatno pojasnjenje, tu sam.

${offerLine}`;

    case "final":
      return `${contextIntro}

Javljam se jos jednom u vezi predloga koji sam poslao.

Znam da ste verovatno u guzvi, pa mi je dovoljno i kratko da znam da li je ovo aktuelno u ovom trenutku ili da temu zatvorimo za sada.

Ako ima smisla, mogu poslati i kratak rezime sa sledecim koracima, bez dodatnog oduzimanja vremena.`;

    default:
      return `${contextIntro}

Samo da proverim da li ste stigli da pogledate predlog koji sam poslao.

Kad budete stigli, znacilo bi mi da cujem utisak ili eventualna pitanja sa vase strane.

${offerLine}`;
  }
}

function getFollowupContext(client) {
  const candidates = [];
  const log = Array.isArray(client.activityLog) ? client.activityLog : [];

  log.forEach(item => {
    const note = normalizeFollowupNote(item.note || "");
    if (!note) return;
    candidates.push({
      at: item.at || "",
      note,
      type: item.type || ""
    });
  });

  const fallbackNote = normalizeFollowupNote(client.lastActionNote || "");
  if (fallbackNote) {
    candidates.push({
      at: client.lastActionAt || "",
      note: fallbackNote,
      type: "last_action_note"
    });
  }

  candidates.sort((a, b) => new Date(b.at || 0) - new Date(a.at || 0));

  const best = candidates.find(item => item.note.length >= 8) || null;
  if (!best) {
    return {
      summary: "",
      raw: ""
    };
  }

  return {
    raw: best.note,
    summary: summarizeFollowupContext(best.note)
  };
}

function normalizeFollowupNote(note) {
  return String(note || "")
    .replace(/\s+/g, " ")
    .replace(/[.!?]+$/g, "")
    .trim();
}

function summarizeFollowupContext(note) {
  const cleaned = normalizeFollowupNote(note);
  if (!cleaned) return "";

  let short = cleaned.length > 90 ? `${cleaned.slice(0, 87).trim()}...` : cleaned;

  short = short
    .replace(/^dogovorili\s+/i, "")
    .replace(/^dogovoren\s+/i, "")
    .replace(/^dogovorena\s+/i, "")
    .replace(/^dogovoreno\s+/i, "")
    .replace(/^cekaju\s+/i, "")
    .replace(/^ceka se\s+/i, "")
    .replace(/^ceka\s+/i, "")
    .replace(/^traze\s+/i, "")
    .replace(/^trazi\s+/i, "")
    .replace(/^zanima ih\s+/i, "")
    .replace(/^zainteresovani za\s+/i, "");

  return short.charAt(0).toLowerCase() + short.slice(1);
}

async function copyActionMessage() {
  const field = document.getElementById("actionMessage");
  const value = field ? field.value : "";
  try {
    await navigator.clipboard.writeText(value);
    showToast("Poruka je kopirana.");
  } catch {
    showToast("Copy nije uspeo.");
  }
}

function markActionAsSent() {
  const client = getClientById(currentActionClientId);
  if (!client) return;

  const actionType = currentActionTypeKey;

  client.lastActionAt = nowISO();
  client.lastActionHuman = actionHumanLabel(actionType);
  if (isFollowupActionType(actionType) || actionType === "status_check" || actionType === "first_contact") {
    client.stage = "waiting";
  } else if (actionType === "after_meeting") {
    client.stage = "offer_sent";
  } else if (actionType === "negotiation_push") {
    client.stage = "negotiation";
  } else if (actionType === "payment_reminder") {
    client.payment.lastReminderDate = nowISO();
  }

  const defaultNextStep = getDefaultNextStepForAction(actionType);
  client.nextStepText = defaultNextStep.text;
  client.nextStepType = defaultNextStep.type;
  client.nextStepDate = defaultNextStep.date;

  addActivity(client, actionType, actionHumanLabel(actionType), client.lastActionNote || "");
  saveClients();
  closeActionModal();
  renderAll();

  if (currentClientId === client.id) openClientDrawer(client.id);
  showToast("Akcija je evidentirana.");
}

function getGenericActionSubtitle(client, actionType) {
  switch (actionType) {
    case "first_contact":
      return `Klijent je nov i treba prvi kontakt. Poslednja aktivnost je pre ${daysSince(client.lastActionAt)} dana.`;
    case "after_meeting":
      return "Sastanak je evidentiran i sada je pravi trenutak za poruku sa sledecim korakom.";
    case "status_check":
      return "Klijent je u cekanju. Posalji kratak check-in bez pritiska.";
    case "negotiation_push":
      return "Pregovori stoje. Predlog je da poruka bude jasna i usmerena ka odluci.";
    case "payment_reminder":
      return "Otvaras podsetnik za placanje na osnovu poslednje poslate fakture.";
    default:
      return "Predlog poruke i sledeci korak.";
  }
}

/* ------------------------- DRAWER RECOMMENDATION ------------------------- */
function getDrawerActionRecommendation(client) {
  if (isDoneStage(client.stage)) {
    return {
      title: "Status je zavrsen",
      text: "Za ovog klijenta sada vise ima smisla interna beleska ili naplata nego novi follow-up."
    };
  }

  const followup = getFollowupMeta(client);
  if (client.stage === "offer_sent" || client.stage === "waiting") {
    return {
      title: followup.cadenceLabel,
      text: `Poslednji kontakt "${followup.sourceLabel}" je bio pre ${followup.days} dana. Otvori Follow-up i izaberi poruku koja najbolje odgovara tonu razgovora.`
    };
  }

  const inactiveDays = daysSince(client.lastActionAt);
  if (inactiveDays >= 7) {
    return {
      title: "Klijent je neaktivan",
      text: `Nema aktivnosti vec ${inactiveDays} dana. Dodaj novu aktivnost i evidentiraj poziv, podsetnik ili reaktivaciju.`
    };
  }

  return {
    title: "Odrzavaj ritam",
    text: "Ako nema poruke za slanje, koristi Novu aktivnost da evidentiras poziv, sastanak ili internu napomenu."
  };
}

/* ------------------------- NEW ACTIVITY MODAL ------------------------- */
function openActivityModal(clientId) {
  const client = getClientById(clientId);
  if (!client) return;

  currentActivityClientId = clientId;

  setTextIfExists("activityModalTitle", `Nova aktivnost - ${client.name}`);
  setTextIfExists("activityModalSubtitle", "Evidentiraj poziv, sastanak, podsetnik ili internu belesku.");
  setTextIfExists("activityClientBadge", client.name);
  setValueIfExists("activityType", "");
  setValueIfExists("activityStage", "");
  setValueIfExists("activityNote", "");
  setValueIfExists("activityNextStepText", client.nextStepText || "");
  setValueIfExists("activityNextStepType", client.nextStepType || "");
  setValueIfExists("activityNextStepDate", client.nextStepDate || "");

  const modal = document.getElementById("activityModal");
  if (modal) {
    modal.classList.remove("hidden");
    modal.setAttribute("aria-hidden", "false");
  }
}

function closeActivityModal() {
  const modal = document.getElementById("activityModal");
  if (modal) {
    modal.classList.add("hidden");
    modal.setAttribute("aria-hidden", "true");
  }
  currentActivityClientId = null;
}

function handleActivitySubmit(e) {
  e.preventDefault();

  const client = getClientById(currentActivityClientId);
  if (!client) return;

  const activityType = getValue("activityType");
  const nextStage = getValue("activityStage");
  const note = getValue("activityNote").trim();
  const nextStepText = getValue("activityNextStepText").trim();
  const nextStepType = getValue("activityNextStepType");
  const nextStepDate = getValue("activityNextStepDate");

  if (!activityType) {
    showToast("Izaberi tip aktivnosti.");
    return;
  }

  if (nextStage) {
    client.stage = nextStage;
  }

  client.lastActionAt = nowISO();
  client.lastActionHuman = actionHumanLabel(activityType);
  if (note) {
    client.lastActionNote = note;
  }

  client.nextStepText = nextStepText;
  client.nextStepType = nextStepType;
  client.nextStepDate = nextStepDate;

  addActivity(client, activityType, actionHumanLabel(activityType), note);
  saveClients();
  closeActivityModal();
  renderAll();

  if (currentClientId === client.id) openClientDrawer(client.id);
  showToast("Aktivnost je sacuvana.");
}

function getDefaultNextStepForAction(actionType) {
  const baseDate = new Date();

  let offsetDays = 3;
  let text = "Definisati sledeci korak";
  let type = "task";

  switch (actionType) {
    case "followup_light":
    case "followup_medium":
    case "followup_final":
    case "status_check":
      offsetDays = 3;
      text = "Proveriti da li je stigao odgovor";
      type = "followup";
      break;
    case "after_meeting":
      offsetDays = 1;
      text = "Poslati ponudu ili rezime sastanka";
      type = "offer";
      break;
    case "first_contact":
      offsetDays = 2;
      text = "Uraditi prvi check-in";
      type = "call";
      break;
    case "negotiation_push":
      offsetDays = 2;
      text = "Zakljuciti sledeci korak odluke";
      type = "decision";
      break;
    case "payment_reminder":
      offsetDays = 2;
      text = "Proveriti status uplate";
      type = "task";
      break;
  }

  baseDate.setDate(baseDate.getDate() + offsetDays);

  return {
    text,
    type,
    date: baseDate.toISOString().slice(0, 10)
  };
}

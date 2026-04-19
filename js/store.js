/* ------------------------- STORAGE ------------------------- */
function loadClients() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    clients = raw ? JSON.parse(raw) : [];
  } catch {
    clients = [];
  }
}

function saveClients() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(clients));
}

function migrateClients() {
  clients = clients.map(client => {
    const migrated = { ...client };

    if (!migrated.clientAddress) migrated.clientAddress = "";
    if (!migrated.clientCity) migrated.clientCity = "";
    if (!migrated.contactPerson) migrated.contactPerson = "";
    if (!migrated.contactRole) migrated.contactRole = "";
    if (!migrated.contactPhone) migrated.contactPhone = "";
    if (!migrated.contactEmail) migrated.contactEmail = "";

    if (!migrated.revenueDriverPrimary) migrated.revenueDriverPrimary = "";
    if (!migrated.nextStepText) migrated.nextStepText = "";
    if (!migrated.nextStepType) migrated.nextStepType = "";
    if (!migrated.nextStepDate) migrated.nextStepDate = "";
    if (!migrated.dealValue) migrated.dealValue = 0;
    if (!migrated.dealProbability) migrated.dealProbability = "";
    if (!migrated.expectedDecisionDate) migrated.expectedDecisionDate = "";

    if (!migrated.leadTemperature) {
      if (migrated.stage === "negotiation" || migrated.stage === "offer_sent") migrated.leadTemperature = "warm";
      else if (migrated.stage === "meeting_done") migrated.leadTemperature = "warm";
      else migrated.leadTemperature = "cold";
    }

    if (!migrated.budgetStatus) {
      if (migrated.stage === "negotiation") migrated.budgetStatus = "planned";
      else if (migrated.stage === "offer_sent" || migrated.stage === "meeting_done") migrated.budgetStatus = "exploring";
      else migrated.budgetStatus = "unknown";
    }

    if (!migrated.urgencyLevel) {
      if (migrated.stage === "negotiation" || migrated.stage === "offer_sent") migrated.urgencyLevel = "medium";
      else migrated.urgencyLevel = "low";
    }

    if (!migrated.pilotReadiness) {
      const note = String(migrated.lastActionNote || "").toLowerCase();
      if (note.includes("pilot")) migrated.pilotReadiness = "discussed";
      else migrated.pilotReadiness = "possible";
    }

    if (!migrated.relationshipStrength) {
      migrated.relationshipStrength = migrated.contactPerson ? "working" : "new";
    }
    if (!Array.isArray(migrated.revenueFocusTags)) migrated.revenueFocusTags = [];
    if (!migrated.revenueDetail) migrated.revenueDetail = migrated.revenueDriver || "";

    if (!migrated.retailLocationType) migrated.retailLocationType = "";
    if (!migrated.retailAssortmentType) migrated.retailAssortmentType = "";
    if (!migrated.retailPromoPotential) migrated.retailPromoPotential = "";

    if (!Array.isArray(migrated.activityLog)) {
      migrated.activityLog = [];
    }

    if (!migrated.payment || typeof migrated.payment !== "object") {
      migrated.payment = {
        lastInvoiceDate: null,
        lastReminderDate: null,
        lastPaidDate: null,
        paymentSpeed: null
      };
    } else {
      migrated.payment = {
        lastInvoiceDate: migrated.payment.lastInvoiceDate || null,
        lastReminderDate: migrated.payment.lastReminderDate || null,
        lastPaidDate: migrated.payment.lastPaidDate || null,
        paymentSpeed: migrated.payment.paymentSpeed || null
      };
    }

    if (!migrated.lastActionAt) migrated.lastActionAt = migrated.createdAt || nowISO();
    if (!migrated.lastActionHuman) migrated.lastActionHuman = "Kreiran klijent";

    if (!migrated.nextStepText) {
      if (migrated.stage === "offer_sent") migrated.nextStepText = "Proveriti reakciju na ponudu";
      else if (migrated.stage === "waiting") migrated.nextStepText = "Uraditi status check";
      else if (migrated.stage === "meeting_done") migrated.nextStepText = "Poslati ponudu";
      else if (migrated.stage === "negotiation") migrated.nextStepText = "Pogurati odluku";
      else migrated.nextStepText = "Definisati sledeci korak";
    }

    if (!migrated.nextStepType) {
      if (migrated.stage === "offer_sent" || migrated.stage === "waiting") migrated.nextStepType = "followup";
      else if (migrated.stage === "meeting_done") migrated.nextStepType = "offer";
      else if (migrated.stage === "negotiation") migrated.nextStepType = "decision";
      else migrated.nextStepType = "task";
    }

    if (!migrated.nextStepDate && migrated.lastActionAt) {
      const offset =
        migrated.stage === "offer_sent" ? 3 :
        migrated.stage === "waiting" ? 3 :
        migrated.stage === "meeting_done" ? 1 :
        migrated.stage === "negotiation" ? 2 :
        7;
      const nextDate = new Date(migrated.lastActionAt);
      nextDate.setDate(nextDate.getDate() + offset);
      migrated.nextStepDate = nextDate.toISOString().slice(0, 10);
    }

    if (!migrated.dealProbability) {
      if (migrated.stage === "negotiation") migrated.dealProbability = "75";
      else if (migrated.stage === "offer_sent") migrated.dealProbability = "50";
      else if (migrated.stage === "meeting_done") migrated.dealProbability = "25";
    }

    if (!migrated.expectedDecisionDate && migrated.nextStepDate) {
      const decisionDate = new Date(migrated.nextStepDate);
      const offset =
        migrated.stage === "negotiation" ? 7 :
        migrated.stage === "offer_sent" ? 10 :
        migrated.stage === "meeting_done" ? 14 :
        21;
      decisionDate.setDate(decisionDate.getDate() + offset);
      migrated.expectedDecisionDate = decisionDate.toISOString().slice(0, 10);
    }

    if (migrated.activityLog.length === 0) {
      migrated.activityLog.unshift({
        at: migrated.createdAt || migrated.lastActionAt || nowISO(),
        type: "created",
        label: "Kreiran klijent",
        note: migrated.lastActionNote || ""
      });

      if (migrated.lastActionHuman && migrated.lastActionHuman !== "Kreiran klijent") {
        migrated.activityLog.unshift({
          at: migrated.lastActionAt || nowISO(),
          type: "legacy_action",
          label: migrated.lastActionHuman,
          note: migrated.lastActionNote || ""
        });
      }
    }

    return migrated;
  });

  saveClients();
}

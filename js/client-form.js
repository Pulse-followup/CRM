/* ------------------------- CLIENT FORM / CRUD ------------------------- */

function openAddClientModal() {
  currentClientId = null;

  if (isFreeClientLimitReached(clients.length + 1)) {
    showToast(getFreePlanLimitText());
    openLicenseModal("deal_info");
    return;
  }

  const form = document.getElementById("clientForm");
  const deleteBtn = document.getElementById("deleteClientBtn");

  setTextIfExists("clientModalTitle", "Novi klijent");
  setTextIfExists("clientModalSubtitle", "Brz unos osnovnih podataka i komercijalne procene.");

  if (form) form.reset();
  setValueIfExists("clientId", "");

  if (deleteBtn) {
    deleteBtn.classList.add("hidden");
  }

  openClientModal();
  renderLicenseUI();
}

function openEditClientModal(id) {
  const client = getClientById(id);
  if (!client) return;

  currentClientId = id;

  setTextIfExists("clientModalTitle", "Izmeni klijenta");
  setTextIfExists("clientModalSubtitle", "Azuriraj osnovne podatke i komercijalnu procenu.");

  setValueIfExists("clientId", client.id);
  setValueIfExists("clientName", client.name || "");
  setValueIfExists("clientCity", client.clientCity || client.city || "");
  setValueIfExists("contactPerson", client.contactPerson || "");
  setValueIfExists("contactPhone", client.contactPhone || "");
  setValueIfExists("contactEmail", client.contactEmail || "");
  setValueIfExists("companySize", client.companySize || "");
  setValueIfExists("decisionModel", client.decisionModel || "");
  setValueIfExists("revenueDriverPrimary", client.revenueDriverPrimary || "");
  setValueIfExists("leadTemperature", client.leadTemperature || "");
  setValueIfExists("budgetStatus", client.budgetStatus || "");
  setValueIfExists("urgencyLevel", client.urgencyLevel || "");
  setValueIfExists("pilotReadiness", client.pilotReadiness || "");
  setValueIfExists("relationshipStrength", client.relationshipStrength || "");
  setValueIfExists("lastActionNote", client.lastActionNote || "");
  setValueIfExists("nextStepText", client.nextStepText || "");
  setValueIfExists("nextStepType", client.nextStepType || "");
  setValueIfExists("nextStepDate", client.nextStepDate || "");
  setValueIfExists("dealValue", client.dealValue || "");
  setValueIfExists("dealProbability", client.dealProbability || "");
  setValueIfExists("expectedDecisionDate", client.expectedDecisionDate || "");

  const deleteBtn = document.getElementById("deleteClientBtn");
  if (deleteBtn) {
    deleteBtn.classList.remove("hidden");
  }

  openClientModal();
  renderLicenseUI();
}

function handleClientSubmit(e) {
  e.preventDefault();

  const id = getValue("clientId");
  const clientName = getValue("clientName").trim();
  const clientCity = getValue("clientCity").trim();
  const contactPerson = getValue("contactPerson").trim();
  const contactPhone = getValue("contactPhone").trim();
  const contactEmail = getValue("contactEmail").trim();
  const companySize = getValue("companySize");
  const decisionModel = getValue("decisionModel");
  const revenueDriverPrimary = getValue("revenueDriverPrimary");
  const leadTemperature = getValue("leadTemperature");
  const budgetStatus = getValue("budgetStatus");
  const urgencyLevel = getValue("urgencyLevel");
  const pilotReadiness = getValue("pilotReadiness");
  const relationshipStrength = getValue("relationshipStrength");
  const lastActionNote = getValue("lastActionNote").trim();
  const nextStepText = getValue("nextStepText").trim();
  const nextStepType = getValue("nextStepType");
  const nextStepDate = getValue("nextStepDate");
  const dealValue = Number(getValue("dealValue") || 0);
  const dealProbability = getValue("dealProbability");
  const expectedDecisionDate = getValue("expectedDecisionDate");

  if (!clientName) {
    showToast("Unesi naziv klijenta.");
    return;
  }

  if (
    !companySize ||
    !decisionModel ||
    !revenueDriverPrimary ||
    !leadTemperature ||
    !budgetStatus ||
    !urgencyLevel ||
    !pilotReadiness ||
    !relationshipStrength
  ) {
    showToast("Popuni obavezna polja za procenu klijenta.");
    return;
  }

  const baseClient = {
    id: id ? Number(id) : Date.now(),
    name: clientName,
    clientCity,
    city: clientCity,
    contactPerson,
    contactPhone,
    contactEmail,
    companySize,
    decisionModel,
    revenueDriverPrimary,
    leadTemperature,
    budgetStatus,
    urgencyLevel,
    pilotReadiness,
    relationshipStrength,
    lastActionNote,
    nextStepText,
    nextStepType,
    nextStepDate,
    dealValue,
    dealProbability,
    expectedDecisionDate,

    /* Zadrzavamo kompatibilnost sa ostatkom app-a */
    businessType: "other",
    clientAddress: "",
    contactRole: "",
    clientType: "",
    internationalFlag: "",
    revenueFocusTags: [],
    revenueDetail: "",
    retailLocationType: "",
    retailAssortmentType: "",
    retailPromoPotential: "",
    pharmacyFocus: "",
    pharmacyLocations: "",
    pharmacyCentralization: "",
    pharmacyTraffic: "",
    pharmacySuppliers: ""
  };

  if (id) {
    const existing = getClientById(Number(id));
    if (!existing) {
      showToast("Klijent nije pronadjen.");
      return;
    }

    const idx = clients.findIndex(c => c.id === Number(id));
    if (idx === -1) {
      showToast("Klijent nije pronadjen.");
      return;
    }

    clients[idx] = {
      ...existing,
      ...baseClient,
      id: existing.id,
      createdAt: existing.createdAt || nowISO(),
      stage: existing.stage || "new",
      lastActionAt: existing.lastActionAt || existing.createdAt || nowISO(),
      lastActionHuman: existing.lastActionHuman || "Kreiran klijent",
      payment: existing.payment || {
        lastInvoiceDate: null,
        lastReminderDate: null,
        lastPaidDate: null,
        paymentSpeed: null
      },
      activityLog: Array.isArray(existing.activityLog) ? existing.activityLog : []
    };

    addActivity(
      clients[idx],
      "client_updated",
      "Azurirani podaci o klijentu",
      lastActionNote || ""
    );

    saveClients();
    closeClientModal();
    renderAll();

    if (currentClientId === clients[idx].id) {
      openClientDrawer(clients[idx].id);
    }

    showToast("Klijent je azuriran.");
    return;
  }

  const createdAt = nowISO();

  if (isFreeClientLimitReached(clients.length + 1)) {
    showToast(getFreePlanLimitText());
    openLicenseModal("deal_info");
    return;
  }

  const newClient = {
    ...baseClient,
    createdAt,
    stage: "new",
    lastActionAt: createdAt,
    lastActionHuman: "Kreiran klijent",
    payment: {
      lastInvoiceDate: null,
      lastReminderDate: null,
      lastPaidDate: null,
      paymentSpeed: null
    },
    activityLog: [
      {
        at: createdAt,
        type: "created",
        label: "Kreiran klijent",
        note: lastActionNote || ""
      }
    ]
  };

  clients.unshift(newClient);

  saveClients();
  closeClientModal();
  renderAll();
  showToast("Klijent je dodat.");
}

function handleDeleteClient() {
  const rawId = getValue("clientId");
  const id = Number(rawId);

  if (!id) return;

  const sure = confirm("Da li sigurno zelis da obrises klijenta?");
  if (!sure) return;

  clients = clients.filter(c => c.id !== id);
  saveClients();
  closeClientModal();
  closeClientDrawer();
  renderAll();
  showToast("Klijent je obrisan.");
}

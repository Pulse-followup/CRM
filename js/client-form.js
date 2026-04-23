/* ------------------------- CLIENT FORM / CRUD ------------------------- */

function snapshotClientsForRollback() {
  return clients.map(client => ({
    ...client,
    payment: client.payment
      ? {
          ...client.payment,
          workflow: client.payment.workflow ? { ...client.payment.workflow } : {}
        }
      : client.payment,
    activityLog: Array.isArray(client.activityLog)
      ? client.activityLog.map(item => ({ ...item }))
      : client.activityLog,
    contacts: Array.isArray(client.contacts)
      ? client.contacts.map(contact => ({ ...contact }))
      : client.contacts
  }));
}

function openAddClientModal() {
  currentClientId = null;

  if (!isClientWorkspaceSourceReady()) {
    syncClientCreateAvailability();
    showToast("Novi klijent nije dostupan dok se workspace klijenti ne ucitaju.");
    return;
  }

  if (isFreeClientLimitReached(clients.length + 1)) {
    showToast(getFreePlanLimitText());
    openLicenseModal("deal_info");
    return;
  }

  const form = document.getElementById("clientForm");
  const deleteBtn = document.getElementById("deleteClientBtn");

  setTextIfExists("clientModalTitle", "Novi klijent");
  setTextIfExists("clientModalSubtitle", "Azuriraj osnovne podatke klijenta.");

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
  setTextIfExists("clientModalSubtitle", "Azuriraj osnovne podatke klijenta.");

  setValueIfExists("clientId", client.id);
  setValueIfExists("clientName", client.name || "");
  setValueIfExists("clientCity", getClientCity(client));
  setValueIfExists("clientAddress", getClientAddress(client));
  const primaryContact = getPrimaryClientContact(client);
  setValueIfExists("contactPerson", primaryContact?.name || "");
  setValueIfExists("contactPhone", primaryContact?.phone || "");
  setValueIfExists("contactEmail", primaryContact?.email || "");
  setValueIfExists("contactRole", primaryContact?.role || "");
  setValueIfExists("businessType", client.businessType || "");
  setValueIfExists("revenueBand", client.revenueBand || "");
  setValueIfExists("employeeCount", client.employeeCount ?? "");
  setValueIfExists("locationCount", client.locationCount ?? "");
  setValueIfExists("decisionLevel", client.decisionLevel || "");
  setValueIfExists("relationshipLevel", client.relationshipLevel || "");
  setValueIfExists("innovationReady", client.innovationReady || "");

  const deleteBtn = document.getElementById("deleteClientBtn");
  if (deleteBtn) {
    deleteBtn.classList.remove("hidden");
  }

  openClientModal();
  renderLicenseUI();
}

async function handleClientSubmit(e) {
  e.preventDefault();

  const id = getValue("clientId");
  const clientName = getValue("clientName").trim();
  const clientCity = getValue("clientCity").trim();
  const clientAddress = getValue("clientAddress").trim();
  const contactPerson = getValue("contactPerson").trim();
  const contactPhone = getValue("contactPhone").trim();
  const contactEmail = getValue("contactEmail").trim();
  const contactRole = getValue("contactRole").trim();
  const businessType = getValue("businessType");
  const revenueBand = getValue("revenueBand");
  const employeeCountRaw = getValue("employeeCount");
  const locationCountRaw = getValue("locationCount");
  const employeeCount = employeeCountRaw === "" ? null : Number(employeeCountRaw);
  const locationCount = locationCountRaw === "" ? null : Number(locationCountRaw);
  const decisionLevel = getValue("decisionLevel");
  const relationshipLevel = getValue("relationshipLevel");
  const innovationReady = getValue("innovationReady");
  const primaryContact = normalizeClientContact({
    name: contactPerson,
    role: contactRole,
    email: contactEmail,
    phone: contactPhone
  });
  const contacts = contactHasAnyValue(primaryContact) ? [primaryContact] : [];

  if (!clientName) {
    showToast("Unesi naziv klijenta.");
    return;
  }

  const sourceReady = await ensureClientSourceReady({ requireWorkspace: true });
  if (!sourceReady) return;
  const existingClient = id ? getClientById(Number(id)) : null;

  const baseClient = {
    id: id ? Number(id) : Date.now(),
    name: clientName,
    city: clientCity,
    clientCity,
    address: clientAddress,
    clientAddress,
    contacts,
    contactPerson: primaryContact.name,
    contactPhone: primaryContact.phone,
    contactEmail: primaryContact.email,
    contactRole: primaryContact.role,
    businessType,
    revenueBand,
    employeeCount,
    locationCount,
    decisionLevel,
    relationshipLevel,
    innovationReady,
    companySize: existingClient?.companySize || "",
    decisionModel: existingClient?.decisionModel || "",
    revenueDriverPrimary: existingClient?.revenueDriverPrimary || "",
    leadTemperature: existingClient?.leadTemperature || "",
    budgetStatus: existingClient?.budgetStatus || "",
    urgencyLevel: existingClient?.urgencyLevel || "",
    pilotReadiness: existingClient?.pilotReadiness || "",
    relationshipStrength: existingClient?.relationshipStrength || "",
    lastActionNote: existingClient?.lastActionNote || "",
    dealValue: existingClient?.dealValue || 0,
    dealProbability: existingClient?.dealProbability || "",
    expectedDecisionDate: existingClient?.expectedDecisionDate || "",
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

    const rollbackClients = snapshotClientsForRollback();

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
      clients[idx].lastActionNote || ""
    );

    const persisted = await persistClients({
      immediate: true,
      requireWorkspace: true
    });
    if (!persisted) {
      clients = rollbackClients;
      saveClientsLocalOnly();
      renderAll();
      return;
    }

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
    nextStepText: "",
    nextStepType: "",
    nextStepDate: "",
    lastActionAt: createdAt,
    lastActionHuman: "Kreiran klijent",
    payment: {
      lastInvoiceDate: null,
      lastReminderDate: null,
      lastPaidDate: null,
      paymentSpeed: null,
      workflow: {}
    },
    activityLog: [
      {
        at: createdAt,
        type: "created",
        label: "Kreiran klijent",
        note: newClient.lastActionNote || ""
      }
    ]
  };

  const rollbackClients = snapshotClientsForRollback();
  clients.unshift(newClient);

  const persisted = await persistClients({
    immediate: true,
    requireWorkspace: true
  });
  if (!persisted) {
    clients = rollbackClients;
    saveClientsLocalOnly();
    renderAll();
    return;
  }

  closeClientModal();
  renderAll();
  showToast("Klijent je dodat.");
}

async function handleDeleteClient() {
  const rawId = getValue("clientId");
  const id = Number(rawId);

  if (!id) return;

  const sure = confirm("Da li sigurno zelis da obrises klijenta?");
  if (!sure) return;

  const sourceReady = await ensureClientSourceReady({ requireWorkspace: true });
  if (!sourceReady) return;
  const requiresWorkspacePersistence = isClientWorkspaceSourceReady();

  const rollbackClients = snapshotClientsForRollback();

  if (requiresWorkspacePersistence) {
    const deleted = await deleteClientFromWorkspace(id);
    if (!deleted) return;
  }

  clients = clients.filter(c => c.id !== id);
  if (requiresWorkspacePersistence) {
    saveClientsLocalOnly();
  } else {
    const persisted = await persistClients();
    if (!persisted) {
      clients = rollbackClients;
      saveClientsLocalOnly();
      renderAll();
      return;
    }
  }
  closeClientModal();
  closeClientDrawer();
  renderAll();
  showToast("Klijent je obrisan.");
}

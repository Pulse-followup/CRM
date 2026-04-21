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
  saveClientsLocalOnly();
  queueCloudSync();
}

function saveClientsLocalOnly() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(clients));
}

function mapClientRowToLocal(row) {
  const payment = row.payment && typeof row.payment === "object"
    ? row.payment
    : {};

  return {
    id: Number(row.id),
    name: row.name || "",
    ownerUserId: row.owner_user_id || "",
    createdByUserId: row.created_by_user_id || "",
    clientAddress: row.client_address || "",
    clientCity: row.client_city || "",
    city: row.client_city || "",
    contactPerson: row.contact_person || "",
    contactRole: row.contact_role || "",
    contactPhone: row.contact_phone || "",
    contactEmail: row.contact_email || "",
    companySize: row.company_size || "",
    decisionModel: row.decision_model || "",
    revenueDriverPrimary: row.revenue_driver_primary || "",
    leadTemperature: row.lead_temperature || "",
    budgetStatus: row.budget_status || "",
    urgencyLevel: row.urgency_level || "",
    pilotReadiness: row.pilot_readiness || "",
    relationshipStrength: row.relationship_strength || "",
    lastActionNote: row.last_action_note || "",
    nextStepText: row.next_step_text || "",
    nextStepType: row.next_step_type || "",
    nextStepDate: row.next_step_date || "",
    dealValue: Number(row.deal_value || 0),
    dealProbability: row.deal_probability || "",
    expectedDecisionDate: row.expected_decision_date || "",
    businessType: row.business_type || "other",
    clientType: row.client_type || "",
    internationalFlag: row.international_flag || "",
    revenueFocusTags: Array.isArray(row.revenue_focus_tags) ? row.revenue_focus_tags : [],
    revenueDetail: row.revenue_detail || "",
    retailLocationType: row.retail_location_type || "",
    retailAssortmentType: row.retail_assortment_type || "",
    retailPromoPotential: row.retail_promo_potential || "",
    pharmacyFocus: row.pharmacy_focus || "",
    pharmacyLocations: row.pharmacy_locations || "",
    pharmacyCentralization: row.pharmacy_centralization || "",
    pharmacyTraffic: row.pharmacy_traffic || "",
    pharmacySuppliers: row.pharmacy_suppliers || "",
    stage: row.stage || "new",
    lastActionAt: row.last_action_at || row.created_at || nowISO(),
    lastActionHuman: row.last_action_human || "Kreiran klijent",
    payment: {
      lastInvoiceDate: payment.lastInvoiceDate || null,
      lastReminderDate: payment.lastReminderDate || null,
      lastPaidDate: payment.lastPaidDate || null,
      paymentSpeed: payment.paymentSpeed || null,
      workflow: payment.workflow && typeof payment.workflow === "object" ? payment.workflow : {}
    },
    activityLog: Array.isArray(row.activity_log) ? row.activity_log : [],
    createdAt: row.created_at || nowISO()
  };
}

function mapClientToWorkspaceRow(client, existingRemoteRow = null) {
  const existingCreatedByUserId = existingRemoteRow?.created_by_user_id || "";
  const existingOwnerUserId = existingRemoteRow?.owner_user_id || "";

  return {
    id: Number(client.id),
    workspace_id: currentWorkspace.id,
    owner_user_id: client.ownerUserId || existingOwnerUserId || supabaseUser.id,
    created_by_user_id: existingCreatedByUserId || supabaseUser.id,
    name: client.name || "",
    client_address: client.clientAddress || "",
    client_city: client.clientCity || client.city || "",
    contact_person: client.contactPerson || "",
    contact_role: client.contactRole || "",
    contact_phone: client.contactPhone || "",
    contact_email: client.contactEmail || "",
    company_size: client.companySize || "",
    decision_model: client.decisionModel || "",
    revenue_driver_primary: client.revenueDriverPrimary || "",
    lead_temperature: client.leadTemperature || "",
    budget_status: client.budgetStatus || "",
    urgency_level: client.urgencyLevel || "",
    pilot_readiness: client.pilotReadiness || "",
    relationship_strength: client.relationshipStrength || "",
    last_action_note: client.lastActionNote || "",
    next_step_text: client.nextStepText || "",
    next_step_type: client.nextStepType || "",
    next_step_date: client.nextStepDate || null,
    deal_value: Number(client.dealValue || 0),
    deal_probability: client.dealProbability || null,
    expected_decision_date: client.expectedDecisionDate || null,
    business_type: client.businessType || "other",
    client_type: client.clientType || "",
    international_flag: client.internationalFlag || "",
    revenue_focus_tags: Array.isArray(client.revenueFocusTags) ? client.revenueFocusTags : [],
    revenue_detail: client.revenueDetail || "",
    retail_location_type: client.retailLocationType || "",
    retail_assortment_type: client.retailAssortmentType || "",
    retail_promo_potential: client.retailPromoPotential || "",
    pharmacy_focus: client.pharmacyFocus || "",
    pharmacy_locations: client.pharmacyLocations || "",
    pharmacy_centralization: client.pharmacyCentralization || "",
    pharmacy_traffic: client.pharmacyTraffic || "",
    pharmacy_suppliers: client.pharmacySuppliers || "",
    stage: client.stage || "new",
    last_action_at: client.lastActionAt || nowISO(),
    last_action_human: client.lastActionHuman || "Kreiran klijent",
    payment: client.payment || {},
    activity_log: Array.isArray(client.activityLog) ? client.activityLog : [],
    created_at: client.createdAt || nowISO(),
    updated_at: nowISO()
  };
}

function ensureActivityLogIds() {
  clients.forEach(client => {
    if (!Array.isArray(client.activityLog)) {
      client.activityLog = [];
      return;
    }

    client.activityLog = client.activityLog.map(item => ({
      id: item.id || createLocalEntityId("act"),
      ...item
    }));
  });
}

async function hydrateClientsFromWorkspace(options = {}) {
  if (!canUseWorkspaceClientStore()) return;
  const { pushIfEmpty = true, silent = false } = options;

  const { data, error } = await supabaseClient
    .from("clients")
    .select("*")
    .eq("workspace_id", currentWorkspace.id)
    .order("created_at", { ascending: false });

  if (error) {
    if (!silent) {
      showToast("Workspace klijenti nisu ucitani.");
    }
    console.error("[Pulse Workspace] hydrateClientsFromWorkspace failed", error);
    return;
  }

  if (Array.isArray(data) && data.length) {
    clients = data.map(mapClientRowToLocal);
    ensureActivityLogIds();
    if (typeof rememberObservedMembersFromClients === "function") {
      rememberObservedMembersFromClients();
    }
    saveClientsLocalOnly();
    return;
  }

  if (pushIfEmpty && clients.length) {
    await pushClientsToWorkspace();
  }
}

async function pushClientsToWorkspace() {
  if (!canUseWorkspaceClientStore()) return false;

  const { data: existingRows, error: existingError } = await supabaseClient
    .from("clients")
    .select("id, owner_user_id, created_by_user_id")
    .eq("workspace_id", currentWorkspace.id);

  if (existingError) {
    console.error("[Pulse Workspace] pushClientsToWorkspace existing rows failed", existingError);
    showToast(`Workspace sync nije uspeo: ${existingError.message || "citanje klijenata"}`);
    return false;
  }

  const existingById = new Map(
    (Array.isArray(existingRows) ? existingRows : []).map(row => [String(row.id), row])
  );
  const payload = clients.map(client => mapClientToWorkspaceRow(client, existingById.get(String(Number(client.id)))));
  const rowsToInsert = payload.filter(row => !existingById.has(String(row.id)));
  const rowsToUpdate = payload.filter(row => existingById.has(String(row.id)));

  if (rowsToInsert.length) {
    const { error } = await supabaseClient
      .from("clients")
      .insert(rowsToInsert);

    if (error) {
      console.error("[Pulse Workspace] pushClientsToWorkspace insert failed", error, rowsToInsert);
      showToast(`Workspace sync nije uspeo: ${error.message || "novi klijenti"}`);
      return false;
    }
  }

  for (const row of rowsToUpdate) {
    const { error } = await supabaseClient
      .from("clients")
      .update(row)
      .eq("id", row.id)
      .eq("workspace_id", currentWorkspace.id);

    if (error) {
      console.error("[Pulse Workspace] pushClientsToWorkspace update failed", error, row);
      showToast(`Workspace sync nije uspeo: ${error.message || "azuriranje klijenta"}`);
      return false;
    }
  }

  // Workspace sync is append/update-only from the browser. Deleting stale rows from
  // a local cache can erase another user's fresh work, so cleanup must be explicit.
  void existingRows;
  cloudSyncState = "synced";
  syncCloudStatusUI("Sinhronizovano");
  return true;
}

function mapActivityToWorkspaceRow(client, activity) {
  return {
    id: activity.id,
    workspace_id: currentWorkspace.id,
    client_id: Number(client.id),
    created_by_user_id: activity.actorId || supabaseUser?.id || null,
    activity_type: activity.type || "note",
    label: activity.label || "Aktivnost",
    note: activity.note || "",
    activity_at: activity.at || nowISO(),
    created_at: activity.at || nowISO()
  };
}

async function hydrateActivitiesFromWorkspace(options = {}) {
  // Legacy no-op. Activity metadata and task ownership now round-trip through
  // clients.activity_log, because client_activities has no JSON metadata column.
  // Pulling from client_activities would strip owner/delegation data and make Tim
  // and Zadaci disagree after SYNC.
  void options;
  return true;
}

async function pushActivitiesToWorkspace() {
  // Legacy no-op. The source of truth is the client row JSON payload.
  return true;
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
    migrated.activityLog = migrated.activityLog.map(item => ({
      id: item.id || createLocalEntityId("act"),
      ...item
    }));

    if (!migrated.payment || typeof migrated.payment !== "object") {
      migrated.payment = {
        lastInvoiceDate: null,
        lastReminderDate: null,
        lastPaidDate: null,
        paymentSpeed: null,
        workflow: {}
      };
    } else {
      migrated.payment = {
        lastInvoiceDate: migrated.payment.lastInvoiceDate || null,
        lastReminderDate: migrated.payment.lastReminderDate || null,
        lastPaidDate: migrated.payment.lastPaidDate || null,
        paymentSpeed: migrated.payment.paymentSpeed || null,
        workflow: migrated.payment.workflow && typeof migrated.payment.workflow === "object"
          ? migrated.payment.workflow
          : {}
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
        id: createLocalEntityId("act"),
        at: migrated.createdAt || migrated.lastActionAt || nowISO(),
        type: "created",
        label: "Kreiran klijent",
        note: migrated.lastActionNote || ""
      });

      if (migrated.lastActionHuman && migrated.lastActionHuman !== "Kreiran klijent") {
        migrated.activityLog.unshift({
          id: createLocalEntityId("act"),
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

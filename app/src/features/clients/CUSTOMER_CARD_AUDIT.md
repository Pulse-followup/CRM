# CUSTOMER CARD Audit

## Scope

Legacy files reviewed:

- `C:\Users\ddosl\PULSE\CRM\legacy\fragments\customer-drawer.html`
- `C:\Users\ddosl\PULSE\CRM\legacy\fragments\client-form.html` (missing)
- `C:\Users\ddosl\PULSE\CRM\legacy\fragments\project-modal.html`
- `C:\Users\ddosl\PULSE\CRM\legacy\fragments\task-modal.html`
- `C:\Users\ddosl\PULSE\CRM\legacy\js\client-drawer.js`
- `C:\Users\ddosl\PULSE\CRM\legacy\js\client-form.js`
- `C:\Users\ddosl\PULSE\CRM\legacy\js\store.js`
- `C:\Users\ddosl\PULSE\CRM\legacy\js\actions.js`
- `C:\Users\ddosl\PULSE\CRM\legacy\js\payments.js`
- `C:\Users\ddosl\PULSE\CRM\legacy\js\scoring.js`
- `C:\Users\ddosl\PULSE\CRM\legacy\js\workspace.js`

## Executive summary

Current legacy Customer Card is visually cleaned up, but the logic behind it is still much wider than the fragment suggests.

Visible UI in the drawer is now mostly:

- basic client data
- contacts
- commercial inputs
- projects

But the JavaScript around the drawer still drives a larger operational system:

- project create/edit/archive
- project task list and task detail
- worker task execution flow
- admin review flow
- project cost calculation
- project billing creation
- follow-up and activity flow
- payment workflow helpers
- scoring helpers

That means the React migration should treat Customer Card as a feature boundary with several nested subdomains, not as a single presentational component.

## 1. Existing Customer Card sections in legacy

### 1.1 Visible sections in `customer-drawer.html`

1. Header
   - client name
   - subtitle (currently effectively city only in `client-drawer.js`)

2. `Osnovni podaci`
   - naziv
   - grad
   - adresa
   - action: `Izmeni podatke`

3. `Kontakti`
   - list of contacts
   - fallback: `Nema unetih kontakata`

4. `Komercijalni inputi`
   - tip delatnosti
   - promet
   - broj zaposlenih
   - broj objekata
   - nivo odlučivanja
   - odnos
   - spremnost za inovacije

5. `Projekti`
   - action: `Novi projekat`
   - active project list
   - archived projects collapse block
   - per-project actions and task summary

### 1.2 Operational sections rendered from drawer JS / connected modals

These are not all visible as dedicated drawer blocks anymore, but they are part of Customer Card behavior and migration scope:

1. Project modal
   - create/edit project
   - project type / frequency / value / status

2. Project tasks modal
   - task count per project
   - task list for a project
   - project cost summary (`Obracun projekta`)
   - included-in-cost tasks
   - non-billable tasks
   - admin action: create billing order from project

3. Task detail modal
   - task status
   - assignee
   - due date
   - description
   - worker actions
   - admin review actions
   - time/material/labor readout
   - non-billable reason

4. Activity / follow-up flow
   - activity modal creates tasks
   - follow-up recommendation logic
   - stage-aware action suggestions

5. Payment / billing flow
   - older payment modal logic still exists
   - newer project-level billing flow also exists

6. Scoring / assessment logic
   - PULSE score and signals are computed from client fields
   - score is not a simple UI badge; it depends on many commercial and activity fields

### 1.3 Legacy sections that are no longer visible in the current drawer fragment, but still exist in model/logic

- stage / pipeline status
- next step / follow-up planning
- activity log
- old payment summary fields
- deal fields
- retail-specific fields
- pharmacy-specific fields
- score / assessment inputs

## 2. Client fields currently present in the legacy model

Below is the practical legacy client model, grouped by concern. Some fields are visible in the current UI, some are legacy baggage still preserved by `client-form.js` and `store.js`.

### 2.1 Identity and ownership

- `id`
- `workspaceId`
- `name`
- `ownerUserId`
- `ownerName`
- `createdByUserId`
- `createdByName`
- `createdAt`

### 2.2 Basic data

- `city`
- `address`

### 2.3 Contact data

- `contacts[]`
  - `name`
  - `role`
  - `email`
  - `phone`
- legacy single-contact compatibility fields:
  - `contactPerson`
  - `contactRole`
  - `contactPhone`
  - `contactEmail`

### 2.4 Current commercial input fields

- `businessType`
- `revenueBand`
- `employeeCount`
- `locationCount`
- `decisionLevel`
- `relationshipLevel`
- `innovationReady`

### 2.5 Older commercial / qualification fields still preserved

- `companySize`
- `decisionModel`
- `revenueDriverPrimary`
- `leadTemperature`
- `budgetStatus`
- `urgencyLevel`
- `pilotReadiness`
- `relationshipStrength`
- `lastActionNote`
- `dealValue`
- `dealProbability`
- `expectedDecisionDate`
- `clientType`
- `internationalFlag`
- `revenueFocusTags`
- `revenueDetail`

### 2.6 Retail-specific fields

- `retailLocationType`
- `retailAssortmentType`
- `retailPromoPotential`

### 2.7 Pharmacy-specific fields

- `pharmacyFocus`
- `pharmacyLocations`
- `pharmacyCentralization`
- `pharmacyTraffic`
- `pharmacySuppliers`

### 2.8 Stage / workflow / activity fields

- `stage`
- `nextStepText`
- `nextStepType`
- `nextStepDate`
- `lastActionAt`
- `lastActionHuman`
- `activityLog[]`

Activity log items can contain metadata like:

- `type`
- `label`
- `note`
- `at`
- `actorId`
- `actorName`
- `actorEmail`
- `ownerId`
- `ownerName`
- `ownerEmail`
- `projectId`
- `projectName`
- `taskTitle`
- `taskStatus`
- `taskActionText`
- `relatedTaskId`
- `billingId`

### 2.9 Payment / legacy nested CRM payload

- `payment`
  - includes legacy workflow and payment metadata
  - old nested `payment.workflow.projects` still exists in compatibility / migration paths

## 3. Actions currently possible from Customer Card and connected flows

### 3.1 Client-level actions

- edit client (`Izmeni podatke`)
- open activity flow (`Nova aktivnost` / follow-up flow via legacy action logic)
- open payment flow (older payment modal logic still exists)

### 3.2 Project actions

- create project (`Novi projekat`)
- edit project
- archive project
- restore archived project
- open project tasks modal (`Taskovi`)

### 3.3 Task actions from project/task context

Worker / owner flow:

- `Preuzmi`
- `Na cekanju`
- `Vrati u rad`
- `Zavrsi`
- enter time spent
- enter material cost
- enter material description

Admin / finance-like control flow around tasks:

- `Promeni zaduzenog`
- `Promeni rok`
- `Otkazi task`
- `Dodaj u trosak projekta`
- `Arhiviraj bez naplate`
- `Vrati na doradu`

Task creation / activity flow:

- create task from project context
- create task from activity modal
- delegate / return follow-up
- complete current task from activity modal

### 3.4 Project billing actions

- open project billing modal
- `Kreiraj nalog za naplatu` (admin)
- mark billing draft as invoiced
- mark invoiced billing as paid
- mark invoiced billing as overdue

### 3.5 Follow-up / activity actions

- generate follow-up recommendation by stage and inactivity
- open action modal for follow-up / negotiation / payment reminder
- mark action as sent
- add activity log entry

## 4. Where each part is stored

## 4.1 Clients

Primary local key:

- `pulse_mvp_clients_v031`

Workspace / Supabase:

- table: `clients`

Important note:

- clients still carry old CRM data, payment payload, stage data, next-step data and activity log
- current drawer UI uses only a subset, but migration cannot assume a minimal client object yet

## 4.2 Projects

Primary local key:

- `pulse_mvp_projects_v001`

Workspace / Supabase:

- table: `projects`

Current source of truth:

- global `projects[]`

Compatibility layer:

- old nested `client.payment.workflow.projects`
- `migrateProjects()` copies old nested projects into global `projects[]`
- old nested projects are not yet fully deleted from legacy model

## 4.3 Tasks

Primary local key:

- `pulse_mvp_tasks_v001`

Workspace / Supabase:

- table: `tasks`

Current source of truth:

- global `tasks[]`

Compatibility / older paths:

- activity flow and older helper naming still reflect previous nested task patterns
- customer card logic bridges old workflow concepts and the global task store

## 4.4 Billing

Primary local key:

- `PULSE_BILLING`

Workspace / Supabase:

- table: `billing`

Current source of truth:

- global `billing[]`

Project linkage:

- `project.billingId`
- `project.billingStatus`

Task linkage:

- newer logic references billing through project-level flow
- older logic also includes task-to-billing legacy action paths

## 4.5 Activity data

Stored in at least two conceptual places:

1. nested client field
   - `client.activityLog[]`

2. optional workspace table detection exists for
   - `client_activities`

Important note:

- current business behavior still relies heavily on `client.activityLog[]`
- `client_activities` support appears infrastructure-ready, but the client row remains the reliable audit source in current legacy behavior

## 4.6 Scoring

No separate persistent score entity was identified.

Score is derived from client fields through `scoring.js`, especially:

- company size
- decision model
- commercial potential inputs
- lead temperature
- budget status
- urgency
- pilot readiness
- relationship strength
- deal value
- deal probability
- payment discipline
- stage
- last action timing

## 5. Risk areas for migration

### 5.1 Two project systems still exist

This is the biggest project-level risk.

- old: `client.payment.workflow.projects`
- new: global `projects[]`

Even though global `projects[]` is the intended source of truth now, legacy compatibility code still exists. Migration must not reintroduce reads from the nested workflow branch.

### 5.2 Customer Card is not just a card

`client-drawer.js` contains:

- client display logic
- project CRUD
- project task modal
- task detail modal
- task actions
- admin review flow
- project costing
- project billing entry

If React migration copies only visible sections first and ignores operational logic, the new ClientDetail will look correct but be functionally incomplete.

### 5.3 Client form still preserves legacy baggage

Even if the visible client card is clean, `client-form.js` still reads and writes many old fields. If React migration defines too small a client type too early, edit/save could silently drop legacy sales and scoring inputs.

### 5.4 Task lifecycle spans multiple contexts

Task behavior is split across:

- project modal
n- task modal
- activity modal
- scoring / follow-up signals
- billing review decisions

Risk:

- migrating task display without the surrounding action/state rules can create duplicate or inconsistent flows

### 5.5 Billing lineage is mixed

Legacy contains both:

- older client/project payment workflow modal logic
- newer project-level billing entity logic

Migration risk:

- if React reads both, billing can be duplicated or shown inconsistently
- if React assumes task-level billing, it will conflict with the current project-centric billing direction

### 5.6 Activity log is still embedded in client data

Because activity history is still nested under client and not fully normalized away, partial migration could lose historical context if client payload mapping is simplified too aggressively.

### 5.7 Score is computed, not standalone

If React Customer Card eventually needs score/badges, it must also migrate the upstream client fields used by scoring. Migrating just a score badge component without those fields will be brittle.

### 5.8 Drawer subtitle bug / behavior mismatch

`renderCleanDrawer()` effectively overwrites the richer subtitle and ends with city-only subtitle. That is small, but it is a sign that some legacy UI behavior has contradictory code paths.

## 6. Migration recommendation for React Customer Card

Do not migrate Customer Card as one giant page component.

Recommended feature structure:

```text
features/clients/
  pages/ClientDetail.tsx
  components/ClientHeader.tsx
  components/ClientInfoSection.tsx
  components/ClientCommercialSection.tsx
  components/ClientContactsSection.tsx
  components/ClientProjectsSection.tsx
  components/ClientTasksSection.tsx
  components/ClientBillingSection.tsx
  components/ClientScoreSection.tsx
  components/ClientActionsBar.tsx
```

### Suggested responsibility split

- `ClientDetail.tsx`
  - route container
  - orchestrates client loading and section layout

- `ClientHeader.tsx`
  - name
  - city / subtitle
  - high-level badges if needed later

- `ClientActionsBar.tsx`
  - edit client
  - add project
  - follow-up / activity entry points
  - keep actions centralized rather than scattering button ownership across sections

- `ClientInfoSection.tsx`
  - name
  - city
  - address
  - basic contact fallbacks if needed

- `ClientContactsSection.tsx`
  - normalized contact list
  - empty state

- `ClientCommercialSection.tsx`
  - current visible commercial inputs only
  - should stay separate from legacy scoring-only fields

- `ClientProjectsSection.tsx`
  - active projects
  - archived projects
  - task count
  - project entry points
  - should read only from global projects state in React

- `ClientTasksSection.tsx`
  - if/when task timeline or project-task snapshot is brought back into the card
  - should read only from global tasks state

- `ClientBillingSection.tsx`
  - if/when project billing summary returns to the page
  - should read only from global billing state

- `ClientScoreSection.tsx`
  - isolated because scoring depends on many legacy fields and may migrate later than base card UI

## 7. Recommended migration order

1. Migrate presentational Customer Card shell first
   - header
   - basic info
   - contacts
   - commercial section
   - project list read-only

2. Migrate global data dependencies next
   - clients
   - projects
   - tasks
   - billing

3. Migrate operational actions after that
   - edit client
   - create/edit/archive project
   - project tasks modal
   - task detail modal

4. Migrate advanced derived features last
   - scoring
   - follow-up recommendation engine
   - payment discipline and finance summaries

## 8. Practical recommendations before implementation

1. Define React types that explicitly separate:
   - visible card fields
   - legacy compatibility fields
   - linked global entities

2. Keep `projects`, `tasks`, and `billing` out of the client object in React state.
   - link them by `clientId` / `projectId`
   - this matches the newer legacy direction

3. Treat old nested workflow project/task data as migration-only input, not as ongoing source of truth.

4. Delay scoring and older finance summaries until the base client/project/task chain is stable in React.

5. When Customer Card implementation starts, migrate `ClientProjectsSection` together with a thin selector layer:
   - `getProjectsByClientId(clientId)`
   - `getTasksByProjectId(projectId)`
   - `getBillingByProjectId(projectId)`

That will keep the React version aligned with the current global-store direction and reduce regression risk.

## 9. Missing or notable source details

- `legacy/fragments/client-form.html` was not found in the legacy folder during audit.
- Current client form behavior therefore appears to be driven primarily from JavaScript and/or another fragment path.
- `scoring.js` does exist and is active as derived logic, not just dead code.

## 10. Bottom line

The current legacy Customer Card UI looks much smaller than the real feature surface behind it.

For React migration, the safe mental model is:

- Customer Card = client view shell
- Projects / tasks / billing / scoring = attached feature slices
- global projects/tasks/billing = source of truth
- old nested workflow data = compatibility baggage to read carefully, not to preserve as architecture

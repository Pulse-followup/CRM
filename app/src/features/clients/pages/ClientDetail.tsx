import { useEffect, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { useBillingStore } from "../../billing/billingStore";
import {
  isProductVisibleForClient,
  readProducts,
  readProductsFromSupabase,
  saveProducts,
} from "../../products/productStorage";
import {
  readProcessTemplates,
  readProcessTemplatesFromSupabase,
  saveProcessTemplates,
} from "../../templates/templateStorage";
import { buildCatalogJobPayload } from "../../workflows/createJobFromProduct";
import ProjectForm, {
  type ProjectFormValues,
} from "../../projects/components/ProjectForm";
import {
  buildStagesFromTemplate,
  getTemplateIdForProjectType,
} from "../../projects/projectTemplates";
import { useProjectStore } from "../../projects/projectStore";
import type { Project } from "../../projects/types";
import { getClientScore } from "../../scoring/scoringSelectors";
import CreateTaskForm, {
  type CreateTaskFormValues,
} from "../../tasks/components/CreateTaskForm";
import { useTaskStore } from "../../tasks/taskStore";
import type { Task } from "../../tasks/types";
import { useClientStore } from "../clientStore";
import ClientActionsBar from "../components/ClientActionsBar";
import CatalogJobForm, {
  type CatalogJobFormValues,
} from "../components/CatalogJobForm";

import ClientEditForm, {
  type ClientEditFormPatch,
} from "../components/ClientEditForm";
import ClientHeader from "../components/ClientHeader";
import ClientCardSections from "../components/ClientCardSections";
import { useCloudStore } from "../../cloud/cloudStore";
import { trackEvent } from "../../usage/usageTracker";
import "./client-detail.css";

const PRIORITY_LABELS = {
  low: "Nizak prioritet",
  medium: "Srednji prioritet",
  high: "Visok prioritet",
} as const;

function ClientDetail() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { id } = useParams();
  const clientId = id ?? "";
  const { clients, getClientById, updateClient } = useClientStore();
  const { tasks, addTask } = useTaskStore();
  const {
    projects: allProjects,
    getProjectsByClientId,
    addProject,
  } = useProjectStore();
  const { billing } = useBillingStore();
  const cloud = useCloudStore();
  const [isEditingClient, setIsEditingClient] = useState(false);
  const [isCreatingActivity, setIsCreatingActivity] = useState(false);
  const [isCreatingProject, setIsCreatingProject] = useState(false);
  const [isChoosingJob, setIsChoosingJob] = useState(false);
  const [isCreatingFromCatalog, setIsCreatingFromCatalog] = useState(false);
  const [initialCatalogProductId, setInitialCatalogProductId] = useState<
    string | undefined
  >(undefined);
  const [catalogJobMessage, setCatalogJobMessage] = useState("");
  const setupTarget = searchParams.get("setup");

  useEffect(() => {
    let isMounted = true;
    const workspaceId = cloud.activeWorkspace?.id || "";

    async function preloadCatalogFromCloud() {
      if (!cloud.isConfigured || !workspaceId) return;

      try {
        const [cloudProducts, cloudTemplates] = await Promise.all([
          readProductsFromSupabase(workspaceId),
          readProcessTemplatesFromSupabase(workspaceId),
        ]);

        if (!isMounted) return;
        if (cloudProducts.length) saveProducts(cloudProducts);
        if (cloudTemplates.length) saveProcessTemplates(cloudTemplates);
      } catch {
        // Cloud catalog preload is best-effort; localStorage remains fallback.
      }
    }

    void preloadCatalogFromCloud();

    return () => {
      isMounted = false;
    };
  }, [cloud.activeWorkspace?.id, cloud.isConfigured]);

  useEffect(() => {
    if (!clientId) return;
    trackEvent("client_opened", {
      entityType: "client",
      entityId: clientId,
    });
  }, [clientId]);

  useEffect(() => {
    if (setupTarget === "create-project") {
      setIsChoosingJob(true);
      setIsCreatingProject(true);
      setIsCreatingActivity(false);
      setIsCreatingFromCatalog(false);
    }
    if (setupTarget === "create-activity") {
      setIsCreatingActivity(true);
      setIsChoosingJob(false);
      setIsCreatingProject(false);
      setIsCreatingFromCatalog(false);
    }
    if (setupTarget === "create-from-catalog") {
      openCatalogJobForm();
    }
  }, [setupTarget]);

  const client = getClientById(clientId);
  const projects = getProjectsByClientId(clientId);
  const products = readProducts();
  const processTemplates = readProcessTemplates();
  const score = client
    ? getClientScore(String(client.id), {
        clients,
        projects: allProjects,
        tasks,
        billing,
      })
    : null;

  const handleCreateActivity = (values: CreateTaskFormValues) => {
    if (!client) return;

    const timestamp = new Date().toISOString();
    const nextTask: Task = {
      id: `task-${Date.now()}`,
      clientId: String(client.id),
      projectId: values.projectId,
      title: values.title.trim() || "Nova aktivnost",
      description: values.description.trim(),
      type: values.type || undefined,
      assignedToUserId: values.assignedToUserId,
      assignedToLabel: values.assignedToLabel.trim(),
      dueDate: values.dueDate || undefined,
      stageId: values.stageId || undefined,
      status: "dodeljen",
      createdAt: timestamp,
      updatedAt: timestamp,
      completedAt: null,
      billingState: values.billingState,
    };

    addTask(nextTask);
    setIsCreatingActivity(false);
  };

  const handleCreateProject = (values: ProjectFormValues) => {
    if (!client) return;

    const templateId = getTemplateIdForProjectType(values.type);
    const nextProject: Project = {
      id: `project-${Date.now()}`,
      clientId: String(client.id),
      title: values.title.trim() || "Novi projekat",
      type: values.type || undefined,
      frequency: values.frequency || undefined,
      value: values.value.trim() ? Number(values.value) : undefined,
      status: "aktivan",
      templateId,
      stages: buildStagesFromTemplate(templateId),
    };

    addProject(nextProject);
    setIsCreatingProject(false);
    setIsChoosingJob(false);
  };

  const openCatalogJobForm = (productId?: string) => {
    setInitialCatalogProductId(productId);
    setIsCreatingFromCatalog(true);
    setIsCreatingProject(false);
    setIsCreatingActivity(false);
    setIsChoosingJob(false);
    setCatalogJobMessage("");
  };

  const handleCreateJobFromCatalog = async (values: CatalogJobFormValues) => {
    if (!client) return;

    const product = products.find(
      (item) =>
        item.id === values.productId &&
        item.status === "active" &&
        isProductVisibleForClient(item, String(client.id)),
    );
    const template = product?.processTemplateId
      ? processTemplates.find((item) => item.id === product.processTemplateId)
      : undefined;
    const quantity = Number(values.quantity.replace(",", "."));

    if (
      !product ||
      !template ||
      !template.steps.length ||
      !Number.isFinite(quantity) ||
      quantity <= 0
    ) {
      setCatalogJobMessage(
        "Posao nije kreiran. Proveri proizvod, šablon procesa i količinu.",
      );
      return;
    }

    const payload = buildCatalogJobPayload(
      {
        clientId: String(client.id),
        product,
        template,
        title: values.title,
        dueDate: values.dueDate || undefined,
        quantity,
        fileLink: values.fileLink,
        note: values.note,
      },
      cloud.members.map((member) => ({
        id: member.user_id,
        name:
          member.display_name ||
          member.profile?.full_name ||
          member.profile?.email ||
          member.user_id,
        productionRole: member.production_role || null,
      })),
    );

    const savedProject = await Promise.resolve(addProject(payload.project));

    if (!savedProject) {
      setCatalogJobMessage("Projekat nije sačuvan. Taskovi nisu kreirani.");
      return;
    }

    await Promise.all(
      payload.tasks.map((task) =>
        Promise.resolve(addTask({ ...task, projectId: savedProject.id })),
      ),
    );
    setIsCreatingFromCatalog(false);
    setInitialCatalogProductId(undefined);
    setCatalogJobMessage(
      `Kreiran posao: ${savedProject.title} + ${payload.tasks.length} taskova.`,
    );
  };

  const handleUpdateClient = (patch: ClientEditFormPatch) => {
    updateClient(clientId, patch);
    setIsEditingClient(false);
  };

  if (!client) {
    return (
      <section className="page-card client-detail-shell">
        <button
          type="button"
          className="secondary-link-button"
          onClick={() => navigate("/clients")}
        >
          Nazad na klijente
        </button>

        <div className="clients-empty-state">
          <h2>Klijent nije pronađen</h2>
          <p>Vrati se na listu klijenata i izaberi postojeći zapis.</p>
        </div>
      </section>
    );
  }

  return (
    <section className="page-card client-detail-shell">
      <button
        type="button"
        className="secondary-link-button"
        onClick={() => navigate("/clients")}
      >
        Nazad na klijente
      </button>

      <ClientHeader
        name={client.name}
        city={client.city}
        pulseScore={score?.total}
        priorityLabel={score ? PRIORITY_LABELS[score.priority] : undefined}
        priorityTone={
          score?.priority === "high"
            ? "success"
            : score?.priority === "medium"
              ? "warning"
              : "muted"
        }
        risks={score?.signals.risks ?? []}
      />
      <ClientActionsBar
        clientId={clientId}
        onNewActivity={() => setIsCreatingActivity((current) => !current)}
        onNewJob={() => setIsChoosingJob((current) => !current)}
      />
      {isChoosingJob ? (
        <div className="customer-job-choice">
          <button
            type="button"
            className="customer-project-action-button"
            onClick={() => {
              setIsCreatingProject(true);
              setIsCreatingFromCatalog(false);
              setCatalogJobMessage("");
            }}
          >
            Prazan projekat
          </button>
          <button
            type="button"
            className="customer-project-action-button customer-project-action-button-secondary"
            onClick={() => {
              openCatalogJobForm();
            }}
          >
            Iz kataloga
          </button>
        </div>
      ) : null}
      {isEditingClient ? (
        <ClientEditForm
          client={client}
          onCancel={() => setIsEditingClient(false)}
          onSubmit={handleUpdateClient}
        />
      ) : null}
      {isCreatingProject ? (
        <ProjectForm
          onCancel={() => setIsCreatingProject(false)}
          onSubmit={handleCreateProject}
        />
      ) : null}
      {isCreatingFromCatalog ? (
        <CatalogJobForm
          clientId={String(client.id)}
          products={products}
          templates={processTemplates}
          initialProductId={initialCatalogProductId}
          onCancel={() => {
            setIsCreatingFromCatalog(false);
            setInitialCatalogProductId(undefined);
          }}
          onSubmit={handleCreateJobFromCatalog}
        />
      ) : null}
      {catalogJobMessage ? (
        <p className="customer-catalog-job-message">{catalogJobMessage}</p>
      ) : null}
      {isCreatingActivity ? (
        <CreateTaskForm
          onCancel={() => setIsCreatingActivity(false)}
          onSubmit={handleCreateActivity}
          requireProjectSelection
          projectOptions={projects.map((project) => ({
            id: project.id,
            label: project.title,
            stages: project.stages,
          }))}
        />
      ) : null}
      <ClientCardSections
        clientId={String(client.id)}
        clientName={client.name}
        clientCity={client.city}
        clientAddress={client.address}
        contacts={client.contacts}
        commercial={client.commercial}
        projects={projects}
        tasks={tasks}
        billing={billing}
        onEditClient={() => setIsEditingClient((current) => !current)}
        onAddFromCatalog={openCatalogJobForm}
      />
    </section>
  );
}

export default ClientDetail;

import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useClientStore } from "../clientStore";
import CreateTaskForm, {
  AD_HOC_PROJECT_VALUE,
  type CreateTaskFormValues,
} from "../../tasks/components/CreateTaskForm";
import { useTaskStore } from "../../tasks/taskStore";
import { useProjectStore } from "../../projects/projectStore";
import type { Task } from "../../tasks/types";
import "./client-detail.css";

function ClientCreateActivityPage() {
  const navigate = useNavigate();
  const { id } = useParams();
  const clientId = id ?? "";
  const { getClientById } = useClientStore();
  const { getProjectsByClientId } = useProjectStore();
  const { addTask } = useTaskStore();
  const [message, setMessage] = useState("");
  const client = getClientById(clientId);
  const projects = getProjectsByClientId(clientId);

  const goBack = () => navigate(clientId ? `/clients/${clientId}` : "/clients");

  const handleCreateActivity = async (values: CreateTaskFormValues) => {
    if (!client) return;

    const timestamp = new Date().toISOString();
    const nextTask: Task = {
      id: `task-${Date.now()}`,
      clientId: String(client.id),
      projectId: values.projectId || "",
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
      source: "manual",
    };

    const savedTask = await Promise.resolve(addTask(nextTask));
    if (!savedTask) {
      setMessage(
        "Task nije sačuvan. Proveri konekciju/Supabase i pokušaj ponovo.",
      );
      return;
    }

    navigate(`/clients/${client.id}`);
  };

  if (!client) {
    return (
      <section className="page-card client-detail-shell pulse-create-flow-page">
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
    <section className="page-card client-detail-shell pulse-create-flow-page">
      <button type="button" className="secondary-link-button" onClick={goBack}>
        Nazad na klijenta
      </button>
      <div className="pulse-create-flow-head">
        <span>Nova aktivnost</span>
        <h2>{client.name}</h2>
        <p>
          Ad hoc task ili aktivnost vezana za klijenta. Projekat nije obavezan.
        </p>
      </div>
      {message ? (
        <p className="customer-catalog-job-message">{message}</p>
      ) : null}
      <CreateTaskForm
        onCancel={goBack}
        onSubmit={handleCreateActivity}
        requireProjectSelection
        initialProjectId={AD_HOC_PROJECT_VALUE}
        projectOptions={projects.map((project) => ({
          id: project.id,
          label: project.title,
          stages: project.stages,
        }))}
      />
    </section>
  );
}

export default ClientCreateActivityPage;

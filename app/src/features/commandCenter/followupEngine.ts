import { getBillingCollections } from "../billing/billingSelectors";
import { getBillingStatus } from "../billing/billingLifecycle";
import type { BillingRecord } from "../billing/types";
import type { Client } from "../clients/types";
import type { CloudWorkspaceMember } from "../cloud/types";
import type { Project } from "../projects/types";
import { isTaskOpen } from "../tasks/taskLifecycle";
import { getOverdueTasks, getTaskOverdueDays } from "../tasks/taskSignals";
import type { Task } from "../tasks/types";

export type FollowUpSignalType =
  | "TASK_OVERDUE_INTERNAL"
  | "PROJECT_INACTIVE_CLIENT"
  | "WAITING_CLIENT_CONFIRMATION"
  | "BILLING_READY"
  | "PAYMENT_OVERDUE_CLIENT";

export type FollowUpTone = "neutral" | "friendly" | "direct" | "team";

export type ClientFollowUpKind =
  | "project_confirmation"
  | "waiting_material"
  | "project_stalled"
  | "post_meeting"
  | "billing"
  | "general";

export type FollowUpCategory = "Interno" | "Klijent" | "Naplata";
export type FollowUpPriority = "Visok" | "Srednji" | "Nizak";

export type FollowUpProposal = {
  id: string;
  signalType: FollowUpSignalType;
  category: FollowUpCategory;
  priority: FollowUpPriority;
  summary: string;
  contextLabel: string;
  clientName?: string;
  projectTitle?: string;
  taskTitle?: string;
  assignedUserId?: string;
  assignedUserName?: string;
  recipientEmail?: string;
  recipientName?: string;
  subject: string;
  daysOverdue?: number;
  daysInactive?: number;
  taskStatus?: string;
  billingStatus?: string;
  phaseName?: string;
  relatedTaskId?: string;
  relatedProjectId?: string;
  relatedClientId?: string;
};

function startOfDay(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
}

function daysBetweenNow(value?: string | null) {
  if (!value) return 0;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 0;
  return Math.max(0, Math.floor((startOfDay(new Date()) - startOfDay(date)) / 86400000));
}

function clientEmail(client?: Client | null) {
  if (!client?.contacts?.length) return null;
  const withEmail = client.contacts.find((contact) => contact.email?.trim());
  return withEmail?.email?.trim() || null;
}

function clientContactName(client?: Client | null) {
  if (!client?.contacts?.length) return null;
  const withEmail = client.contacts.find((contact) => contact.email?.trim());
  return withEmail?.name?.trim() || null;
}

function projectClient(project: Project | null | undefined, clientById: Map<string, Client>) {
  if (!project) return null;
  return clientById.get(String(project.clientId)) ?? null;
}

function memberName(member: CloudWorkspaceMember | undefined, fallback?: string | null) {
  const label =
    member?.display_name?.trim() ||
    member?.profile?.full_name?.trim() ||
    member?.profile?.email?.trim() ||
    fallback?.trim() ||
    member?.user_id ||
    "";
  return label || "tim";
}

function taskActivityDate(task: Task) {
  return task.updatedAt || task.activatedAt || task.createdAt || null;
}

function projectActivityDate(tasks: Task[]) {
  const values = tasks
    .map((task) => task.completedAt || task.updatedAt || task.createdAt)
    .filter((value): value is string => Boolean(value))
    .sort((first, second) => new Date(second).getTime() - new Date(first).getTime());
  return values[0] ?? null;
}

function contextLabel(parts: Array<string | undefined | null>) {
  return parts
    .map((part) => part?.trim())
    .filter((part): part is string => Boolean(part))
    .join(" / ");
}

function includesWaitingKeywords(value: string) {
  const normalized = value.toLowerCase();
  return [
    "potvrda",
    "odobrenje",
    "materijal",
    "korekcija",
    "feedback",
    "cekamo",
    "čekamo",
    "client",
    "klijent",
  ].some((keyword) => normalized.includes(keyword));
}

function getActiveProjectPhase(project?: Project | null) {
  return (
    project?.stages?.find((stage) => stage.status === "active")?.name ||
    project?.stages?.find((stage) => stage.status !== "done")?.name ||
    null
  );
}

function proposalTarget(proposal: FollowUpProposal) {
  return proposal.projectTitle || proposal.taskTitle || proposal.clientName || "ovoga";
}

function inactivityNote(days?: number) {
  return days ? ` Već stoji ${days} dana.` : "";
}

export function buildInternalFollowUpMessage(proposal: FollowUpProposal, tone: FollowUpTone) {
  const target = proposalTarget(proposal);

  switch (tone) {
    case "friendly":
      if (proposal.signalType === "WAITING_CLIENT_CONFIRMATION") {
        return `Je l' imamo neki update ovde, da li još čekamo klijenta za ${target}?`;
      }
      if (proposal.signalType === "PROJECT_INACTIVE_CLIENT") {
        return `Je l' možemo da proverimo gde je stalo oko ${target}?${inactivityNote(proposal.daysInactive)}`;
      }
      if (proposal.signalType === "PAYMENT_OVERDUE_CLIENT") {
        return `Je l' imamo info da li je klijentu javljeno za uplatu oko ${target}?`;
      }
      return `Je l' imamo neki update ovde za ${target}?`;
    case "direct":
      if (proposal.daysOverdue) return `Ovo kasni već ${proposal.daysOverdue} dana, treba nam update danas.`;
      if (proposal.signalType === "WAITING_CLIENT_CONFIRMATION") {
        return "Treba nam jasan status danas, da li je ovo blokirano ili čekamo odgovor klijenta?";
      }
      return `Treba nam konkretan update danas za ${target}.`;
    case "team":
      if (proposal.signalType === "WAITING_CLIENT_CONFIRMATION") {
        return "Da poguramo ovo danas ako možemo, deluje da čekamo potvrdu klijenta.";
      }
      if (proposal.signalType === "PROJECT_INACTIVE_CLIENT") {
        return `Da proverimo ko preuzima follow-up za ${target} danas.`;
      }
      return "Da poguramo ovo danas ako možemo.";
    case "neutral":
    default:
      if (proposal.signalType === "WAITING_CLIENT_CONFIRMATION") {
        return "Da li je ovo blokirano ili čekamo odgovor klijenta?";
      }
      if (proposal.signalType === "PAYMENT_OVERDUE_CLIENT") {
        return `Možemo li da proverimo status naplate za ${target}?`;
      }
      return "Kakav je status ovog taska?";
  }
}

export function getDefaultClientFollowUpKind(proposal: FollowUpProposal): ClientFollowUpKind {
  if (proposal.signalType === "WAITING_CLIENT_CONFIRMATION") return "project_confirmation";
  if (proposal.signalType === "PAYMENT_OVERDUE_CLIENT") return "billing";
  if (proposal.signalType === "PROJECT_INACTIVE_CLIENT") return "project_stalled";
  return "general";
}

export function getClientFollowUpKindLabel(kind: ClientFollowUpKind) {
  switch (kind) {
    case "project_confirmation":
      return "Potvrda projekta";
    case "waiting_material":
      return "Čekamo materijal";
    case "project_stalled":
      return "Projekat stoji";
    case "post_meeting":
      return "Follow-up posle sastanka";
    case "billing":
      return "Naplata";
    case "general":
    default:
      return "Opšti follow-up";
  }
}

export function buildClientFollowUpMessage(proposal: FollowUpProposal, kind: ClientFollowUpKind) {
  const target = proposal.projectTitle || proposal.clientName || "projekat";
  const phase = proposal.phaseName ? ` u fazi ${proposal.phaseName}` : "";
  const inactivity = proposal.daysInactive ? ` Već neko vreme nemamo novi update (${proposal.daysInactive} dana).` : "";

  switch (kind) {
    case "project_confirmation":
      return `Želeli smo samo da proverimo da li ste stigli da pogledate predlog za ${target}${phase}.`;
    case "waiting_material":
      return `Kada budete imali vremena, pošaljite nam potrebne materijale za ${target} kako bismo nastavili dalje.`;
    case "project_stalled":
      return `Želeli smo samo da proverimo da li možemo da nastavimo sa sledećom fazom projekta ${target}.${inactivity}`.trim();
    case "post_meeting":
      return `Hvala još jednom na sastanku. Javljamo se samo kratko da proverimo da li imate dodatna pitanja ili naredni korak za ${target}.`;
    case "billing":
      return `Želeli smo samo da proverimo da li je sve u redu sa dokumentacijom za uplatu vezano za ${target}${proposal.billingStatus ? ` (${proposal.billingStatus})` : ""}.`;
    case "general":
    default:
      return `Javljamo se kratko da proverimo status za ${target} i da li sa vaše strane postoji nešto što vam treba od nas da bismo nastavili dalje.`;
  }
}

export function buildClientFollowUpVariants(
  proposal: FollowUpProposal,
  kind: ClientFollowUpKind,
) {
  const target = proposal.projectTitle || proposal.clientName || "projekat";
  const phase = proposal.phaseName ? ` u fazi ${proposal.phaseName}` : "";
  const inactivity = proposal.daysInactive ? ` Imamo utisak da je komunikacija malo stala poslednjih ${proposal.daysInactive} dana.` : "";

  switch (kind) {
    case "project_confirmation":
      return [
        `Želeli smo samo da proverimo da li ste stigli da pogledate predlog za ${target}${phase}.`,
        `Javljamo se kratko da proverimo da li ste imali priliku da pogledate predlog za ${target}.`,
        `Kad budete imali trenutak, javite nam da li možemo da računamo na potvrdu za ${target}.`,
      ];
    case "waiting_material":
      return [
        `Kada budete imali vremena, pošaljite nam potrebne materijale za ${target} kako bismo nastavili dalje.`,
        `Javljamo se samo kratko kao podsetnik za materijale koji su nam potrebni za ${target}.`,
        `Čim vam bude odgovaralo, pošaljite nam materijale za ${target} da možemo da nastavimo sledeći korak.`,
      ];
    case "project_stalled":
      return [
        `Želeli smo samo da proverimo da li možemo da nastavimo sa sledećom fazom projekta ${target}.${inactivity}`.trim(),
        `Javljamo se kratko da proverimo status projekta ${target} i da li ima nečega što vam je potrebno od nas za nastavak.`,
        `Kad budete imali trenutak, javite nam da li možemo da pokrenemo sledeći korak za ${target}.`,
      ];
    case "post_meeting":
      return [
        `Hvala još jednom na sastanku. Javljamo se samo kratko da proverimo da li imate dodatna pitanja ili naredni korak za ${target}.`,
        `Drago nam je što smo se čuli. Kad budete imali vremena, javite nam kako želite da nastavimo oko ${target}.`,
        `Samo kratko da se nadovežemo na sastanak i proverimo sledeći korak za ${target}.`,
      ];
    case "billing":
      return [
        `Želeli smo samo da proverimo da li je sve u redu sa dokumentacijom za uplatu vezano za ${target}${proposal.billingStatus ? ` (${proposal.billingStatus})` : ""}.`,
        `Javljamo se kratko da proverimo da li je sve spremno sa vaše strane oko uplate za ${target}.`,
        `Kad budete imali trenutak, javite nam da li postoji još nešto što treba da uskladimo oko dokumentacije za uplatu za ${target}.`,
      ];
    case "general":
    default:
      return [
        `Javljamo se kratko da proverimo status za ${target} i da li sa vaše strane postoji nešto što vam treba od nas da bismo nastavili dalje.`,
        `Samo kratko da proverimo gde smo stali oko ${target} i da li možemo da pomognemo sa narednim korakom.`,
        `Kad budete imali trenutak, javite nam status za ${target} kako bismo znali kako dalje da planiramo.`,
      ];
  }
}

export function getFollowUpToneLabel(tone: FollowUpTone) {
  switch (tone) {
    case "neutral":
      return "Neutralno";
    case "friendly":
      return "Prijateljski";
    case "direct":
      return "Direktnije";
    case "team":
      return "Interno timu";
    default:
      return "Neutralno";
  }
}

export function buildFollowUpProposals({
  clients,
  projects,
  tasks,
  billing,
  members,
}: {
  clients: Client[];
  projects: Project[];
  tasks: Task[];
  billing: BillingRecord[];
  members: CloudWorkspaceMember[];
}) {
  const clientById = new Map(clients.map((client) => [String(client.id), client]));
  const projectById = new Map(projects.map((project) => [project.id, project]));
  const memberById = new Map(members.map((member) => [member.user_id, member]));
  const proposals: FollowUpProposal[] = [];

  getOverdueTasks(tasks)
    .filter((task) => task.assignedToUserId)
    .forEach((task) => {
      const assignedUserId = task.assignedToUserId;
      if (!assignedUserId) return;
      const project = task.projectId ? projectById.get(task.projectId) ?? null : null;
      const client = clientById.get(String(task.clientId)) ?? projectClient(project, clientById);
      const overdueDays = getTaskOverdueDays(task);
      proposals.push({
        id: `task-overdue-${task.id}`,
        signalType: "TASK_OVERDUE_INTERNAL",
        category: "Interno",
        priority: "Visok",
        summary: `${task.title} kasni${overdueDays ? ` ${overdueDays} dana` : ""}.`,
        contextLabel: contextLabel([client?.name, project?.title, task.title]),
        clientName: client?.name,
        projectTitle: project?.title,
        taskTitle: task.title,
        assignedUserId,
        assignedUserName: memberName(memberById.get(assignedUserId), task.assignedToLabel),
        subject: "Interna provera statusa zadatka",
        daysOverdue: overdueDays,
        taskStatus: task.status,
        phaseName: getActiveProjectPhase(project) ?? undefined,
        relatedTaskId: task.id,
        relatedProjectId: project?.id,
        relatedClientId: client ? String(client.id) : undefined,
      });
    });

  projects.forEach((project) => {
    const projectTasks = tasks.filter((task) => task.projectId === project.id && isTaskOpen(task));
    if (!projectTasks.length) return;
    const lastActivity = projectActivityDate(projectTasks);
    const idleDays = daysBetweenNow(lastActivity);
    if (idleDays < 4) return;

    const client = clientById.get(String(project.clientId)) ?? null;
    proposals.push({
      id: `project-inactive-${project.id}`,
      signalType: "PROJECT_INACTIVE_CLIENT",
      category: "Klijent",
      priority: idleDays >= 7 ? "Visok" : "Srednji",
      summary: `${project.title} nema novih aktivnosti ${idleDays} dana.`,
      contextLabel: contextLabel([client?.name, project.title]),
      clientName: client?.name,
      projectTitle: project.title,
      recipientEmail: clientEmail(client) ?? undefined,
      recipientName: clientContactName(client) ?? undefined,
      subject: "Provera statusa projekta",
      daysInactive: idleDays,
      taskStatus: project.status,
      billingStatus: project.billingStatus,
      phaseName: getActiveProjectPhase(project) ?? undefined,
      relatedProjectId: project.id,
      relatedClientId: client ? String(client.id) : undefined,
    });
  });

  tasks
    .filter((task) => isTaskOpen(task))
    .filter((task) => includesWaitingKeywords([task.title, task.description, task.status].filter(Boolean).join(" ")))
    .forEach((task) => {
      const project = task.projectId ? projectById.get(task.projectId) ?? null : null;
      const client = clientById.get(String(task.clientId)) ?? projectClient(project, clientById);
      const inactivity = daysBetweenNow(taskActivityDate(task));
      proposals.push({
        id: `waiting-confirmation-${task.id}`,
        signalType: "WAITING_CLIENT_CONFIRMATION",
        category: "Klijent",
        priority: inactivity >= 5 ? "Visok" : "Srednji",
        summary: `${project?.title || task.title} čeka potvrdu ili komentar klijenta.`,
        contextLabel: contextLabel([client?.name, project?.title, task.title]),
        clientName: client?.name,
        projectTitle: project?.title,
        taskTitle: task.title,
        recipientEmail: clientEmail(client) ?? undefined,
        recipientName: clientContactName(client) ?? undefined,
        subject: "Potvrda materijala",
        daysInactive: inactivity || undefined,
        taskStatus: task.status,
        phaseName: getActiveProjectPhase(project) ?? undefined,
        relatedTaskId: task.id,
        relatedProjectId: project?.id,
        relatedClientId: client ? String(client.id) : undefined,
      });
    });

  const billingCollections = getBillingCollections(billing);

  billingCollections.ready.forEach((record) => {
    const project = projectById.get(record.projectId) ?? null;
    const client = clientById.get(String(record.clientId)) ?? projectClient(project, clientById);
    proposals.push({
      id: `billing-ready-${record.id}`,
      signalType: "BILLING_READY",
      category: "Naplata",
      priority: "Srednji",
      summary: `${record.amount?.toLocaleString("sr-RS") || 0} ${record.currency || "RSD"} spremno je za fakturisanje.`,
      contextLabel: contextLabel([client?.name, project?.title || record.projectName, record.description]),
      clientName: client?.name,
      projectTitle: project?.title || record.projectName,
      subject: "Priprema naloga za naplatu",
      billingStatus: record.status,
      phaseName: getActiveProjectPhase(project) ?? undefined,
      relatedProjectId: project?.id,
      relatedClientId: client ? String(client.id) : undefined,
    });
  });

  billingCollections.overdue.forEach((record) => {
    const project = projectById.get(record.projectId) ?? null;
    const client = clientById.get(String(record.clientId)) ?? projectClient(project, clientById);
    const lateDays = getBillingStatus(record) === "overdue" ? daysBetweenNow(record.dueDate) : 0;
    proposals.push({
      id: `payment-overdue-${record.id}`,
      signalType: "PAYMENT_OVERDUE_CLIENT",
      category: "Klijent",
      priority: lateDays >= 7 ? "Visok" : "Srednji",
      summary: `Faktura za ${project?.title || client?.name || "projekat"} kasni sa uplatom${lateDays ? ` ${lateDays} dana` : ""}.`,
      contextLabel: contextLabel([client?.name, project?.title || record.projectName, record.description]),
      clientName: client?.name,
      projectTitle: project?.title || record.projectName,
      recipientEmail: clientEmail(client) ?? undefined,
      recipientName: clientContactName(client) ?? undefined,
      subject: "Podsetnik za otvorenu fakturu",
      daysOverdue: lateDays || undefined,
      billingStatus: record.status,
      phaseName: getActiveProjectPhase(project) ?? undefined,
      relatedProjectId: project?.id,
      relatedClientId: client ? String(client.id) : undefined,
    });
  });

  const unique = Array.from(new Map(proposals.map((item) => [item.id, item])).values());
  const priorityWeight: Record<FollowUpPriority, number> = { Visok: 0, Srednji: 1, Nizak: 2 };

  return unique
    .sort((first, second) => priorityWeight[first.priority] - priorityWeight[second.priority])
    .slice(0, 4);
}

export function getFollowUpBadgeTone(category: FollowUpCategory) {
  if (category === "Interno") return "is-red";
  if (category === "Naplata") return "is-yellow";
  return "is-blue";
}

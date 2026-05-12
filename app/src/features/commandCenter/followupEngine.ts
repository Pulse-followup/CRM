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

export type FollowUpTone = "neutral" | "warm" | "direct" | "internal";

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
  assignedUserName?: string;
  recipientEmail?: string;
  recipientName?: string;
  subject: string;
  daysOverdue?: number;
  daysInactive?: number;
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
  return Math.max(
    0,
    Math.floor((startOfDay(new Date()) - startOfDay(date)) / 86400000),
  );
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

function projectClient(
  project: Project | null | undefined,
  clientById: Map<string, Client>,
) {
  if (!project) return null;
  return clientById.get(String(project.clientId)) ?? null;
}

function memberName(
  member: CloudWorkspaceMember | undefined,
  fallback?: string | null,
) {
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

function isClientFacingSignalType(signalType: FollowUpSignalType) {
  return (
    signalType === "PROJECT_INACTIVE_CLIENT" ||
    signalType === "WAITING_CLIENT_CONFIRMATION" ||
    signalType === "PAYMENT_OVERDUE_CLIENT"
  );
}

function taskContextSentence(proposal: FollowUpProposal) {
  if (!proposal.taskTitle) return "";
  return ` Aktivnost "${proposal.taskTitle}" je trenutno otvorena.`;
}

function delaySentence(days?: number, mode: "soft" | "direct" | "internal" = "soft") {
  if (!days) return "";
  if (mode === "direct") return ` Rok je probijen vec ${days} dan${days === 1 ? "" : "a"}.`;
  if (mode === "internal") {
    return ` Deluje da stoji duze nego sto bi trebalo, vec ${days} dan${days === 1 ? "" : "a"} posle roka.`;
  }
  return ` Rok je prosao pre ${days} dan${days === 1 ? "" : "a"}.`;
}

function clientGreeting(name?: string) {
  return name ? `Postovani ${name},` : "Postovani,";
}

export function buildFollowUpMessage(
  proposal: FollowUpProposal,
  tone: FollowUpTone,
) {
  const contextTarget = proposal.projectTitle || proposal.clientName || "realizaciju";
  const taskMention = taskContextSentence(proposal);
  const recipientName = clientGreeting(proposal.recipientName);
  const assignedName = proposal.assignedUserName || "tim";

  switch (proposal.signalType) {
    case "TASK_OVERDUE_INTERNAL": {
      if (tone === "direct") {
        return `Cao ${assignedName}, potreban nam je konkretan status za ${contextTarget}.${taskMention}${delaySentence(proposal.daysOverdue, "direct")} Javi odmah da li postoji blokada, sta ceka potvrdu i koji je realan sledeci korak da se ovo ne razvuce dalje.`;
      }
      if (tone === "warm") {
        return `Cao ${assignedName}, samo proveravam status oko realizacije za ${contextTarget}.${taskMention}${delaySentence(proposal.daysOverdue)} Javi ako postoji blokada ili treba pomoc da poguramo dalje bez dodatnog pomeranja. Ako je sve pod kontrolom, znacilo bi da imamo samo kratak update.`;
      }
      if (tone === "internal") {
        return `Cao ${assignedName}, proveri molim te status za ${contextTarget}.${taskMention}${delaySentence(proposal.daysOverdue, "internal")} Javi da li nesto ceka klijenta, materijal ili internu potvrdu i ko zatvara sledeci korak.`;
      }
      return `Cao ${assignedName}, samo proveravam status oko realizacije za ${contextTarget}.${taskMention}${delaySentence(proposal.daysOverdue)} Javi da li postoji blokada ili treba nesto da uskladimo da bismo nastavili bez zastoja.`;
    }
    case "PROJECT_INACTIVE_CLIENT": {
      if (tone === "direct") {
        return `${recipientName} potrebna nam je potvrda ili konkretan status za ${contextTarget} kako bismo nastavili realizaciju bez dodatnog kasnjenja. Bez te informacije ne mozemo da pomerimo sledeci korak.`;
      }
      if (tone === "warm") {
        return `${recipientName} samo kratka provera vezano za ${contextTarget}. Da ne izgubimo ritam realizacije, znacila bi nam potvrda ili eventualne korekcije sa Vase strane. Cim dobijemo povratnu informaciju, nastavljamo dalje.`;
      }
      if (tone === "internal") {
        return `Interna napomena: projekat ${contextTarget} nema novih aktivnosti${proposal.daysInactive ? ` vec ${proposal.daysInactive} dana` : ""}. Proveriti da li cekamo odgovor klijenta, materijal ili finalnu potvrdu i ko preuzima follow-up danas.`;
      }
      return `${recipientName} samo kratka provera vezano za ${contextTarget}. Da bismo nastavili realizaciju bez dodatnog pomeranja rokova, znacila bi nam potvrda ili eventualne korekcije.`;
    }
    case "WAITING_CLIENT_CONFIRMATION": {
      if (tone === "direct") {
        return `${recipientName} potrebna nam je potvrda ili komentar za ${contextTarget} kako bismo nastavili bez zastoja. Bez toga ne mozemo da zatvorimo pripremu i prebacimo projekat u sledecu fazu.`;
      }
      if (tone === "warm") {
        return `${recipientName} samo proveravam da li imate komentar ili potvrdu za materijale i korekcije oko ${contextTarget}, kako bismo nastavili dalje bez zastoja. Ako je sve u redu, dovoljan nam je i kratak odgovor.`;
      }
      if (tone === "internal") {
        return `Interna napomena: za ${contextTarget} cekamo potvrdu klijenta. Proveriti ko radi follow-up, kada saljemo sledeci podsetnik i sta ostaje na cekanju dok odgovor ne stigne.`;
      }
      return `${recipientName} samo proveravam da li imate komentar ili potvrdu za materijale vezano za ${contextTarget}, kako bismo nastavili dalje bez zastoja.`;
    }
    case "BILLING_READY": {
      if (tone === "direct") {
        return `Projekat ${contextTarget} je zavrsen i obracun je spreman. Potrebno je odmah pripremiti nalog za naplatu i proslediti finansijama kako ne bismo izgubili jos jedan ciklus naplate.`;
      }
      if (tone === "warm") {
        return `Projekat ${contextTarget} je zavrsen i obracun je spreman za fakturisanje. Predlog je da pripremimo nalog za naplatu i prosledimo finansijama bez odlaganja, dok je kontekst jos potpuno svež.`;
      }
      return `Projekat ${contextTarget} je zavrsen i obracun je spreman za fakturisanje. Predlog je da se pripremi nalog za naplatu i prosledi finansijama.`;
    }
    case "PAYMENT_OVERDUE_CLIENT": {
      if (tone === "direct") {
        return `${recipientName} faktura za ${contextTarget} je i dalje otvorena${proposal.daysOverdue ? `, sa kasnjenjem od ${proposal.daysOverdue} dana` : ""}. Molimo potvrdu termina uplate ili informaciju ako je potrebna dodatna dokumentacija sa nase strane.`;
      }
      if (tone === "warm") {
        return `${recipientName} samo ljubazan podsetnik da je faktura za ${contextTarget} trenutno otvorena. Ukoliko je uplata vec poslata, slobodno zanemarite poruku. Ako je potrebno jos nesto sa nase strane, stojimo na raspolaganju i rado cemo dopuniti dokumentaciju.`;
      }
      if (tone === "internal") {
        return `Interna napomena: uplata za ${contextTarget} kasni${proposal.daysOverdue ? ` ${proposal.daysOverdue} dana` : ""}. Proveriti da li ide novi podsetnik, direktan kontakt sa finansijama klijenta ili eskalacija preko account-a.`;
      }
      return `${recipientName} samo ljubazan podsetnik da je faktura za ${contextTarget} trenutno otvorena. Ukoliko je uplata vec poslata, slobodno zanemarite poruku. Ako je potrebno jos nesto sa nase strane, stojimo na raspolaganju.`;
    }
    default:
      return "";
  }
}

export function getFollowUpToneLabel(tone: FollowUpTone) {
  switch (tone) {
    case "neutral":
      return "Neutralno";
    case "warm":
      return "Ljubazno";
    case "direct":
      return "Direktnije";
    case "internal":
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
        assignedUserName: memberName(
          memberById.get(assignedUserId),
          task.assignedToLabel,
        ),
        subject: "Interna provera statusa zadatka",
        daysOverdue: overdueDays,
        relatedTaskId: task.id,
        relatedProjectId: project?.id,
        relatedClientId: client ? String(client.id) : undefined,
      });
    });

  projects.forEach((project) => {
    const projectTasks = tasks.filter(
      (task) => task.projectId === project.id && isTaskOpen(task),
    );
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
      relatedProjectId: project.id,
      relatedClientId: client ? String(client.id) : undefined,
    });
  });

  tasks
    .filter((task) => isTaskOpen(task))
    .filter((task) =>
      includesWaitingKeywords(
        [task.title, task.description, task.status].filter(Boolean).join(" "),
      ),
    )
    .forEach((task) => {
      const project = task.projectId ? projectById.get(task.projectId) ?? null : null;
      const client = clientById.get(String(task.clientId)) ?? projectClient(project, clientById);
      const inactivity = daysBetweenNow(taskActivityDate(task));
      proposals.push({
        id: `waiting-confirmation-${task.id}`,
        signalType: "WAITING_CLIENT_CONFIRMATION",
        category: "Klijent",
        priority: inactivity >= 5 ? "Visok" : "Srednji",
        summary: `${project?.title || task.title} ceka potvrdu ili komentar klijenta.`,
        contextLabel: contextLabel([client?.name, project?.title, task.title]),
        clientName: client?.name,
        projectTitle: project?.title,
        taskTitle: task.title,
        recipientEmail: clientEmail(client) ?? undefined,
        recipientName: clientContactName(client) ?? undefined,
        subject: "Potvrda materijala",
        daysInactive: inactivity || undefined,
        relatedTaskId: task.id,
        relatedProjectId: project?.id,
        relatedClientId: client ? String(client.id) : undefined,
      });
    });

  const billingCollections = getBillingCollections(billing);

  billingCollections.ready.forEach((record) => {
    const project = projectById.get(record.projectId) ?? null;
    const client =
      clientById.get(String(record.clientId)) ?? projectClient(project, clientById);
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
      relatedProjectId: project?.id,
      relatedClientId: client ? String(client.id) : undefined,
    });
  });

  billingCollections.overdue.forEach((record) => {
    const project = projectById.get(record.projectId) ?? null;
    const client =
      clientById.get(String(record.clientId)) ?? projectClient(project, clientById);
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
      relatedProjectId: project?.id,
      relatedClientId: client ? String(client.id) : undefined,
    });
  });

  const unique = Array.from(new Map(proposals.map((item) => [item.id, item])).values());
  const priorityWeight: Record<FollowUpPriority, number> = {
    Visok: 0,
    Srednji: 1,
    Nizak: 2,
  };

  return unique
    .sort((first, second) => priorityWeight[first.priority] - priorityWeight[second.priority])
    .slice(0, 4);
}

export function getFollowUpBadgeTone(category: FollowUpCategory) {
  if (category === "Interno") return "is-red";
  if (category === "Naplata") return "is-yellow";
  return "is-blue";
}

export function canOpenFollowUpEmail(proposal: FollowUpProposal) {
  return Boolean(proposal.recipientEmail && isClientFacingSignalType(proposal.signalType));
}

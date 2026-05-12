import { getBillingCollections } from '../billing/billingSelectors';
import type { BillingRecord } from '../billing/types';
import type { Client } from '../clients/types';
import type { CloudWorkspaceMember } from '../cloud/types';
import type { Project } from '../projects/types';
import { isTaskOpen } from '../tasks/taskLifecycle';
import {
  buildCommandCenterSignals,
  getOverdueTasks,
  getTaskOverdueDays,
} from '../tasks/taskSignals';
import type { Task } from '../tasks/types';

export type PulseSignal = {
  id: string;
  severity: 'red' | 'yellow' | 'green';
  entityName: string;
  message: string;
  impact?: string;
  actionLabel?: string;
  actionType?:
    | 'follow_up'
    | 'billing_summary'
    | 'redistribute'
    | 'open_task'
    | 'open_billing';
  relatedTaskId?: string;
  relatedProjectId?: string;
  relatedClientId?: string;
  relatedUserId?: string;
};

export function getSignalTone(
  signals: PulseSignal[],
): 'green' | 'yellow' | 'red' {
  if (signals.some((signal) => signal.severity === 'red')) return 'red';
  if (signals.some((signal) => signal.severity === 'yellow')) return 'yellow';
  return 'green';
}

function formatAmountValue(amount: number) {
  return `${amount.toLocaleString('sr-RS')} RSD`;
}

function memberName(member?: CloudWorkspaceMember) {
  if (!member) return 'Clan tima';
  return (
    member.display_name?.trim() ||
    member.profile?.full_name?.trim() ||
    member.profile?.email?.trim() ||
    member.user_id ||
    'Clan tima'
  );
}

function sortSignals(signals: PulseSignal[]) {
  const priority = { red: 0, yellow: 1, green: 2 };
  return signals.sort(
    (first, second) => priority[first.severity] - priority[second.severity],
  );
}

export function buildSignalSuggestion(signal: PulseSignal) {
  if (signal.actionType === 'follow_up') {
    return [
      'Predlog poruke:',
      `Zdravo, samo kratka provera statusa za ${signal.entityName}. Da li mozemo danas dobiti potvrdu kako bismo nastavili dalje bez pomeranja roka?`,
    ].join('\n');
  }

  if (signal.actionType === 'billing_summary') {
    return [
      'Billing summary:',
      'Klijent/projekat ima iznos spreman za fakturisanje. Proveriti opis usluge, iznos i rok placanja pre slanja naloga finansijama.',
    ].join('\n');
  }

  if (signal.actionType === 'redistribute') {
    return [
      'Predlog:',
      'Korisnik ima povecan broj aktivnih taskova. Proveriti da li deo zadataka moze da se prebaci na drugog clana tima.',
    ].join('\n');
  }

  return '';
}

export function buildAdminAiSignals({
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
}): PulseSignal[] {
  const signals: PulseSignal[] = [];
  const projectById = new Map(projects.map((project) => [project.id, project]));
  const clientById = new Map(clients.map((client) => [String(client.id), client]));
  const memberById = new Map(members.map((member) => [member.user_id, member]));

  getOverdueTasks(tasks).forEach((task) => {
      const lateBy = getTaskOverdueDays(task);
      const relatedProject = task.projectId ? projectById.get(task.projectId) : null;
      const relatedClient = clientById.get(String(task.clientId));
      signals.push({
        id: `late-${task.id}`,
        severity: 'red',
        entityName: task.title,
        message: `${task.title} kasni ${lateBy} dana.`,
        impact: 'Moguce pomeranje projekta ili reakcije klijenta.',
        actionLabel: 'Predlozi follow-up',
        actionType: 'follow_up',
        relatedTaskId: task.id,
        relatedProjectId: relatedProject?.id,
        relatedClientId: relatedClient?.id ? String(relatedClient.id) : undefined,
        relatedUserId: task.assignedToUserId,
      });
    });

  const billingCollections = getBillingCollections(billing);

  if (billingCollections.ready.length || billingCollections.readyTotal > 0) {
    const primaryRecord = billingCollections.ready[0];
    signals.push({
      id: `billing-${primaryRecord?.id ?? 'summary'}`,
      severity: 'yellow',
      entityName: 'Naplata',
      message: `${formatAmountValue(billingCollections.readyTotal)} spremno za fakturisanje.`,
      impact: 'Finansije treba da posalju nalog ili fakturu.',
      actionLabel: 'Kreiraj billing summary',
      actionType: 'billing_summary',
      relatedClientId: primaryRecord?.clientId ? String(primaryRecord.clientId) : undefined,
    });
  }

  const activeTaskCountByUser = new Map<string, number>();
  tasks.filter(isTaskOpen).forEach((task) => {
    if (!task.assignedToUserId) return;
    activeTaskCountByUser.set(
      task.assignedToUserId,
      (activeTaskCountByUser.get(task.assignedToUserId) ?? 0) + 1,
    );
  });

  Array.from(activeTaskCountByUser.entries())
    .filter(([, count]) => count > 5)
    .forEach(([userId, count]) => {
      signals.push({
        id: `load-${userId}`,
        severity: 'red',
        entityName: memberName(memberById.get(userId)),
        message: `${memberName(memberById.get(userId))} ima ${count} aktivnih taskova.`,
        impact: 'Moguce preopterecenje i kasnjenje.',
        actionLabel: 'Predlozi redistribuciju',
        actionType: 'redistribute',
        relatedUserId: userId,
      });
    });

  const commandSignals = buildCommandCenterSignals(tasks, billing, projects);
  if (commandSignals.some((signal) => signal.kind === 'task_overdue')) {
    const overdueTaskIds = new Set(getOverdueTasks(tasks).map((task) => task.id));
    if (!signals.some((signal) => signal.relatedTaskId && overdueTaskIds.has(signal.relatedTaskId))) {
      getOverdueTasks(tasks).slice(0, 4).forEach((task) => {
        const relatedProject = task.projectId ? projectById.get(task.projectId) : null;
        const relatedClient = clientById.get(String(task.clientId));
        signals.push({
          id: `late-fallback-${task.id}`,
          severity: 'red',
          entityName: task.title,
          message: `${task.title} kasni.`,
          impact: 'Moguce pomeranje projekta ili reakcije klijenta.',
          actionLabel: 'Predlozi follow-up',
          actionType: 'follow_up',
          relatedTaskId: task.id,
          relatedProjectId: relatedProject?.id,
          relatedClientId: relatedClient?.id ? String(relatedClient.id) : undefined,
          relatedUserId: task.assignedToUserId,
        });
      });
    }
  }

  const prioritized = sortSignals(signals).slice(0, 4);
  if (prioritized.length) return prioritized;

  return [
    {
      id: 'pulse-green',
      severity: 'green',
      entityName: 'PULSE',
      message: 'Sve aktivnosti su trenutno pod kontrolom.',
      impact: 'Nema hitne reakcije za admina.',
    },
  ];
}

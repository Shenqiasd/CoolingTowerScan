import type { Project, SopPhase } from '../types/project.ts';

export interface ProjectWorkbenchSummary {
  waitingApproval: number;
  blocked: number;
  overdue: number;
  pendingHandoffs: number;
}

type ProjectPhaseSnapshot = Partial<{
  dueAt: string;
  pendingHandoffs: unknown[];
  blockers: unknown[];
}>;

function getCurrentPhaseSnapshot(project: Project): ProjectPhaseSnapshot {
  const phaseData = project.phase_data[project.current_phase as SopPhase];
  if (!phaseData || typeof phaseData !== 'object') {
    return {};
  }

  return phaseData as ProjectPhaseSnapshot;
}

function hasPendingHandoffs(snapshot: ProjectPhaseSnapshot) {
  return Array.isArray(snapshot.pendingHandoffs) && snapshot.pendingHandoffs.length > 0;
}

function isBlocked(project: Project, snapshot: ProjectPhaseSnapshot) {
  if (project.current_stage_status === 'blocked') {
    return true;
  }

  return Array.isArray(snapshot.blockers) && snapshot.blockers.length > 0;
}

function isOverdue(project: Project, snapshot: ProjectPhaseSnapshot, now: number) {
  if (
    project.current_stage_status === 'completed' ||
    project.current_stage_status === 'waived'
  ) {
    return false;
  }

  if (typeof snapshot.dueAt !== 'string' || snapshot.dueAt.length === 0) {
    return false;
  }

  const dueAt = Date.parse(snapshot.dueAt);
  if (Number.isNaN(dueAt)) {
    return false;
  }

  return dueAt < now;
}

export function buildProjectWorkbenchSummary(
  projects: Project[],
  nowInput: string | number | Date = Date.now(),
): ProjectWorkbenchSummary {
  const now = nowInput instanceof Date ? nowInput.getTime() : (
    typeof nowInput === 'string' ? Date.parse(nowInput) : nowInput
  );

  return projects.reduce<ProjectWorkbenchSummary>((acc, project) => {
    const snapshot = getCurrentPhaseSnapshot(project);

    if (project.current_stage_status === 'pending_approval') {
      acc.waitingApproval += 1;
    }

    if (isBlocked(project, snapshot)) {
      acc.blocked += 1;
    }

    if (Number.isFinite(now) && isOverdue(project, snapshot, now)) {
      acc.overdue += 1;
    }

    if (hasPendingHandoffs(snapshot)) {
      acc.pendingHandoffs += 1;
    }

    return acc;
  }, {
    waitingApproval: 0,
    blocked: 0,
    overdue: 0,
    pendingHandoffs: 0,
  });
}

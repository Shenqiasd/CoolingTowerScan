import { useState, useEffect, useCallback } from 'react';

import {
  listProjects,
  type ProjectListItem,
} from '../api/projects';
import type { Project, SopPhase } from '../types/project';
import { SOP_PHASES } from '../types/project';

function buildEmptyPhaseData(): Project['phase_data'] {
  return Object.fromEntries(SOP_PHASES.map((phase) => [phase, {}])) as Project['phase_data'];
}

function mapProject(item: ProjectListItem): Project {
  const phaseData = buildEmptyPhaseData();
  phaseData[item.currentPhase] = {
    riskSummary: item.riskSummary,
    dueAt: item.currentStageDueAt,
    ownerUserId: item.currentStageOwnerUserId,
    approverUserId: item.currentStageApproverUserId,
    blockers: item.currentStageBlockers,
    pendingHandoffs: item.currentStagePendingHandoffs,
    nextGateLabel: item.currentStageNextGateLabel,
  };
  phaseData.proposal = {
    ...phaseData.proposal,
    solutionWorkspace: {
      commercialBranching: {
        branchType: item.commercialBranchType,
        freezeReady: item.commercialFreezeReady,
      },
      gateValidation: {
        canSnapshot: item.solutionCanSnapshot,
        errorCount: item.solutionGateErrorCount,
      },
      lastSnapshotVersion: item.lastSolutionSnapshotVersion,
    },
  };

  return {
    id: item.id,
    project_code: item.projectCode,
    lead_id: item.leadId,
    enterprise_id: item.enterpriseId,
    site_id: item.siteId,
    name: item.name,
    current_phase: item.currentPhase,
    current_stage_code: item.currentStageCode,
    current_stage_status: item.currentStageStatus,
    phase_data: phaseData,
    opportunity_score: item.opportunityScore,
    priority: item.priority,
    assigned_to: item.assignedTo,
    status: item.workflowStatus,
    created_at: item.createdAt,
    updated_at: item.updatedAt,
  };
}

export function useProjects() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [phaseFilter, setPhaseFilter] = useState<SopPhase | ''>('');

  const fetch = useCallback(async () => {
    setLoading(true);
    try {
      const items = await listProjects(phaseFilter);
      setProjects(items.map(mapProject));
    } catch {
      setProjects([]);
    } finally {
      setLoading(false);
    }
  }, [phaseFilter]);

  useEffect(() => {
    void fetch();
  }, [fetch]);

  const createFromEnterprise = useCallback(async (enterpriseId: string) => {
    throw new Error(`Legacy create_project_from_enterprise path is disabled: ${enterpriseId}`);
  }, []);

  const updatePhase = useCallback(async (projectId: string, phase: SopPhase) => {
    throw new Error(`Project phase updates must go through the API: ${projectId}:${phase}`);
  }, []);

  const updateProject = useCallback(async (projectId: string, updates: Partial<Project>) => {
    throw new Error(`Project updates must go through the API: ${projectId}:${JSON.stringify(updates)}`);
  }, []);

  return {
    projects,
    loading,
    phaseFilter,
    setPhaseFilter,
    refresh: fetch,
    createFromEnterprise,
    updatePhase,
    updateProject,
  };
}

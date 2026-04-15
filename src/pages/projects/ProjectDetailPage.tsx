import { useCallback, useEffect, useState, type ReactNode } from 'react';
import {
  AlertCircle,
  ArrowLeft,
  ClipboardList,
  ClipboardCheck,
  Database,
  FileWarning,
  Handshake,
  Loader2,
  Plus,
  RefreshCw,
  Save,
  Trash2,
  Zap,
} from 'lucide-react';
import { useNavigate, useParams } from 'react-router-dom';

import {
  completeProjectSurvey,
  decideProjectSolutionFreeze,
  createProjectSolutionSnapshot,
  getProjectAudit,
  getProjectDetail,
  getProjectSolutionWorkspace,
  getProjectSurveyWorkspace,
  listProjectSolutionSnapshots,
  requestProjectSolutionFreeze,
  updateProject,
  updateProjectSolutionWorkspace,
  updateProjectSurveyWorkspace,
  updateProjectStage,
  type ProjectAuditItem,
  type ProjectDetailData,
  type ProjectPriority,
  type ProjectSolutionSnapshot,
  type ProjectSolutionWorkspace,
  type ProjectSolutionFreezeDecision,
  type ProjectStageData,
  type ProjectStageStatus,
  type ProjectWorkflowStatus,
} from '../../api/projects';
import { SOP_PHASE_LABELS, type SopPhase } from '../../types/project';
import {
  buildCommercialSummaryItems,
  createDefaultSolutionWorkspace,
  createSolutionWorkspaceDraft,
  evaluateSolutionWorkspacePayload,
  serializeSolutionWorkspaceDraft,
  splitSolutionGateErrors,
  type ProjectCommercialBranchType,
  type ProjectSolutionEmcCommercialDraft,
  type ProjectSolutionEpcCommercialDraft,
  type ProjectSolutionWorkspaceDraft,
  type ProjectSolutionTechnicalAssumptionsDraft,
} from '../../utils/projectSolutionWorkspace';
import {
  createDefaultSurveyWorkspace,
  createEmptyDataGapDraftItem,
  createEmptyEquipmentDraftItem,
  createEmptyHandoffDraftItem,
  createSurveyWorkspaceDraft,
  serializeSurveyWorkspaceDraft,
  type DataGapDraftItem,
  type EquipmentLedgerDraftItem,
  type HandoffDraftItem,
  type ProjectSurveyWorkspace,
  type ProjectSurveyWorkspaceDraft,
  type SurveyRecordDraft,
} from '../../utils/projectSurveyWorkspace';
import { supabase } from '../../lib/supabase';

const STAGE_STATUS_LABELS: Record<ProjectStageStatus, string> = {
  not_started: '未开始',
  in_progress: '进行中',
  blocked: '阻塞',
  pending_approval: '待审批',
  completed: '已完成',
  waived: '已豁免',
};

const WORKFLOW_STATUS_LABELS: Record<ProjectWorkflowStatus, string> = {
  active: '进行中',
  blocked: '阻塞',
  on_hold: '挂起',
  completed: '完成',
  cancelled: '取消',
};

const PRIORITY_LABELS: Record<ProjectPriority, string> = {
  high: '高',
  medium: '中',
  low: '低',
};

const COMMERCIAL_BRANCH_LABELS: Record<ProjectCommercialBranchType, string> = {
  epc: 'EPC',
  emc: 'EMC',
};

const SOLUTION_FREEZE_STATUS_LABELS = {
  idle: '未提交',
  pending_approval: '待审批',
  approved: '已批准',
  rejected: '已驳回',
} as const;

interface ProjectDraft {
  name: string;
  priority: ProjectPriority;
  workflowStatus: ProjectWorkflowStatus;
  assignedTo: string;
  opportunityScore: string;
  riskSummary: string;
}

interface StageDraft {
  stageCode: SopPhase;
  status: ProjectStageStatus;
  ownerUserId: string;
  approverUserId: string;
  dueAt: string;
  blockersText: string;
  collaboratorUserIdsText: string;
  pendingHandoffsText: string;
  nextGateLabel: string;
}

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : '项目详情加载失败';
}

function toDateTimeLocalValue(value: string | null) {
  if (!value) {
    return '';
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return '';
  }

  const offset = date.getTimezoneOffset();
  const local = new Date(date.getTime() - offset * 60_000);
  return local.toISOString().slice(0, 16);
}

function toIsoOrNull(value: string) {
  if (!value.trim()) {
    return null;
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return null;
  }

  return date.toISOString();
}

function linesToText(items: string[]) {
  return items.join('\n');
}

function textToLines(value: string) {
  return value
    .split('\n')
    .map((item) => item.trim())
    .filter(Boolean);
}

function buildProjectDraft(detail: ProjectDetailData): ProjectDraft {
  return {
    name: detail.name,
    priority: detail.priority,
    workflowStatus: detail.status,
    assignedTo: detail.assigned_to ?? '',
    opportunityScore: String(detail.opportunity_score ?? 0),
    riskSummary: detail.risk_summary ?? '',
  };
}

function buildStageDrafts(stages: ProjectStageData[]): Record<SopPhase, StageDraft> {
  return stages.reduce<Record<SopPhase, StageDraft>>((acc, stage) => {
    acc[stage.stageCode] = {
      stageCode: stage.stageCode,
      status: stage.status,
      ownerUserId: stage.ownerUserId ?? '',
      approverUserId: stage.approverUserId ?? '',
      dueAt: toDateTimeLocalValue(stage.dueAt),
      blockersText: linesToText(stage.blockers),
      collaboratorUserIdsText: linesToText(stage.collaboratorUserIds),
      pendingHandoffsText: linesToText(stage.pendingHandoffs),
      nextGateLabel: stage.nextGateLabel,
    };
    return acc;
  }, {} as Record<SopPhase, StageDraft>);
}

function formatAuditPayload(payload: Record<string, unknown>) {
  const entries = Object.entries(payload);
  if (entries.length === 0) {
    return '无附加信息';
  }

  return entries
    .slice(0, 4)
    .map(([key, value]) => `${key}: ${typeof value === 'string' ? value : JSON.stringify(value)}`)
    .join(' · ');
}

function getSolutionSectionTone(isReady: boolean) {
  return isReady
    ? 'border-emerald-500/20 bg-emerald-500/10 text-emerald-200'
    : 'border-amber-500/20 bg-amber-500/10 text-amber-200';
}

export default function ProjectDetailPage() {
  const navigate = useNavigate();
  const { projectId = '' } = useParams();
  const [item, setItem] = useState<ProjectDetailData | null>(null);
  const [projectDraft, setProjectDraft] = useState<ProjectDraft | null>(null);
  const [stageDrafts, setStageDrafts] = useState<Record<SopPhase, StageDraft>>({} as Record<SopPhase, StageDraft>);
  const [auditLogs, setAuditLogs] = useState<ProjectAuditItem[]>([]);
  const [surveyWorkspace, setSurveyWorkspace] = useState<ProjectSurveyWorkspace | null>(null);
  const [surveyDraft, setSurveyDraft] = useState<ProjectSurveyWorkspaceDraft | null>(null);
  const [solutionWorkspace, setSolutionWorkspace] = useState<ProjectSolutionWorkspace | null>(null);
  const [solutionDraft, setSolutionDraft] = useState<ProjectSolutionWorkspaceDraft | null>(null);
  const [solutionSnapshots, setSolutionSnapshots] = useState<ProjectSolutionSnapshot[]>([]);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [auditError, setAuditError] = useState<string | null>(null);
  const [surveyError, setSurveyError] = useState<string | null>(null);
  const [solutionError, setSolutionError] = useState<string | null>(null);
  const [savingProject, setSavingProject] = useState(false);
  const [savingStages, setSavingStages] = useState<Record<string, boolean>>({});
  const [savingSurvey, setSavingSurvey] = useState(false);
  const [completingSurvey, setCompletingSurvey] = useState(false);
  const [savingSolution, setSavingSolution] = useState(false);
  const [snapshottingSolution, setSnapshottingSolution] = useState(false);
  const [requestingSolutionFreeze, setRequestingSolutionFreeze] = useState(false);
  const [decidingSolutionFreeze, setDecidingSolutionFreeze] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  const loadProject = useCallback(async () => {
    if (!projectId) {
      setLoading(false);
      setError('缺少 projectId');
      return;
    }

    setLoading(true);
    setError(null);
    setNotice(null);
    setAuditError(null);
    setSurveyError(null);
    setSolutionError(null);

    try {
      const [detail, audit, workspaceResult, solutionWorkspaceResult, snapshotsResult] = await Promise.all([
        getProjectDetail(projectId),
        getProjectAudit(projectId).catch((nextError) => {
          setAuditError(getErrorMessage(nextError));
          return [];
        }),
        getProjectSurveyWorkspace(projectId)
          .then((workspace) => ({ workspace, error: null as string | null }))
          .catch((nextError) => ({
            workspace: null,
            error: getErrorMessage(nextError),
          })),
        getProjectSolutionWorkspace(projectId)
          .then((workspace) => ({ workspace, error: null as string | null }))
          .catch((nextError) => ({
            workspace: null,
            error: getErrorMessage(nextError),
          })),
        listProjectSolutionSnapshots(projectId)
          .then((items) => ({ items, error: null as string | null }))
          .catch((nextError) => ({
            items: [] as ProjectSolutionSnapshot[],
            error: getErrorMessage(nextError),
          })),
      ]);

      setItem(detail);
      setProjectDraft(buildProjectDraft(detail));
      setStageDrafts(buildStageDrafts(detail.stages));
      setAuditLogs(audit);
      if (workspaceResult.workspace) {
        setSurveyWorkspace(workspaceResult.workspace);
        setSurveyDraft(createSurveyWorkspaceDraft(workspaceResult.workspace));
      } else {
        setSurveyWorkspace(null);
        setSurveyDraft(createSurveyWorkspaceDraft(createDefaultSurveyWorkspace(projectId)));
        setSurveyError(workspaceResult.error);
      }
      if (solutionWorkspaceResult.workspace) {
        setSolutionWorkspace(solutionWorkspaceResult.workspace);
        setSolutionDraft(createSolutionWorkspaceDraft(solutionWorkspaceResult.workspace));
      } else {
        setSolutionWorkspace(null);
        setSolutionDraft(createSolutionWorkspaceDraft(createDefaultSolutionWorkspace(projectId)));
        setSolutionError(solutionWorkspaceResult.error);
      }
      setSolutionSnapshots(snapshotsResult.items);
      if (snapshotsResult.error && !solutionWorkspaceResult.error) {
        setSolutionError(snapshotsResult.error);
      }
    } catch (nextError) {
      setItem(null);
      setProjectDraft(null);
      setStageDrafts({} as Record<SopPhase, StageDraft>);
      setSurveyWorkspace(null);
      setSurveyDraft(null);
      setSolutionWorkspace(null);
      setSolutionDraft(null);
      setSolutionSnapshots([]);
      setError(getErrorMessage(nextError));
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    void loadProject();
  }, [loadProject]);

  useEffect(() => {
    let mounted = true;
    void supabase.auth.getSession().then(({ data }) => {
      if (mounted) {
        setCurrentUserId(data.session?.user?.id ?? null);
      }
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setCurrentUserId(session?.user?.id ?? null);
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  const handleProjectDraftChange = useCallback(
    <K extends keyof ProjectDraft,>(key: K, value: ProjectDraft[K]) => {
      setProjectDraft((prev) => (prev ? { ...prev, [key]: value } : prev));
    },
    [],
  );

  const handleStageDraftChange = useCallback(
    <K extends keyof StageDraft,>(stageCode: SopPhase, key: K, value: StageDraft[K]) => {
      setStageDrafts((prev) => ({
        ...prev,
        [stageCode]: {
          ...prev[stageCode],
          [key]: value,
        },
      }));
    },
    [],
  );

  const handleSaveProject = useCallback(async () => {
    if (!projectId || !projectDraft) {
      return;
    }

    setSavingProject(true);
    setNotice(null);
    setError(null);

    try {
      const updated = await updateProject(projectId, {
        name: projectDraft.name.trim(),
        priority: projectDraft.priority,
        workflowStatus: projectDraft.workflowStatus,
        assignedTo: projectDraft.assignedTo.trim() || null,
        opportunityScore: Number(projectDraft.opportunityScore) || 0,
        riskSummary: projectDraft.riskSummary.trim(),
      });

      setItem(updated);
      setProjectDraft(buildProjectDraft(updated));
      setStageDrafts(buildStageDrafts(updated.stages));
      setNotice('项目主信息已保存');
      setAuditLogs(await getProjectAudit(projectId).catch(() => auditLogs));
    } catch (nextError) {
      setError(getErrorMessage(nextError));
    } finally {
      setSavingProject(false);
    }
  }, [auditLogs, projectDraft, projectId]);

  const handleSaveStage = useCallback(async (stageCode: SopPhase) => {
    if (!projectId) {
      return;
    }

    const draft = stageDrafts[stageCode];
    if (!draft) {
      return;
    }

    setSavingStages((prev) => ({ ...prev, [stageCode]: true }));
    setNotice(null);
    setError(null);

    try {
      await updateProjectStage(projectId, stageCode, {
        status: draft.status,
        ownerUserId: draft.ownerUserId.trim() || null,
        approverUserId: draft.approverUserId.trim() || null,
        dueAt: toIsoOrNull(draft.dueAt),
        blockers: textToLines(draft.blockersText),
        collaboratorUserIds: textToLines(draft.collaboratorUserIdsText),
        pendingHandoffs: textToLines(draft.pendingHandoffsText),
        nextGateLabel: draft.nextGateLabel.trim(),
      });

      await loadProject();
      setNotice(`${SOP_PHASE_LABELS[stageCode]} 已保存`);
    } catch (nextError) {
      setError(getErrorMessage(nextError));
    } finally {
      setSavingStages((prev) => ({ ...prev, [stageCode]: false }));
    }
  }, [loadProject, projectId, stageDrafts]);

  const handleSurveyInfoChange = useCallback(
    <K extends keyof ProjectSurveyWorkspaceDraft['infoCollection'],>(key: K, value: ProjectSurveyWorkspaceDraft['infoCollection'][K]) => {
      setSurveyDraft((prev) => (prev ? {
        ...prev,
        infoCollection: {
          ...prev.infoCollection,
          [key]: value,
        },
      } : prev));
    },
    [],
  );

  const handleSurveyRecordChange = useCallback(
    <K extends keyof SurveyRecordDraft,>(key: K, value: SurveyRecordDraft[K]) => {
      setSurveyDraft((prev) => (prev ? {
        ...prev,
        surveyRecord: {
          ...prev.surveyRecord,
          [key]: value,
        },
      } : prev));
    },
    [],
  );

  const handleEquipmentChange = useCallback(
    <K extends keyof EquipmentLedgerDraftItem,>(index: number, key: K, value: EquipmentLedgerDraftItem[K]) => {
      setSurveyDraft((prev) => {
        if (!prev) {
          return prev;
        }

        const nextItems = [...prev.equipmentLedger];
        nextItems[index] = {
          ...nextItems[index],
          [key]: value,
        };
        return {
          ...prev,
          equipmentLedger: nextItems,
        };
      });
    },
    [],
  );

  const handleDataGapChange = useCallback(
    <K extends keyof DataGapDraftItem,>(index: number, key: K, value: DataGapDraftItem[K]) => {
      setSurveyDraft((prev) => {
        if (!prev) {
          return prev;
        }

        const nextItems = [...prev.dataGaps];
        nextItems[index] = {
          ...nextItems[index],
          [key]: value,
        };
        return {
          ...prev,
          dataGaps: nextItems,
        };
      });
    },
    [],
  );

  const handleHandoffChange = useCallback(
    <K extends keyof HandoffDraftItem,>(index: number, key: K, value: HandoffDraftItem[K]) => {
      setSurveyDraft((prev) => {
        if (!prev) {
          return prev;
        }

        const nextItems = [...prev.handoffs];
        nextItems[index] = {
          ...nextItems[index],
          [key]: value,
        };
        return {
          ...prev,
          handoffs: nextItems,
        };
      });
    },
    [],
  );

  const handleSaveSurveyWorkspace = useCallback(async () => {
    if (!projectId || !surveyDraft) {
      return;
    }

    setSavingSurvey(true);
    setSurveyError(null);
    setNotice(null);

    try {
      const updated = await updateProjectSurveyWorkspace(
        projectId,
        serializeSurveyWorkspaceDraft(surveyDraft),
      );
      setSurveyWorkspace(updated);
      setSurveyDraft(createSurveyWorkspaceDraft(updated));
      setNotice('Survey Workspace 已保存');
      setAuditLogs(await getProjectAudit(projectId).catch(() => auditLogs));
    } catch (nextError) {
      setSurveyError(getErrorMessage(nextError));
    } finally {
      setSavingSurvey(false);
    }
  }, [auditLogs, projectId, surveyDraft]);

  const handleCompleteSurvey = useCallback(async () => {
    if (!projectId) {
      return;
    }

    setCompletingSurvey(true);
    setSurveyError(null);
    setNotice(null);

    try {
      const completed = await completeProjectSurvey(projectId);
      setSurveyWorkspace(completed);
      setSurveyDraft(createSurveyWorkspaceDraft(completed));
      await loadProject();
      setNotice('Survey 阶段已完成');
    } catch (nextError) {
      setSurveyError(getErrorMessage(nextError));
    } finally {
      setCompletingSurvey(false);
    }
  }, [loadProject, projectId]);

  const handleSolutionDraftChange = useCallback(
    <K extends keyof ProjectSolutionTechnicalAssumptionsDraft,>(
      key: K,
      value: ProjectSolutionTechnicalAssumptionsDraft[K],
    ) => {
      setSolutionDraft((prev) => (prev ? {
        ...prev,
        technicalAssumptions: {
          ...prev.technicalAssumptions,
          [key]: value,
        },
      } : prev));
    },
    [],
  );

  const handleSolutionBranchTypeChange = useCallback((branchType: ProjectCommercialBranchType) => {
    setSolutionDraft((prev) => (prev ? {
      ...prev,
      commercialBranching: {
        ...prev.commercialBranching,
        branchType,
      },
    } : prev));
  }, []);

  const handleSolutionBranchNoteChange = useCallback((value: string) => {
    setSolutionDraft((prev) => (prev ? {
      ...prev,
      commercialBranching: {
        ...prev.commercialBranching,
        branchDecisionNote: value,
      },
    } : prev));
  }, []);

  const handleSolutionFreezeReadyChange = useCallback((checked: boolean) => {
    setSolutionDraft((prev) => (prev ? {
      ...prev,
      commercialBranching: {
        ...prev.commercialBranching,
        freezeReady: checked,
      },
    } : prev));
  }, []);

  const handleSolutionEpcDraftChange = useCallback(
    <K extends keyof ProjectSolutionEpcCommercialDraft>(key: K, value: ProjectSolutionEpcCommercialDraft[K]) => {
      setSolutionDraft((prev) => (prev ? {
        ...prev,
        commercialBranching: {
          ...prev.commercialBranching,
          epc: {
            ...prev.commercialBranching.epc,
            [key]: value,
          },
        },
      } : prev));
    },
    [],
  );

  const handleSolutionEmcDraftChange = useCallback(
    <K extends keyof ProjectSolutionEmcCommercialDraft>(key: K, value: ProjectSolutionEmcCommercialDraft[K]) => {
      setSolutionDraft((prev) => (prev ? {
        ...prev,
        commercialBranching: {
          ...prev.commercialBranching,
          emc: {
            ...prev.commercialBranching.emc,
            [key]: value,
          },
        },
      } : prev));
    },
    [],
  );

  const handleSaveSolutionWorkspace = useCallback(async () => {
    if (!projectId || !solutionDraft) {
      return;
    }

    setSavingSolution(true);
    setSolutionError(null);
    setNotice(null);

    try {
      const updated = await updateProjectSolutionWorkspace(
        projectId,
        serializeSolutionWorkspaceDraft(solutionDraft),
      );
      setSolutionWorkspace(updated);
      setSolutionDraft(createSolutionWorkspaceDraft(updated));
      setSolutionSnapshots(await listProjectSolutionSnapshots(projectId).catch(() => solutionSnapshots));
      setNotice('Solution Center 已保存');
    } catch (nextError) {
      setSolutionError(getErrorMessage(nextError));
    } finally {
      setSavingSolution(false);
    }
  }, [projectId, solutionDraft, solutionSnapshots]);

  const handleCreateSolutionSnapshot = useCallback(async () => {
    if (!projectId) {
      return;
    }

    setSnapshottingSolution(true);
    setSolutionError(null);
    setNotice(null);

    try {
      await createProjectSolutionSnapshot(projectId);
      await loadProject();
      setNotice('Solution 版本快照已创建');
    } catch (nextError) {
      setSolutionError(getErrorMessage(nextError));
    } finally {
      setSnapshottingSolution(false);
    }
  }, [loadProject, projectId]);

  const handleRequestSolutionFreeze = useCallback(async () => {
    if (!projectId || !solutionDraft) {
      return;
    }

    setRequestingSolutionFreeze(true);
    setSolutionError(null);
    setNotice(null);

    try {
      await updateProjectSolutionWorkspace(
        projectId,
        serializeSolutionWorkspaceDraft(solutionDraft),
      );
      await requestProjectSolutionFreeze(projectId);
      await loadProject();
      setNotice('已提交商业冻结审批，并生成正式快照');
    } catch (nextError) {
      setSolutionError(getErrorMessage(nextError));
    } finally {
      setRequestingSolutionFreeze(false);
    }
  }, [loadProject, projectId, solutionDraft]);

  const handleDecideSolutionFreeze = useCallback(async (action: ProjectSolutionFreezeDecision) => {
    if (!projectId) {
      return;
    }

    setDecidingSolutionFreeze(true);
    setSolutionError(null);
    setNotice(null);

    try {
      await decideProjectSolutionFreeze(projectId, action);
      await loadProject();
      setNotice(action === 'approve' ? '商业冻结审批已批准' : '商业冻结审批已驳回');
    } catch (nextError) {
      setSolutionError(getErrorMessage(nextError));
    } finally {
      setDecidingSolutionFreeze(false);
    }
  }, [loadProject, projectId]);

  const defaultSolutionWorkspace = createDefaultSolutionWorkspace(projectId);
  const serializedSolutionDraft = solutionDraft
    ? serializeSolutionWorkspaceDraft(solutionDraft)
    : null;
  const solutionPreview = serializedSolutionDraft
    ? evaluateSolutionWorkspacePayload(serializedSolutionDraft)
    : null;
  const activeCalculationSummary = solutionPreview?.calculationSummary ?? solutionWorkspace?.calculationSummary ?? defaultSolutionWorkspace.calculationSummary;
  const activeGateValidation = solutionPreview?.gateValidation ?? solutionWorkspace?.gateValidation ?? defaultSolutionWorkspace.gateValidation;
  const activeCommercialBranching = solutionDraft
    ? serializedSolutionDraft?.commercialBranching ?? defaultSolutionWorkspace.commercialBranching
    : solutionWorkspace?.commercialBranching ?? defaultSolutionWorkspace.commercialBranching;
  const activeFreezeApproval = solutionWorkspace?.commercialFreezeApproval ?? defaultSolutionWorkspace.commercialFreezeApproval;
  const solutionGateBreakdown = solutionWorkspace
    ? splitSolutionGateErrors(activeGateValidation.errors)
    : { technical: [], commercial: [] };
  const commercialSummaryItems = solutionWorkspace
    ? buildCommercialSummaryItems({
      commercialBranching: activeCommercialBranching,
      calculationSummary: activeCalculationSummary,
    })
    : [];
  const proposalStage = item?.stages.find((stage) => stage.stageCode === 'proposal') ?? null;
  const isSolutionFreezePending = activeFreezeApproval.status === 'pending_approval';
  const isCurrentProposalApprover = Boolean(
    proposalStage?.approverUserId
    && currentUserId
    && proposalStage.approverUserId === currentUserId,
  );

  return (
    <div className="flex-1 overflow-y-auto bg-slate-950">
      <div className="border-b border-slate-800 px-6 py-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <button
            onClick={() => navigate('/projects')}
            className="inline-flex items-center gap-2 text-sm text-slate-400 transition-colors hover:text-white"
          >
            <ArrowLeft className="h-4 w-4" />
            返回项目看板
          </button>
          <button
            onClick={() => void loadProject()}
            className="inline-flex items-center gap-2 rounded-lg border border-slate-700 px-3 py-2 text-xs text-slate-300 transition-colors hover:border-slate-500 hover:text-white"
          >
            <RefreshCw className="h-3.5 w-3.5" />
            刷新详情
          </button>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center gap-2 px-6 py-20 text-sm text-slate-400">
          <Loader2 className="h-4 w-4 animate-spin" />
          正在加载项目详情
        </div>
      ) : error ? (
        <div className="flex items-start gap-3 px-6 py-8 text-sm text-rose-300">
          <AlertCircle className="mt-0.5 h-4 w-4 flex-shrink-0" />
          <div>
            <p className="font-medium text-rose-200">项目详情加载失败</p>
            <p className="mt-1 text-rose-300/80">{error}</p>
          </div>
        </div>
      ) : !item || !projectDraft ? (
        <div className="px-6 py-16 text-center text-sm text-slate-500">未找到对应项目。</div>
      ) : (
        <div className="space-y-5 px-6 py-5">
          <section className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5">
            <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="text-xl font-semibold text-white">{item.name}</h2>
                  <span className="rounded-full bg-slate-800 px-2 py-0.5 text-[10px] text-slate-300">
                    {item.project_code || item.id}
                  </span>
                </div>
                <div className="mt-3 flex flex-wrap gap-4 text-xs text-slate-500">
                  <span>当前阶段 {SOP_PHASE_LABELS[item.current_phase]}</span>
                  <span>工作流 {WORKFLOW_STATUS_LABELS[item.status]}</span>
                  <span>优先级 {PRIORITY_LABELS[item.priority]}</span>
                  <span>更新时间 {new Date(item.updated_at).toLocaleString('zh-CN')}</span>
                </div>
              </div>

              {notice && (
                <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-xs text-emerald-300">
                  {notice}
                </div>
              )}
            </div>
          </section>

          <section className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5">
            <div className="mb-4 flex items-center justify-between gap-3">
              <div>
                <h3 className="text-sm font-medium text-white">项目主信息</h3>
                <p className="mt-1 text-xs text-slate-500">项目级指挥字段由 API 统一写入</p>
              </div>
              <button
                onClick={() => void handleSaveProject()}
                disabled={savingProject}
                className="inline-flex items-center gap-2 rounded-lg bg-cyan-600 px-3 py-2 text-xs font-medium text-white transition-colors hover:bg-cyan-500 disabled:cursor-not-allowed disabled:bg-cyan-900/40"
              >
                {savingProject ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
                保存项目
              </button>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <label className="space-y-2 text-xs text-slate-400">
                <span>项目名称</span>
                <input
                  value={projectDraft.name}
                  onChange={(event) => handleProjectDraftChange('name', event.target.value)}
                  className="w-full rounded-lg border border-slate-800 bg-slate-950/70 px-3 py-2 text-sm text-white focus:border-cyan-500/50 focus:outline-none"
                />
              </label>
              <label className="space-y-2 text-xs text-slate-400">
                <span>项目负责人</span>
                <input
                  value={projectDraft.assignedTo}
                  onChange={(event) => handleProjectDraftChange('assignedTo', event.target.value)}
                  placeholder="user-id 或姓名占位"
                  className="w-full rounded-lg border border-slate-800 bg-slate-950/70 px-3 py-2 text-sm text-white focus:border-cyan-500/50 focus:outline-none"
                />
              </label>
              <label className="space-y-2 text-xs text-slate-400">
                <span>优先级</span>
                <select
                  value={projectDraft.priority}
                  onChange={(event) => handleProjectDraftChange('priority', event.target.value as ProjectPriority)}
                  className="w-full rounded-lg border border-slate-800 bg-slate-950/70 px-3 py-2 text-sm text-white focus:border-cyan-500/50 focus:outline-none"
                >
                  {Object.entries(PRIORITY_LABELS).map(([value, label]) => (
                    <option key={value} value={value}>{label}</option>
                  ))}
                </select>
              </label>
              <label className="space-y-2 text-xs text-slate-400">
                <span>工作流状态</span>
                <select
                  value={projectDraft.workflowStatus}
                  onChange={(event) => handleProjectDraftChange('workflowStatus', event.target.value as ProjectWorkflowStatus)}
                  className="w-full rounded-lg border border-slate-800 bg-slate-950/70 px-3 py-2 text-sm text-white focus:border-cyan-500/50 focus:outline-none"
                >
                  {Object.entries(WORKFLOW_STATUS_LABELS).map(([value, label]) => (
                    <option key={value} value={value}>{label}</option>
                  ))}
                </select>
              </label>
              <label className="space-y-2 text-xs text-slate-400">
                <span>商机评分</span>
                <input
                  type="number"
                  value={projectDraft.opportunityScore}
                  onChange={(event) => handleProjectDraftChange('opportunityScore', event.target.value)}
                  className="w-full rounded-lg border border-slate-800 bg-slate-950/70 px-3 py-2 text-sm text-white focus:border-cyan-500/50 focus:outline-none"
                />
              </label>
              <div className="rounded-lg border border-slate-800 bg-slate-950/60 px-3 py-3 text-xs text-slate-500">
                <p>当前阶段：{SOP_PHASE_LABELS[item.current_phase]}</p>
                <p className="mt-2">当前阶段状态：{STAGE_STATUS_LABELS[item.current_stage_status]}</p>
                <p className="mt-2">来源线索：{item.lead_id || '未绑定'}</p>
              </div>
            </div>

            <label className="mt-4 block space-y-2 text-xs text-slate-400">
              <span>风险摘要</span>
              <textarea
                value={projectDraft.riskSummary}
                onChange={(event) => handleProjectDraftChange('riskSummary', event.target.value)}
                rows={4}
                className="w-full rounded-lg border border-slate-800 bg-slate-950/70 px-3 py-2 text-sm text-white focus:border-cyan-500/50 focus:outline-none"
              />
            </label>
          </section>

          <section className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5">
            <div className="mb-4">
              <h3 className="text-sm font-medium text-white">阶段指挥区</h3>
              <p className="mt-1 text-xs text-slate-500">逐阶段维护负责人、审批人、阻塞和待交接事项</p>
            </div>

            <div className="grid gap-4 xl:grid-cols-2">
              {item.stages.map((stage) => {
                const draft = stageDrafts[stage.stageCode];
                if (!draft) {
                  return null;
                }

                return (
                  <div key={stage.stageCode} className="rounded-xl border border-slate-800 bg-slate-950/60 p-4">
                    <div className="mb-3 flex items-start justify-between gap-3">
                      <div>
                        <p className="text-sm font-medium text-white">{SOP_PHASE_LABELS[stage.stageCode]}</p>
                        <p className="mt-1 text-xs text-slate-500">
                          进入时间 {stage.enteredAt ? new Date(stage.enteredAt).toLocaleString('zh-CN') : '未进入'}
                        </p>
                      </div>
                      <button
                        onClick={() => void handleSaveStage(stage.stageCode)}
                        disabled={savingStages[stage.stageCode]}
                        className="inline-flex items-center gap-2 rounded-lg border border-slate-700 px-3 py-2 text-xs text-slate-200 transition-colors hover:border-cyan-500/50 hover:text-white disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        {savingStages[stage.stageCode]
                          ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          : <Save className="h-3.5 w-3.5" />}
                        保存阶段
                      </button>
                    </div>

                    <div className="grid gap-3 md:grid-cols-2">
                      <label className="space-y-2 text-xs text-slate-400">
                        <span>阶段状态</span>
                        <select
                          value={draft.status}
                          onChange={(event) => handleStageDraftChange(stage.stageCode, 'status', event.target.value as ProjectStageStatus)}
                          className="w-full rounded-lg border border-slate-800 bg-slate-900 px-3 py-2 text-sm text-white focus:border-cyan-500/50 focus:outline-none"
                        >
                          {Object.entries(STAGE_STATUS_LABELS).map(([value, label]) => (
                            <option key={value} value={value}>{label}</option>
                          ))}
                        </select>
                      </label>
                      <label className="space-y-2 text-xs text-slate-400">
                        <span>截止时间</span>
                        <input
                          type="datetime-local"
                          value={draft.dueAt}
                          onChange={(event) => handleStageDraftChange(stage.stageCode, 'dueAt', event.target.value)}
                          className="w-full rounded-lg border border-slate-800 bg-slate-900 px-3 py-2 text-sm text-white focus:border-cyan-500/50 focus:outline-none"
                        />
                      </label>
                      <label className="space-y-2 text-xs text-slate-400">
                        <span>阶段负责人</span>
                        <input
                          value={draft.ownerUserId}
                          onChange={(event) => handleStageDraftChange(stage.stageCode, 'ownerUserId', event.target.value)}
                          placeholder="user-id"
                          className="w-full rounded-lg border border-slate-800 bg-slate-900 px-3 py-2 text-sm text-white focus:border-cyan-500/50 focus:outline-none"
                        />
                      </label>
                      <label className="space-y-2 text-xs text-slate-400">
                        <span>审批人</span>
                        <input
                          value={draft.approverUserId}
                          onChange={(event) => handleStageDraftChange(stage.stageCode, 'approverUserId', event.target.value)}
                          placeholder="user-id"
                          className="w-full rounded-lg border border-slate-800 bg-slate-900 px-3 py-2 text-sm text-white focus:border-cyan-500/50 focus:outline-none"
                        />
                      </label>
                    </div>

                    <label className="mt-3 block space-y-2 text-xs text-slate-400">
                      <span>下一关口</span>
                      <input
                        value={draft.nextGateLabel}
                        onChange={(event) => handleStageDraftChange(stage.stageCode, 'nextGateLabel', event.target.value)}
                        placeholder="例如：完成现场踏勘纪要审批"
                        className="w-full rounded-lg border border-slate-800 bg-slate-900 px-3 py-2 text-sm text-white focus:border-cyan-500/50 focus:outline-none"
                      />
                    </label>

                    <div className="mt-3 grid gap-3">
                      <label className="space-y-2 text-xs text-slate-400">
                        <span>阻塞项，每行一条</span>
                        <textarea
                          rows={3}
                          value={draft.blockersText}
                          onChange={(event) => handleStageDraftChange(stage.stageCode, 'blockersText', event.target.value)}
                          className="w-full rounded-lg border border-slate-800 bg-slate-900 px-3 py-2 text-sm text-white focus:border-cyan-500/50 focus:outline-none"
                        />
                      </label>
                      <label className="space-y-2 text-xs text-slate-400">
                        <span>待交接事项，每行一条</span>
                        <textarea
                          rows={3}
                          value={draft.pendingHandoffsText}
                          onChange={(event) => handleStageDraftChange(stage.stageCode, 'pendingHandoffsText', event.target.value)}
                          className="w-full rounded-lg border border-slate-800 bg-slate-900 px-3 py-2 text-sm text-white focus:border-cyan-500/50 focus:outline-none"
                        />
                      </label>
                      <label className="space-y-2 text-xs text-slate-400">
                        <span>协同人，每行一条</span>
                        <textarea
                          rows={3}
                          value={draft.collaboratorUserIdsText}
                          onChange={(event) => handleStageDraftChange(stage.stageCode, 'collaboratorUserIdsText', event.target.value)}
                          className="w-full rounded-lg border border-slate-800 bg-slate-900 px-3 py-2 text-sm text-white focus:border-cyan-500/50 focus:outline-none"
                        />
                      </label>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>

          <section className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5">
            <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
              <div>
                <h3 className="text-sm font-medium text-white">Survey Workspace</h3>
                <p className="mt-1 text-xs text-slate-500">结构化维护信息采集、调研记录、台账、缺口和交接。</p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                {surveyWorkspace && (
                  <span className="rounded-full border border-slate-700 bg-slate-950/70 px-3 py-1 text-[11px] text-slate-300">
                    状态 {surveyWorkspace.completionStatus}
                    {surveyWorkspace.completedAt ? ` · ${new Date(surveyWorkspace.completedAt).toLocaleString('zh-CN')}` : ''}
                  </span>
                )}
                <button
                  onClick={() => void handleSaveSurveyWorkspace()}
                  disabled={savingSurvey || !surveyDraft}
                  className="inline-flex items-center gap-2 rounded-lg border border-slate-700 px-3 py-2 text-xs text-slate-200 transition-colors hover:border-cyan-500/50 hover:text-white disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {savingSurvey ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
                  保存 Survey
                </button>
                <button
                  onClick={() => void handleCompleteSurvey()}
                  disabled={completingSurvey || !surveyDraft}
                  className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-3 py-2 text-xs font-medium text-white transition-colors hover:bg-emerald-500 disabled:cursor-not-allowed disabled:bg-emerald-900/40"
                >
                  {completingSurvey ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <ClipboardCheck className="h-3.5 w-3.5" />}
                  完成 Survey
                </button>
              </div>
            </div>

            {surveyError ? (
              <div className="mb-4 rounded-lg border border-amber-500/20 bg-amber-500/10 px-3 py-3 text-xs text-amber-200">
                Survey Workspace 不可用：{surveyError}
              </div>
            ) : null}

            {surveyDraft && surveyWorkspace ? (
              <div className="space-y-5">
                <div className="rounded-xl border border-slate-800 bg-slate-950/50 p-4">
                  <div className="flex items-center gap-2">
                    <AlertCircle className="h-4 w-4 text-cyan-300" />
                    <h4 className="text-sm font-medium text-white">完成校验</h4>
                  </div>
                  <div className="mt-3 flex flex-wrap items-center gap-2 text-xs">
                    <span className={`rounded-full px-2.5 py-1 ${surveyWorkspace.gateValidation.canComplete ? 'bg-emerald-500/15 text-emerald-300' : 'bg-amber-500/15 text-amber-300'}`}>
                      {surveyWorkspace.gateValidation.canComplete ? '可完成' : '未满足完成条件'}
                    </span>
                    <span className="text-slate-500">错误数 {surveyWorkspace.gateValidation.errors.length}</span>
                  </div>
                  {surveyWorkspace.gateValidation.errors.length > 0 ? (
                    <ul className="mt-3 space-y-2 text-xs text-amber-200">
                      {surveyWorkspace.gateValidation.errors.map((item) => (
                        <li key={item} className="rounded-lg border border-amber-500/20 bg-amber-500/10 px-3 py-2">
                          {item}
                        </li>
                      ))}
                    </ul>
                  ) : null}
                </div>

                <div className="grid gap-4 xl:grid-cols-2">
                  <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-4">
                    <h4 className="text-sm font-medium text-white">信息采集</h4>
                    <div className="mt-4 grid gap-3 md:grid-cols-2">
                      <label className="space-y-2 text-xs text-slate-400">
                        <span>现场联系人</span>
                        <input value={surveyDraft.infoCollection.siteContactName} onChange={(event) => handleSurveyInfoChange('siteContactName', event.target.value)} className="w-full rounded-lg border border-slate-800 bg-slate-900 px-3 py-2 text-sm text-white focus:border-cyan-500/50 focus:outline-none" />
                      </label>
                      <label className="space-y-2 text-xs text-slate-400">
                        <span>联系电话</span>
                        <input value={surveyDraft.infoCollection.siteContactPhone} onChange={(event) => handleSurveyInfoChange('siteContactPhone', event.target.value)} className="w-full rounded-lg border border-slate-800 bg-slate-900 px-3 py-2 text-sm text-white focus:border-cyan-500/50 focus:outline-none" />
                      </label>
                      <label className="space-y-2 text-xs text-slate-400">
                        <span>进场时间窗</span>
                        <input value={surveyDraft.infoCollection.siteAccessWindow} onChange={(event) => handleSurveyInfoChange('siteAccessWindow', event.target.value)} className="w-full rounded-lg border border-slate-800 bg-slate-900 px-3 py-2 text-sm text-white focus:border-cyan-500/50 focus:outline-none" />
                      </label>
                      <label className="space-y-2 text-xs text-slate-400">
                        <span>运行班次</span>
                        <input value={surveyDraft.infoCollection.operatingSchedule} onChange={(event) => handleSurveyInfoChange('operatingSchedule', event.target.value)} className="w-full rounded-lg border border-slate-800 bg-slate-900 px-3 py-2 text-sm text-white focus:border-cyan-500/50 focus:outline-none" />
                      </label>
                      <label className="space-y-2 text-xs text-slate-400">
                        <span>冷却系统类型</span>
                        <input value={surveyDraft.infoCollection.coolingSystemType} onChange={(event) => handleSurveyInfoChange('coolingSystemType', event.target.value)} className="w-full rounded-lg border border-slate-800 bg-slate-900 px-3 py-2 text-sm text-white focus:border-cyan-500/50 focus:outline-none" />
                      </label>
                      <label className="space-y-2 text-xs text-slate-400">
                        <span>供配电条件</span>
                        <input value={surveyDraft.infoCollection.powerAccessStatus} onChange={(event) => handleSurveyInfoChange('powerAccessStatus', event.target.value)} className="w-full rounded-lg border border-slate-800 bg-slate-900 px-3 py-2 text-sm text-white focus:border-cyan-500/50 focus:outline-none" />
                      </label>
                      <label className="space-y-2 text-xs text-slate-400 md:col-span-2">
                        <span>水处理状态</span>
                        <input value={surveyDraft.infoCollection.waterTreatmentStatus} onChange={(event) => handleSurveyInfoChange('waterTreatmentStatus', event.target.value)} className="w-full rounded-lg border border-slate-800 bg-slate-900 px-3 py-2 text-sm text-white focus:border-cyan-500/50 focus:outline-none" />
                      </label>
                      <label className="space-y-2 text-xs text-slate-400 md:col-span-2">
                        <span>备注</span>
                        <textarea rows={3} value={surveyDraft.infoCollection.notes} onChange={(event) => handleSurveyInfoChange('notes', event.target.value)} className="w-full rounded-lg border border-slate-800 bg-slate-900 px-3 py-2 text-sm text-white focus:border-cyan-500/50 focus:outline-none" />
                      </label>
                    </div>
                  </div>

                  <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-4">
                    <h4 className="text-sm font-medium text-white">调研记录</h4>
                    <div className="mt-4 grid gap-3 md:grid-cols-2">
                      <label className="space-y-2 text-xs text-slate-400">
                        <span>调研日期</span>
                        <input type="date" value={surveyDraft.surveyRecord.surveyDate} onChange={(event) => handleSurveyRecordChange('surveyDate', event.target.value)} className="w-full rounded-lg border border-slate-800 bg-slate-900 px-3 py-2 text-sm text-white focus:border-cyan-500/50 focus:outline-none" />
                      </label>
                      <label className="space-y-2 text-xs text-slate-400">
                        <span>调研负责人</span>
                        <input value={surveyDraft.surveyRecord.surveyOwnerUserId} onChange={(event) => handleSurveyRecordChange('surveyOwnerUserId', event.target.value)} className="w-full rounded-lg border border-slate-800 bg-slate-900 px-3 py-2 text-sm text-white focus:border-cyan-500/50 focus:outline-none" />
                      </label>
                      <label className="space-y-2 text-xs text-slate-400 md:col-span-2">
                        <span>参与人，每行一位</span>
                        <textarea rows={3} value={surveyDraft.surveyRecord.participantNamesText} onChange={(event) => handleSurveyRecordChange('participantNamesText', event.target.value)} className="w-full rounded-lg border border-slate-800 bg-slate-900 px-3 py-2 text-sm text-white focus:border-cyan-500/50 focus:outline-none" />
                      </label>
                      <label className="space-y-2 text-xs text-slate-400 md:col-span-2">
                        <span>现场发现</span>
                        <textarea rows={4} value={surveyDraft.surveyRecord.onSiteFindings} onChange={(event) => handleSurveyRecordChange('onSiteFindings', event.target.value)} className="w-full rounded-lg border border-slate-800 bg-slate-900 px-3 py-2 text-sm text-white focus:border-cyan-500/50 focus:outline-none" />
                      </label>
                      <label className="space-y-2 text-xs text-slate-400 md:col-span-2">
                        <span>负荷概况</span>
                        <textarea rows={3} value={surveyDraft.surveyRecord.loadProfileSummary} onChange={(event) => handleSurveyRecordChange('loadProfileSummary', event.target.value)} className="w-full rounded-lg border border-slate-800 bg-slate-900 px-3 py-2 text-sm text-white focus:border-cyan-500/50 focus:outline-none" />
                      </label>
                      <label className="space-y-2 text-xs text-slate-400 md:col-span-2">
                        <span>改造约束</span>
                        <textarea rows={3} value={surveyDraft.surveyRecord.retrofitConstraints} onChange={(event) => handleSurveyRecordChange('retrofitConstraints', event.target.value)} className="w-full rounded-lg border border-slate-800 bg-slate-900 px-3 py-2 text-sm text-white focus:border-cyan-500/50 focus:outline-none" />
                      </label>
                      <label className="space-y-2 text-xs text-slate-400 md:col-span-2">
                        <span>下一步动作</span>
                        <textarea rows={3} value={surveyDraft.surveyRecord.nextActions} onChange={(event) => handleSurveyRecordChange('nextActions', event.target.value)} className="w-full rounded-lg border border-slate-800 bg-slate-900 px-3 py-2 text-sm text-white focus:border-cyan-500/50 focus:outline-none" />
                      </label>
                    </div>
                  </div>
                </div>

                <SurveyCollectionSection
                  title="设备台账"
                  icon={<Database className="h-4 w-4 text-cyan-300" />}
                  actionLabel="新增设备"
                  onAdd={() => setSurveyDraft((prev) => (prev ? { ...prev, equipmentLedger: [...prev.equipmentLedger, createEmptyEquipmentDraftItem()] } : prev))}
                >
                  {surveyDraft.equipmentLedger.map((item, index) => (
                    <div key={item.id ?? `equipment-${index}`} className="rounded-xl border border-slate-800 bg-slate-950/60 p-4">
                      <div className="grid gap-3 md:grid-cols-3">
                        <label className="space-y-2 text-xs text-slate-400"><span>设备名称</span><input value={item.equipmentName} onChange={(event) => handleEquipmentChange(index, 'equipmentName', event.target.value)} className="w-full rounded-lg border border-slate-800 bg-slate-900 px-3 py-2 text-sm text-white focus:border-cyan-500/50 focus:outline-none" /></label>
                        <label className="space-y-2 text-xs text-slate-400"><span>设备类型</span><input value={item.equipmentType} onChange={(event) => handleEquipmentChange(index, 'equipmentType', event.target.value)} className="w-full rounded-lg border border-slate-800 bg-slate-900 px-3 py-2 text-sm text-white focus:border-cyan-500/50 focus:outline-none" /></label>
                        <label className="space-y-2 text-xs text-slate-400"><span>位置</span><input value={item.locationLabel} onChange={(event) => handleEquipmentChange(index, 'locationLabel', event.target.value)} className="w-full rounded-lg border border-slate-800 bg-slate-900 px-3 py-2 text-sm text-white focus:border-cyan-500/50 focus:outline-none" /></label>
                        <label className="space-y-2 text-xs text-slate-400"><span>数量</span><input value={item.quantity} onChange={(event) => handleEquipmentChange(index, 'quantity', event.target.value)} className="w-full rounded-lg border border-slate-800 bg-slate-900 px-3 py-2 text-sm text-white focus:border-cyan-500/50 focus:outline-none" /></label>
                        <label className="space-y-2 text-xs text-slate-400"><span>容量 RT</span><input value={item.capacityRt} onChange={(event) => handleEquipmentChange(index, 'capacityRt', event.target.value)} className="w-full rounded-lg border border-slate-800 bg-slate-900 px-3 py-2 text-sm text-white focus:border-cyan-500/50 focus:outline-none" /></label>
                        <label className="space-y-2 text-xs text-slate-400">
                          <span>状态</span>
                          <select value={item.status} onChange={(event) => handleEquipmentChange(index, 'status', event.target.value as EquipmentLedgerDraftItem['status'])} className="w-full rounded-lg border border-slate-800 bg-slate-900 px-3 py-2 text-sm text-white focus:border-cyan-500/50 focus:outline-none">
                            <option value="unknown">unknown</option>
                            <option value="running">running</option>
                            <option value="standby">standby</option>
                            <option value="offline">offline</option>
                          </select>
                        </label>
                        <label className="space-y-2 text-xs text-slate-400 md:col-span-3"><span>备注</span><textarea rows={2} value={item.notes} onChange={(event) => handleEquipmentChange(index, 'notes', event.target.value)} className="w-full rounded-lg border border-slate-800 bg-slate-900 px-3 py-2 text-sm text-white focus:border-cyan-500/50 focus:outline-none" /></label>
                      </div>
                      <button onClick={() => setSurveyDraft((prev) => (prev ? { ...prev, equipmentLedger: prev.equipmentLedger.filter((_, itemIndex) => itemIndex !== index) } : prev))} className="mt-3 inline-flex items-center gap-1 text-xs text-rose-300 transition hover:text-rose-200"><Trash2 className="h-3.5 w-3.5" /> 删除设备</button>
                    </div>
                  ))}
                </SurveyCollectionSection>

                <SurveyCollectionSection
                  title="缺口 / 风险 / Waiver"
                  icon={<FileWarning className="h-4 w-4 text-amber-300" />}
                  actionLabel="新增条目"
                  onAdd={() => setSurveyDraft((prev) => (prev ? { ...prev, dataGaps: [...prev.dataGaps, createEmptyDataGapDraftItem()] } : prev))}
                >
                  {surveyDraft.dataGaps.map((item, index) => (
                    <div key={item.id ?? `gap-${index}`} className="rounded-xl border border-slate-800 bg-slate-950/60 p-4">
                      <div className="grid gap-3 md:grid-cols-3">
                        <label className="space-y-2 text-xs text-slate-400">
                          <span>类型</span>
                          <select value={item.gapType} onChange={(event) => handleDataGapChange(index, 'gapType', event.target.value as DataGapDraftItem['gapType'])} className="w-full rounded-lg border border-slate-800 bg-slate-900 px-3 py-2 text-sm text-white focus:border-cyan-500/50 focus:outline-none">
                            <option value="missing_info">missing_info</option>
                            <option value="risk">risk</option>
                            <option value="waiver">waiver</option>
                          </select>
                        </label>
                        <label className="space-y-2 text-xs text-slate-400">
                          <span>状态</span>
                          <select value={item.status} onChange={(event) => handleDataGapChange(index, 'status', event.target.value as DataGapDraftItem['status'])} className="w-full rounded-lg border border-slate-800 bg-slate-900 px-3 py-2 text-sm text-white focus:border-cyan-500/50 focus:outline-none">
                            <option value="open">open</option>
                            <option value="resolved">resolved</option>
                            <option value="waived">waived</option>
                          </select>
                        </label>
                        <label className="space-y-2 text-xs text-slate-400"><span>Owner</span><input value={item.ownerUserId} onChange={(event) => handleDataGapChange(index, 'ownerUserId', event.target.value)} className="w-full rounded-lg border border-slate-800 bg-slate-900 px-3 py-2 text-sm text-white focus:border-cyan-500/50 focus:outline-none" /></label>
                        <label className="space-y-2 text-xs text-slate-400 md:col-span-2"><span>标题</span><input value={item.title} onChange={(event) => handleDataGapChange(index, 'title', event.target.value)} className="w-full rounded-lg border border-slate-800 bg-slate-900 px-3 py-2 text-sm text-white focus:border-cyan-500/50 focus:outline-none" /></label>
                        <label className="space-y-2 text-xs text-slate-400"><span>截止日期</span><input type="date" value={item.dueAt} onChange={(event) => handleDataGapChange(index, 'dueAt', event.target.value)} className="w-full rounded-lg border border-slate-800 bg-slate-900 px-3 py-2 text-sm text-white focus:border-cyan-500/50 focus:outline-none" /></label>
                        <label className="space-y-2 text-xs text-slate-400 md:col-span-3"><span>说明</span><textarea rows={3} value={item.detail} onChange={(event) => handleDataGapChange(index, 'detail', event.target.value)} className="w-full rounded-lg border border-slate-800 bg-slate-900 px-3 py-2 text-sm text-white focus:border-cyan-500/50 focus:outline-none" /></label>
                        <label className="space-y-2 text-xs text-slate-400 md:col-span-3"><span>Waiver 原因</span><textarea rows={2} value={item.waiverReason} onChange={(event) => handleDataGapChange(index, 'waiverReason', event.target.value)} className="w-full rounded-lg border border-slate-800 bg-slate-900 px-3 py-2 text-sm text-white focus:border-cyan-500/50 focus:outline-none" /></label>
                      </div>
                      <button onClick={() => setSurveyDraft((prev) => (prev ? { ...prev, dataGaps: prev.dataGaps.filter((_, itemIndex) => itemIndex !== index) } : prev))} className="mt-3 inline-flex items-center gap-1 text-xs text-rose-300 transition hover:text-rose-200"><Trash2 className="h-3.5 w-3.5" /> 删除条目</button>
                    </div>
                  ))}
                </SurveyCollectionSection>

                <SurveyCollectionSection
                  title="交接包"
                  icon={<Handshake className="h-4 w-4 text-emerald-300" />}
                  actionLabel="新增交接"
                  onAdd={() => setSurveyDraft((prev) => (prev ? { ...prev, handoffs: [...prev.handoffs, createEmptyHandoffDraftItem()] } : prev))}
                >
                  {surveyDraft.handoffs.map((item, index) => (
                    <div key={item.id ?? `handoff-${index}`} className="rounded-xl border border-slate-800 bg-slate-950/60 p-4">
                      <div className="grid gap-3 md:grid-cols-3">
                        <label className="space-y-2 text-xs text-slate-400"><span>From</span><select value={item.fromStage} onChange={(event) => handleHandoffChange(index, 'fromStage', event.target.value as HandoffDraftItem['fromStage'])} className="w-full rounded-lg border border-slate-800 bg-slate-900 px-3 py-2 text-sm text-white focus:border-cyan-500/50 focus:outline-none">{Object.entries(SOP_PHASE_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
                        <label className="space-y-2 text-xs text-slate-400"><span>To</span><select value={item.toStage} onChange={(event) => handleHandoffChange(index, 'toStage', event.target.value as HandoffDraftItem['toStage'])} className="w-full rounded-lg border border-slate-800 bg-slate-900 px-3 py-2 text-sm text-white focus:border-cyan-500/50 focus:outline-none">{Object.entries(SOP_PHASE_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
                        <label className="space-y-2 text-xs text-slate-400">
                          <span>状态</span>
                          <select value={item.status} onChange={(event) => handleHandoffChange(index, 'status', event.target.value as HandoffDraftItem['status'])} className="w-full rounded-lg border border-slate-800 bg-slate-900 px-3 py-2 text-sm text-white focus:border-cyan-500/50 focus:outline-none">
                            <option value="pending">pending</option>
                            <option value="ready">ready</option>
                            <option value="completed">completed</option>
                            <option value="waived">waived</option>
                          </select>
                        </label>
                        <label className="space-y-2 text-xs text-slate-400 md:col-span-2"><span>标题</span><input value={item.title} onChange={(event) => handleHandoffChange(index, 'title', event.target.value)} className="w-full rounded-lg border border-slate-800 bg-slate-900 px-3 py-2 text-sm text-white focus:border-cyan-500/50 focus:outline-none" /></label>
                        <label className="space-y-2 text-xs text-slate-400"><span>Owner</span><input value={item.ownerUserId} onChange={(event) => handleHandoffChange(index, 'ownerUserId', event.target.value)} className="w-full rounded-lg border border-slate-800 bg-slate-900 px-3 py-2 text-sm text-white focus:border-cyan-500/50 focus:outline-none" /></label>
                        <label className="space-y-2 text-xs text-slate-400"><span>截止日期</span><input type="date" value={item.dueAt} onChange={(event) => handleHandoffChange(index, 'dueAt', event.target.value)} className="w-full rounded-lg border border-slate-800 bg-slate-900 px-3 py-2 text-sm text-white focus:border-cyan-500/50 focus:outline-none" /></label>
                        <label className="space-y-2 text-xs text-slate-400 md:col-span-3"><span>交接内容</span><textarea rows={3} value={item.detail} onChange={(event) => handleHandoffChange(index, 'detail', event.target.value)} className="w-full rounded-lg border border-slate-800 bg-slate-900 px-3 py-2 text-sm text-white focus:border-cyan-500/50 focus:outline-none" /></label>
                      </div>
                      <button onClick={() => setSurveyDraft((prev) => (prev ? { ...prev, handoffs: prev.handoffs.filter((_, itemIndex) => itemIndex !== index) } : prev))} className="mt-3 inline-flex items-center gap-1 text-xs text-rose-300 transition hover:text-rose-200"><Trash2 className="h-3.5 w-3.5" /> 删除交接</button>
                    </div>
                  ))}
                </SurveyCollectionSection>
              </div>
            ) : null}
          </section>

          <section className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5">
            <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
              <div>
                <h3 className="text-sm font-medium text-white">Solution Center</h3>
                <p className="mt-1 text-xs text-slate-500">在方案阶段维护技术假设、节能测算与版本快照。</p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                {solutionWorkspace && (
                  <span className="rounded-full border border-slate-700 bg-slate-950/70 px-3 py-1 text-[11px] text-slate-300">
                    最近快照 V{solutionWorkspace.lastSnapshotVersion || 0}
                    {solutionWorkspace.lastSnapshotAt ? ` · ${new Date(solutionWorkspace.lastSnapshotAt).toLocaleString('zh-CN')}` : ''}
                  </span>
                )}
                <button
                  onClick={() => void handleSaveSolutionWorkspace()}
                  disabled={savingSolution || !solutionDraft || isSolutionFreezePending}
                  className="inline-flex items-center gap-2 rounded-lg border border-slate-700 px-3 py-2 text-xs text-slate-200 transition-colors hover:border-cyan-500/50 hover:text-white disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {savingSolution ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
                  保存 Solution
                </button>
                <button
                  onClick={() => void handleCreateSolutionSnapshot()}
                  disabled={snapshottingSolution || !solutionDraft || !activeGateValidation.canSnapshot || isSolutionFreezePending}
                  className="inline-flex items-center gap-2 rounded-lg bg-amber-600 px-3 py-2 text-xs font-medium text-white transition-colors hover:bg-amber-500 disabled:cursor-not-allowed disabled:bg-amber-900/40"
                >
                  {snapshottingSolution ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <ClipboardCheck className="h-3.5 w-3.5" />}
                  创建快照
                </button>
              </div>
            </div>

            {solutionError ? (
              <div className="mb-4 rounded-lg border border-amber-500/20 bg-amber-500/10 px-3 py-3 text-xs text-amber-200">
                Solution Center 不可用：{solutionError}
              </div>
            ) : null}

            {solutionDraft && solutionWorkspace ? (
              <div className="space-y-5">
                <div className="grid gap-4 xl:grid-cols-[1.1fr_0.9fr]">
                  <div className="rounded-xl border border-slate-800 bg-slate-950/50 p-4">
                    <div className="flex items-center gap-2">
                      <Zap className="h-4 w-4 text-amber-300" />
                      <h4 className="text-sm font-medium text-white">冻结门槛</h4>
                    </div>
                    <div className="mt-3 flex flex-wrap items-center gap-2 text-xs">
                      <span className={`rounded-full px-2.5 py-1 ${activeGateValidation.canSnapshot ? 'bg-emerald-500/15 text-emerald-300' : 'bg-amber-500/15 text-amber-300'}`}>
                        {activeGateValidation.canSnapshot ? '技术与商业校验均通过' : '仍有待补齐项'}
                      </span>
                      <span className="text-slate-500">总缺口 {activeGateValidation.errors.length}</span>
                      <span className="text-slate-600">基于当前编辑实时预演</span>
                    </div>

                    <div className="mt-4 grid gap-3 md:grid-cols-2">
                      <div className={`rounded-xl border px-3 py-3 ${getSolutionSectionTone(solutionGateBreakdown.technical.length === 0)}`}>
                        <div className="flex items-center justify-between gap-3">
                          <p className="text-xs font-medium">技术门槛</p>
                          <span className="text-[11px]">{solutionGateBreakdown.technical.length === 0 ? '已通过' : `${solutionGateBreakdown.technical.length} 项待补`}</span>
                        </div>
                        {solutionGateBreakdown.technical.length === 0 ? (
                          <p className="mt-2 text-xs text-emerald-200/90">测算输入完整，节能结果可用于冻结。</p>
                        ) : (
                          <ul className="mt-3 space-y-2 text-xs">
                            {solutionGateBreakdown.technical.map((item) => (
                              <li key={item} className="rounded-lg border border-current/10 bg-black/10 px-3 py-2">
                                {item}
                              </li>
                            ))}
                          </ul>
                        )}
                      </div>

                      <div className={`rounded-xl border px-3 py-3 ${getSolutionSectionTone(solutionGateBreakdown.commercial.length === 0)}`}>
                        <div className="flex items-center justify-between gap-3">
                          <p className="text-xs font-medium">商业门槛</p>
                          <span className="text-[11px]">{solutionGateBreakdown.commercial.length === 0 ? '已通过' : `${solutionGateBreakdown.commercial.length} 项待补`}</span>
                        </div>
                        {solutionGateBreakdown.commercial.length === 0 ? (
                          <p className="mt-2 text-xs text-emerald-200/90">分支字段已齐备，商业冻结确认已完成。</p>
                        ) : (
                          <ul className="mt-3 space-y-2 text-xs">
                            {solutionGateBreakdown.commercial.map((item) => (
                              <li key={item} className="rounded-lg border border-current/10 bg-black/10 px-3 py-2">
                                {item}
                              </li>
                            ))}
                          </ul>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-2">
                    {commercialSummaryItems.map((item) => (
                      <MetricCard key={item.label} title={item.label} value={item.value} hint={item.hint} />
                    ))}
                  </div>
                </div>

                <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <h4 className="text-sm font-medium text-white">商业冻结审批</h4>
                      <p className="mt-1 text-xs text-slate-500">提交审批会先保存当前草稿，并生成一版正式快照作为审批底稿。</p>
                      {isSolutionFreezePending ? (
                        <p className="mt-2 text-xs text-amber-300">审批进行中，方案编辑已锁定，避免审批版本漂移。</p>
                      ) : null}
                    </div>
                    <div className="flex flex-wrap items-center gap-2 text-xs">
                      <span className={`rounded-full px-2.5 py-1 ${
                        activeFreezeApproval.status === 'approved'
                          ? 'bg-emerald-500/15 text-emerald-300'
                          : activeFreezeApproval.status === 'rejected'
                            ? 'bg-rose-500/15 text-rose-300'
                            : activeFreezeApproval.status === 'pending_approval'
                              ? 'bg-amber-500/15 text-amber-300'
                              : 'bg-slate-800 text-slate-300'
                      }`}>
                        {SOLUTION_FREEZE_STATUS_LABELS[activeFreezeApproval.status]}
                      </span>
                      <span className="text-slate-500">审批人 {proposalStage?.approverUserId || '未设置'}</span>
                    </div>
                  </div>

                  <div className="mt-4 grid gap-3 md:grid-cols-4">
                    <MetricCard title="冻结状态" value={SOLUTION_FREEZE_STATUS_LABELS[activeFreezeApproval.status]} hint="proposal 阶段商业冻结流转" />
                    <MetricCard title="申请版本" value={activeFreezeApproval.requestedSnapshotVersion ? `V${activeFreezeApproval.requestedSnapshotVersion}` : '尚未提交'} hint="审批基于该版本快照" />
                    <MetricCard title="申请时间" value={activeFreezeApproval.requestedAt ? new Date(activeFreezeApproval.requestedAt).toLocaleString('zh-CN') : '尚未提交'} hint="最近一次提交审批时间" />
                    <MetricCard title="审批结果" value={activeFreezeApproval.decidedAt ? `${SOLUTION_FREEZE_STATUS_LABELS[activeFreezeApproval.status]} · ${new Date(activeFreezeApproval.decidedAt).toLocaleString('zh-CN')}` : '待审批结果'} hint={activeFreezeApproval.decisionComment || '批准后 proposal 阶段可结束'} />
                  </div>

                  <div className="mt-4 flex flex-wrap items-center gap-2">
                    <button
                      onClick={() => void handleRequestSolutionFreeze()}
                      disabled={
                        requestingSolutionFreeze
                        || savingSolution
                        || !solutionDraft
                        || !activeGateValidation.canSnapshot
                        || activeFreezeApproval.status === 'pending_approval'
                      }
                      className="inline-flex items-center gap-2 rounded-lg bg-cyan-600 px-3 py-2 text-xs font-medium text-white transition-colors hover:bg-cyan-500 disabled:cursor-not-allowed disabled:bg-cyan-900/40"
                    >
                      {requestingSolutionFreeze ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <ClipboardCheck className="h-3.5 w-3.5" />}
                      提交冻结审批
                    </button>
                    <button
                      onClick={() => void handleDecideSolutionFreeze('approve')}
                      disabled={decidingSolutionFreeze || !isSolutionFreezePending || !isCurrentProposalApprover}
                      className="inline-flex items-center gap-2 rounded-lg border border-emerald-500/30 px-3 py-2 text-xs text-emerald-200 transition-colors hover:border-emerald-400/60 hover:text-emerald-100 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {decidingSolutionFreeze ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
                      批准冻结
                    </button>
                    <button
                      onClick={() => void handleDecideSolutionFreeze('reject')}
                      disabled={decidingSolutionFreeze || !isSolutionFreezePending || !isCurrentProposalApprover}
                      className="inline-flex items-center gap-2 rounded-lg border border-rose-500/30 px-3 py-2 text-xs text-rose-200 transition-colors hover:border-rose-400/60 hover:text-rose-100 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {decidingSolutionFreeze ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
                      驳回冻结
                    </button>
                    {!proposalStage?.approverUserId ? (
                      <span className="text-xs text-amber-300">先在 proposal 阶段填写审批人，才能提交冻结审批。</span>
                    ) : null}
                    {isSolutionFreezePending && proposalStage?.approverUserId && !isCurrentProposalApprover ? (
                      <span className="text-xs text-slate-400">仅 proposal 审批人可执行批准或驳回。</span>
                    ) : null}
                  </div>
                </div>

                <fieldset disabled={isSolutionFreezePending} className="space-y-5 disabled:opacity-70">
                  <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-4">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <h4 className="text-sm font-medium text-white">商业分支</h4>
                        <p className="mt-1 text-xs text-slate-500">先确定当前方案走 EPC 还是 EMC，再补齐分支字段。</p>
                      </div>
                      <div className="flex items-center gap-2">
                        {(['epc', 'emc'] as ProjectCommercialBranchType[]).map((branch) => (
                          <button
                            key={branch}
                            type="button"
                            onClick={() => handleSolutionBranchTypeChange(branch)}
                            className={`rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${
                              solutionDraft.commercialBranching.branchType === branch
                                ? 'bg-cyan-600 text-white'
                                : 'border border-slate-700 bg-slate-900 text-slate-300 hover:border-cyan-500/50 hover:text-white'
                            }`}
                          >
                            {COMMERCIAL_BRANCH_LABELS[branch]}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="mt-4 grid gap-3 md:grid-cols-2">
                      <label className="space-y-2 text-xs text-slate-400">
                        <span>分支决策说明</span>
                        <textarea
                          value={solutionDraft.commercialBranching.branchDecisionNote}
                          onChange={(event) => handleSolutionBranchNoteChange(event.target.value)}
                          className="min-h-[88px] w-full rounded-lg border border-slate-800 bg-slate-900 px-3 py-2 text-sm text-white focus:border-cyan-500/50 focus:outline-none"
                          placeholder="记录为什么选 EPC 或 EMC，以及当前商务判断"
                        />
                      </label>
                      <label className="flex items-start gap-3 rounded-lg border border-slate-800 bg-slate-900/70 px-3 py-3 text-xs text-slate-300">
                        <input
                          type="checkbox"
                          checked={solutionDraft.commercialBranching.freezeReady}
                          onChange={(event) => handleSolutionFreezeReadyChange(event.target.checked)}
                          className="mt-0.5 h-4 w-4 rounded border-slate-700 bg-slate-950 text-cyan-500"
                        />
                        <span>
                          当前商业分支字段已确认，可以进入快照冻结前校验。
                        </span>
                      </label>
                    </div>

                    {solutionDraft.commercialBranching.branchType === 'epc' ? (
                      <div className="mt-4 grid gap-3 md:grid-cols-3">
                        <label className="space-y-2 text-xs text-slate-400">
                          <span>设备投资额</span>
                          <input value={solutionDraft.commercialBranching.epc.capexCny} onChange={(event) => handleSolutionEpcDraftChange('capexCny', event.target.value)} className="w-full rounded-lg border border-slate-800 bg-slate-900 px-3 py-2 text-sm text-white focus:border-cyan-500/50 focus:outline-none" />
                        </label>
                        <label className="space-y-2 text-xs text-slate-400">
                          <span>目标毛利率</span>
                          <input value={solutionDraft.commercialBranching.epc.grossMarginRate} onChange={(event) => handleSolutionEpcDraftChange('grossMarginRate', event.target.value)} className="w-full rounded-lg border border-slate-800 bg-slate-900 px-3 py-2 text-sm text-white focus:border-cyan-500/50 focus:outline-none" />
                        </label>
                        <label className="space-y-2 text-xs text-slate-400">
                          <span>交付周期(月)</span>
                          <input value={solutionDraft.commercialBranching.epc.deliveryMonths} onChange={(event) => handleSolutionEpcDraftChange('deliveryMonths', event.target.value)} className="w-full rounded-lg border border-slate-800 bg-slate-900 px-3 py-2 text-sm text-white focus:border-cyan-500/50 focus:outline-none" />
                        </label>
                      </div>
                    ) : null}

                    {solutionDraft.commercialBranching.branchType === 'emc' ? (
                      <div className="mt-4 grid gap-3 md:grid-cols-3">
                        <label className="space-y-2 text-xs text-slate-400">
                          <span>收益分成比例</span>
                          <input value={solutionDraft.commercialBranching.emc.sharedSavingRate} onChange={(event) => handleSolutionEmcDraftChange('sharedSavingRate', event.target.value)} className="w-full rounded-lg border border-slate-800 bg-slate-900 px-3 py-2 text-sm text-white focus:border-cyan-500/50 focus:outline-none" />
                        </label>
                        <label className="space-y-2 text-xs text-slate-400">
                          <span>合同年限</span>
                          <input value={solutionDraft.commercialBranching.emc.contractYears} onChange={(event) => handleSolutionEmcDraftChange('contractYears', event.target.value)} className="w-full rounded-lg border border-slate-800 bg-slate-900 px-3 py-2 text-sm text-white focus:border-cyan-500/50 focus:outline-none" />
                        </label>
                        <label className="space-y-2 text-xs text-slate-400">
                          <span>保底节能率</span>
                          <input value={solutionDraft.commercialBranching.emc.guaranteedSavingRate} onChange={(event) => handleSolutionEmcDraftChange('guaranteedSavingRate', event.target.value)} className="w-full rounded-lg border border-slate-800 bg-slate-900 px-3 py-2 text-sm text-white focus:border-cyan-500/50 focus:outline-none" />
                        </label>
                      </div>
                    ) : null}
                  </div>

                  <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-4">
                    <h4 className="text-sm font-medium text-white">技术假设</h4>
                    <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                      <label className="space-y-2 text-xs text-slate-400">
                        <span>基线负荷 RT</span>
                        <input value={solutionDraft.technicalAssumptions.baselineLoadRt} onChange={(event) => handleSolutionDraftChange('baselineLoadRt', event.target.value)} className="w-full rounded-lg border border-slate-800 bg-slate-900 px-3 py-2 text-sm text-white focus:border-cyan-500/50 focus:outline-none" />
                      </label>
                      <label className="space-y-2 text-xs text-slate-400">
                        <span>目标负荷 RT</span>
                        <input value={solutionDraft.technicalAssumptions.targetLoadRt} onChange={(event) => handleSolutionDraftChange('targetLoadRt', event.target.value)} className="w-full rounded-lg border border-slate-800 bg-slate-900 px-3 py-2 text-sm text-white focus:border-cyan-500/50 focus:outline-none" />
                      </label>
                      <label className="space-y-2 text-xs text-slate-400">
                        <span>年运行小时</span>
                        <input value={solutionDraft.technicalAssumptions.operatingHoursPerYear} onChange={(event) => handleSolutionDraftChange('operatingHoursPerYear', event.target.value)} className="w-full rounded-lg border border-slate-800 bg-slate-900 px-3 py-2 text-sm text-white focus:border-cyan-500/50 focus:outline-none" />
                      </label>
                      <label className="space-y-2 text-xs text-slate-400">
                        <span>电价 元/kWh</span>
                        <input value={solutionDraft.technicalAssumptions.electricityPricePerKwh} onChange={(event) => handleSolutionDraftChange('electricityPricePerKwh', event.target.value)} className="w-full rounded-lg border border-slate-800 bg-slate-900 px-3 py-2 text-sm text-white focus:border-cyan-500/50 focus:outline-none" />
                      </label>
                      <label className="space-y-2 text-xs text-slate-400">
                        <span>基线 COP</span>
                        <input value={solutionDraft.technicalAssumptions.baselineCop} onChange={(event) => handleSolutionDraftChange('baselineCop', event.target.value)} className="w-full rounded-lg border border-slate-800 bg-slate-900 px-3 py-2 text-sm text-white focus:border-cyan-500/50 focus:outline-none" />
                      </label>
                      <label className="space-y-2 text-xs text-slate-400">
                        <span>目标 COP</span>
                        <input value={solutionDraft.technicalAssumptions.targetCop} onChange={(event) => handleSolutionDraftChange('targetCop', event.target.value)} className="w-full rounded-lg border border-slate-800 bg-slate-900 px-3 py-2 text-sm text-white focus:border-cyan-500/50 focus:outline-none" />
                      </label>
                      <label className="space-y-2 text-xs text-slate-400">
                        <span>系统损耗系数</span>
                        <input value={solutionDraft.technicalAssumptions.systemLossFactor} onChange={(event) => handleSolutionDraftChange('systemLossFactor', event.target.value)} className="w-full rounded-lg border border-slate-800 bg-slate-900 px-3 py-2 text-sm text-white focus:border-cyan-500/50 focus:outline-none" />
                      </label>
                      <div className="rounded-lg border border-slate-800 bg-slate-900/70 px-3 py-3 text-xs text-slate-400">
                        <p>快照版本：V{solutionWorkspace.lastSnapshotVersion || 0}</p>
                        <p className="mt-2">最近时间：{solutionWorkspace.lastSnapshotAt ? new Date(solutionWorkspace.lastSnapshotAt).toLocaleString('zh-CN') : '尚未创建'}</p>
                      </div>
                    </div>
                  </div>
                </fieldset>

                <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                  <MetricCard title="基线年耗电" value={`${activeCalculationSummary.baselineAnnualEnergyKwh.toLocaleString('zh-CN')} kWh`} />
                  <MetricCard title="目标年耗电" value={`${activeCalculationSummary.targetAnnualEnergyKwh.toLocaleString('zh-CN')} kWh`} />
                  <MetricCard title="年节电量" value={`${activeCalculationSummary.annualPowerSavingKwh.toLocaleString('zh-CN')} kWh`} />
                  <MetricCard title="年节约电费" value={`${activeCalculationSummary.annualCostSavingCny.toLocaleString('zh-CN')} 元`} />
                </div>

                <div className="rounded-xl border border-slate-800 bg-slate-950/50 p-4">
                  <div className="mb-3 flex items-center justify-between gap-3">
                    <h4 className="text-sm font-medium text-white">快照历史</h4>
                    <span className="text-xs text-slate-500">共 {solutionSnapshots.length} 条</span>
                  </div>
                  {solutionSnapshots.length === 0 ? (
                    <div className="rounded-lg border border-slate-800 bg-slate-900/70 px-3 py-4 text-sm text-slate-500">
                      暂无 Solution 快照
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {solutionSnapshots.map((snapshot) => (
                        <div key={snapshot.id} className="rounded-lg border border-slate-800 bg-slate-900/70 px-3 py-3">
                          <div className="flex flex-wrap items-center gap-3 text-xs text-slate-500">
                            <span className="rounded-full bg-slate-800 px-2 py-0.5 text-[10px] text-slate-300">V{snapshot.versionNo}</span>
                            <span>{snapshot.stageCode}</span>
                            {typeof (snapshot.snapshotPayload as { commercialBranching?: { branchType?: string } }).commercialBranching?.branchType === 'string' ? (
                              <span className="rounded-full border border-cyan-500/20 bg-cyan-500/10 px-2 py-0.5 text-[10px] text-cyan-300">
                                {(snapshot.snapshotPayload as { commercialBranching?: { branchType?: string } }).commercialBranching?.branchType?.toUpperCase()}
                              </span>
                            ) : null}
                            <span>{new Date(snapshot.createdAt).toLocaleString('zh-CN')}</span>
                            <span>actor {snapshot.createdBy || 'unknown'}</span>
                          </div>
                          <p className="mt-2 text-sm text-slate-200">
                            年节约电费 {snapshot.calculationSummary.annualCostSavingCny.toLocaleString('zh-CN')} 元 · 节电量 {snapshot.calculationSummary.annualPowerSavingKwh.toLocaleString('zh-CN')} kWh
                          </p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ) : null}
          </section>

          <section className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5">
            <div className="mb-4 flex items-center gap-2">
              <ClipboardList className="h-4 w-4 text-slate-400" />
              <div>
                <h3 className="text-sm font-medium text-white">审计日志</h3>
                <p className="mt-1 text-xs text-slate-500">项目和阶段写操作的最近记录</p>
              </div>
            </div>

            {auditError ? (
              <div className="rounded-lg border border-amber-500/20 bg-amber-500/10 px-3 py-3 text-xs text-amber-200">
                审计日志暂不可用：{auditError}
              </div>
            ) : auditLogs.length === 0 ? (
              <div className="rounded-lg border border-slate-800 bg-slate-950/50 px-3 py-4 text-sm text-slate-500">
                暂无审计记录
              </div>
            ) : (
              <div className="space-y-2">
                {auditLogs.map((log) => (
                  <div key={log.id} className="rounded-lg border border-slate-800 bg-slate-950/50 px-3 py-3">
                    <div className="flex flex-wrap items-center gap-3 text-xs text-slate-500">
                      <span className="rounded-full bg-slate-800 px-2 py-0.5 text-[10px] text-slate-300">
                        {log.action}
                      </span>
                      <span>{new Date(log.createdAt).toLocaleString('zh-CN')}</span>
                      <span>actor {log.actorUserId || log.actorSource}</span>
                    </div>
                    <p className="mt-2 text-sm text-slate-200">{formatAuditPayload(log.payload)}</p>
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>
      )}
    </div>
  );
}

function SurveyCollectionSection({
  title,
  icon,
  actionLabel,
  onAdd,
  children,
}: {
  title: string;
  icon: ReactNode;
  actionLabel: string;
  onAdd: () => void;
  children: ReactNode;
}) {
  return (
    <div className="rounded-xl border border-slate-800 bg-slate-950/50 p-4">
      <div className="mb-4 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          {icon}
          <h4 className="text-sm font-medium text-white">{title}</h4>
        </div>
        <button
          onClick={onAdd}
          className="inline-flex items-center gap-1 rounded-lg border border-slate-700 px-3 py-1.5 text-xs text-slate-300 transition hover:border-cyan-500/50 hover:text-white"
        >
          <Plus className="h-3.5 w-3.5" />
          {actionLabel}
        </button>
      </div>
      <div className="space-y-3">{children}</div>
    </div>
  );
}

function MetricCard({ title, value, hint }: { title: string; value: string; hint?: string }) {
  return (
    <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-4">
      <p className="text-xs text-slate-500">{title}</p>
      <p className="mt-2 text-lg font-semibold text-white">{value}</p>
      {hint ? <p className="mt-2 text-[11px] text-slate-500">{hint}</p> : null}
    </div>
  );
}

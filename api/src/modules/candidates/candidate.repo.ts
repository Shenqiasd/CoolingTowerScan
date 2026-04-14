import type { SupabaseClient } from '@supabase/supabase-js';

import type {
  CandidateMaterializationResult,
  CandidateDetail,
  CandidateDedupeInput,
  CandidateDuplicateItem,
  CandidateDuplicateReason,
  CandidateEvidence,
  CandidateListFilters,
  CandidateListItem,
  CandidateRepo,
  CandidateReviewAction,
  CandidateStatus,
} from './candidate.schemas.js';

type CandidateRow = {
  id: string;
  candidate_code: string;
  status: CandidateStatus;
  matched_enterprise_name: string | null;
  matched_address: string | null;
  cooling_tower_count: number | null;
  confidence_score: number | null;
  created_at: string;
  updated_at?: string | null;
  site_id?: string | null;
  enterprise_id?: string | null;
  scan_session_id?: string | null;
  review_note?: string | null;
  rejection_reason?: string | null;
  hvac_estimate_snapshot?: Record<string, unknown> | null;
  source_payload?: Record<string, unknown> | null;
  reviewed_by?: string | null;
  scan_candidate_evidences?: CandidateEvidenceRow[] | null;
};

type CandidateEvidenceRow = {
  id: string;
  kind: string;
  screenshot_id: string | null;
  detection_result_id: string | null;
  sort_order: number | null;
  metadata: Record<string, unknown> | null;
};

type SessionScreenshotRow = {
  id: string;
  session_id: string;
  enterprise_id: string | null;
  address_label: string | null;
  resolved_address: string | null;
  tower_count: number | null;
  max_confidence: number | null;
};

type SessionDetectionRow = {
  id: string;
  screenshot_id: string | null;
  confidence: number | null;
  bbox_area: number | null;
};

type EnterpriseLookupRow = {
  id: string;
  enterprise_name: string | null;
  address: string | null;
};

type AuditLogInsert = {
  entity_type: string;
  entity_id: string;
  action: string;
  actor_user_id: string | null;
  actor_source: string;
  payload: Record<string, unknown>;
};

function mapCandidateListItem(row: CandidateRow): CandidateListItem {
  return {
    id: row.id,
    candidateCode: row.candidate_code,
    status: row.status,
    matchedEnterpriseName: row.matched_enterprise_name ?? '',
    matchedAddress: row.matched_address ?? '',
    coolingTowerCount: row.cooling_tower_count ?? 0,
    confidenceScore: row.confidence_score ?? 0,
    createdAt: row.created_at,
  };
}

function mapEvidence(row: CandidateEvidenceRow): CandidateEvidence {
  return {
    id: row.id,
    kind: row.kind,
    screenshotId: row.screenshot_id,
    detectionResultId: row.detection_result_id,
    sortOrder: row.sort_order ?? 0,
    metadata: row.metadata ?? {},
  };
}

function mapCandidateDetail(row: CandidateRow): CandidateDetail {
  return {
    ...mapCandidateListItem(row),
    siteId: row.site_id ?? null,
    enterpriseId: row.enterprise_id ?? null,
    scanSessionId: row.scan_session_id ?? null,
    reviewNote: row.review_note ?? '',
    rejectionReason: row.rejection_reason ?? '',
    hvacEstimateSnapshot: row.hvac_estimate_snapshot ?? {},
    sourcePayload: row.source_payload ?? {},
    evidences: (row.scan_candidate_evidences ?? []).map(mapEvidence),
    updatedAt: row.updated_at ?? row.created_at,
    ...(row.reviewed_by ? { lastReviewedBy: row.reviewed_by } : {}),
  };
}

function mapCandidateDuplicateItem(
  row: CandidateRow,
  duplicateReasons: CandidateDuplicateReason[],
): CandidateDuplicateItem {
  return {
    ...mapCandidateListItem(row),
    siteId: row.site_id ?? null,
    enterpriseId: row.enterprise_id ?? null,
    updatedAt: row.updated_at ?? row.created_at,
    duplicateReasons,
  };
}

function actionToStatus(action: CandidateReviewAction): CandidateStatus {
  switch (action) {
    case 'approve':
      return 'approved';
    case 'reject':
      return 'rejected';
    case 'needs_info':
      return 'needs_info';
  }
}

function buildCandidateCode(sessionId: string, enterpriseId: string): string {
  return `SC-${sessionId.slice(0, 8)}-${enterpriseId.slice(0, 8)}`;
}

function uniqueStrings(values: Array<string | null | undefined>): string[] {
  return [...new Set(values.filter((value): value is string => typeof value === 'string' && value.length > 0))];
}

function normalizeText(value: string | null | undefined): string {
  return (value ?? '')
    .toLowerCase()
    .replace(/[\s\-_,.;:()（）]/g, '')
    .trim();
}

function hasAddressSimilarity(source: string, target: string): boolean {
  if (!source || !target) {
    return false;
  }

  return source === target
    || source.includes(target)
    || target.includes(source);
}

function getDuplicateReasons(source: CandidateRow, target: CandidateRow): CandidateDuplicateReason[] {
  const reasons: CandidateDuplicateReason[] = [];

  if (source.enterprise_id && target.enterprise_id && source.enterprise_id === target.enterprise_id) {
    reasons.push('enterprise_id');
  }

  if (source.site_id && target.site_id && source.site_id === target.site_id) {
    reasons.push('site_id');
  }

  const sourceName = normalizeText(source.matched_enterprise_name);
  const targetName = normalizeText(target.matched_enterprise_name);
  if (sourceName && sourceName === targetName) {
    reasons.push('enterprise_name');
  }

  const sourceAddress = normalizeText(source.matched_address);
  const targetAddress = normalizeText(target.matched_address);
  if (hasAddressSimilarity(sourceAddress, targetAddress)) {
    reasons.push('address_similarity');
  }

  return reasons;
}

async function insertAuditLogs(supabaseAdmin: SupabaseClient, rows: AuditLogInsert[]) {
  if (rows.length === 0) {
    return;
  }

  const { error } = await supabaseAdmin
    .from('workflow_audit_logs')
    .insert(rows);

  if (error) {
    throw error;
  }
}

export function createCandidateRepo(supabaseAdmin: SupabaseClient): CandidateRepo {
  return {
    async listCandidates(filters: CandidateListFilters) {
      let query = supabaseAdmin
        .from('scan_candidates')
        .select(
          'id, candidate_code, status, matched_enterprise_name, matched_address, cooling_tower_count, confidence_score, created_at',
        )
        .order('created_at', { ascending: false });

      if (filters.status) {
        query = query.eq('status', filters.status);
      }

      if (filters.search) {
        const escaped = filters.search.replace(/[%_]/g, '');
        query = query.or(
          `candidate_code.ilike.%${escaped}%,matched_enterprise_name.ilike.%${escaped}%,matched_address.ilike.%${escaped}%`,
        );
      }

      const { data, error } = await query;
      if (error) {
        throw error;
      }

      return (data ?? []).map((row) => mapCandidateListItem(row as CandidateRow));
    },

    async getCandidateById(candidateId: string) {
      const { data, error } = await supabaseAdmin
        .from('scan_candidates')
        .select(`
          id,
          candidate_code,
          status,
          matched_enterprise_name,
          matched_address,
          cooling_tower_count,
          confidence_score,
          created_at,
          updated_at,
          site_id,
          enterprise_id,
          scan_session_id,
          review_note,
          rejection_reason,
          hvac_estimate_snapshot,
          source_payload,
          reviewed_by,
          scan_candidate_evidences (
            id,
            kind,
            screenshot_id,
            detection_result_id,
            sort_order,
            metadata
          )
        `)
        .eq('id', candidateId)
        .maybeSingle();

      if (error) {
        throw error;
      }

      return data ? mapCandidateDetail(data as CandidateRow) : null;
    },

    async listDuplicateCandidates(candidateId: string) {
      const source = await this.getCandidateById(candidateId);
      if (!source) {
        return [];
      }

      const sourceRow: CandidateRow = {
        id: source.id,
        candidate_code: source.candidateCode,
        status: source.status,
        matched_enterprise_name: source.matchedEnterpriseName,
        matched_address: source.matchedAddress,
        cooling_tower_count: source.coolingTowerCount,
        confidence_score: source.confidenceScore,
        created_at: source.createdAt,
        updated_at: source.updatedAt,
        site_id: source.siteId,
        enterprise_id: source.enterpriseId,
      };

      let query = supabaseAdmin
        .from('scan_candidates')
        .select(`
          id,
          candidate_code,
          status,
          matched_enterprise_name,
          matched_address,
          cooling_tower_count,
          confidence_score,
          created_at,
          updated_at,
          site_id,
          enterprise_id
        `)
        .neq('id', candidateId)
        .order('created_at', { ascending: false });

      const enterpriseName = source.matchedEnterpriseName.replace(/[%_]/g, '').trim();
      const matchedAddress = source.matchedAddress.replace(/[%_]/g, '').trim();
      const filters: string[] = [];

      if (source.enterpriseId) {
        filters.push(`enterprise_id.eq.${source.enterpriseId}`);
      }

      if (source.siteId) {
        filters.push(`site_id.eq.${source.siteId}`);
      }

      if (enterpriseName) {
        filters.push(`matched_enterprise_name.ilike.%${enterpriseName}%`);
      }

      if (matchedAddress) {
        filters.push(`matched_address.ilike.%${matchedAddress}%`);
      }

      if (filters.length > 0) {
        query = query.or(filters.join(','));
      }

      const { data, error } = await query;
      if (error) {
        throw error;
      }

      return (data ?? [])
        .map((row) => row as CandidateRow)
        .map((row) => ({
          row,
          reasons: getDuplicateReasons(sourceRow, row),
        }))
        .filter((item) => item.reasons.length > 0)
        .map((item) => mapCandidateDuplicateItem(item.row, item.reasons));
    },

    async reviewCandidate(candidateId, action, note, actorUserId) {
      const previous = await this.getCandidateById(candidateId);
      if (!previous) {
        return null;
      }

      const nextStatus = actionToStatus(action);
      const { error } = await supabaseAdmin
        .from('scan_candidates')
        .update({
          status: nextStatus,
          review_note: note,
          rejection_reason: action === 'reject' ? note : '',
          reviewed_by: actorUserId,
          reviewed_at: new Date().toISOString(),
        })
        .eq('id', candidateId);

      if (error) {
        throw error;
      }

      const nextItem = await this.getCandidateById(candidateId);
      if (!nextItem) {
        return null;
      }

      await insertAuditLogs(supabaseAdmin, [
        {
          entity_type: 'scan_candidate',
          entity_id: candidateId,
          action: 'candidate.reviewed',
          actor_user_id: actorUserId,
          actor_source: 'api',
          payload: {
            action,
            previousStatus: previous.status,
            nextStatus,
            note,
          },
        },
      ]);

      return nextItem;
    },

    async dedupeCandidate(candidateId, input: CandidateDedupeInput, actorUserId: string) {
      const source = await this.getCandidateById(candidateId);
      const target = await this.getCandidateById(input.targetCandidateId);
      if (!source || !target) {
        return null;
      }

      const dedupeAt = new Date().toISOString();
      const mergedPayload = {
        ...source.sourcePayload,
        dedupe: {
          targetCandidateId: target.id,
          targetCandidateCode: target.candidateCode,
          dedupedAt: dedupeAt,
          dedupedBy: actorUserId,
          note: input.note,
        },
        duplicateOfCandidateId: target.id,
      };

      const { error } = await supabaseAdmin
        .from('scan_candidates')
        .update({
          status: 'rejected',
          review_note: input.note,
          rejection_reason: `duplicate_of:${target.id}`,
          source_payload: mergedPayload,
          reviewed_by: actorUserId,
          reviewed_at: dedupeAt,
        })
        .eq('id', candidateId);

      if (error) {
        throw error;
      }

      const nextItem = await this.getCandidateById(candidateId);
      if (!nextItem) {
        return null;
      }

      await insertAuditLogs(supabaseAdmin, [
        {
          entity_type: 'scan_candidate',
          entity_id: candidateId,
          action: 'candidate.deduped',
          actor_user_id: actorUserId,
          actor_source: 'api',
          payload: {
            sourceCandidateId: source.id,
            sourceCandidateCode: source.candidateCode,
            targetCandidateId: target.id,
            targetCandidateCode: target.candidateCode,
            note: input.note,
          },
        },
      ]);

      return nextItem;
    },

    async materializeFromScanSession(sessionId, actorUserId): Promise<CandidateMaterializationResult> {
      const { data: screenshotData, error: screenshotError } = await supabaseAdmin
        .from('scan_screenshots')
        .select(
          'id, session_id, enterprise_id, address_label, resolved_address, tower_count, max_confidence',
        )
        .eq('session_id', sessionId)
        .not('enterprise_id', 'is', null);

      if (screenshotError) {
        throw screenshotError;
      }

      const screenshots = (screenshotData ?? []) as SessionScreenshotRow[];
      if (screenshots.length === 0) {
        return {
          sessionId,
          actorUserId,
          candidateCount: 0,
          evidenceCount: 0,
        };
      }

      const screenshotIds = uniqueStrings(screenshots.map((row) => row.id));
      const enterpriseIds = uniqueStrings(screenshots.map((row) => row.enterprise_id));

      const [detectionResult, enterpriseResult] = await Promise.all([
        supabaseAdmin
          .from('detection_results')
          .select('id, screenshot_id, confidence, bbox_area')
          .in('screenshot_id', screenshotIds),
        supabaseAdmin
          .from('enterprises')
          .select('id, enterprise_name, address')
          .in('id', enterpriseIds),
      ]);

      if (detectionResult.error) {
        throw detectionResult.error;
      }

      if (enterpriseResult.error) {
        throw enterpriseResult.error;
      }

      const detections = (detectionResult.data ?? []) as SessionDetectionRow[];
      const enterpriseLookup = new Map(
        ((enterpriseResult.data ?? []) as EnterpriseLookupRow[]).map((row) => [row.id, row]),
      );

      const groups = new Map<string, SessionScreenshotRow[]>();
      for (const screenshot of screenshots) {
        if (!screenshot.enterprise_id) {
          continue;
        }

        const key = `${sessionId}:${screenshot.enterprise_id}`;
        const current = groups.get(key) ?? [];
        current.push(screenshot);
        groups.set(key, current);
      }

      const candidateRows = Array.from(groups.entries()).map(([groupKey, groupScreenshots]) => {
        const enterpriseId = groupScreenshots[0].enterprise_id as string;
        const screenshotIdSet = new Set(groupScreenshots.map((row) => row.id));
        const groupDetections = detections.filter((row) => row.screenshot_id && screenshotIdSet.has(row.screenshot_id));
        const enterprise = enterpriseLookup.get(enterpriseId);
        const confidenceScore = Math.max(
          0,
          ...groupScreenshots.map((row) => row.max_confidence ?? 0),
          ...groupDetections.map((row) => row.confidence ?? 0),
        );
        const totalTowerBboxAreaPx = groupDetections.reduce((sum, row) => sum + (row.bbox_area ?? 0), 0);
        const coolingTowerCount = groupDetections.length > 0
          ? groupDetections.length
          : groupScreenshots.reduce((sum, row) => sum + (row.tower_count ?? 0), 0);
        const primaryScreenshot = groupScreenshots[0];

        return {
          candidate_code: buildCandidateCode(sessionId, enterpriseId),
          scan_session_id: sessionId,
          enterprise_id: enterpriseId,
          site_id: null,
          status: 'new' as const,
          source_type: 'cooling_tower_scan' as const,
          source_label: 'scan_session_materialization',
          matched_enterprise_name: enterprise?.enterprise_name ?? '',
          matched_address: enterprise?.address ?? primaryScreenshot.resolved_address ?? primaryScreenshot.address_label ?? '',
          cooling_tower_count: coolingTowerCount,
          total_tower_bbox_area_px: totalTowerBboxAreaPx,
          estimated_capacity_rt: 0,
          estimated_cooling_station_power_kw: 0,
          confidence_score: confidenceScore,
          review_note: '',
          rejection_reason: '',
          source_payload: {
            groupKey,
            screenshotCount: groupScreenshots.length,
            screenshotIds: groupScreenshots.map((row) => row.id),
            detectionCount: groupDetections.length,
          },
          hvac_estimate_snapshot: {},
          created_by: actorUserId,
        };
      });

      const { data: candidateData, error: candidateError } = await supabaseAdmin
        .from('scan_candidates')
        .upsert(candidateRows, { onConflict: 'candidate_code' })
        .select('id, enterprise_id');

      if (candidateError) {
        throw candidateError;
      }

      const candidates = (candidateData ?? []) as Array<{ id: string; enterprise_id: string | null }>;
      const candidateByEnterpriseId = new Map(
        candidates
          .filter((row): row is { id: string; enterprise_id: string } => Boolean(row.enterprise_id))
          .map((row) => [row.enterprise_id, row.id]),
      );

      const candidateIds = uniqueStrings(candidates.map((row) => row.id));
      if (candidateIds.length > 0) {
        const { error } = await supabaseAdmin
          .from('scan_candidate_evidences')
          .delete()
          .in('candidate_id', candidateIds);

        if (error) {
          throw error;
        }
      }

      const evidenceRows = Array.from(groups.values()).flatMap((groupScreenshots) => {
        const enterpriseId = groupScreenshots[0].enterprise_id;
        if (!enterpriseId) {
          return [];
        }

        const candidateId = candidateByEnterpriseId.get(enterpriseId);
        if (!candidateId) {
          return [];
        }

        const screenshotIdSet = new Set(groupScreenshots.map((row) => row.id));
        const groupDetections = detections.filter((row) => row.screenshot_id && screenshotIdSet.has(row.screenshot_id));

        const screenshotEvidence = groupScreenshots.map((row, index) => ({
          candidate_id: candidateId,
          screenshot_id: row.id,
          detection_result_id: null,
          kind: 'original' as const,
          sort_order: index,
          metadata: {},
        }));

        const detectionEvidence = groupDetections.map((row, index) => ({
          candidate_id: candidateId,
          screenshot_id: row.screenshot_id,
          detection_result_id: row.id,
          kind: 'bbox' as const,
          sort_order: screenshotEvidence.length + index,
          metadata: {
            bboxArea: row.bbox_area ?? 0,
            confidence: row.confidence ?? 0,
          },
        }));

        return [...screenshotEvidence, ...detectionEvidence];
      });

      if (evidenceRows.length > 0) {
        const { error } = await supabaseAdmin
          .from('scan_candidate_evidences')
          .insert(evidenceRows);

        if (error) {
          throw error;
        }
      }

      const evidenceCountByCandidateId = new Map<string, number>();
      for (const row of evidenceRows) {
        const current = evidenceCountByCandidateId.get(row.candidate_id) ?? 0;
        evidenceCountByCandidateId.set(row.candidate_id, current + 1);
      }

      await insertAuditLogs(supabaseAdmin, candidates.map((candidate) => ({
        entity_type: 'scan_candidate',
        entity_id: candidate.id,
        action: 'candidate.materialized',
        actor_user_id: actorUserId,
        actor_source: 'api',
        payload: {
          sessionId,
          candidateId: candidate.id,
          enterpriseId: candidate.enterprise_id,
          evidenceCount: evidenceCountByCandidateId.get(candidate.id) ?? 0,
        },
      })));

      return {
        sessionId,
        actorUserId,
        candidateCount: candidateRows.length,
        evidenceCount: evidenceRows.length,
      };
    },
  };
}

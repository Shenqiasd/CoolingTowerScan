import type { SupabaseClient } from '@supabase/supabase-js';

import type {
  LeadConfirmAction,
  LeadAuditLogItem,
  LeadConfirmation,
  LeadConfirmationRole,
  LeadDetail,
  LeadListFilters,
  LeadListItem,
  LeadRepo,
  LeadStatus,
  UpdateLeadInput,
} from './lead.schemas.js';

type CandidateRow = {
  id: string;
  status: 'approved' | 'new' | 'under_review' | 'rejected' | 'needs_info' | 'converted';
  enterprise_id: string | null;
  site_id: string | null;
  matched_enterprise_name: string | null;
  source_payload: Record<string, unknown> | null;
  hvac_estimate_snapshot: Record<string, unknown> | null;
};

type LeadRow = {
  id: string;
  lead_code: string;
  candidate_id: string;
  enterprise_id: string;
  site_id: string;
  name: string;
  status: LeadStatus;
  priority: 'high' | 'medium' | 'low';
  sales_owner_user_id: string | null;
  technical_owner_user_id: string | null;
  next_action: string | null;
  risk_summary: string | null;
  qualification_summary: Record<string, unknown> | null;
  source_snapshot: Record<string, unknown> | null;
  created_at: string;
  updated_at: string;
  lead_confirmations?: LeadConfirmationRow[] | null;
};

type LeadConfirmationRow = {
  confirmation_role: LeadConfirmationRole;
  status: 'pending' | 'confirmed' | 'rejected';
  comment: string | null;
  confirmed_by: string | null;
  confirmed_at: string | null;
};

type AuditRow = {
  id: string;
  entity_type: string;
  entity_id: string;
  action: string;
  actor_user_id: string | null;
  actor_source: string;
  payload: Record<string, unknown> | null;
  created_at: string;
};

function generateLeadCode() {
  return `LEAD-${Date.now()}`;
}

function mapConfirmation(row: LeadConfirmationRow): LeadConfirmation {
  return {
    role: row.confirmation_role,
    status: row.status,
    comment: row.comment ?? '',
    confirmedBy: row.confirmed_by,
    confirmedAt: row.confirmed_at,
  };
}

function mapLeadListItem(row: LeadRow): LeadListItem {
  return {
    id: row.id,
    leadCode: row.lead_code,
    candidateId: row.candidate_id,
    enterpriseId: row.enterprise_id,
    siteId: row.site_id,
    name: row.name,
    status: row.status,
    priority: row.priority,
    salesOwnerUserId: row.sales_owner_user_id ?? null,
    technicalOwnerUserId: row.technical_owner_user_id ?? null,
    nextAction: row.next_action ?? '',
    riskSummary: row.risk_summary ?? '',
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    confirmations: (row.lead_confirmations ?? []).map((item) => ({
      role: item.confirmation_role,
      status: item.status,
    })),
  };
}

function mapAuditLog(row: AuditRow): LeadAuditLogItem {
  return {
    id: row.id,
    entityType: row.entity_type,
    entityId: row.entity_id,
    action: row.action,
    actorUserId: row.actor_user_id,
    actorSource: row.actor_source,
    payload: row.payload ?? {},
    createdAt: row.created_at,
  };
}

async function insertLeadAuditLog(
  supabaseAdmin: SupabaseClient,
  leadId: string,
  action: string,
  actorUserId: string,
  payload: Record<string, unknown>,
) {
  const { error } = await supabaseAdmin
    .from('workflow_audit_logs')
    .insert({
      entity_type: 'lead',
      entity_id: leadId,
      action,
      actor_user_id: actorUserId || null,
      actor_source: actorUserId ? 'api' : 'anonymous',
      payload,
    });

  if (error) {
    throw error;
  }
}

function mapLead(row: LeadRow): LeadDetail {
  return {
    ...mapLeadListItem(row),
    qualificationSummary: row.qualification_summary ?? {},
    sourceSnapshot: row.source_snapshot ?? {},
    confirmations: (row.lead_confirmations ?? []).map(mapConfirmation),
  };
}

async function getLeadById(supabaseAdmin: SupabaseClient, leadId: string): Promise<LeadDetail | null> {
  const { data, error } = await supabaseAdmin
    .from('leads')
    .select(`
      id,
      lead_code,
      candidate_id,
      enterprise_id,
      site_id,
      name,
      status,
      priority,
      sales_owner_user_id,
      technical_owner_user_id,
      next_action,
      risk_summary,
      qualification_summary,
      source_snapshot,
      created_at,
      updated_at,
      lead_confirmations (
        confirmation_role,
        status,
        comment,
        confirmed_by,
        confirmed_at
      )
    `)
    .eq('id', leadId)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return data ? mapLead(data as LeadRow) : null;
}

export function createLeadRepo(supabaseAdmin: SupabaseClient): LeadRepo {
  return {
    async getCandidateStatus(candidateId) {
      const { data, error } = await supabaseAdmin
        .from('scan_candidates')
        .select('status')
        .eq('id', candidateId)
        .maybeSingle();

      if (error) {
        throw error;
      }

      return (data?.status as CandidateRow['status'] | undefined) ?? null;
    },

    async listLeads(filters: LeadListFilters) {
      let query = supabaseAdmin
        .from('leads')
        .select(`
          id,
          lead_code,
          candidate_id,
          enterprise_id,
          site_id,
          name,
          status,
          priority,
          sales_owner_user_id,
          technical_owner_user_id,
          next_action,
          risk_summary,
          created_at,
          updated_at,
          lead_confirmations (
            confirmation_role,
            status
          )
        `)
        .order('updated_at', { ascending: false });

      if (filters.status) {
        query = query.eq('status', filters.status);
      }

      if (filters.priority) {
        query = query.eq('priority', filters.priority);
      }

      if (filters.search) {
        const escaped = filters.search.replace(/[%_]/g, '');
        query = query.or(
          `lead_code.ilike.%${escaped}%,name.ilike.%${escaped}%`,
        );
      }

      const { data, error } = await query;

      if (error) {
        throw error;
      }

      return (data ?? []).map((item) => mapLeadListItem(item as LeadRow));
    },

    async getLeadById(leadId) {
      return getLeadById(supabaseAdmin, leadId);
    },

    async createLeadFromCandidate(candidateId, name, actorUserId) {
      const { data: candidate, error: candidateError } = await supabaseAdmin
        .from('scan_candidates')
        .select('id, status, enterprise_id, site_id, matched_enterprise_name, source_payload, hvac_estimate_snapshot')
        .eq('id', candidateId)
        .maybeSingle();

      if (candidateError) {
        throw candidateError;
      }

      const row = candidate as CandidateRow | null;
      if (!row?.enterprise_id || !row.site_id) {
        return null;
      }

      const { data: lead, error: leadError } = await supabaseAdmin
        .from('leads')
        .insert({
          lead_code: generateLeadCode(),
          candidate_id: candidateId,
          enterprise_id: row.enterprise_id,
          site_id: row.site_id,
          name: name || row.matched_enterprise_name || '',
          status: 'pending_confirmation',
          sales_owner_user_id: actorUserId,
          source_snapshot: {
            candidateSourcePayload: row.source_payload ?? {},
            hvacEstimateSnapshot: row.hvac_estimate_snapshot ?? {},
            createdBy: actorUserId,
          },
        })
        .select('id')
        .maybeSingle();

      if (leadError) {
        throw leadError;
      }

      if (!lead?.id) {
        return null;
      }

      const { error: confirmationError } = await supabaseAdmin
        .from('lead_confirmations')
        .upsert([
          { lead_id: lead.id, confirmation_role: 'sales', status: 'pending' },
          { lead_id: lead.id, confirmation_role: 'technical', status: 'pending' },
        ], {
          onConflict: 'lead_id,confirmation_role',
          ignoreDuplicates: false,
        });

      if (confirmationError) {
        throw confirmationError;
      }

      await insertLeadAuditLog(supabaseAdmin, lead.id, 'lead.created', actorUserId, {
        candidateId,
        name: name || row.matched_enterprise_name || '',
      });

      return getLeadById(supabaseAdmin, lead.id);
    },

    async confirmLead(leadId, role, action, comment, actorUserId) {
      const status = action === 'confirm' ? 'confirmed' : 'rejected';
      const timestamp = new Date().toISOString();

      const { error: confirmationError } = await supabaseAdmin
        .from('lead_confirmations')
        .update({
          status,
          comment,
          confirmed_by: actorUserId,
          confirmed_at: timestamp,
        })
        .eq('lead_id', leadId)
        .eq('confirmation_role', role);

      if (confirmationError) {
        throw confirmationError;
      }

      const { data: confirmations, error: confirmationReadError } = await supabaseAdmin
        .from('lead_confirmations')
        .select('status')
        .eq('lead_id', leadId);

      if (confirmationReadError) {
        throw confirmationReadError;
      }

      const rows = confirmations ?? [];
      const nextLeadStatus: LeadStatus = action === 'reject'
        ? 'disqualified'
        : rows.length > 0 && rows.every((item) => item.status === 'confirmed')
          ? 'qualified'
          : 'pending_confirmation';

      const { error: leadError } = await supabaseAdmin
        .from('leads')
        .update({
          status: nextLeadStatus,
        })
        .eq('id', leadId);

      if (leadError) {
        throw leadError;
      }

      await insertLeadAuditLog(supabaseAdmin, leadId, 'lead.confirmed', actorUserId, {
        role,
        action,
        comment,
        nextStatus: nextLeadStatus,
      });

      return getLeadById(supabaseAdmin, leadId);
    },

    async updateLead(leadId, input: UpdateLeadInput, actorUserId: string) {
      const patch: Record<string, unknown> = {};

      if (input.priority) {
        patch.priority = input.priority;
      }

      if (input.salesOwnerUserId !== undefined) {
        patch.sales_owner_user_id = input.salesOwnerUserId;
      }

      if (input.technicalOwnerUserId !== undefined) {
        patch.technical_owner_user_id = input.technicalOwnerUserId;
      }

      if (input.nextAction !== undefined) {
        patch.next_action = input.nextAction;
      }

      if (input.riskSummary !== undefined) {
        patch.risk_summary = input.riskSummary;
      }

      if (Object.keys(patch).length === 0) {
        return getLeadById(supabaseAdmin, leadId);
      }

      const { error } = await supabaseAdmin
        .from('leads')
        .update(patch)
        .eq('id', leadId);

      if (error) {
        throw error;
      }

      await insertLeadAuditLog(supabaseAdmin, leadId, 'lead.updated', actorUserId, patch);
      return getLeadById(supabaseAdmin, leadId);
    },

    async listLeadAuditLogs(leadId) {
      const { data, error } = await supabaseAdmin
        .from('workflow_audit_logs')
        .select('id, entity_type, entity_id, action, actor_user_id, actor_source, payload, created_at')
        .eq('entity_type', 'lead')
        .eq('entity_id', leadId)
        .order('created_at', { ascending: false });

      if (error) {
        throw error;
      }

      return (data ?? []).map((row) => mapAuditLog(row as AuditRow));
    },
  };
}

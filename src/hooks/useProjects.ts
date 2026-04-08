import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import type { Project, SopPhase } from '../types/project';

export function useProjects() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [phaseFilter, setPhaseFilter] = useState<SopPhase | ''>('');

  const fetch = useCallback(async () => {
    setLoading(true);
    let query = supabase
      .from('projects')
      .select(`
        *,
        enterprise:enterprises(
          enterprise_name, address, industry_category,
          has_cooling_tower, cooling_tower_count,
          total_cooling_capacity_rt, probability_level
        )
      `)
      .order('updated_at', { ascending: false });

    if (phaseFilter) {
      query = query.eq('current_phase', phaseFilter);
    }

    const { data, error } = await query;
    if (!error && data) {
      setProjects(data as Project[]);
    }
    setLoading(false);
  }, [phaseFilter]);

  useEffect(() => { fetch(); }, [fetch]);

  const createFromEnterprise = useCallback(async (enterpriseId: string) => {
    const { data, error } = await supabase.rpc('create_project_from_enterprise', {
      p_enterprise_id: enterpriseId,
    });
    if (error) throw error;
    await fetch();
    return data as string;
  }, [fetch]);

  const updatePhase = useCallback(async (projectId: string, phase: SopPhase) => {
    const { error } = await supabase
      .from('projects')
      .update({ current_phase: phase })
      .eq('id', projectId);
    if (error) throw error;
    await fetch();
  }, [fetch]);

  const updateProject = useCallback(async (projectId: string, updates: Partial<Project>) => {
    const { error } = await supabase
      .from('projects')
      .update(updates)
      .eq('id', projectId);
    if (error) throw error;
    await fetch();
  }, [fetch]);

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

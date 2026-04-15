import { useCallback, useEffect, useRef, useState } from 'react';

import { supabase } from '../lib/supabase';
import { INITIAL_SCAN_SESSION, type ScanSession } from '../types/pipeline';
import {
  buildRecentScanTaskSummary,
  getTaskStatusMeta,
  type RecentScanTaskSummary,
  type ScanSessionRowSummary,
} from './activeScanTaskModel';
import {
  buildRestoredScanSession,
  type PersistedCandidateRow,
  type PersistedDetectionRow,
  type PersistedScreenshotRow,
} from '../utils/scanSessionPersistence';
import { shouldRunRestore } from './activeScanTaskRestorePolicy';

export const ACTIVE_SCAN_SESSION_KEY = 'active_scan_session_id';

async function loadCandidateRows(sessionId: string): Promise<PersistedCandidateRow[]> {
  const { data, error } = await supabase
    .from('scan_candidates')
    .select('id, status, source_payload')
    .eq('scan_session_id', sessionId);

  if (error || !data) {
    return [];
  }

  return (data as Array<{ id: string; status: PersistedCandidateRow['status']; source_payload: Record<string, unknown> | null }>)
    .flatMap((row) => {
      const payload = row.source_payload ?? {};
      const ids = [
        typeof payload.screenshotId === 'string' ? payload.screenshotId : null,
        ...(Array.isArray(payload.screenshotIds)
          ? payload.screenshotIds.filter((value): value is string => typeof value === 'string')
          : []),
      ].filter((value, index, list): value is string => Boolean(value) && list.indexOf(value) === index);

      return ids.map((screenshotId) => ({
        id: row.id,
        screenshot_id: screenshotId,
        status: row.status,
      }));
    });
}

async function restoreSessionById(sessionId: string): Promise<ScanSession | null> {
  const { data: sessionRow, error: sessionError } = await supabase
    .from('scan_sessions')
    .select('id, mode')
    .eq('id', sessionId)
    .maybeSingle();
  if (sessionError || !sessionRow) {
    return null;
  }

  const { data: screenshotRows, error: screenshotError } = await supabase
    .from('scan_screenshots')
    .select(`
      id,
      session_id,
      enterprise_id,
      filename,
      storage_url,
      annotated_url,
      lng,
      lat,
      row_idx,
      col_idx,
      address_label,
      resolved_address,
      has_cooling_tower,
      tower_count,
      max_confidence,
      detection_status,
      review_status
    `)
    .eq('session_id', sessionId)
    .order('created_at', { ascending: true });
  if (screenshotError || !screenshotRows?.length) {
    return null;
  }

  const screenshotIds = screenshotRows.map((row) => row.id);
  let detectionRows: PersistedDetectionRow[] = [];
  if (screenshotIds.length > 0) {
    const { data, error } = await supabase
      .from('detection_results')
      .select('screenshot_id, confidence, class_name, bbox_x1, bbox_y1, bbox_x2, bbox_y2')
      .in('screenshot_id', screenshotIds)
      .order('detection_id', { ascending: true });
    if (!error && data) {
      detectionRows = data as PersistedDetectionRow[];
    }
  }

  const candidateRows = await loadCandidateRows(sessionId);

  return buildRestoredScanSession({
    sessionId,
    mode: sessionRow.mode,
    screenshots: screenshotRows as PersistedScreenshotRow[],
    candidateRows,
    detectionRows,
  });
}

export function useActiveScanTask() {
  const [session, setSession] = useState<ScanSession>(INITIAL_SCAN_SESSION);
  const [loading, setLoading] = useState(true);
  const [recentTasks, setRecentTasks] = useState<RecentScanTaskSummary[]>([]);
  const hasAutoRestoredRef = useRef(false);

  const refreshRecentTasks = useCallback(async (activeSessionId?: string | null) => {
    const currentActiveId = activeSessionId ?? null;
    const { data, error } = await supabase
      .from('scan_sessions')
      .select('id, mode, label, zoom_level, total_count, created_at')
      .order('created_at', { ascending: false })
      .limit(6);

    if (error || !data) {
      setRecentTasks([]);
      return;
    }

    setRecentTasks((data as ScanSessionRowSummary[]).map((row) => buildRecentScanTaskSummary({
      row,
      activeSessionId: currentActiveId,
    })));
  }, []);

  const restore = useCallback(async (sessionId?: string | null) => {
    if (!shouldRunRestore({
      hasAutoRestored: hasAutoRestoredRef.current,
      explicitSessionId: sessionId,
    })) {
      return null;
    }

    const targetSessionId = sessionId ?? localStorage.getItem(ACTIVE_SCAN_SESSION_KEY);
    if (!sessionId) {
      hasAutoRestoredRef.current = true;
    }

    if (!targetSessionId) {
      setSession(INITIAL_SCAN_SESSION);
      await refreshRecentTasks(null);
      setLoading(false);
      return null;
    }

    setLoading(true);
    const restored = await restoreSessionById(targetSessionId);
    if (!restored) {
      localStorage.removeItem(ACTIVE_SCAN_SESSION_KEY);
      setSession(INITIAL_SCAN_SESSION);
      await refreshRecentTasks(null);
      setLoading(false);
      return null;
    }

    setSession(restored);
    await refreshRecentTasks(targetSessionId);
    setLoading(false);
    return restored;
  }, [refreshRecentTasks]);

  const selectTask = useCallback(async (taskId: string) => {
    localStorage.setItem(ACTIVE_SCAN_SESSION_KEY, taskId);
    return restore(taskId);
  }, [restore]);

  useEffect(() => {
    void restore();
  }, [restore]);

  useEffect(() => {
    if (session.sessionId) {
      localStorage.setItem(ACTIVE_SCAN_SESSION_KEY, session.sessionId);
      void refreshRecentTasks(session.sessionId);
      return;
    }

    localStorage.removeItem(ACTIVE_SCAN_SESSION_KEY);
    void refreshRecentTasks(null);
  }, [refreshRecentTasks, session.sessionId]);

  const clearActiveTask = useCallback(() => {
    setSession(INITIAL_SCAN_SESSION);
    localStorage.removeItem(ACTIVE_SCAN_SESSION_KEY);
    void refreshRecentTasks(null);
  }, [refreshRecentTasks]);

  return {
    session,
    setSession,
    loading,
    recentTasks,
    restore,
    selectTask,
    refreshRecentTasks,
    clearActiveTask,
    activeTask: session.task ?? null,
    taskMeta: getTaskStatusMeta(session.task),
  };
}

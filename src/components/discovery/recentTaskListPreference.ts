import type { PipelineStep } from '../../types/pipeline';

export const RECENT_TASK_LIST_PREFERENCE_KEY = 'discovery_recent_task_list_preference';

export type RecentTaskListPreference = 'expanded' | 'collapsed';

export function parseRecentTaskListPreference(value: string | null | undefined): RecentTaskListPreference | null {
  if (value === 'expanded' || value === 'collapsed') {
    return value;
  }

  return null;
}

export function getInitialRecentTaskListCollapsed(
  step: PipelineStep,
  storedValue: string | null | undefined,
): boolean {
  const preference = parseRecentTaskListPreference(storedValue);
  if (preference) {
    return preference === 'collapsed';
  }

  return step === 'screenshot';
}

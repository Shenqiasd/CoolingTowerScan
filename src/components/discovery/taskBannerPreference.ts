import type { PipelineStep } from '../../types/pipeline';

export const TASK_BANNER_PREFERENCE_KEY = 'discovery_task_banner_preference';

export type TaskBannerPreference = 'expanded' | 'collapsed';

export function parseTaskBannerPreference(value: string | null | undefined): TaskBannerPreference | null {
  if (value === 'expanded' || value === 'collapsed') {
    return value;
  }

  return null;
}

export function getInitialTaskBannerCollapsed(
  step: PipelineStep,
  storedValue: string | null | undefined,
): boolean {
  const preference = parseTaskBannerPreference(storedValue);
  if (preference) {
    return preference === 'collapsed';
  }

  return step === 'screenshot';
}

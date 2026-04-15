interface RestorePolicyInput {
  hasAutoRestored: boolean;
  explicitSessionId: string | null | undefined;
}

export function shouldRunRestore({
  hasAutoRestored,
  explicitSessionId,
}: RestorePolicyInput): boolean {
  if (explicitSessionId) {
    return true;
  }

  return !hasAutoRestored;
}

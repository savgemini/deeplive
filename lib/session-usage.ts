export const CREDITS_PER_MINUTE = 125;

export function getBillableMinutes(durationSeconds: number): number {
  return Math.ceil(Math.max(0, durationSeconds) / 60);
}

export function formatSessionDuration(durationSeconds: number): string {
  const safeSeconds = Math.max(0, Math.floor(durationSeconds));
  return `${Math.floor(safeSeconds / 60)}m ${safeSeconds % 60}s`;
}
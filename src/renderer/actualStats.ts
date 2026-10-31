/** Where an observed value sits in a histogram of shares (index k = value k). */
export interface Rank {
  below: number;
  at: number;
  above: number;
}

export function rank(histogram: number[], value: number): Rank {
  let below = 0;
  for (let k = 0; k < Math.min(value, histogram.length); k++) below += histogram[k];
  const at = histogram[value] ?? 0;
  return { below, at, above: Math.max(0, 1 - below - at) };
}

/** Mid-rank percentile: 0 means every simulated battle was above the observed value, 1 means every one below. */
export const midRank = (r: Rank) => r.below + r.at / 2;

export function mean(histogram: number[]): number {
  return histogram.reduce((sum, share, k) => sum + share * k, 0);
}

/**
 * How often the exact end state came up, and the share of battles that ended in a result no more likely than it.
 * The second number is a p-value: small means the observed end was unusual under the simulator's model.
 */
export function endStateRarity(endStates: Record<string, number>, key: string): { share: number; asRare: number } {
  const share = endStates[key] ?? 0;
  let asRare = 0;
  for (const p of Object.values(endStates)) if (p <= share) asRare += p;
  return { share, asRare };
}

/** A word for how likely an observed event was. */
export function likelihoodLabel(p: number): string {
  if (p >= 0.5) return 'Expected';
  if (p >= 0.2) return 'Plausible';
  if (p >= 0.05) return 'Unlikely';
  return 'Long shot';
}

/** A word for a side's losses, given the mid-rank of what it lost among simulated battles. */
export function luckLabel(lossMidRank: number): string {
  if (lossMidRank < 0.15) return 'Very lucky';
  if (lossMidRank < 0.35) return 'Lucky';
  if (lossMidRank <= 0.65) return 'Typical';
  if (lossMidRank <= 0.85) return 'Unlucky';
  return 'Very unlucky';
}

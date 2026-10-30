export type Rng = () => number;

/** Small, fast seeded PRNG (mulberry32) so runs can be reproduced in tests. */
export function createRng(seed?: number): Rng {
  let state = (seed ?? Math.floor(Math.random() * 2 ** 32)) >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Roll a ten-sided die: 1-10. */
export function d10(rng: Rng): number {
  return Math.floor(rng() * 10) + 1;
}

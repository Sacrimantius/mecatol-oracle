import { describe, expect, it } from 'vitest';
import { endStateRarity, likelihoodLabel, luckLabel, mean, midRank, rank } from './actualStats';

describe('rank', () => {
  it('splits the shares below, at and above a value', () => {
    const r = rank([0.1, 0.2, 0.3, 0.4], 2);
    expect(r.below).toBeCloseTo(0.3);
    expect(r.at).toBeCloseTo(0.3);
    expect(r.above).toBeCloseTo(0.4);
    expect(midRank(r)).toBeCloseTo(0.45);
  });

  it('puts a value past the end of the histogram above everything', () => {
    const r = rank([0.5, 0.5], 5);
    expect(r).toEqual({ below: 1, at: 0, above: 0 });
  });
});

it('averages a histogram', () => {
  expect(mean([0.25, 0.5, 0.25])).toBeCloseTo(1);
});

describe('endStateRarity', () => {
  const endStates = { a: 0.6, b: 0.25, c: 0.1, d: 0.05 };

  it('counts outcomes no more likely than the observed one', () => {
    expect(endStateRarity(endStates, 'c').share).toBe(0.1);
    expect(endStateRarity(endStates, 'c').asRare).toBeCloseTo(0.15);
    expect(endStateRarity(endStates, 'a').asRare).toBeCloseTo(1);
  });

  it('treats an end state the simulator never produced as impossible', () => {
    expect(endStateRarity(endStates, 'z')).toEqual({ share: 0, asRare: 0 });
  });
});

it('labels likelihood and luck', () => {
  expect(likelihoodLabel(0.7)).toBe('Expected');
  expect(likelihoodLabel(0.03)).toBe('Long shot');
  expect(luckLabel(0.05)).toBe('Very lucky');
  expect(luckLabel(0.5)).toBe('Typical');
  expect(luckLabel(0.95)).toBe('Very unlucky');
});

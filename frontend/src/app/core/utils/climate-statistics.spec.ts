import { describe, it, expect } from 'vitest';
import { climateCsv, periodComparison } from './climate-statistics';
import { TrendAnalysisResponse } from '../models/climate.model';
const data = {
  years: [2000, 2001, 2002, 2003, 2004, 2005],
  temperatures: [10, 11, 12, 13, 14, 15],
  latitude: 19.845,
  longitude: -90.523,
  source: 'NASA POWER',
} as TrendAnalysisResponse;
describe('Scientific comparisons and CSV', () => {
  it('calculates equal-year means and signed/absolute differences', () => {
    expect(periodComparison(data, 2000, 2002, 2003, 2005)).toEqual({
      a: 11,
      b: 14,
      delta: 3,
      absolute: 3,
    });
  });
  it('rejects overlap, unequal durations, missing years and fractional years', () => {
    for (const years of [
      [2000, 2002, 2002, 2004],
      [2000, 2001, 2002, 2005],
      [1999, 2001, 2003, 2005],
      [2000.5, 2002, 2003, 2005],
    ])
      expect(() =>
        periodComparison(data, ...(years as [number, number, number, number])),
      ).toThrow();
  });
  it('exports both displayed locations with provenance and original precision', () => {
    const csv = climateCsv([data, { ...data, latitude: 0 }]);
    expect(csv.split('\r\n')).toHaveLength(13);
    expect(csv).toContain('"A","2000","10","19.845","-90.523","T2M","degC","NASA POWER"');
    expect(csv).toContain('"B","2000","10","0"');
  });
});

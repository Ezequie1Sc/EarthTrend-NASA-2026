import { TrendAnalysisResponse } from '../models/climate.model';
export const mean = (values: number[]) =>
  values.reduce((sum, value) => sum + value, 0) / values.length;
export function periodComparison(
  data: TrendAnalysisResponse,
  a0: number,
  a1: number,
  b0: number,
  b1: number,
) {
  if (![a0, a1, b0, b1].every(Number.isInteger) || a0 > a1 || b0 > b1)
    throw new Error('Enter ordered integer years.');
  if (a1 >= b0) throw new Error('Period B must follow period A without overlap.');
  if (a1 - a0 !== b1 - b0 || a1 - a0 < 2)
    throw new Error('Use equal-length periods of at least 3 complete years.');
  const values = (start: number, end: number) => {
    const result: number[] = [];
    for (let year = start; year <= end; year++) {
      const index = data.years.indexOf(year),
        value = data.temperatures[index];
      if (index < 0 || !Number.isFinite(value))
        throw new Error('Both periods must be fully covered by the displayed analysis.');
      result.push(value);
    }
    return result;
  };
  const a = mean(values(a0, a1)),
    b = mean(values(b0, b1));
  return { a, b, delta: b - a, absolute: Math.abs(b - a) };
}
export function climateCsv(series: TrendAnalysisResponse[]): string {
  const cell = (value: string | number) => `"${String(value).replaceAll('"', '""')}"`;
  return [
    'location,year,temperature,latitude,longitude,variable,unit,source',
    ...series.flatMap((s, index) =>
      s.years.map((year, i) =>
        [
          index === 0 ? 'A' : 'B',
          year,
          s.temperatures[i],
          s.latitude,
          s.longitude,
          'T2M',
          'degC',
          s.source,
        ]
          .map(cell)
          .join(','),
      ),
    ),
  ].join('\r\n');
}
export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob),
    anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

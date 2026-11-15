import { TestBed } from '@angular/core/testing';
import { describe, it, expect, vi } from 'vitest';
import { ClimateChart } from './climate-chart';
import { TrendAnalysisResponse } from '../../../../core/models/climate.model';
const data = {
  latitude: 19.845,
  longitude: -90.523,
  start_year: 2000,
  end_year: 2024,
  temperatures: [26, 27],
  years: [2000, 2024],
  source: 'NASA POWER',
} as TrendAnalysisResponse;
describe('Chart export composition', () => {
  it('composes PNG with title, units, period, coordinates and data canvas', () => {
    TestBed.overrideComponent(ClimateChart, { set: { template: '' } });
    const fixture = TestBed.createComponent(ClimateChart);
    fixture.componentRef.setInput('data', data);
    const source = document.createElement('canvas');
    source.width = 400;
    source.height = 300;
    const fillText = vi.fn(),
      drawImage = vi.fn(),
      toBlob = vi.spyOn(HTMLCanvasElement.prototype, 'toBlob').mockImplementation(() => {});
    const getContext = vi
      .spyOn(HTMLCanvasElement.prototype, 'getContext')
      .mockReturnValue({ fillRect: vi.fn(), fillText, drawImage } as any);
    (fixture.componentInstance as any).chart = {
      canvas: source,
      stop: vi.fn(),
      update: vi.fn(),
      destroy: vi.fn(),
    };
    fixture.componentInstance.exportPng();
    expect(fillText.mock.calls[0][0]).toContain('NASA POWER T2M (°C) | 2000–2024');
    expect(fillText.mock.calls[1][0]).toContain('19.8450, -90.5230');
    expect(drawImage).toHaveBeenCalledOnce();
    expect(toBlob).toHaveBeenCalledWith(expect.any(Function), 'image/png');
    getContext.mockRestore();
    toBlob.mockRestore();
  });
});

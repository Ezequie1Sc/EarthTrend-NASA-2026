import { TestBed } from '@angular/core/testing';
import { describe, it, expect } from 'vitest';
import { Subject } from 'rxjs';
import { ClimateComparison } from './climate-comparison';
import { ClimateApiService } from '../../../../core/services/climate-api.service';
import { ClimateChart } from '../climate-chart/climate-chart';
import { TrendAnalysisResponse, ClimateQuery } from '../../../../core/models/climate.model';
const data = {
  latitude: 0,
  longitude: 0,
  start_year: 2000,
  end_year: 2005,
  years: [2000, 2001, 2002, 2003, 2004, 2005],
  temperatures: [10, 11, 12, 13, 14, 15],
  slope_celsius_per_decade: 10,
  slope_celsius_per_year: 1,
  intercept: -1990,
  source: 'NASA POWER',
} as TrendAnalysisResponse;
describe('Two-location integration', () => {
  it('queries only on analyze and forces the same period, discarding changed B', () => {
    const responses: Subject<TrendAnalysisResponse>[] = [];
    const queries: ClimateQuery[] = [];
    TestBed.configureTestingModule({
      providers: [
        {
          provide: ClimateApiService,
          useValue: {
            getTrendAnalysis: (q: ClimateQuery) => {
              queries.push(q);
              const response = new Subject<TrendAnalysisResponse>();
              responses.push(response);
              return response;
            },
          },
        },
      ],
    });
    TestBed.overrideComponent(ClimateChart, { set: { template: '' } });
    const fixture = TestBed.createComponent(ClimateComparison);
    fixture.componentRef.setInput('data', data);
    fixture.detectChanges();
    fixture.componentRef.setInput('coordinatesB', { latitude: 10, longitude: 20 });
    fixture.detectChanges();
    expect(queries).toHaveLength(0);
    fixture.componentInstance.compareLocation({ latitude: 10, longitude: 20 });
    expect(queries[0]).toEqual({ latitude: 10, longitude: 20, start_year: 2000, end_year: 2005 });
    responses[0].next({ ...data, latitude: 10, longitude: 20 });
    expect(fixture.componentInstance.other()).not.toBeNull();
    fixture.componentRef.setInput('coordinatesB', { latitude: 30, longitude: 40 });
    fixture.detectChanges();
    expect(fixture.componentInstance.other()).toBeNull();
  });
});

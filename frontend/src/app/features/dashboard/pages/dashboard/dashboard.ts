import { Component, DestroyRef, inject, signal } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';

import { finalize, forkJoin, Subscription } from 'rxjs';

import { ClimateApiService } from '../../../../core/services/climate-api.service';

import type { ClimateQuery, TrendAnalysisResponse } from '../../../../core/models/climate.model';

import { ClimateChart } from '../../components/climate-chart/climate-chart';
import { LocationSelector } from '../../components/location-selector/location-selector';
import { TrendSummary } from '../../components/trend-summary/trend-summary';

import { ClimateComparison } from '../../components/climate-comparison/climate-comparison';

@Component({
  selector: 'app-dashboard',
  standalone: true,

  imports: [ClimateChart, LocationSelector, TrendSummary, ClimateComparison],

  styleUrl: './dashboard.css',

  templateUrl: './dashboard.html',
})
export class Dashboard {
  private readonly climateApi = inject(ClimateApiService);

  readonly chartExpanded = signal(false);
  readonly loading = signal(false);
  readonly error = signal<string | null>(null);

  readonly analysis = signal<TrendAnalysisResponse | null>(null);

  private requestVersion = 0;
  private activeRequest?: Subscription;
  constructor() {
    inject(DestroyRef).onDestroy(() => this.activeRequest?.unsubscribe());
  }

  analyzeClimate(query: ClimateQuery): void {
    const version = ++this.requestVersion;
    this.activeRequest?.unsubscribe();

    this.loading.set(true);
    this.error.set(null);
    this.analysis.set(null);

    this.activeRequest = forkJoin({
      analysis: this.climateApi.getTrendAnalysis(query),
    })
      .pipe(
        finalize(() => {
          if (version === this.requestVersion) {
            this.loading.set(false);
          }
        }),
      )
      .subscribe({
        next: ({ analysis }) => {
          if (version !== this.requestVersion) {
            return;
          }

          this.analysis.set(analysis);
          setTimeout(
            () =>
              document
                .querySelector('app-climate-chart')
                ?.scrollIntoView({ behavior: 'smooth', block: 'start' }),
            0,
          );
        },

        error: (error: unknown) => {
          if (version !== this.requestVersion) {
            return;
          }

          this.error.set(this.getErrorMessage(error));
        },
      });
  }

  private getErrorMessage(error: unknown): string {
    if (error instanceof HttpErrorResponse) {
      if (error.status === 0) {
        return 'Unable to connect to the climate API. Verify that the FastAPI backend is running.';
      }

      if (typeof error.error?.detail === 'string') return error.error.detail;

      if (error.status === 422) {
        return 'The selected coordinates or historical period are not valid.';
      }

      if (error.status === 502) {
        return 'NASA POWER is temporarily unavailable. Please try again later.';
      }

      return `The climate API returned an error (${error.status}).`;
    }

    return 'An unexpected error occurred during climate analysis.';
  }
}

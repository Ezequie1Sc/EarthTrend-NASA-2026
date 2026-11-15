
import {
  Component,
  DestroyRef,
  inject,
  signal,
  computed,
} from '@angular/core';

import { DecimalPipe } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';

import {
  finalize,
  Subscription,
} from 'rxjs';

import { ClimateApiService } from '../../../../core/services/climate-api.service';

import type {
  ClimateQuery,
  TrendAnalysisResponse,
} from '../../../../core/models/climate.model';

import { EarthGlobe } from '../../components/earth-globe/earth-globe';

import {
  LocationSelector,
} from '../../../dashboard/components/location-selector/location-selector';

import type {
  SelectedCoordinates,
} from '../../../dashboard/components/location-selector/location-selector';

import { ClimateChart } from '../../../dashboard/components/climate-chart/climate-chart';
import { TrendSummary } from '../../../dashboard/components/trend-summary/trend-summary';
import { ClimateComparison } from '../../../dashboard/components/climate-comparison/climate-comparison';

@Component({
  selector: 'app-earth-explorer',
  standalone: true,

  imports: [
    DecimalPipe,
    EarthGlobe,
    LocationSelector,
    ClimateChart,
    TrendSummary,
    ClimateComparison,
  ],

  templateUrl: './earth-explorer.html',
  styleUrl: './earth-explorer.css',
})
export class EarthExplorer {
  private readonly climateApi = inject(ClimateApiService);
  private readonly destroyRef = inject(DestroyRef);

  // ==========================================
  // IMMERSIVE VIEW
  // ==========================================

  // Both observation panels start hidden.
  // The coordinate display is independent
  // and must remain visible in the template.

  readonly leftPanelVisible = signal(false);
  readonly rightPanelVisible = signal(false);

  readonly immersive = computed(
    () =>
      !this.leftPanelVisible() &&
      !this.rightPanelVisible(),
  );

  readonly chartExpanded = signal(false);

  togglePanel(panel: 'left' | 'right'): void {
    const target =
      panel === 'left'
        ? this.leftPanelVisible
        : this.rightPanelVisible;

    target.update((visible) => !visible);
  }

  toggleImmersive(): void {
    const shouldShowPanels = this.immersive();

    this.leftPanelVisible.set(shouldShowPanels);
    this.rightPanelVisible.set(shouldShowPanels);
  }

  showAnalysis(): void {
    this.leftPanelVisible.set(true);
    this.rightPanelVisible.set(true);
  }

  // ==========================================
  // COORDINATE SELECTION
  // ==========================================

  readonly selectedCoordinates =
    signal<SelectedCoordinates | null>({
      latitude: 19.845,
      longitude: -90.523,
    });

  readonly coordinatesB =
    signal<SelectedCoordinates | null>(null);

  readonly selectionTarget =
    signal<'A' | 'B'>('A');

  // ==========================================
  // CLIMATE ANALYSIS
  // ==========================================

  readonly loading = signal(false);
  readonly error = signal<string | null>(null);

  readonly analysis =
    signal<TrendAnalysisResponse | null>(null);

  private requestVersion = 0;
  private activeRequest?: Subscription;

  constructor() {
    this.destroyRef.onDestroy(() => {
      this.requestVersion++;
      this.activeRequest?.unsubscribe();
    });
  }

  // ==========================================
  // VALIDATION
  // ==========================================

  private validCoordinates(
    location: SelectedCoordinates,
  ): boolean {
    return (
      Number.isFinite(location.latitude) &&
      Number.isFinite(location.longitude) &&
      location.latitude >= -90 &&
      location.latitude <= 90 &&
      location.longitude >= -180 &&
      location.longitude <= 180
    );
  }

  private clearAnalysis(): void {
    this.requestVersion++;
    this.activeRequest?.unsubscribe();
    this.activeRequest = undefined;

    this.loading.set(false);
    this.analysis.set(null);
    this.error.set(null);
  }

  // ==========================================
  // POINT A / POINT B
  // ==========================================

  readonly setManualB = (
    location: SelectedCoordinates,
  ): void => {
    if (!this.validCoordinates(location)) {
      return;
    }

    this.coordinatesB.set({
      latitude: location.latitude,
      longitude: location.longitude,
    });
  };

  onLocationSelected(
    location: SelectedCoordinates,
  ): void {
    if (!this.validCoordinates(location)) {
      return;
    }

    const coordinates = {
      latitude: location.latitude,
      longitude: location.longitude,
    };

    if (this.selectionTarget() === 'B') {
      this.coordinatesB.set(coordinates);
      return;
    }

    this.clearAnalysis();
    this.selectedCoordinates.set(coordinates);
  }

  onManualA(
    location: SelectedCoordinates,
  ): void {
    if (!this.validCoordinates(location)) {
      return;
    }

    this.clearAnalysis();

    this.selectedCoordinates.set({
      latitude: location.latitude,
      longitude: location.longitude,
    });
  }

  // ==========================================
  // NASA POWER ANALYSIS
  // ==========================================

  analyzeClimate(query: ClimateQuery): void {
    if (
      !this.validCoordinates({
        latitude: query.latitude,
        longitude: query.longitude,
      })
    ) {
      this.error.set(
        'The selected coordinates are not valid.',
      );
      return;
    }

    this.selectedCoordinates.set({
      latitude: query.latitude,
      longitude: query.longitude,
    });

    const version = ++this.requestVersion;

    this.activeRequest?.unsubscribe();

    this.loading.set(true);
    this.error.set(null);
    this.analysis.set(null);

    this.activeRequest = this.climateApi
      .getTrendAnalysis(query)
      .pipe(
        finalize(() => {
          if (version === this.requestVersion) {
            this.loading.set(false);
          }
        }),
      )
      .subscribe({
        next: (analysis) => {
          if (version !== this.requestVersion) {
            return;
          }

          this.analysis.set(analysis);

          // Avoid scrolling another explorer instance
          // or interrupting mobile navigation.
        },

        error: (error: unknown) => {
          if (version !== this.requestVersion) {
            return;
          }

          this.error.set(
            this.getErrorMessage(error),
          );
        },
      });
  }

  // ==========================================
  // ERROR HANDLING
  // ==========================================

  private getErrorMessage(
    error: unknown,
  ): string {
    if (error instanceof HttpErrorResponse) {
      if (error.status === 0) {
        return (
          'Unable to connect to the climate API. ' +
          'Verify that the FastAPI backend is running.'
        );
      }

      if (
        typeof error.error?.detail === 'string'
      ) {
        return error.error.detail;
      }

      if (error.status === 422) {
        return (
          'The selected coordinates or historical ' +
          'period are not valid.'
        );
      }

      if (error.status === 502) {
        return (
          'NASA POWER is temporarily unavailable. ' +
          'Please try again later.'
        );
      }

      return (
        `The climate API returned an error ` +
        `(${error.status}).`
      );
    }

    return (
      'An unexpected error occurred ' +
      'during climate analysis.'
    );
  }
}

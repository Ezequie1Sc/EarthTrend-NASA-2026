import { Component, computed, effect, inject, input, signal, DestroyRef } from '@angular/core';
import { DecimalPipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Subscription } from 'rxjs';
import { ClimateApiService } from '../../../../core/services/climate-api.service';
import { TrendAnalysisResponse } from '../../../../core/models/climate.model';
import { mean, periodComparison } from '../../../../core/utils/climate-statistics';
import { ClimateChart } from '../climate-chart/climate-chart';
import { LocationSelector, SelectedCoordinates } from '../location-selector/location-selector';
@Component({
  selector: 'app-climate-comparison',
  standalone: true,
  imports: [FormsModule, DecimalPipe, ClimateChart, LocationSelector],
  styleUrl: './climate-comparison.css',
  templateUrl: './climate-comparison.html',
})
export class ClimateComparison {
  readonly data = input.required<TrendAnalysisResponse>();
  readonly coordinatesB = input<SelectedCoordinates | null>(null);
  readonly onManualB = input<(value: SelectedCoordinates) => void>(() => {});
  private readonly api = inject(ClimateApiService);
  private request?: Subscription;
  private activeLocation = '';
  readonly other = signal<TrendAnalysisResponse | null>(null);
  readonly loading = signal(false);
  readonly error = signal('');
  readonly average = computed(() => mean(this.data().temperatures));
  readonly minimum = computed(() => Math.min(...this.data().temperatures));
  readonly maximum = computed(() => Math.max(...this.data().temperatures));
  readonly otherMean = computed(() => mean(this.other()?.temperatures ?? []));
  readonly a0 = signal(2000);
  readonly a1 = signal(2010);
  readonly b0 = signal(2014);
  readonly b1 = signal(2024);
  readonly periodResult = signal<ReturnType<typeof periodComparison> | null>(null);
  readonly periodError = signal('');
  constructor() {
    effect(() => {
      const d = this.data();
      const n = Math.floor(d.years.length / 2);
      this.a0.set(d.start_year);
      this.a1.set(d.start_year + n - 1);
      this.b0.set(d.end_year - n + 1);
      this.b1.set(d.end_year);
      this.resetOther();
    });
    effect(() => {
      const b = this.coordinatesB();
      if (b && `${b.latitude},${b.longitude}` !== this.activeLocation) this.resetOther();
    });
    effect(() => {
      this.a0();
      this.a1();
      this.b0();
      this.b1();
      this.periodResult.set(null);
      this.periodError.set('');
    });
    inject(DestroyRef).onDestroy(() => this.request?.unsubscribe());
  }
  private resetOther() {
    this.request?.unsubscribe();
    this.other.set(null);
    this.error.set('');
    this.loading.set(false);
  }
  manualB(value: SelectedCoordinates) {
    this.onManualB()(value);
    this.resetOther();
  }
  comparePeriods() {
    try {
      this.periodResult.set(
        periodComparison(this.data(), this.a0(), this.a1(), this.b0(), this.b1()),
      );
      this.periodError.set('');
    } catch (e) {
      this.periodResult.set(null);
      this.periodError.set((e as Error).message);
    }
  }
  compareLocation(value: SelectedCoordinates) {
    this.resetOther();
    this.loading.set(true);
    this.activeLocation = `${value.latitude},${value.longitude}`;
    this.onManualB()(value);
    const a = this.data();
    this.request = this.api
      .getTrendAnalysis({ ...value, start_year: a.start_year, end_year: a.end_year })
      .subscribe({
        next: (b) => {
          this.loading.set(false);
          if (b.years.join(',') !== a.years.join(',')) {
            this.error.set('The two series do not cover identical years.');
            return;
          }
          this.other.set(b);
        },
        error: (e) => {
          this.loading.set(false);
          this.error.set(
            typeof e.error?.detail === 'string'
              ? e.error.detail
              : 'Unable to retrieve location B. Please retry.',
          );
        },
      });
  }
}

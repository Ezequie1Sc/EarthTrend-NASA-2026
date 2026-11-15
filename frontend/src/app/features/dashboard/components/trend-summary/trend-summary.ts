import { Component, computed, input } from '@angular/core';
import { DecimalPipe } from '@angular/common';

import type { TrendAnalysisResponse } from '../../../../core/models/climate.model';

@Component({
  selector: 'app-trend-summary',
  standalone: true,
  imports: [DecimalPipe],
  templateUrl: './trend-summary.html',
})
export class TrendSummary {
  readonly data = input.required<TrendAnalysisResponse>();

  readonly temperatureDirection = computed(() => {
    const slope = this.data().slope_celsius_per_decade;

    if (slope > 0) {
      return 'Increasing temperature';
    }

    if (slope < 0) {
      return 'Decreasing temperature';
    }

    return 'No estimated change';
  });

  readonly explainedVariation = computed(() => {
    const value = this.data().r_squared;

    if (!Number.isFinite(value)) {
      return 0;
    }

    return Math.min(100, Math.max(0, value * 100));
  });
}

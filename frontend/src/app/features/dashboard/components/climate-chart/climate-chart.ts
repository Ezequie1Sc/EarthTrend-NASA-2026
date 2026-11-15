import {
  Component,
  ElementRef,
  effect,
  inject,
  input,
  OnDestroy,
  output,
  signal,
  viewChild,
} from '@angular/core';

import { DecimalPipe, DOCUMENT } from '@angular/common';

import { Chart, ChartConfiguration, registerables } from 'chart.js';

import type { TrendAnalysisResponse } from '../../../../core/models/climate.model';

Chart.register(...registerables);

import { climateCsv, downloadBlob } from '../../../../core/utils/climate-statistics';

@Component({
  selector: 'app-climate-chart',
  standalone: true,
  imports: [DecimalPipe],
  templateUrl: './climate-chart.html',
})
export class ClimateChart implements OnDestroy {
  readonly data = input.required<TrendAnalysisResponse>();
  readonly comparison = input<TrendAnalysisResponse | null>(null);
  exportCsv(): void {
    downloadBlob(
      new Blob([climateCsv([this.data(), ...(this.comparison() ? [this.comparison()!] : [])])], {
        type: 'text/csv;charset=utf-8',
      }),
      `earthtrend-${this.data().start_year}-${this.data().end_year}.csv`,
    );
  }
  exportPng(): void {
    if (!this.chart) return;
    this.chart.stop();
    this.chart.update('none');
    const source = this.chart.canvas,
      canvas = document.createElement('canvas');
    canvas.width = Math.max(source.width, 900);
    canvas.height = source.height + 130;
    const context = canvas.getContext('2d');
    if (!context) return;
    context.fillStyle = '#191c1c';
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.fillStyle = '#ffffff';
    context.font = '20px sans-serif';
    const a = this.data(),
      b = this.comparison();
    context.fillText(`EarthTrend | NASA POWER T2M (°C) | ${a.start_year}–${a.end_year}`, 20, 30);
    context.font = '16px sans-serif';
    context.fillText(
      `A: ${a.latitude.toFixed(4)}, ${a.longitude.toFixed(4)}${b ? ` | B: ${b.latitude.toFixed(4)}, ${b.longitude.toFixed(4)}` : ''}`,
      20,
      58,
    );
    context.drawImage(source, 0, 90, canvas.width, source.height);
    context.fillText(
      'Annual grid-cell means; dashed lines: OLS trends. Source: NASA POWER.',
      20,
      canvas.height - 14,
    );
    canvas.toBlob((blob) => {
      if (blob) downloadBlob(blob, `earthtrend-${a.start_year}-${a.end_year}.png`);
    }, 'image/png');
  }

  // Dashboard expansion is controlled by EarthExplorer.
  readonly expanded = input(false);
  readonly expandedChange = output<boolean>();

  private readonly document = inject(DOCUMENT);

  private readonly fullscreenContainer = viewChild<ElementRef<HTMLElement>>('fullscreenContainer');

  private readonly canvas = viewChild<ElementRef<HTMLCanvasElement>>('chartCanvas');

  private readonly chartHost = viewChild<ElementRef<HTMLElement>>('chartHost');

  readonly isFullscreen = signal(false);

  private chart?: Chart<'line'>;
  private resizeObserver?: ResizeObserver;
  private destroyed = false;

  private readonly fullscreenChangeHandler = () => {
    const container = this.fullscreenContainer()?.nativeElement;

    this.isFullscreen.set(!!container && this.document.fullscreenElement === container);

    this.scheduleChartResize();
  };

  constructor() {
    // Recreate the chart only when the analysis changes.
    effect(() => {
      const canvas = this.canvas();
      const analysis = this.data();
      this.comparison();

      if (!canvas) {
        return;
      }

      this.renderChart(canvas.nativeElement, analysis);
    });

    // Resize the existing chart when the dashboard layout changes.
    effect(() => {
      this.expanded();
      this.scheduleChartResize();
    });

    this.document.addEventListener('fullscreenchange', this.fullscreenChangeHandler);
  }

  get averageTemperature(): number | null {
    const values = this.validTemperatures;

    if (!values.length) {
      return null;
    }

    return values.reduce((sum, value) => sum + value, 0) / values.length;
  }

  get minimumTemperature(): number | null {
    const values = this.validTemperatures;

    return values.length ? Math.min(...values) : null;
  }

  get maximumTemperature(): number | null {
    const values = this.validTemperatures;

    return values.length ? Math.max(...values) : null;
  }

  private get validTemperatures(): number[] {
    return this.data().temperatures.filter(
      (value): value is number => typeof value === 'number' && Number.isFinite(value),
    );
  }

  /**
   * Expand or restore the chart within Climate Analysis.
   * The form is moved by the parent component.
   */
  toggleExpanded(): void {
    this.expandedChange.emit(!this.expanded());
  }

  /**
   * Enter or exit real browser fullscreen.
   */
  async toggleFullscreen(): Promise<void> {
    const container = this.fullscreenContainer()?.nativeElement;

    if (!container) {
      return;
    }

    try {
      if (
        container &&
        this.document.fullscreenElement === container &&
        this.document.exitFullscreen
      ) {
        await this.document.exitFullscreen();
        return;
      }

      if (this.document.fullscreenElement) {
        await this.document.exitFullscreen();
      }

      if (!container.requestFullscreen) {
        return;
      }

      await container.requestFullscreen();
    } catch (error) {
      console.error('Unable to toggle chart fullscreen:', error);
    }
  }

  /**
   * Update Chart.js after a container size change.
   */
  private scheduleChartResize(): void {
    if (this.destroyed) {
      return;
    }

    requestAnimationFrame(() => {
      if (this.destroyed) {
        return;
      }

      this.chart?.resize();
      this.chart?.update('none');
    });
  }

  /**
   * Draw NASA POWER annual temperatures and linear regression.
   */
  private renderChart(canvas: HTMLCanvasElement, analysis: TrendAnalysisResponse): void {
    this.resizeObserver?.disconnect();
    this.chart?.destroy();

    const context = canvas.getContext('2d');

    if (!context) {
      return;
    }

    const chartHeight = canvas.parentElement?.clientHeight ?? 400;

    const gradient = context.createLinearGradient(0, 0, 0, Math.max(chartHeight, 1));

    gradient.addColorStop(0, 'rgba(34, 211, 238, 0.28)');

    gradient.addColorStop(0.5, 'rgba(14, 165, 233, 0.10)');

    gradient.addColorStop(1, 'rgba(14, 165, 233, 0)');

    const regression = analysis.years.map(
      (year) => analysis.intercept + analysis.slope_celsius_per_year * year,
    );

    const configuration: ChartConfiguration<'line'> = {
      type: 'line',

      data: {
        labels: analysis.years.map(String),

        datasets: [
          {
            label: this.comparison() ? 'A annual' : 'Annual temperature',
            data: analysis.temperatures,

            borderColor: '#22d3ee',
            backgroundColor: gradient,

            borderWidth: 3,
            tension: 0,

            pointRadius: 2.5,
            pointHoverRadius: 6,
            pointHitRadius: 14,

            pointBackgroundColor: '#191c1c',
            pointBorderColor: '#67e8f9',
            pointBorderWidth: 2,

            fill: true,
            spanGaps: false,
          },
          {
            label: this.comparison() ? 'A trend' : 'Linear trend',
            data: regression,

            borderColor: this.comparison() ? '#22d3ee' : '#fb923c',
            backgroundColor: 'transparent',

            borderWidth: 2.5,
            borderDash: [8, 6],

            pointRadius: 0,
            pointHoverRadius: 0,

            tension: 0,
            fill: false,
          },
        ],
      },

      options: {
        responsive: true,
        maintainAspectRatio: false,

        animation: {
          duration:
            typeof matchMedia !== 'undefined' &&
            matchMedia('(prefers-reduced-motion: reduce)').matches
              ? 0
              : 500,
          easing: 'easeOutQuart',
        },

        interaction: {
          mode: 'index',
          intersect: false,
        },

        layout: {
          padding: {
            top: 12,
            right: 12,
            bottom: 4,
            left: 4,
          },
        },

        plugins: {
          legend: {
            display: !!this.comparison(),
            position: 'bottom',
            labels: { color: '#cbd5e1', boxWidth: 16, font: { size: 11 } },
          },

          tooltip: {
            enabled: true,

            backgroundColor: '#191c1c',
            titleColor: '#ffffff',
            bodyColor: '#cbd5e1',

            borderColor: '#454b48',
            borderWidth: 1,

            padding: 8,
            cornerRadius: 10,
            displayColors: true,

            callbacks: {
              title: (items) => (items.length ? `Year ${items[0].label}` : ''),

              label: (item) => {
                const value = item.parsed.y;

                if (value === null) {
                  return item.dataset.label ?? '';
                }

                return `${item.dataset.label}: ` + `${value.toFixed(2)} °C`;
              },
            },
          },
        },

        scales: {
          x: {
            grid: {
              color: 'rgba(148, 163, 184, 0.06)',
            },

            border: {
              display: false,
            },

            ticks: {
              color: '#94a3b8',
              maxRotation: 0,
              autoSkip: true,
              maxTicksLimit: canvas.clientWidth < 500 ? 5 : 9,

              font: {
                size: 11,
              },
            },

            title: {
              display: true,
              text: 'Year',
              color: '#64748b',

              font: {
                size: 11,
              },

              padding: {
                top: 12,
              },
            },
          },

          y: {
            grid: {
              color: 'rgba(148, 163, 184, 0.10)',
            },

            border: {
              display: false,
              dash: [4, 4],
            },

            ticks: {
              color: '#94a3b8',
              padding: 12,

              callback: (value) => `${Number(value).toFixed(1)}°`,

              font: {
                size: 11,
              },
            },

            title: {
              display: true,
              text: 'Temperature (°C)',
              color: '#64748b',

              font: {
                size: 11,
              },

              padding: {
                bottom: 12,
              },
            },
          },
        },
      },
    };

    const b = this.comparison();
    if (b) {
      configuration.data.datasets.push({
        label: 'B annual',
        data: b.temperatures,
        borderColor: '#fb923c',
        pointRadius: 2,
        tension: 0,
        fill: false,
      });
      configuration.data.datasets.push({
        label: 'B trend',
        data: b.years.map((year) => b.intercept + b.slope_celsius_per_year * year),
        borderColor: '#fb923c',
        borderDash: [5, 5],
        pointRadius: 0,
        fill: false,
      });
    }
    this.chart = new Chart(context, configuration);

    // Observe the chart container so Chart.js follows layout changes.
    const host = this.chartHost()?.nativeElement;

    if (host && typeof ResizeObserver !== 'undefined') {
      this.resizeObserver = new ResizeObserver(() => {
        this.scheduleChartResize();
      });

      this.resizeObserver.observe(host);
    }
  }

  ngOnDestroy(): void {
    this.destroyed = true;

    this.document.removeEventListener('fullscreenchange', this.fullscreenChangeHandler);

    this.resizeObserver?.disconnect();

    if (
      this.fullscreenContainer()?.nativeElement &&
      this.document.exitFullscreen &&
      this.document.fullscreenElement === this.fullscreenContainer()?.nativeElement
    ) {
      void this.document.exitFullscreen().catch(() => {
        // Ignore fullscreen cleanup errors.
      });
    }

    this.chart?.destroy();
  }
}

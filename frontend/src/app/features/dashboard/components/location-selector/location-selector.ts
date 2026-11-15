import { Component, effect, input, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';

import type { ClimateQuery } from '../../../../core/models/climate.model';

export interface SelectedCoordinates {
  latitude: number;
  longitude: number;
}

interface CityOption {
  id: string;
  label: string;
  latitude: number;
  longitude: number;
}

@Component({
  selector: 'app-location-selector',
  standalone: true,
  imports: [FormsModule],
  templateUrl: './location-selector.html',
})
export class LocationSelector {
  readonly coordinates = input<SelectedCoordinates | null>(null);

  readonly horizontal = input(false);
  readonly fixedPeriod = input<{ start_year: number; end_year: number } | null>(null);
  private static nextId = 0;
  readonly idPrefix = `climate-${LocationSelector.nextId++}`;

  readonly analyze = output<ClimateQuery>();
  readonly coordinatesChange = output<SelectedCoordinates>();
  readonly maxYear = new Date().getFullYear() - 1;
  private emitCoordinates(): void {
    const latitude = this.latitude(),
      longitude = this.longitude();
    if (
      latitude !== null &&
      longitude !== null &&
      Number.isFinite(latitude) &&
      Number.isFinite(longitude) &&
      Math.abs(latitude) <= 90 &&
      Math.abs(longitude) <= 180
    )
      this.coordinatesChange.emit({ latitude, longitude });
  }

  readonly cities: CityOption[] = [
    {
      id: 'campeche',
      label: 'Campeche, Mexico',
      latitude: 19.845,
      longitude: -90.523,
    },
    {
      id: 'mexico-city',
      label: 'Mexico City, Mexico',
      latitude: 19.4326,
      longitude: -99.1332,
    },
    {
      id: 'new-york',
      label: 'New York, USA',
      latitude: 40.7128,
      longitude: -74.006,
    },
    {
      id: 'london',
      label: 'London, UK',
      latitude: 51.5074,
      longitude: -0.1278,
    },
    {
      id: 'tokyo',
      label: 'Tokyo, Japan',
      latitude: 35.6762,
      longitude: 139.6503,
    },
  ];

  readonly selectedCity = signal('campeche');

  readonly latitude = signal<number | null>(19.845);
  readonly longitude = signal<number | null>(-90.523);

  readonly startYear = signal<number | null>(2000);
  readonly endYear = signal<number | null>(2024);

  constructor() {
    effect(() => {
      const period = this.fixedPeriod();
      if (period) {
        this.startYear.set(period.start_year);
        this.endYear.set(period.end_year);
      }
    });
    effect(() => {
      const coordinates = this.coordinates();

      if (!coordinates) {
        return;
      }

      if (
        !Number.isFinite(coordinates.latitude) ||
        !Number.isFinite(coordinates.longitude) ||
        coordinates.latitude < -90 ||
        coordinates.latitude > 90 ||
        coordinates.longitude < -180 ||
        coordinates.longitude > 180
      ) {
        return;
      }

      this.latitude.set(coordinates.latitude);
      this.longitude.set(coordinates.longitude);

      const city = this.cities.find(
        (item) =>
          Math.abs(item.latitude - coordinates.latitude) < 0.000001 &&
          Math.abs(item.longitude - coordinates.longitude) < 0.000001,
      );

      this.selectedCity.set(city?.id ?? 'custom');
    });
  }

  onCityChange(id: string): void {
    this.selectedCity.set(id);

    const city = this.cities.find((item) => item.id === id);

    if (city) {
      this.latitude.set(city.latitude);
      this.longitude.set(city.longitude);
      this.emitCoordinates();
    }
  }

  onLatitudeChange(value: number | null): void {
    this.latitude.set(value);
    this.selectedCity.set('custom');
    this.emitCoordinates();
  }

  onLongitudeChange(value: number | null): void {
    this.longitude.set(value);
    this.selectedCity.set('custom');
    this.emitCoordinates();
  }

  isValid(): boolean {
    const lat = this.latitude();
    const lon = this.longitude();
    const start = this.startYear();
    const end = this.endYear();

    if (lat === null || lon === null || start === null || end === null) {
      return false;
    }

    return (
      Number.isFinite(lat) &&
      Number.isFinite(lon) &&
      lat >= -90 &&
      lat <= 90 &&
      lon >= -180 &&
      lon <= 180 &&
      Number.isInteger(start) &&
      Number.isInteger(end) &&
      start >= 1981 &&
      end <= this.maxYear &&
      start <= end &&
      end - start + 1 >= 3
    );
  }

  validationMessage(): string {
    const lat = this.latitude();
    const lon = this.longitude();
    const start = this.startYear();
    const end = this.endYear();

    if (
      lat === null ||
      lon === null ||
      !Number.isFinite(lat) ||
      !Number.isFinite(lon) ||
      lat < -90 ||
      lat > 90 ||
      lon < -180 ||
      lon > 180
    ) {
      return 'Enter valid latitude (-90 to 90) and longitude (-180 to 180).';
    }

    if (
      start === null ||
      end === null ||
      !Number.isInteger(start) ||
      !Number.isInteger(end) ||
      start < 1981 ||
      end > this.maxYear
    ) {
      return `Select years between 1981 and ${this.maxYear}.`;
    }

    if (start > end) {
      return 'The start year must not be later than the end year.';
    }

    return 'Select at least three years of observations.';
  }

  submitAnalysis(): void {
    if (!this.isValid()) {
      return;
    }

    const latitude = this.latitude();
    const longitude = this.longitude();
    const start = this.startYear();
    const end = this.endYear();

    if (latitude === null || longitude === null || start === null || end === null) {
      return;
    }

    this.analyze.emit({
      latitude,
      longitude,
      start_year: start,
      end_year: end,
    });
  }
}

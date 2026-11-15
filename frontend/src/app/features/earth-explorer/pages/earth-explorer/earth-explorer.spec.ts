import { By } from '@angular/platform-browser';
import { EarthGlobe } from '../../components/earth-globe/earth-globe';
import { TemperatureGridService } from '../../../../core/services/temperature-grid.service';
import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { describe, expect, it, vi } from 'vitest';
import { EarthExplorer } from './earth-explorer';
import { ClimateApiService } from '../../../../core/services/climate-api.service';

describe('Explorer coordinate consistency', () => {
  it('clears the previous location result when coordinates are edited manually', () => {
    TestBed.configureTestingModule({
      providers: [{ provide: ClimateApiService, useValue: { getTrendAnalysis: () => of(null) } }],
    });
    const explorer = TestBed.runInInjectionContext(() => new EarthExplorer());
    explorer.error.set('Old failure');
    explorer.loading.set(true);
    explorer.onManualA({ latitude: 30, longitude: -80 });
    expect(explorer.selectedCoordinates()).toEqual({ latitude: 30, longitude: -80 });
    expect(explorer.analysis()).toBeNull();
    expect(explorer.error()).toBeNull();
    expect(explorer.loading()).toBe(false);
  });
});

describe('Independent observation panels and points', () => {
  function createExplorer() {
    TestBed.configureTestingModule({
      providers: [{ provide: ClimateApiService, useValue: { getTrendAnalysis: () => of(null) } }],
    });
    return TestBed.runInInjectionContext(() => new EarthExplorer());
  }
  it('hides each panel independently and restores both from immersive mode', () => {
    const explorer = createExplorer();
    explorer.leftPanelVisible.set(true);
    explorer.rightPanelVisible.set(true);
    explorer.togglePanel('left');
    expect(explorer.leftPanelVisible()).toBe(false);
    expect(explorer.rightPanelVisible()).toBe(true);
    expect(explorer.immersive()).toBe(false);
    explorer.toggleImmersive();
    expect(explorer.leftPanelVisible()).toBe(false);
    expect(explorer.rightPanelVisible()).toBe(false);
    expect(explorer.immersive()).toBe(true);
    explorer.toggleImmersive();
    expect(explorer.leftPanelVisible()).toBe(true);
    expect(explorer.rightPanelVisible()).toBe(true);
  });
  it('a single emitted globe selection updates B without replacing A, and vice versa', () => {
    const explorer = createExplorer();
    const a = { latitude: 15, longitude: 20 },
      b = { latitude: -30, longitude: 40 };
    explorer.onLocationSelected(a);
    explorer.selectionTarget.set('B');
    explorer.onLocationSelected(b);
    expect(explorer.selectedCoordinates()).toEqual(a);
    expect(explorer.coordinatesB()).toEqual(b);
    explorer.selectionTarget.set('A');
    explorer.onLocationSelected({ latitude: 10, longitude: 10 });
    expect(explorer.coordinatesB()).toEqual(b);
    explorer.toggleImmersive();
    explorer.toggleImmersive();
    expect(explorer.coordinatesB()).toEqual(b);
    expect(explorer.selectedCoordinates()).toEqual({ latitude: 10, longitude: 10 });
  });
});

describe('Explorer scene lifetime', () => {
  it('keeps the same globe, panel DOM and form through every visibility change', () => {
    const initialize = vi
      .spyOn(EarthGlobe.prototype, 'ngAfterViewInit')
      .mockImplementation(() => {});
    TestBed.configureTestingModule({
      imports: [EarthExplorer],
      providers: [
        { provide: ClimateApiService, useValue: { getTrendAnalysis: () => of(null) } },
        {
          provide: TemperatureGridService,
          useValue: { sources: () => of([]), getTemperatureGrid: () => of(null) },
        },
      ],
    });
    const fixture = TestBed.createComponent(EarthExplorer);
    fixture.detectChanges();
    const host = fixture.nativeElement as HTMLElement;
    const globe = fixture.debugElement.query(By.directive(EarthGlobe)).componentInstance;
    const panel = host.querySelector('#exploration-panel');
    const form = host.querySelector('app-location-selector');
    fixture.componentInstance.leftPanelVisible.set(true);
    fixture.componentInstance.rightPanelVisible.set(true);
    for (const action of [
      () => fixture.componentInstance.togglePanel('left'),
      () => fixture.componentInstance.togglePanel('right'),
      () => fixture.componentInstance.toggleImmersive(),
      () => fixture.componentInstance.toggleImmersive(),
    ]) {
      action();
      fixture.detectChanges();
      expect(fixture.debugElement.query(By.directive(EarthGlobe)).componentInstance).toBe(globe);
      expect(host.querySelector('#exploration-panel')).toBe(panel);
      expect(host.querySelector('app-location-selector')).toBe(form);
    }
    expect(initialize).toHaveBeenCalledOnce();
    fixture.destroy();
    initialize.mockRestore();
  });
});

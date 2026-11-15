import { TestBed } from '@angular/core/testing';
import { describe, it, expect } from 'vitest';
import { LocationSelector } from './location-selector';
describe('Coordinate form integration', () => {
  it('synchronizes globe coordinates without running an analysis', () => {
    const fixture = TestBed.createComponent(LocationSelector);
    let calls = 0;
    fixture.componentInstance.analyze.subscribe(() => calls++);
    fixture.componentRef.setInput('coordinates', { latitude: -33.86, longitude: 151.2 });
    fixture.detectChanges();
    expect(fixture.componentInstance.latitude()).toBe(-33.86);
    expect(fixture.componentInstance.longitude()).toBe(151.2);
    expect(calls).toBe(0);
  });
  it('rejects empty, infinite and out-of-range manual coordinates', () => {
    const fixture = TestBed.createComponent(LocationSelector),
      form = fixture.componentInstance;
    for (const lat of [null, NaN, Infinity, 91, -91]) {
      form.latitude.set(lat);
      expect(form.isValid()).toBe(false);
    }
    form.latitude.set(0);
    form.longitude.set(181);
    expect(form.isValid()).toBe(false);
  });
  it('locks comparison years to the analyzed location', async () => {
    const fixture = TestBed.createComponent(LocationSelector);
    fixture.componentRef.setInput('fixedPeriod', { start_year: 2010, end_year: 2020 });
    fixture.detectChanges();
    expect(fixture.componentInstance.startYear()).toBe(2010);
    expect(fixture.componentInstance.endYear()).toBe(2020);
    await fixture.whenStable();
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('[name="startYear"]').disabled).toBe(true);
  });
});

import { TestBed } from '@angular/core/testing';
import { describe, expect, it, vi } from 'vitest';
import { ThermalControls } from './thermal-controls';

describe('Compact thermal controls', () => {
  it('keeps source settings collapsed while exposing both layer actions', () => {
    const fixture = TestBed.createComponent(ThermalControls);
    fixture.detectChanges();
    const host = fixture.nativeElement as HTMLElement;
    expect((host.querySelector('.thermal-options') as HTMLElement).hidden).toBe(true);
    (host.querySelector('.settings-toggle') as HTMLButtonElement).click();
    fixture.detectChanges();
    expect((host.querySelector('.thermal-options') as HTMLElement).hidden).toBe(false);
    const emit = vi.spyOn(fixture.componentInstance.layerChange, 'emit');
    (host.querySelector('.modes button:last-child') as HTMLButtonElement).click();
    expect(emit).toHaveBeenCalledWith('surface');
  });
  it('keeps retry visible without opening the advanced settings', () => {
    const fixture = TestBed.createComponent(ThermalControls);
    fixture.componentRef.setInput('error', 'NOAA unavailable');
    fixture.detectChanges();
    const host = fixture.nativeElement as HTMLElement;
    const retry = host.querySelector('.status button') as HTMLButtonElement;
    expect(retry.closest('details')).toBeNull();
    const emit = vi.spyOn(fixture.componentInstance.retry, 'emit');
    retry.click();
    expect(emit).toHaveBeenCalledOnce();
  });
});

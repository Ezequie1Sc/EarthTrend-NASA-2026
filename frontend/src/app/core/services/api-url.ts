import { InjectionToken } from '@angular/core';

const API_BASE_URL =
  'https://earthtrend-nasa-2026.onrender.com';

export const API_URL = new InjectionToken<string>('API_URL', {
  providedIn: 'root',

  factory: () => {
    const hostname =
      typeof window !== 'undefined'
        ? window.location.hostname
        : '';

    const isLocal =
      hostname === 'localhost' ||
      hostname === '127.0.0.1';

    return isLocal
      ? '/api/v1'
      : API_BASE_URL;
  },
});
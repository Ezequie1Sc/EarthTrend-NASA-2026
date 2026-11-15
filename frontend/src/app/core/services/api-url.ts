import { InjectionToken } from '@angular/core';

const API_BASE_URL = 'https://earthtrend-nasa-api.onrender.com/api/v1';

export const API_URL = new InjectionToken<string>('API_URL', {
  providedIn: 'root',
  factory: () =>
    ['localhost', '127.0.0.1'].includes(globalThis.location?.hostname) ? '/api/v1' : API_BASE_URL,
});

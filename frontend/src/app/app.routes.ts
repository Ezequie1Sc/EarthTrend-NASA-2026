import { Routes } from '@angular/router';

export const routes: Routes = [
  {
    path: '',
    pathMatch: 'full',
    title: 'EarthTrend NASA | Explore Our Planet',
    loadComponent: () => import('./features/home/pages/home/home').then((module) => module.Home),
  },
  {
    path: 'explorer',
    pathMatch: 'full',
    title: 'EarthTrend NASA | Earth Explorer',
    loadComponent: () =>
      import('./features/earth-explorer/pages/earth-explorer/earth-explorer').then(
        (module) => module.EarthExplorer,
      ),
  },
  {
    path: 'dashboard',
    title: 'EarthTrend NASA | Climate Dashboard',
    loadComponent: () =>
      import('./features/dashboard/pages/dashboard/dashboard').then((module) => module.Dashboard),
  },
  {
    path: '**',
    redirectTo: '',
  },
];

import { Routes } from '@angular/router';
import { App } from './app';

export const routes: Routes = [
  {
    path: '',
    pathMatch: 'full',
    component: App,
    title: 'Fairytales with Spice - Story Lab'
  },
  {
    path: 'proving-grounds',
    loadComponent: () => import('./proving-grounds/proving-grounds').then((module) => module.ProvingGroundsComponent),
    title: 'Fairytales with Spice - Proving Grounds'
  },
  {
    path: '**',
    redirectTo: ''
  }
];

// Created: 2025-10-31 06:28
import { Routes } from '@angular/router';

export const routes: Routes = [
  {
    path: '',
    loadComponent: () => import('./app').then(m => m.App),
    title: 'Fairytales with Spice - Story Generator'
  },
  {
    path: 'proving-grounds',
    loadComponent: () => import('./proving-grounds/proving-grounds').then(m => m.ProvingGroundsComponent),
    title: 'Proving Grounds - Test Story Prompts'
  },
  {
    path: '**',
    redirectTo: ''
  }
];

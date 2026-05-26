import { Routes } from '@angular/router';
import { App } from './app';
import { ProvingGroundsComponent } from './proving-grounds/proving-grounds';

export const routes: Routes = [
  {
    path: '',
    pathMatch: 'full',
    component: App,
    title: 'Fairytales with Spice - Story Lab'
  },
  {
    path: 'proving-grounds',
    component: ProvingGroundsComponent,
    title: 'Fairytales with Spice - Proving Grounds'
  },
  {
    path: '**',
    redirectTo: ''
  }
];

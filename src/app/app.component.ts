import { Component, ViewEncapsulation } from '@angular/core';
import { PostgresPluginComponent } from './modules/postgres/postgres-plugin.component';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [PostgresPluginComponent],
  encapsulation: ViewEncapsulation.ShadowDom,
  styleUrls: ['./app.component.css'],
  template: '<app-postgres-plugin />',
})
export class AppComponent {}

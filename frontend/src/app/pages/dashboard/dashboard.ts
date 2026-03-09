import { Component, ChangeDetectionStrategy } from '@angular/core';
import { StatsWidget } from './widgets/stats-widget';
import { StoresWidget } from './widgets/stores-widget';
import { DepartmentWidget } from './widgets/department-widget';

@Component({
  selector: 'app-dashboard',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [StatsWidget, StoresWidget, DepartmentWidget],
  template: `
    <div class="grid grid-cols-12 gap-8">
      <app-stats-widget class="contents" />
      <app-stores-widget class="col-span-12 xl:col-span-6" />
      <app-department-widget class="col-span-12 xl:col-span-6" />
    </div>
  `,
})
export class Dashboard {}

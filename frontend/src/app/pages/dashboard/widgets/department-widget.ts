import { Component, ChangeDetectionStrategy, inject, computed } from '@angular/core';
import { DealsService } from '@/app/core/services/deals.service';

interface DepartmentCount {
  name: string;
  count: number;
  percentage: number;
}

@Component({
  selector: 'app-department-widget',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="card">
      <div class="font-semibold text-xl mb-6">Department Breakdown</div>
      @if (topDepartments().length === 0) {
        <div class="text-center py-8">
          <i class="pi pi-th-large text-4xl text-muted-color mb-4" aria-hidden="true"></i>
          <p class="text-muted-color">No deals loaded yet.</p>
        </div>
      } @else {
        <ul class="list-none p-0 m-0">
          @for (dept of topDepartments(); track dept.name) {
            <li class="flex flex-col md:flex-row md:items-center md:justify-between mb-6">
              <div>
                <span class="text-surface-900 dark:text-surface-0 font-medium mr-2 mb-1 md:mb-0">{{ dept.name }}</span>
              </div>
              <div class="mt-2 md:mt-0 flex items-center">
                <div class="bg-surface-300 dark:bg-surface-500 rounded-border overflow-hidden w-40 lg:w-24" style="height: 8px">
                  <div class="bg-primary h-full" [style.width.%]="dept.percentage"></div>
                </div>
                <span class="text-muted-color ml-4 font-medium w-8 text-right">{{ dept.count }}</span>
              </div>
            </li>
          }
        </ul>
      }
    </div>
  `,
})
export class DepartmentWidget {
  private dealsService = inject(DealsService);

  topDepartments = computed<DepartmentCount[]>(() => {
    const deals = this.dealsService.deals();
    const counts = new Map<string, number>();

    for (const deal of deals) {
      counts.set(deal.dept, (counts.get(deal.dept) || 0) + 1);
    }

    const sorted = Array.from(counts.entries())
      .map(([name, count]) => ({ name, count, percentage: 0 }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 8);

    const max = sorted[0]?.count || 1;
    for (const dept of sorted) {
      dept.percentage = (dept.count / max) * 100;
    }

    return sorted;
  });
}

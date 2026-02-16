import { Component, ChangeDetectionStrategy } from '@angular/core';

@Component({
  selector: 'app-footer',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="layout-footer">
      Grocery Price Tracker
    </div>
  `
})
export class FooterComponent {}

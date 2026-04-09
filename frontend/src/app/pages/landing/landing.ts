import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { AuthService } from '@auth0/auth0-angular';
import { ButtonModule } from 'primeng/button';

@Component({
  selector: 'app-landing',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ButtonModule],
  styles: `
    :host {
      display: block;
    }

    .landing-wrapper {
      min-height: 100vh;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      background: var(--surface-ground);
      padding: 2rem;
    }

    .landing-card {
      background: var(--surface-card);
      border-radius: 1.5rem;
      padding: 3rem 2.5rem;
      max-width: 500px;
      width: 100%;
      text-align: center;
      box-shadow: 0 4px 24px rgba(0,0,0,0.08);
    }

    .logo-icon {
      font-size: 3rem;
      color: var(--primary-color);
      margin-bottom: 1.25rem;
    }

    h1 {
      font-size: 2rem;
      font-weight: 700;
      margin: 0 0 0.75rem;
      color: var(--text-color);
    }

    .tagline {
      color: var(--text-color-secondary);
      font-size: 1.05rem;
      margin-bottom: 2rem;
      line-height: 1.6;
    }

    .feature-list {
      list-style: none;
      padding: 0;
      margin: 0 0 2.5rem;
      text-align: left;
      display: flex;
      flex-direction: column;
      gap: 0.75rem;
    }

    .feature-list li {
      display: flex;
      align-items: center;
      gap: 0.6rem;
      color: var(--text-color-secondary);
      font-size: 0.95rem;
    }

    .feature-list li i {
      color: var(--primary-color);
      font-size: 1rem;
    }
  `,
  template: `
    <div class="landing-wrapper">
      <div class="landing-card">
        <i class="pi pi-shopping-cart logo-icon" aria-hidden="true"></i>
        <h1>Grocery Price Tracker</h1>
        <p class="tagline">
          Track weekly deals from your local grocery stores — all in one place.
        </p>

        <ul class="feature-list" aria-label="Features">
          <li><i class="pi pi-check-circle" aria-hidden="true"></i> Browse weekly ads for King Soopers, Safeway &amp; Sprouts</li>
          <li><i class="pi pi-check-circle" aria-hidden="true"></i> Filter deals by department</li>
          <li><i class="pi pi-check-circle" aria-hidden="true"></i> Track price history across weeks</li>
        </ul>

        <p-button
          label="Get Started"
          icon="pi pi-arrow-right"
          iconPos="right"
          size="large"
          (onClick)="login()"
          [style]="{ width: '100%' }"
        />
      </div>
    </div>
  `,
})
export class Landing {
  private auth = inject(AuthService);

  login(): void {
    this.auth.loginWithRedirect({ appState: { target: '/' } });
  }
}

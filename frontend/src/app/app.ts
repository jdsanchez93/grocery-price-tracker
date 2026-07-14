import { Component, computed, inject } from '@angular/core';
import { NavigationEnd, NavigationError, Router, RouterOutlet } from '@angular/router';
import { AuthService } from '@auth0/auth0-angular';
import { toSignal } from '@angular/core/rxjs-interop';
import { ChangeDetectionStrategy } from '@angular/core';
import { ToastModule } from "primeng/toast";
import { filter, map, take } from 'rxjs/operators';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, ToastModule],
  templateUrl: './app.html',
  styleUrl: './app.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class App {
  private auth = inject(AuthService);
  private router = inject(Router);

  private authLoading = toSignal(this.auth.isLoading$, { initialValue: true });

  /**
   * True once the first navigation has settled. Until then the router-outlet
   * is empty (guards resolving, lazy chunks downloading), so the app-level
   * spinner must stay up or the user sees a blank screen.
   * NavigationCancel is deliberately ignored: guard redirects (e.g. landing →
   * dashboard) cancel the current navigation and immediately start another.
   */
  private initialNavigationDone = toSignal(
    this.router.events.pipe(
      filter(e => e instanceof NavigationEnd || e instanceof NavigationError),
      take(1),
      map(() => true)
    ),
    { initialValue: false }
  );

  isLoading = computed(() => this.authLoading() || !this.initialNavigationDone());
}

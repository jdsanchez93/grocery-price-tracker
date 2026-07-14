import { ComponentFixture, TestBed } from '@angular/core/testing';
import { App } from './app';
import { AuthService } from '@auth0/auth0-angular';
import { BehaviorSubject } from 'rxjs';
import { By } from '@angular/platform-browser';
import { provideRouter, Router } from '@angular/router';
import { MessageService } from 'primeng/api';

describe('App', () => {
  let component: App;
  let fixture: ComponentFixture<App>;
  let isLoading$: BehaviorSubject<boolean>;

  beforeEach(async () => {
    isLoading$ = new BehaviorSubject<boolean>(false);
    const authMock = {
      isLoading$: isLoading$.asObservable(),
    };

    await TestBed.configureTestingModule({
      imports: [App],
      providers: [
        { provide: AuthService, useValue: authMock },
        provideRouter([{ path: '', children: [] }]),
        MessageService,
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(App);
    component = fixture.componentInstance;
  });

  /** Completes the first navigation so initialNavigationDone becomes true. */
  async function completeInitialNavigation() {
    await TestBed.inject(Router).navigateByUrl('/');
  }

  it('should create the app', () => {
    expect(component).toBeTruthy();
  });

  it('should show the loading spinner when auth is loading', () => {
    isLoading$.next(true);
    fixture.detectChanges();

    const loader = fixture.debugElement.query(By.css('.app-loader'));
    expect(loader).toBeTruthy();
    expect(loader.attributes['role']).toBe('status');
    expect(loader.attributes['aria-label']).toBe('Loading');
  });

  it('should keep showing the spinner after auth completes until the first navigation ends', () => {
    isLoading$.next(false);
    fixture.detectChanges();

    expect(fixture.debugElement.query(By.css('.app-loader'))).toBeTruthy();
    expect(fixture.debugElement.query(By.css('router-outlet'))).toBeNull();
  });

  it('should hide the loading spinner when auth is done and navigation has completed', async () => {
    isLoading$.next(false);
    await completeInitialNavigation();
    fixture.detectChanges();

    const loader = fixture.debugElement.query(By.css('.app-loader'));
    expect(loader).toBeNull();
  });

  it('should show the router outlet when auth is done and navigation has completed', async () => {
    isLoading$.next(false);
    await completeInitialNavigation();
    fixture.detectChanges();

    const outlet = fixture.debugElement.query(By.css('router-outlet'));
    expect(outlet).toBeTruthy();
  });

  it('should keep showing the spinner while auth loads even after navigation completes', async () => {
    isLoading$.next(true);
    await completeInitialNavigation();
    fixture.detectChanges();

    expect(fixture.debugElement.query(By.css('.app-loader'))).toBeTruthy();
  });

  it('should render p-toast for global error notifications', () => {
    fixture.detectChanges();
    const toast = fixture.debugElement.query(By.css('p-toast'));
    expect(toast).toBeTruthy();
  });

  it('should transition from loading to done', async () => {
    isLoading$.next(true);
    fixture.detectChanges();
    expect(fixture.debugElement.query(By.css('.app-loader'))).toBeTruthy();

    isLoading$.next(false);
    await completeInitialNavigation();
    fixture.detectChanges();
    expect(fixture.debugElement.query(By.css('.app-loader'))).toBeNull();
    expect(fixture.debugElement.query(By.css('router-outlet'))).toBeTruthy();
  });
});

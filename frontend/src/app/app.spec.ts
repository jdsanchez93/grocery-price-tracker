import { ComponentFixture, TestBed } from '@angular/core/testing';
import { App } from './app';
import { AuthService } from '@auth0/auth0-angular';
import { BehaviorSubject } from 'rxjs';
import { By } from '@angular/platform-browser';
import { provideRouter } from '@angular/router';

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
        provideRouter([]),
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(App);
    component = fixture.componentInstance;
  });

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

  it('should hide the loading spinner when auth is done loading', () => {
    isLoading$.next(false);
    fixture.detectChanges();

    const loader = fixture.debugElement.query(By.css('.app-loader'));
    expect(loader).toBeNull();
  });

  it('should show the router outlet when auth is done loading', () => {
    isLoading$.next(false);
    fixture.detectChanges();

    const outlet = fixture.debugElement.query(By.css('router-outlet'));
    expect(outlet).toBeTruthy();
  });

  it('should transition from loading to done', () => {
    isLoading$.next(true);
    fixture.detectChanges();
    expect(fixture.debugElement.query(By.css('.app-loader'))).toBeTruthy();

    isLoading$.next(false);
    fixture.detectChanges();
    expect(fixture.debugElement.query(By.css('.app-loader'))).toBeNull();
    expect(fixture.debugElement.query(By.css('router-outlet'))).toBeTruthy();
  });
});

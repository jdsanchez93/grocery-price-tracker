import { ComponentFixture, TestBed } from '@angular/core/testing';

import { StoreCard } from './store-card';
import { Component } from '@angular/core';
import { ButtonModule } from 'primeng/button';

describe('StoreCard', () => {
  let component: StoreCard;
  let fixture: ComponentFixture<StoreCard>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [StoreCard]
    })
      .compileComponents();

    fixture = TestBed.createComponent(StoreCard);
    component = fixture.componentInstance;

    // Defaults — override in individual tests as needed
    fixture.componentRef.setInput('name', 'Test Store #42');
    fixture.componentRef.setInput('storeType', 'kingsoopers');
    await fixture.whenStable();
  });

  it('should derive metadata for kingsoopers', () => {
    fixture.componentRef.setInput('storeType', 'kingsoopers');
    fixture.detectChanges();
    expect(component.storeDisplayName()).toBe('King Soopers');
    expect(component.tagSeverity()).toBe('info');
  });

  it('should derive metadata for safeway', () => {
    fixture.componentRef.setInput('storeType', 'safeway');
    fixture.detectChanges();
    expect(component.storeDisplayName()).toBe('Safeway');
    expect(component.tagSeverity()).toBe('danger');
  });

  it('should derive metadata for sprouts', () => {
    fixture.componentRef.setInput('storeType', 'sprouts');
    fixture.detectChanges();
    expect(component.storeDisplayName()).toBe('Sprouts');
    expect(component.tagSeverity()).toBe('success');
  });

  it('should render the DOM', () => {
    expect(fixture.nativeElement.textContent).toContain('King Soopers');
    expect(fixture.nativeElement.querySelector('p-tag')).toBeTruthy();
  });

  it('should project content', () => {

  });

  describe('address input', () => {
    it('does not render address block when address input is not provided', () => {
      fixture.detectChanges();
      const addressEl = fixture.nativeElement.querySelector('.store-address');
      expect(addressEl).toBeFalsy();
    });

    it('renders address block with full address when provided', () => {
      fixture.componentRef.setInput('address', {
        addressLine1: '1234 Pearl St',
        city: 'Boulder',
        state: 'CO',
        zipCode: '80000',
      });
      fixture.detectChanges();
      const text = fixture.nativeElement.textContent;
      expect(text).toContain('1234 Pearl St');
      expect(text).toContain('Boulder, CO');
    });

    it('renders city and state when addressLine1 is absent', () => {
      fixture.componentRef.setInput('address', {
        addressLine1: '',
        city: 'Denver',
        state: 'CO',
      });
      fixture.detectChanges();
      const addressEl = fixture.nativeElement.querySelector('.store-address');
      expect(addressEl).toBeTruthy();
      expect(addressEl.textContent).toContain('Denver, CO');
      expect(addressEl.textContent).not.toContain('undefined');
    });

    it('does not render address block when address is undefined', () => {
      fixture.componentRef.setInput('address', undefined);
      fixture.detectChanges();
      const addressEl = fixture.nativeElement.querySelector('.store-address');
      expect(addressEl).toBeFalsy();
    });
  });
});

describe('Store Card content projection', () => {
  @Component({
    template: `
      <app-store-card name="Test" storeType="kingsoopers">
        <p-button label="Delete" />
      </app-store-card>
    `,
    imports: [StoreCard, ButtonModule],
  })
  class TestHost {}

  let fixture: ComponentFixture<TestHost>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [TestHost],
    }).compileComponents();

    fixture = TestBed.createComponent(TestHost);
    fixture.detectChanges();
  });

  it('should project content into footer', () => {
    const button = fixture.nativeElement.querySelector('p-button');
    expect(button).toBeTruthy();
  });
});

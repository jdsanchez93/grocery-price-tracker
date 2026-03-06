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
    expect(component.chainName()).toBe('kroger');
    expect(component.tagSeverity()).toBe('info');
  });

  it('should derive metadata for safeway', () => {
    fixture.componentRef.setInput('storeType', 'safeway');
    fixture.detectChanges();
    expect(component.storeDisplayName()).toBe('Safeway');
    expect(component.chainName()).toBe('albertsons');
    expect(component.tagSeverity()).toBe('danger');
  });

  it('should derive metadata for sprouts', () => {
    fixture.componentRef.setInput('storeType', 'sprouts');
    fixture.detectChanges();
    expect(component.storeDisplayName()).toBe('Sprouts');
    expect(component.chainName()).toBe('sprouts');
    expect(component.tagSeverity()).toBe('success');
  });

  it('should render the DOM', () => {
    expect(fixture.nativeElement.textContent).toContain('King Soopers');
    expect(fixture.nativeElement.textContent).toContain('kroger');
    expect(fixture.nativeElement.querySelector('p-tag')).toBeTruthy();
  });

  it('should project content', () => {

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

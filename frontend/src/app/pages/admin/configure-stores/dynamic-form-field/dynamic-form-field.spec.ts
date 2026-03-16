import { ComponentFixture, TestBed } from '@angular/core/testing';
import { FormControl, FormGroup, Validators } from '@angular/forms';
import { DynamicFormField } from './dynamic-form-field';
import { FieldConfig } from '../../../../core/models/store.model';

function makeField(overrides: Partial<FieldConfig> = {}): FieldConfig {
  return { key: 'storeId', controlType: 'text', label: 'Store ID', placeholder: 'e.g. 123', ...overrides };
}

function makeForm(key: string = 'storeId'): FormGroup {
  return new FormGroup({ [key]: new FormControl('', Validators.required) });
}

describe('DynamicFormField', () => {
  let fixture: ComponentFixture<DynamicFormField>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [DynamicFormField],
    }).compileComponents();

    fixture = TestBed.createComponent(DynamicFormField);
    fixture.componentRef.setInput('field', makeField());
    fixture.componentRef.setInput('form', makeForm());
    fixture.detectChanges();
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(fixture.componentInstance).toBeTruthy();
  });

  it('renders a label with the field label text', () => {
    const label = fixture.nativeElement.querySelector('label');
    expect(label.textContent.trim()).toBe('Store ID');
  });

  it('label for attribute matches field key', () => {
    const label = fixture.nativeElement.querySelector('label');
    expect(label.getAttribute('for')).toBe('storeId');
  });

  it('renders a text input for controlType "text"', () => {
    const input = fixture.nativeElement.querySelector('input');
    expect(input).toBeTruthy();
    expect(input.type).toBe('text');
  });

  it('input id matches field key', () => {
    const input = fixture.nativeElement.querySelector('input');
    expect(input.id).toBe('storeId');
  });

  it('input placeholder matches field placeholder', () => {
    const input = fixture.nativeElement.querySelector('input');
    expect(input.placeholder).toBe('e.g. 123');
  });

  it('renders hint text when field.hint is provided', () => {
    fixture.componentRef.setInput('field', makeField({ hint: 'Kroger store number' }));
    fixture.detectChanges();
    const hint = fixture.nativeElement.querySelector('small.text-surface-500');
    expect(hint).toBeTruthy();
    expect(hint.textContent.trim()).toBe('Kroger store number');
  });

  it('does not render hint element when field.hint is absent', () => {
    const hint = fixture.nativeElement.querySelector('small.text-surface-500');
    expect(hint).toBeNull();
  });

  it('does not show validation error when control is untouched', () => {
    const error = fixture.nativeElement.querySelector('small.text-red-500');
    expect(error).toBeNull();
  });

  it('shows required error when control is invalid and touched', () => {
    const form = makeForm();
    fixture.componentRef.setInput('form', form);
    fixture.detectChanges();

    form.controls['storeId'].markAsTouched();
    fixture.detectChanges();

    const error = fixture.nativeElement.querySelector('small.text-red-500');
    expect(error).toBeTruthy();
    expect(error.textContent).toContain('Store ID is required');
  });

  it('does not show error when control is valid and touched', () => {
    const form = makeForm();
    form.controls['storeId'].setValue('12345');
    form.controls['storeId'].markAsTouched();
    fixture.componentRef.setInput('form', form);
    fixture.detectChanges();

    const error = fixture.nativeElement.querySelector('small.text-red-500');
    expect(error).toBeNull();
  });
});

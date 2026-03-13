import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { InputTextModule } from 'primeng/inputtext';
import { FieldConfig } from '../../../../core/models/store.model';

@Component({
  selector: 'app-dynamic-form-field',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ReactiveFormsModule, InputTextModule],
  template: `
    <div class="flex flex-col gap-1" [formGroup]="form()">
      <label [for]="field().key">{{ field().label }}</label>

      @switch (field().controlType) {
        @case ('text') {
          <input pInputText
                 [id]="field().key"
                 [formControlName]="field().key"
                 type="text"
                 [placeholder]="field().placeholder" />
        }
        @case ('select') {
          <!-- placeholder for future p-select / autocomplete -->
        }
      }

      @if (field().hint) {
        <small class="text-surface-500">{{ field().hint }}</small>
      }
      @if (control.invalid && control.touched) {
        <small class="text-red-500">{{ field().label }} is required</small>
      }
    </div>
  `,
})
export class DynamicFormField {
  field = input.required<FieldConfig>();
  form = input.required<FormGroup>();

  get control() { return this.form().controls[this.field().key]; }
}

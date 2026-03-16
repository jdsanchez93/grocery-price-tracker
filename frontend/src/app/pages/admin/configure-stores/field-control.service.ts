import { Injectable } from '@angular/core';
import { FormControl, FormGroup, Validators } from '@angular/forms';
import { FieldConfig } from '../../../core/models/store.model';

@Injectable({ providedIn: 'root' })
export class FieldControlService {
  toFormGroup(fields: FieldConfig[]): FormGroup {
    const group: Record<string, FormControl> = {};
    for (const field of fields) {
      group[field.key] = new FormControl('', Validators.required);
    }
    return new FormGroup(group);
  }
}

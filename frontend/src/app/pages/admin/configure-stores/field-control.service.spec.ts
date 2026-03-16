import { FormGroup, Validators } from '@angular/forms';
import { FieldControlService } from './field-control.service';
import { FieldConfig, STORE_FIELD_CONFIGS } from '../../../core/models/store.model';

describe('FieldControlService', () => {
  let service: FieldControlService;

  beforeEach(() => {
    service = new FieldControlService();
  });

  it('returns an empty FormGroup for an empty fields array', () => {
    const group = service.toFormGroup([]);
    expect(Object.keys(group.controls)).toHaveLength(0);
  });

  it('creates controls for kingsoopers fields (storeId, facilityId)', () => {
    const group = service.toFormGroup(STORE_FIELD_CONFIGS['kingsoopers']);
    expect(Object.keys(group.controls)).toEqual(['storeId', 'facilityId']);
  });

  it('creates controls for safeway fields (storeId, postalCode)', () => {
    const group = service.toFormGroup(STORE_FIELD_CONFIGS['safeway']);
    expect(Object.keys(group.controls)).toEqual(['storeId', 'postalCode']);
  });

  it('creates controls for sprouts fields (storeId)', () => {
    const group = service.toFormGroup(STORE_FIELD_CONFIGS['sprouts']);
    expect(Object.keys(group.controls)).toEqual(['storeId']);
  });

  it('initializes all controls with empty string value', () => {
    const group = service.toFormGroup(STORE_FIELD_CONFIGS['kingsoopers']);
    expect(group.get('storeId')!.value).toBe('');
    expect(group.get('facilityId')!.value).toBe('');
  });

  it('each control is invalid when empty (required validator)', () => {
    const group = service.toFormGroup(STORE_FIELD_CONFIGS['kingsoopers']);
    expect(group.get('storeId')!.invalid).toBe(true);
    expect(group.get('facilityId')!.invalid).toBe(true);
  });

  it('each control becomes valid when given a non-empty value', () => {
    const group = service.toFormGroup(STORE_FIELD_CONFIGS['kingsoopers']);
    group.get('storeId')!.setValue('12345');
    group.get('facilityId')!.setValue('67890');
    expect(group.get('storeId')!.valid).toBe(true);
    expect(group.get('facilityId')!.valid).toBe(true);
  });

  it('returns a fresh FormGroup instance on each call', () => {
    const fields: FieldConfig[] = STORE_FIELD_CONFIGS['kingsoopers'];
    const a = service.toFormGroup(fields);
    const b = service.toFormGroup(fields);
    expect(a).not.toBe(b);
  });
});

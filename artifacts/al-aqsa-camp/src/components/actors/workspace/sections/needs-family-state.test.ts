import assert from 'node:assert/strict';
import test from 'node:test';
import {
  FAMILY_LIST_LOAD_ERROR_MESSAGE,
  FAMILY_LIST_LOAD_ERROR_TITLE,
  canSubmitNeed,
} from './needs-family-state';

test('explains a failed family list load and blocks need submission until retry succeeds', () => {
  const failedFamilyList = {
    familiesLoading: false,
    familiesError: true,
    familyCount: 0,
  };

  assert.equal(FAMILY_LIST_LOAD_ERROR_TITLE, 'تعذر تحميل قائمة الأسر');
  assert.match(FAMILY_LIST_LOAD_ERROR_MESSAGE, /لا يمكن تسجيل طلب احتياج/);
  assert.equal(
    canSubmitNeed({ familyId: null, ...failedFamilyList }),
    false,
    'a need cannot be submitted without a loaded beneficiary family',
  );
  assert.equal(
    canSubmitNeed({ familyId: 'family-123', ...failedFamilyList }),
    false,
    'a stale family selection must not submit while the family list is unavailable',
  );
});

test('allows submission after the family list is loaded and a family is selected', () => {
  assert.equal(
    canSubmitNeed({
      familyId: 'family-123',
      familiesLoading: false,
      familiesError: false,
      familyCount: 1,
    }),
    true,
  );
});
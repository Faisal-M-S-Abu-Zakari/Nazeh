import assert from 'node:assert/strict';
import test from 'node:test';
import type { NeedInput } from '@workspace/api-client-react';
import {
  NEED_SUBMISSION_ERROR_MESSAGE,
  NEED_SUBMISSION_ERROR_TITLE,
  submitNeed,
} from './needs-submission';

test('keeps a need form ready to retry after the first save fails', () => {
  const values: NeedInput = {
    familyId: 'family-123',
    category: 'MEDICAL',
    priority: 'HIGH',
    title: 'أدوية للأطفال',
    description: 'جرعة تكفي الأسرة لأسبوع',
  };
  const attempts: Array<{
    data: NeedInput;
    onSuccess: () => void;
    onError: () => void;
  }> = [];
  const errorStates: boolean[] = [];
  const navigations: string[] = [];
  let invalidationCount = 0;

  const dependencies = {
    mutate: (
      variables: { data: NeedInput },
      callbacks: { onSuccess: () => void; onError: () => void },
    ) => {
      attempts.push({ data: variables.data, ...callbacks });
    },
    setSubmitError: (hasError: boolean) => errorStates.push(hasError),
    invalidateNeeds: () => {
      invalidationCount += 1;
    },
    navigate: (path: string) => navigations.push(path),
  };

  assert.equal(submitNeed(values, dependencies), true);
  assert.equal(attempts.length, 1);
  assert.deepEqual(attempts[0].data, values);

  attempts[0].onError();
  assert.equal(errorStates.at(-1), true);
  assert.equal(NEED_SUBMISSION_ERROR_TITLE, 'تعذر حفظ الاحتياج');
  assert.equal(
    NEED_SUBMISSION_ERROR_MESSAGE,
    'لم نتمكن من إرسال طلب الاحتياج. بقيت بياناتك كما هي؛ راجعها وحاول مرة أخرى.',
  );

  assert.equal(submitNeed(values, dependencies), true);
  assert.equal(errorStates.at(-1), false);
  assert.equal(attempts.length, 2);
  assert.deepEqual(
    attempts[1].data,
    values,
    'the retry must use every value that was entered before the failed request',
  );

  attempts[1].onSuccess();
  assert.equal(errorStates.at(-1), false);
  assert.equal(invalidationCount, 1);
  assert.deepEqual(navigations, ['/needs']);
});
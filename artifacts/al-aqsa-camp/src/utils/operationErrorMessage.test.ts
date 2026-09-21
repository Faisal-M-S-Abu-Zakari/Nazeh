import { strict as assert } from 'node:assert';
import test from 'node:test';
import { ApiError } from '@workspace/api-client-react';
import { getOperationErrorMessage } from './operationErrorMessage';

function apiError(code: string, rawError = 'internal stack trace: secret details') {
  return new ApiError(
    new Response(null, { status: 409, statusText: 'Conflict' }),
    { code, error: rawError },
    { method: 'POST', url: '/api/sync/operations' },
  );
}

test('translates known rejection codes into safe Arabic messages', () => {
  assert.equal(
    getOperationErrorMessage(apiError('AID_STOCK_INSUFFICIENT'), 'aid-assignment'),
    'الكمية المتاحة لا تكفي لهذا التخصيص. راجع المخزون وحاول بكمية أقل.',
  );
  assert.equal(
    getOperationErrorMessage(apiError('VERSION_CONFLICT'), 'need-status'),
    'تم تحديث الطلب من موظف آخر. حدّث القائمة، راجع الحالة الحالية، ثم حاول مرة أخرى.',
  );
});

test('uses a safe retryable message when the server reason is unknown', () => {
  const message = getOperationErrorMessage(apiError('UNKNOWN_REASON'), 'aid-receipt');

  assert.equal(message, 'تعذر إكمال العملية. لم تتغير البيانات؛ راجع المعلومات وحاول مرة أخرى.');
  assert.equal(message.includes('internal stack trace'), false);
  assert.equal(message.includes('secret details'), false);
});
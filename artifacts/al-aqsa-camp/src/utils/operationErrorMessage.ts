import { ApiError } from '@workspace/api-client-react';

type OperationErrorCode =
  | 'VERSION_CONFLICT'
  | 'PERMISSION_DENIED'
  | 'NEED_NOT_FOUND'
  | 'AID_NOT_FOUND'
  | 'NEED_NOT_APPROVED'
  | 'AID_STOCK_INSUFFICIENT'
  | 'AID_DISTRIBUTION_DUPLICATE'
  | 'AID_DISTRIBUTION_NOT_FOUND'
  | 'AID_DISTRIBUTION_ALREADY_RECEIVED';

type OperationKind = 'need-status' | 'aid-assignment' | 'aid-receipt';

type ErrorPayload = {
  code?: unknown;
};

const genericMessage = 'تعذر إكمال العملية. لم تتغير البيانات؛ راجع المعلومات وحاول مرة أخرى.';

const messages: Record<OperationErrorCode, string> = {
  VERSION_CONFLICT: 'تم تحديث الطلب من موظف آخر. حدّث القائمة، راجع الحالة الحالية، ثم حاول مرة أخرى.',
  PERMISSION_DENIED: 'لا تملك الصلاحية لتنفيذ هذا الإجراء.',
  NEED_NOT_FOUND: 'لم يعد طلب الاحتياج متاحاً. حدّث القائمة للتحقق من حالته.',
  AID_NOT_FOUND: 'لم تعد المساعدة متاحة. حدّث القائمة للتحقق من المخزون.',
  NEED_NOT_APPROVED: 'لا يمكن تخصيص المساعدة إلا لطلب تمت الموافقة عليه.',
  AID_STOCK_INSUFFICIENT: 'الكمية المتاحة لا تكفي لهذا التخصيص. راجع المخزون وحاول بكمية أقل.',
  AID_DISTRIBUTION_DUPLICATE: 'تم تخصيص هذه المساعدة لهذه الأسرة مسبقاً. حدّث سجل التوزيع قبل المحاولة مجدداً.',
  AID_DISTRIBUTION_NOT_FOUND: 'لم يعد سجل التوزيع متاحاً. حدّث سجل التوزيع للتحقق من حالته.',
  AID_DISTRIBUTION_ALREADY_RECEIVED: 'تم تأكيد تسليم هذه المساعدة مسبقاً. حدّث سجل التوزيع للتحقق من الحالة.',
};

function getErrorCode(error: unknown): OperationErrorCode | undefined {
  if (!(error instanceof ApiError)) return undefined;
  const payload = error.data as ErrorPayload | null;
  const code = payload && typeof payload.code === 'string' ? payload.code : undefined;
  return code && code in messages ? code as OperationErrorCode : undefined;
}

export function getOperationErrorMessage(error: unknown, _kind: OperationKind): string {
  return getErrorCode(error) ? messages[getErrorCode(error)!] : genericMessage;
}
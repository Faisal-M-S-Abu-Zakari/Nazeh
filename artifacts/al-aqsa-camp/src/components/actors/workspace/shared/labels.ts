export const Labels: Record<string, string> = {
  PENDING_APPROVAL: 'بانتظار الاعتماد',
  ACTIVE: 'نشطة',
  ARCHIVED: 'مؤرشفة',
  REQUIRED: 'مطلوب',
  APPROVED: 'معتمد',
  IN_PROGRESS: 'قيد المعالجة',
  FULFILLED: 'منفّذ',
  CANCELLED: 'ملغى',
  ASSIGNED: 'مسند للتسليم',
  RECEIVED: 'تم الاستلام',
  CRITICAL: 'حرج',
  HIGH: 'عالي',
  MEDIUM: 'متوسط',
  LOW: 'منخفض',
  MANAGER: 'مدير النظام',
  DELEGATE: 'مندوب ميداني',
  SECURITY_OFFICER: 'مسؤول أمن',
  SECURITY_MEMBER: 'فرد أمن',
  DISPLACED: 'نازح',
  MALE: 'ذكر',
  FEMALE: 'أنثى',
  OTHER: 'غير محدد',
  PENDING: 'قيد الانتظار',
  COMPLETED: 'مكتملة'
};

export const StatusVariant = (value: string) =>
  value === 'ACTIVE' || value === 'FULFILLED' || value === 'COMPLETED' ? 'default' :
  value === 'PENDING_APPROVAL' || value === 'REQUIRED' || value === 'PENDING' ? 'secondary' :
  value === 'ARCHIVED' || value === 'CANCELLED' ? 'destructive' : 'outline';

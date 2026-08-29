import bcrypt from "bcrypt";
import { db, pool } from "./index";
import { aids, complaints, people, staffUsers, syncAuditEvents, tasks } from "./schema";

const ids = {
  admin: "10000000-0000-4000-8000-000000000001",
  manager: "10000000-0000-4000-8000-000000000002",
  delegate: "10000000-0000-4000-8000-000000000003",
  security: "10000000-0000-4000-8000-000000000004",
  delegateTwo: "10000000-0000-4000-8000-000000000005",
  securityTwo: "10000000-0000-4000-8000-000000000006",
};

async function seed() {
  if (process.env.NODE_ENV !== "development") {
    throw new Error("Development seed requires NODE_ENV=development");
  }
  const passwordHash = await bcrypt.hash("CampDemo2025!", 12);
  await db.insert(staffUsers).values([
    { id: ids.admin, email: "admin@alaqsa.local", name: "مدير النظام", role: "ADMIN", passwordHash, active: true, passwordSetAt: new Date(), isDevelopmentDemo: true },
    { id: ids.manager, email: "manager@alaqsa.local", name: "أحمد الخطيب", role: "MANAGER", passwordHash, active: true, passwordSetAt: new Date(), isDevelopmentDemo: true },
    { id: ids.delegate, email: "delegate@alaqsa.local", name: "سارة النجار", role: "DELEGATE", passwordHash, active: true, passwordSetAt: new Date(), isDevelopmentDemo: true },
    { id: ids.security, email: "security@alaqsa.local", name: "محمود سالم", role: "SECURITY_OFFICER", passwordHash, active: true, passwordSetAt: new Date(), isDevelopmentDemo: true },
    { id: ids.delegateTwo, email: "delegate2@alaqsa.local", name: "ليان أبو عودة", role: "DELEGATE", passwordHash, active: true, passwordSetAt: new Date(), isDevelopmentDemo: true },
    { id: ids.securityTwo, email: "security2@alaqsa.local", name: "عمر حمدان", role: "SECURITY_OFFICER", passwordHash, active: true, passwordSetAt: new Date(), isDevelopmentDemo: true },
  ]).onConflictDoNothing();

  await db.insert(aids).values([
    { id: "20000000-0000-4000-8000-000000000001", title: "طرود غذائية عائلية", type: "FOOD", quantity: 180, unit: "طرد", location: "نقطة التوزيع الشرقية", distributionDate: "2026-08-24", notes: "تكفي الأسرة لمدة أسبوع وتشمل الأرز والزيت والدقيق.", createdById: ids.manager },
    { id: "20000000-0000-4000-8000-000000000002", title: "عبوات مياه شرب", type: "WATER", quantity: 600, unit: "عبوة", location: "الساحة المركزية", distributionDate: "2026-08-26", notes: "توزيع يومي على قطاعات المخيم.", createdById: ids.delegate },
    { id: "20000000-0000-4000-8000-000000000003", title: "حقيبة إسعاف أولي", type: "MEDICAL", quantity: 45, unit: "حقيبة", location: "النقطة الطبية الشمالية", distributionDate: "2026-08-28", notes: "مخصصة للعيادات ونقاط التجمع.", createdById: ids.manager },
    { id: "20000000-0000-4000-8000-000000000004", title: "مستلزمات النظافة الأسرية", type: "HYGIENE", quantity: 120, unit: "حزمة", location: "المستودع رقم 2", distributionDate: "2026-09-01", notes: "صابون ومعقمات وفوط صحية.", createdById: ids.delegateTwo },
    { id: "20000000-0000-4000-8000-000000000005", title: "بطانيات وخيام إضافية", type: "SHELTER", quantity: 70, unit: "طقم", location: "بوابة الخدمات الغربية", distributionDate: "2026-09-03", notes: "للعائلات التي تحتاج إلى مساحة إيواء إضافية.", createdById: ids.manager },
  ]).onConflictDoNothing();

  await db.insert(people).values([
    { id: "30000000-0000-4000-8000-000000000001", nationalId: "DEV-100021", fullName: "أمينة يوسف العطار", gender: "FEMALE", birthDate: "1987-04-12", phone: "0590000121", tentNumber: "ب-17", familySize: 6, createdById: ids.delegate },
    { id: "30000000-0000-4000-8000-000000000002", nationalId: "DEV-100022", fullName: "خالد محمد أبو عودة", gender: "MALE", birthDate: "1979-11-03", tentNumber: "ج-08", familySize: 5, notes: "تحتاج الأسرة إلى متابعة طبية دورية.", createdById: ids.delegate },
    { id: "30000000-0000-4000-8000-000000000003", nationalId: "DEV-100023", fullName: "مريم عبد الله النجار", gender: "FEMALE", birthDate: "1992-07-19", phone: "0590000123", tentNumber: "أ-04", familySize: 4, notes: "لديها طفلان في سن المدرسة.", createdById: ids.delegate },
    { id: "30000000-0000-4000-8000-000000000004", nationalId: "DEV-100024", fullName: "يوسف سليمان حمدان", gender: "MALE", birthDate: "1968-02-26", phone: "0590000124", tentNumber: "د-21", familySize: 3, notes: "يحتاج إلى أدوية للضغط.", createdById: ids.delegateTwo },
    { id: "30000000-0000-4000-8000-000000000005", nationalId: "DEV-100025", fullName: "نور الدين فؤاد", gender: "MALE", birthDate: "2001-10-08", tentNumber: "هـ-11", familySize: 2, notes: "مسجل للمساعدة في نقل كبار السن.", createdById: ids.delegateTwo },
    { id: "30000000-0000-4000-8000-000000000006", nationalId: "DEV-100026", fullName: "رنا محمود الكيلاني", gender: "FEMALE", birthDate: "1984-12-15", phone: "0590000126", tentNumber: "و-03", familySize: 7, notes: "أسرة كبيرة وتحتاج إلى حزمة نظافة إضافية.", createdById: ids.delegateTwo },
  ]).onConflictDoNothing();

  await db.insert(complaints).values([
    { id: "40000000-0000-4000-8000-000000000001", complainantName: "ليلى حسن", subject: "تأخر تعبئة خزان المياه", description: "لم تصل صهاريج المياه إلى القطاع الغربي منذ يومين، ونرجو تحديد موعد التعبئة القادم.", status: "IN_REVIEW", location: "القطاع الغربي", createdById: ids.manager },
    { id: "40000000-0000-4000-8000-000000000002", complainantName: "يوسف إبراهيم", subject: "إنارة الممر بين القطاعين", description: "الممر بين الصفين د وهـ يحتاج إلى مصباح إضافي لتسهيل حركة الأسر بعد المغرب.", status: "OPEN", location: "الممر د-هـ", createdById: ids.delegate },
    { id: "40000000-0000-4000-8000-000000000003", complainantName: "مريم عبد الله النجار", subject: "الحاجة إلى موعد للعيادة", description: "نحتاج إلى تنظيم موعد قريب لفحص طفل يعاني من ارتفاع الحرارة.", status: "RESOLVED", location: "القطاع الشرقي", reply: "تم حجز موعد في النقطة الطبية الشمالية صباح الغد.", repliedById: ids.manager, repliedAt: new Date("2026-08-28T09:30:00Z"), createdById: ids.delegate },
    { id: "40000000-0000-4000-8000-000000000004", complainantName: "يوسف سليمان حمدان", subject: "ازدحام نقطة توزيع المياه", description: "يتكرر الازدحام عند نقطة المياه في الفترة المسائية ونقترح تنظيم الدور على مجموعات.", status: "IN_REVIEW", location: "القطاع الجنوبي", createdById: ids.delegateTwo },
    { id: "40000000-0000-4000-8000-000000000005", complainantName: "رنا محمود الكيلاني", subject: "تسرب مياه قرب الخيمة", description: "يوجد تسرب بسيط قرب الخيمة ونتخوف من اتساعه مع الأمطار.", status: "OPEN", location: "القطاع الغربي", createdById: ids.delegateTwo },
    { id: "40000000-0000-4000-8000-000000000006", complainantName: "خالد محمد أبو عودة", subject: "شكر لفريق التوزيع", description: "نشكر فريق التوزيع على التزامه بالدور ووصول الطرد في الموعد.", status: "RESOLVED", location: "القطاع الشمالي", reply: "يسعدنا وصول المساعدة، وشكرًا على ملاحظتكم.", repliedById: ids.manager, repliedAt: new Date("2026-08-27T14:00:00Z"), createdById: ids.delegate },
  ]).onConflictDoNothing();

  await db.insert(tasks).values([
    { id: "50000000-0000-4000-8000-000000000001", title: "تأمين توزيع الطرود", description: "تنظيم الطابور وتأمين نقطة التوزيع الصباحية مع الحفاظ على ممر واضح للحالات الطبية.", location: "نقطة التوزيع الشرقية", priority: "HIGH", status: "PENDING", assignedToId: ids.security, createdById: ids.manager },
    { id: "50000000-0000-4000-8000-000000000002", title: "جولة السلامة الليلية", description: "فحص الإنارة ومخارج الطوارئ في جميع القطاعات وتسجيل أي ملاحظة قبل منتصف الليل.", location: "كامل المخيم", priority: "MEDIUM", status: "IN_PROGRESS", assignedToId: ids.security, createdById: ids.manager },
    { id: "50000000-0000-4000-8000-000000000003", title: "تنظيم بوابة الخدمات", description: "تخصيص مسار للمركبات الخدمية ومنع الوقوف أمام مدخل النقطة الطبية.", location: "البوابة الغربية", priority: "URGENT", status: "PENDING", assignedToId: ids.securityTwo, dueAt: new Date("2026-08-30T07:30:00Z"), createdById: ids.manager },
    { id: "50000000-0000-4000-8000-000000000004", title: "فحص طفايات الحريق", description: "التأكد من وجود الطفايات وصلاحيتها في المطابخ الجماعية ومخزن المواد.", location: "المطابخ الجماعية", priority: "HIGH", status: "COMPLETED", assignedToId: ids.securityTwo, dueAt: new Date("2026-08-27T16:00:00Z"), createdById: ids.manager },
    { id: "50000000-0000-4000-8000-000000000005", title: "مرافقة قافلة المياه", description: "مرافقة شاحنة المياه من البوابة إلى الخزانات والتنسيق مع مسؤول التوزيع.", location: "الطريق الداخلي", priority: "MEDIUM", status: "COMPLETED", assignedToId: ids.security, dueAt: new Date("2026-08-26T11:00:00Z"), createdById: ids.delegate },
    { id: "50000000-0000-4000-8000-000000000006", title: "مراقبة الهدوء المسائي", description: "تنفيذ جولة قصيرة حول أماكن التجمع والتأكد من بقاء الممرات مفتوحة.", location: "الساحة المركزية", priority: "LOW", status: "IN_PROGRESS", assignedToId: ids.securityTwo, createdById: ids.manager },
  ]).onConflictDoNothing();

  await db.insert(syncAuditEvents).values([
    { id: "60000000-0000-4000-8000-000000000001", actorStaffId: ids.manager, action: "CREATE", entityType: "AID", entityId: "20000000-0000-4000-8000-000000000001", metadata: { description: "إضافة طرد غذائي للعائلات" } },
    { id: "60000000-0000-4000-8000-000000000002", actorStaffId: ids.delegate, action: "CREATE", entityType: "PERSON", entityId: "30000000-0000-4000-8000-000000000001", metadata: { description: "تسجيل أسرة جديدة" } },
    { id: "60000000-0000-4000-8000-000000000003", actorStaffId: ids.delegateTwo, action: "CREATE", entityType: "COMPLAINT", entityId: "40000000-0000-4000-8000-000000000004", metadata: { description: "تسجيل ملاحظة خدمية" } },
    { id: "60000000-0000-4000-8000-000000000004", actorStaffId: ids.security, action: "STATUS", entityType: "TASK", entityId: "50000000-0000-4000-8000-000000000002", metadata: { description: "بدء جولة السلامة الليلية" } },
  ]).onConflictDoNothing();
}

seed()
  .then(() => console.log("Development data seeded"))
  .finally(() => pool.end());

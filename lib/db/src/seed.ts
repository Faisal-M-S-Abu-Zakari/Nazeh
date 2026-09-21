import bcrypt from "bcrypt";
import { and, eq, inArray, ne } from "drizzle-orm";
import { db, pool } from "./index";
import {
  aids,
  campSectorsTable,
  campsTable,
  complaints,
  familyMembersTable,
  familiesTable,
  familyNeedsTable,
  people,
  shelterUnitsTable,
  staffUsers,
  syncAuditEvents,
  tasks,
} from "./schema";

const ids = {
  admin: "10000000-0000-4000-8000-000000000001",
  manager: "10000000-0000-4000-8000-000000000002",
  delegate: "10000000-0000-4000-8000-000000000003",
  security: "10000000-0000-4000-8000-000000000004",
  delegateTwo: "10000000-0000-4000-8000-000000000005",
  securityTwo: "10000000-0000-4000-8000-000000000006",
  securityMember: "10000000-0000-4000-8000-000000000007",
  camp: "70000000-0000-4000-8000-000000000001",
  north: "71000000-0000-4000-8000-000000000001",
  south: "71000000-0000-4000-8000-000000000002",
  tentNorth: "72000000-0000-4000-8000-000000000001",
  tentSouth: "72000000-0000-4000-8000-000000000002",
  familyOne: "73000000-0000-4000-8000-000000000001",
  familyTwo: "73000000-0000-4000-8000-000000000002",
};

async function seed() {
  if (process.env.NODE_ENV !== "development") {
    throw new Error("Development seed requires NODE_ENV=development");
  }
  const passwordHash = await bcrypt.hash("CampDemo2025!", 12);
  // Historical administrator rows may still be referenced by audit or
  // operational records. Retire them instead of deleting them, then keep the
  // single canonical manager below active.
  await db.update(staffUsers).set({ active: false }).where(and(
    inArray(staffUsers.role, ["ADMIN", "MANAGER"]),
    ne(staffUsers.id, ids.manager),
  ));
  const demoStaff: Array<typeof staffUsers.$inferInsert> = [
    { id: ids.manager, email: "manager@alaqsa.local", name: "أحمد الخطيب", role: "MANAGER", passwordHash, active: true, passwordSetAt: new Date(), isDevelopmentDemo: true },
    { id: ids.delegate, email: "delegate@alaqsa.local", name: "سارة النجار", role: "DELEGATE", passwordHash, active: true, passwordSetAt: new Date(), isDevelopmentDemo: true },
    { id: ids.security, email: "security@alaqsa.local", name: "محمود سالم", role: "SECURITY_OFFICER", passwordHash, active: true, passwordSetAt: new Date(), isDevelopmentDemo: true },
    { id: ids.delegateTwo, email: "delegate2@alaqsa.local", name: "ليان أبو عودة", role: "DELEGATE", passwordHash, active: true, passwordSetAt: new Date(), isDevelopmentDemo: true },
    { id: ids.securityTwo, email: "security2@alaqsa.local", name: "عمر حمدان", role: "SECURITY_OFFICER", passwordHash, active: true, passwordSetAt: new Date(), isDevelopmentDemo: true },
    { id: ids.securityMember, email: "security-member@alaqsa.local", name: "فارس شحادة", role: "SECURITY_MEMBER", passwordHash, active: true, passwordSetAt: new Date(), isDevelopmentDemo: true },
  ];
  await db.insert(staffUsers).values(demoStaff).onConflictDoNothing();
  for (const user of demoStaff) {
    await db.update(staffUsers).set({
      email: user.email,
      name: user.name,
      role: user.role,
      passwordHash,
      active: true,
      passwordSetAt: new Date(),
      isDevelopmentDemo: true,
    }).where(eq(staffUsers.id, user.id!));
  }

  await db.insert(campsTable).values({
    id: ids.camp,
    name: "مخيم الأقصى",
    active: true,
  }).onConflictDoNothing();
  await db.insert(campSectorsTable).values([
    { id: ids.north, campId: ids.camp, name: "القطاع الشمالي" },
    { id: ids.south, campId: ids.camp, name: "القطاع الجنوبي" },
  ]).onConflictDoNothing();
  await db.insert(shelterUnitsTable).values([
    { id: ids.tentNorth, sectorId: ids.north, code: "ش-17", capacity: 2, status: "OCCUPIED" },
    { id: ids.tentSouth, sectorId: ids.south, code: "ج-08", capacity: 2, status: "OCCUPIED" },
  ]).onConflictDoNothing();
  await db.insert(familiesTable).values([
    {
      id: ids.familyOne,
      campId: ids.camp,
      sectorId: ids.north,
      shelterId: ids.tentNorth,
      headName: "أمينة يوسف العطار",
      headPhone: "0590000121",
      delegateId: ids.delegate,
      status: "ACTIVE",
      criticalNotes: "طفل يحتاج إلى متابعة طبية دورية.",
      createdById: ids.delegate,
      approvedById: ids.manager,
      approvedAt: new Date("2026-08-25T09:00:00Z"),
    },
    {
      id: ids.familyTwo,
      campId: ids.camp,
      sectorId: ids.south,
      shelterId: ids.tentSouth,
      headName: "خالد محمد أبو عودة",
      headPhone: "0590000122",
      delegateId: ids.delegateTwo,
      status: "PENDING_APPROVAL",
      criticalNotes: "أحد أفراد الأسرة مصاب بمرض مزمن.",
      createdById: ids.delegateTwo,
    },
  ]).onConflictDoNothing();
  await db.insert(familyMembersTable).values([
    { id: "74000000-0000-4000-8000-000000000001", familyId: ids.familyOne, fullName: "أمينة يوسف العطار", gender: "FEMALE", relationship: "رب الأسرة", criticalCase: false },
    { id: "74000000-0000-4000-8000-000000000002", familyId: ids.familyOne, fullName: "يوسف أمينة العطار", gender: "MALE", birthDate: "2018-03-11", relationship: "ابن", criticalCase: true, criticalNotes: "يحتاج إلى متابعة طبية" },
    { id: "74000000-0000-4000-8000-000000000003", familyId: ids.familyTwo, fullName: "خالد محمد أبو عودة", gender: "MALE", relationship: "رب الأسرة", criticalCase: true, criticalNotes: "مرض مزمن" },
  ]).onConflictDoNothing();
  await db.insert(familyNeedsTable).values([
    { id: "75000000-0000-4000-8000-000000000001", familyId: ids.familyOne, category: "MEDICAL", title: "دواء للطفل", description: "دواء متابعة أسبوعية", priority: "CRITICAL", status: "REQUIRED", createdById: ids.delegate },
    { id: "75000000-0000-4000-8000-000000000002", familyId: ids.familyTwo, category: "FOOD", title: "طرد غذائي", description: "احتياج عاجل للأسرة", priority: "HIGH", status: "IN_PROGRESS", createdById: ids.delegateTwo },
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
    { id: "50000000-0000-4000-8000-000000000007", title: "تفقد ممر القطاع الشمالي", description: "التأكد من خلو الممرات من العوائق ورفع النتيجة لمسؤول الأمن.", location: "القطاع الشمالي", priority: "MEDIUM", status: "PENDING", assignedToId: ids.securityMember, createdById: ids.manager },
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

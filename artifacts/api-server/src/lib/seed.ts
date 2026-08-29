import { and, eq } from "drizzle-orm";
import { aidRecipientsTable, aidsTable, complaintsTable, contentPostsTable, db, displacedPersonsTable, notificationsTable, securityTaskAssigneesTable, securityTasksTable, usersTable } from "@workspace/db";
import { hashPassword } from "./security";
import { logger } from "./logger";

let seeded: Promise<void> | undefined;
/** Minimal, idempotent local data only. It is deliberately never callable in production. */
export function seedDevelopmentData(): Promise<void> {
  if (process.env.NODE_ENV !== "development") return Promise.resolve();
  seeded ??= (async () => {
    const passwordHash = await hashPassword("CampDemo2025!");
    type LegacyRole = "MANAGER" | "DELEGATE" | "SECURITY" | "DISPLACED";
    const addUser = async (
      name: string,
      email: string,
      role: LegacyRole,
      identity: string,
      details: Partial<typeof usersTable.$inferInsert> = {},
    ) => {
      const [byIdentity] = await db.select().from(usersTable).where(eq(usersTable.identity, identity)).limit(1);
      if (byIdentity) return byIdentity;
      const [byEmail] = await db.select().from(usersTable).where(eq(usersTable.email, email)).limit(1);
      if (byEmail) return byEmail;
      return (await db.insert(usersTable).values({
        name, email, role, rank: role, identity, passwordHash, active: true, ...details,
      }).returning())[0];
    };
    const addPerson = async (
      userId: number,
      delegateUserId: number | null,
      details: {
        familyNumber: number;
        tentName: string;
        previousResidence: string;
        healthNotes?: string;
      },
    ) => {
      const [existing] = await db.select().from(displacedPersonsTable)
        .where(eq(displacedPersonsTable.userId, userId)).limit(1);
      if (existing) return existing;
      return (await db.insert(displacedPersonsTable).values({
        userId, delegateUserId, ...details,
      }).returning())[0];
    };
    const addAid = async (createdBy: number, values: {
      title: string;
      type: string;
      description: string;
      targetFamilies: number;
      status: "DRAFT" | "ACTIVE" | "COMPLETED" | "CANCELLED";
      startsAt: Date;
      endsAt: Date;
    }) => {
      const [existing] = await db.select().from(aidsTable)
        .where(and(eq(aidsTable.title, values.title), eq(aidsTable.createdBy, createdBy))).limit(1);
      if (existing) return existing;
      return (await db.insert(aidsTable).values({ ...values, createdBy }).returning())[0];
    };
    const addComplaint = async (authorUserId: number, recipientUserId: number | null, values: {
      type: string;
      subject: string;
      body: string;
      status?: "PENDING" | "IN_PROGRESS" | "RESOLVED" | "REJECTED";
      reply?: string;
      repliedBy?: number;
      repliedAt?: Date;
    }) => {
      const [existing] = await db.select().from(complaintsTable)
        .where(and(eq(complaintsTable.authorUserId, authorUserId), eq(complaintsTable.subject, values.subject))).limit(1);
      if (existing) return existing;
      return (await db.insert(complaintsTable).values({
        ...values, authorUserId, recipientUserId,
      }).returning())[0];
    };
    const addNotification = async (recipientUserId: number, actorUserId: number, title: string, body: string, action: string) => {
      const [existing] = await db.select().from(notificationsTable)
        .where(and(eq(notificationsTable.recipientUserId, recipientUserId), eq(notificationsTable.title, title))).limit(1);
      if (existing) return existing;
      return (await db.insert(notificationsTable).values({
        recipientUserId, actorUserId, type: "SYSTEM", action, title, body,
      }).returning())[0];
    };
    const addTask = async (createdBy: number, values: {
      title: string;
      body: string;
      dueAt: Date;
      status?: "UPCOMING" | "IN_PROGRESS" | "COMPLETED" | "CANCELLED";
      assignedToId: number;
    }) => {
      const [existing] = await db.select().from(securityTasksTable)
        .where(and(eq(securityTasksTable.title, values.title), eq(securityTasksTable.createdBy, createdBy))).limit(1);
      if (existing) return existing;
      const [task] = await db.insert(securityTasksTable).values({
        ...values, createdBy,
      }).returning();
      await db.insert(securityTaskAssigneesTable).values({
        taskId: task.id, securityUserId: values.assignedToId,
      }).onConflictDoNothing();
      return task;
    };
    const addContent = async (authorUserId: number, values: {
      title: string;
      summary: string;
      body: string;
      type: "ADS" | "BLOG" | "SUCCESS_STORIES";
      status: "DRAFT" | "PUBLISHED" | "ARCHIVED";
      publishedAt?: Date;
    }) => {
      const [existing] = await db.select().from(contentPostsTable)
        .where(and(eq(contentPostsTable.title, values.title), eq(contentPostsTable.authorUserId, authorUserId))).limit(1);
      if (existing) return existing;
      return (await db.insert(contentPostsTable).values({ ...values, authorUserId }).returning())[0];
    };

    const manager = await addUser("أحمد الخطيب", "staff@alaqsa.local", "MANAGER", "dev-manager", {
      phoneNumber: "0590000101", gender: "MALE", nationality: "فلسطيني", education: "إدارة الأزمات",
    });
    const delegate = await addUser("سارة النجار", "delegate@local.invalid", "DELEGATE", "dev-delegate", {
      phoneNumber: "0590000102", gender: "FEMALE", nationality: "فلسطينية", education: "الخدمة الاجتماعية",
    });
    const delegateTwo = await addUser("ليان أبو عودة", "delegate2@local.invalid", "DELEGATE", "dev-delegate-2", {
      phoneNumber: "0590000103", gender: "FEMALE", nationality: "فلسطينية", education: "التمريض المجتمعي",
    });
    const security = await addUser("محمود سالم", "security@local.invalid", "SECURITY", "dev-security", {
      phoneNumber: "0590000104", gender: "MALE", nationality: "فلسطيني",
    });
    const securityTwo = await addUser("عمر حمدان", "security2@local.invalid", "SECURITY", "dev-security-2", {
      phoneNumber: "0590000105", gender: "MALE", nationality: "فلسطيني",
    });
    const residentOne = await addUser("أمينة يوسف العطار", "resident@local.invalid", "DISPLACED", "dev-resident", {
      phoneNumber: "0590000121", gender: "FEMALE", nationality: "فلسطينية", age: 39, socialStatus: "متزوجة",
    });
    const residentTwo = await addUser("خالد محمد أبو عودة", "resident2@local.invalid", "DISPLACED", "dev-resident-2", {
      phoneNumber: "0590000122", gender: "MALE", nationality: "فلسطيني", age: 46, socialStatus: "متزوج",
    });
    const residentThree = await addUser("مريم عبد الله النجار", "resident3@local.invalid", "DISPLACED", "dev-resident-3", {
      phoneNumber: "0590000123", gender: "FEMALE", nationality: "فلسطينية", age: 34, socialStatus: "متزوجة",
    });
    const residentFour = await addUser("يوسف سليمان حمدان", "resident4@local.invalid", "DISPLACED", "dev-resident-4", {
      phoneNumber: "0590000124", gender: "MALE", nationality: "فلسطيني", age: 58, socialStatus: "متزوج",
    });
    const personOne = await addPerson(residentOne.id, delegate.id, {
      familyNumber: 6, tentName: "ب-17", previousResidence: "حي الشجاعية",
      healthNotes: "تحتاج الأسرة إلى متابعة طبية دورية.",
    });
    const personTwo = await addPerson(residentTwo.id, delegate.id, {
      familyNumber: 5, tentName: "ج-08", previousResidence: "منطقة الزيتون",
      healthNotes: "يوجد فرد يحتاج إلى متابعة ضغط الدم.",
    });
    const personThree = await addPerson(residentThree.id, delegateTwo.id, {
      familyNumber: 4, tentName: "أ-04", previousResidence: "حي الرمال",
      healthNotes: "لديها طفلان في سن المدرسة.",
    });
    const personFour = await addPerson(residentFour.id, delegateTwo.id, {
      familyNumber: 3, tentName: "د-21", previousResidence: "بلدة بيت حانون",
      healthNotes: "يحتاج إلى أدوية منتظمة للضغط.",
    });

    const aidOne = await addAid(manager.id, {
      title: "طرود غذائية عائلية",
      type: "غذاء",
      description: "أرز وزيت ودقيق وبقوليات تكفي الأسرة لمدة أسبوع.",
      targetFamilies: 180,
      status: "ACTIVE",
      startsAt: new Date("2026-08-24T08:00:00Z"),
      endsAt: new Date("2026-09-02T16:00:00Z"),
    });
    const aidTwo = await addAid(manager.id, {
      title: "عبوات مياه الشرب اليومية",
      type: "مياه",
      description: "توزيع عبوات مياه آمنة على نقاط التجمع في القطاعات.",
      targetFamilies: 240,
      status: "ACTIVE",
      startsAt: new Date("2026-08-26T06:30:00Z"),
      endsAt: new Date("2026-09-05T16:00:00Z"),
    });
    const aidThree = await addAid(delegate.id, {
      title: "حقائب الإسعاف الأولي",
      type: "طبي",
      description: "مستلزمات إسعاف أولي للعيادات ونقاط التجمع.",
      targetFamilies: 45,
      status: "COMPLETED",
      startsAt: new Date("2026-08-20T08:00:00Z"),
      endsAt: new Date("2026-08-27T15:00:00Z"),
    });
    await db.insert(aidRecipientsTable).values([
      { aidId: aidOne.id, displacedPersonId: personOne.id, assignedBy: delegate.id, portion: 1, status: "RECEIVED", receivedAt: new Date("2026-08-25T10:00:00Z") },
      { aidId: aidOne.id, displacedPersonId: personTwo.id, assignedBy: delegate.id, portion: 1, status: "ASSIGNED" },
      { aidId: aidTwo.id, displacedPersonId: personThree.id, assignedBy: delegateTwo.id, portion: 2, status: "RECEIVED", receivedAt: new Date("2026-08-27T09:00:00Z") },
      { aidId: aidTwo.id, displacedPersonId: personFour.id, assignedBy: delegateTwo.id, portion: 1, status: "ASSIGNED" },
    ]).onConflictDoNothing();

    await addComplaint(residentOne.id, manager.id, {
      type: "WATER", subject: "تأخر تعبئة خزان المياه",
      body: "لم تصل صهاريج المياه إلى القطاع الغربي منذ يومين، ونرجو تحديد موعد التعبئة القادم.",
      status: "IN_PROGRESS",
    });
    await addComplaint(residentTwo.id, manager.id, {
      type: "LIGHTING", subject: "إنارة الممر بين القطاعين",
      body: "الممر بين الصفين د وهـ يحتاج إلى مصباح إضافي لتسهيل حركة الأسر بعد المغرب.",
      status: "PENDING",
    });
    await addComplaint(residentThree.id, manager.id, {
      type: "MEDICAL", subject: "الحاجة إلى موعد للعيادة",
      body: "نحتاج إلى تنظيم موعد قريب لفحص طفل يعاني من ارتفاع الحرارة.",
      status: "RESOLVED", reply: "تم حجز موعد في النقطة الطبية الشمالية صباح الغد.",
      repliedBy: manager.id, repliedAt: new Date("2026-08-28T09:30:00Z"),
    });
    await addComplaint(residentFour.id, manager.id, {
      type: "WATER", subject: "ازدحام نقطة توزيع المياه",
      body: "يتكرر الازدحام عند نقطة المياه في الفترة المسائية ونقترح تنظيم الدور على مجموعات.",
      status: "IN_PROGRESS",
    });
    await addNotification(delegate.id, manager.id, "تحديث توزيع الأسر", "تم إسناد أسرتين جديدتين إلى نطاق متابعتك في القطاع الشرقي.", "ASSIGNMENT");
    await addNotification(delegate.id, manager.id, "موعد توزيع الطرود", "يبدأ توزيع الطرود الغذائية غدًا عند الساعة الثامنة صباحًا.", "AID_UPDATE");
    await addNotification(delegateTwo.id, manager.id, "شكوى تحتاج إلى متابعة", "تم تسجيل ملاحظة حول ازدحام نقطة المياه في القطاع الجنوبي.", "COMPLAINT");
    await addNotification(security.id, manager.id, "مهمة أمنية جديدة", "تم إسناد مهمة تأمين توزيع الطرود إلى فريقك.", "TASK_ASSIGNMENT");
    await addNotification(securityTwo.id, manager.id, "تذكير بجولة السلامة", "يرجى استكمال فحص بوابة الخدمات قبل بداية التوزيع.", "TASK_REMINDER");

    await addTask(manager.id, {
      title: "تأمين توزيع الطرود",
      body: "تنظيم الطابور وتأمين نقطة التوزيع الصباحية مع الحفاظ على ممر واضح للحالات الطبية.",
      dueAt: new Date("2026-08-30T08:00:00Z"), status: "UPCOMING", assignedToId: security.id,
    });
    await addTask(manager.id, {
      title: "جولة السلامة الليلية",
      body: "فحص الإنارة ومخارج الطوارئ في جميع القطاعات وتسجيل أي ملاحظة قبل منتصف الليل.",
      dueAt: new Date("2026-08-29T22:00:00Z"), status: "IN_PROGRESS", assignedToId: security.id,
    });
    await addTask(manager.id, {
      title: "تنظيم بوابة الخدمات",
      body: "تخصيص مسار للمركبات الخدمية ومنع الوقوف أمام مدخل النقطة الطبية.",
      dueAt: new Date("2026-08-30T07:30:00Z"), status: "UPCOMING", assignedToId: securityTwo.id,
    });
    await addTask(manager.id, {
      title: "فحص طفايات الحريق",
      body: "التأكد من وجود الطفايات وصلاحيتها في المطابخ الجماعية ومخزن المواد.",
      dueAt: new Date("2026-08-27T16:00:00Z"), status: "COMPLETED", assignedToId: securityTwo.id,
    });
    await addTask(delegate.id, {
      title: "مرافقة قافلة المياه",
      body: "مرافقة شاحنة المياه من البوابة إلى الخزانات والتنسيق مع مسؤول التوزيع.",
      dueAt: new Date("2026-08-26T11:00:00Z"), status: "COMPLETED", assignedToId: security.id,
    });

    await addContent(manager.id, {
      title: "إعلان مواعيد توزيع المياه",
      summary: "مواعيد توزيع المياه على قطاعات المخيم خلال الأسبوع القادم.",
      body: "تبدأ فرق المياه جولتها اليومية من القطاع الشرقي عند الساعة السادسة والنصف صباحًا، ثم تنتقل إلى الساحة المركزية والقطاع الغربي. يرجى الالتزام بالدور وإحضار العبوات النظيفة.",
      type: "ADS", status: "PUBLISHED", publishedAt: new Date("2026-08-27T07:00:00Z"),
    });
    await addContent(manager.id, {
      title: "أخبار نقطة الدعم الطبي",
      summary: "توسيع ساعات استقبال الحالات في النقطة الطبية الشمالية.",
      body: "تستقبل النقطة الطبية الشمالية الحالات من الساعة الثامنة صباحًا حتى السادسة مساءً، مع أولوية للأطفال وكبار السن والحالات الطارئة.",
      type: "BLOG", status: "PUBLISHED", publishedAt: new Date("2026-08-28T10:00:00Z"),
    });
    await addContent(manager.id, {
      title: "قصة نجاح: فريق الجيران",
      summary: "مبادرة أهلية لتنظيم ممرات الحركة ومساندة كبار السن.",
      body: "ساهم فريق الجيران في تنظيم حركة الأسر عند نقاط التوزيع ومرافقة كبار السن إلى النقطة الطبية. وتستمر المبادرة بالتنسيق مع مندوبي القطاعات.",
      type: "SUCCESS_STORIES", status: "PUBLISHED", publishedAt: new Date("2026-08-29T12:00:00Z"),
    });
    await addContent(manager.id, {
      title: "مسودة خطة التعليم المؤقت",
      summary: "خطة قيد المراجعة لتنظيم مساحة تعليمية للأطفال.",
      body: "تتضمن الخطة حصصًا قصيرة للقراءة والحساب وأنشطة دعم نفسي اجتماعي.",
      type: "BLOG", status: "DRAFT",
    });
    logger.info({ people: 4, aids: 3, complaints: 4, tasks: 5 }, "Arabic development data seeded");
  })().catch((error: unknown) => { seeded = undefined; logger.warn({ error }, "Development seed unavailable"); });
  return seeded;
}
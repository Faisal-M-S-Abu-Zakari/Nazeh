import bcrypt from "bcrypt";
import { db, pool } from "./index";
import { aids, complaints, people, staffUsers, tasks } from "./schema";

const ids = {
  admin: "10000000-0000-4000-8000-000000000001",
  manager: "10000000-0000-4000-8000-000000000002",
  delegate: "10000000-0000-4000-8000-000000000003",
  security: "10000000-0000-4000-8000-000000000004",
};

async function seed() {
  if (process.env.NODE_ENV === "production") {
    throw new Error("Development seed must not run in production");
  }
  const passwordHash = await bcrypt.hash("CampDemo2025!", 12);
  await db.insert(staffUsers).values([
    { id: ids.admin, email: "admin@alaqsa.local", name: "مدير النظام", role: "ADMIN", passwordHash },
    { id: ids.manager, email: "manager@alaqsa.local", name: "أحمد الخطيب", role: "MANAGER", passwordHash },
    { id: ids.delegate, email: "delegate@alaqsa.local", name: "سارة النجار", role: "DELEGATE", passwordHash },
    { id: ids.security, email: "security@alaqsa.local", name: "محمود سالم", role: "SECURITY_OFFICER", passwordHash },
  ]).onConflictDoNothing();

  await db.insert(aids).values([
    { id: "20000000-0000-4000-8000-000000000001", title: "طرود غذائية عائلية", type: "FOOD", quantity: 180, unit: "طرد", location: "نقطة التوزيع الشرقية", distributionDate: "2025-08-24", notes: "تكفي الأسرة لمدة أسبوع", createdById: ids.manager },
    { id: "20000000-0000-4000-8000-000000000002", title: "عبوات مياه شرب", type: "WATER", quantity: 600, unit: "عبوة", location: "الساحة المركزية", distributionDate: "2025-08-26", createdById: ids.delegate },
  ]).onConflictDoNothing();

  await db.insert(people).values([
    { id: "30000000-0000-4000-8000-000000000001", nationalId: "DEV-100021", fullName: "أمينة يوسف العطار", gender: "FEMALE", birthDate: "1987-04-12", phone: "0590000121", tentNumber: "ب-17", familySize: 6, createdById: ids.delegate },
    { id: "30000000-0000-4000-8000-000000000002", nationalId: "DEV-100022", fullName: "خالد محمد أبو عودة", gender: "MALE", birthDate: "1979-11-03", tentNumber: "ج-08", familySize: 5, notes: "تحتاج الأسرة إلى متابعة طبية", createdById: ids.delegate },
  ]).onConflictDoNothing();

  await db.insert(complaints).values([
    { id: "40000000-0000-4000-8000-000000000001", complainantName: "ليلى حسن", subject: "تأخر تعبئة خزان المياه", description: "لم تصل صهاريج المياه إلى القطاع الغربي منذ يومين.", status: "IN_REVIEW", location: "القطاع الغربي" },
    { id: "40000000-0000-4000-8000-000000000002", complainantName: "يوسف إبراهيم", subject: "إنارة الممر", description: "الممر بين الصفين د وهـ يحتاج إلى مصباح إضافي.", status: "OPEN", location: "الممر د-هـ" },
  ]).onConflictDoNothing();

  await db.insert(tasks).values([
    { id: "50000000-0000-4000-8000-000000000001", title: "تأمين توزيع الطرود", description: "تنظيم الطابور وتأمين نقطة التوزيع الصباحية.", location: "نقطة التوزيع الشرقية", priority: "HIGH", status: "PENDING", assignedToId: ids.security },
    { id: "50000000-0000-4000-8000-000000000002", title: "جولة السلامة الليلية", description: "فحص الإنارة ومخارج الطوارئ في جميع القطاعات.", location: "كامل المخيم", priority: "MEDIUM", status: "IN_PROGRESS", assignedToId: ids.security },
  ]).onConflictDoNothing();
}

seed()
  .then(() => console.log("Development data seeded"))
  .finally(() => pool.end());
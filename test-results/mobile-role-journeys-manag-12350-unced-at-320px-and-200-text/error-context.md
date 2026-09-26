# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: mobile-role-journeys.spec.ts >> manager dashboard and operations actions stay readable and announced at 320px and 200% text
- Location: artifacts/api-server/e2e/mobile-role-journeys.spec.ts:323:1

# Error details

```
Error: expect(locator).toBeVisible() failed

Locator: getByText('التقارير', { exact: true })
Expected: visible
Timeout: 15000ms
Error: element(s) not found

Call log:
  - Expect "toBeVisible" with timeout 15000ms
  - waiting for getByText('التقارير', { exact: true })

```

```yaml
- button "الإشعارات": 
- text: نازح إدارة المخيمات الإنسانية
- img "شعار نازح والعنقاء"
- text: مندوب مرحباً، Presentation DELEGATE ما يحتاج انتباهك اليوم، في مكان واحد.
- button "تعذرت المزامنة. اسحب للتحديث أو أعد المحاولة.. اضغط لإعادة المحاولة": تعذرت المزامنة. اسحب للتحديث أو أعد المحاولة. 
- text: ابدأ العمل
- button "تسجيل مساعدة، إضافة حملة أو توزيع":  تسجيل مساعدة إضافة حملة أو توزيع 
- button "إضافة فرد، تحديث سجل النازحين":  إضافة فرد تحديث سجل النازحين 
- button "تسجيل شكوى، توثيق ومتابعة الحالة":  تسجيل شكوى توثيق ومتابعة الحالة 
- button "تحتاج متابعة. 3 شكاوى مفتوحة":  تحتاج متابعة 3 شكاوى مفتوحة 
- text: انتقل إلى
- button "العائلات، سجلات الأسر":  العائلات سجلات الأسر 
- button "الاحتياجات، الطلبات القائمة":  الاحتياجات الطلبات القائمة 
- button "وحدات الإيواء، المواقع والإشغال":  وحدات الإيواء المواقع والإشغال 
- text:  إعلانات المخيم 28‏/8‏/2026 إعلان عام Camp update Latest camp update. 29‏/8‏/2026 إعلان عام إعلان مواعيد توزيع المياه تبدأ فرق المياه جولتها اليومية من القطاع الشرقي عند الساعة السادسة والنصف صباحًا، ثم تنتقل إلى الساحة المركزية والقطاع الغربي. يرجى الالتزام بالدور وإحضار العبوات النظيفة. 29‏/8‏/2026 إعلان عام أخبار نقطة الدعم الطبي تستقبل النقطة الطبية الشمالية الحالات من الساعة الثامنة صباحًا حتى السادسة مساءً، مع أولوية للأطفال وكبار السن والحالات الطارئة.
- tablist:
  - tab "  الرئيسية" [selected]
  - tab "  المساعدات"
  - tab "  السجل"
  - tab "  التنبيهات"
  - tab "  الحساب"
```

# Test source

```ts
  230 |   expect(expoUrl, 'Set EXPO_E2E_URL to the running Expo web URL').toBeTruthy();
  231 |   const passwordHash = await bcrypt.hash(password, 12);
  232 |   const [existingManager] = await db.select().from(staffUsers)
  233 |     .where(and(eq(staffUsers.active, true), inArray(staffUsers.role, ['MANAGER', 'ADMIN']))).limit(1);
  234 |   managerId = existingManager?.id ?? randomUUID();
  235 |   if (!existingManager) {
  236 |     await db.insert(staffUsers).values({ id: managerId, email: `mobile-manager-${suffix}@example.invalid`, name: 'Presentation manager', role: 'MANAGER', passwordHash });
  237 |     managerCreated = true;
  238 |   }
  239 |   await db.insert(staffUsers).values(staffRoles.map((role) => ({
  240 |     ...staff[role], name: `Presentation ${role}`, passwordHash,
  241 |   })));
  242 |   await db.insert(staffUsers).values({ ...inactiveOfficer, active: false, passwordHash });
  243 |   managerToken = `presentation-${randomUUID()}`;
  244 |   await db.insert(sessions).values({
  245 |     userId: managerId, tokenHash: hashSessionToken(managerToken),
  246 |     expiresAt: new Date(Date.now() + 60 * 60 * 1000),
  247 |   });
  248 |   const [familyUser] = await db.insert(usersTable).values({
  249 |     email: familyEmail, name: `أسرة التجربة ${suffix}`, identity: `presentation-${suffix}`,
  250 |     passwordHash: await hashPassword(password), role: 'DISPLACED', rank: 'DISPLACED',
  251 |   }).returning({ id: usersTable.id });
  252 |   familyUserId = familyUser.id;
  253 |   await db.insert(campsTable).values({ id: campId, name: `مخيم التجربة ${suffix}` });
  254 |   await db.insert(campSectorsTable).values({ id: sectorId, campId, name: 'القطاع التجريبي' });
  255 |   await db.insert(familiesTable).values({
  256 |     id: familyId, campId, sectorId, headName: `أسرة التجربة ${suffix}`,
  257 |     headLegacyUserId: familyUserId, delegateId: staff.DELEGATE.id,
  258 |     status: 'ACTIVE', createdById: managerId,
  259 |   });
  260 |   await db.insert(familyNeedsTable).values({
  261 |     id: approvedNeedId, familyId, category: 'FOOD', title: `احتياج معتمد ${suffix}`,
  262 |     priority: 'MEDIUM', status: 'APPROVED', createdById: managerId,
  263 |   });
  264 |   await db.insert(aids).values({
  265 |     id: aidId, title: aidTitle, type: 'FOOD', quantity: 20,
  266 |     unit: 'سلة', location: 'المستودع', distributionDate: '2030-01-01',
  267 |     createdById: managerId,
  268 |   });
  269 |   await db.insert(tasks).values({
  270 |     id: taskId, title: taskTitle, description: 'نتيجة مهمة أمنية', location: 'المخيم',
  271 |     status: 'IN_PROGRESS', assignedToId: staff.SECURITY_MEMBER.id, createdById: managerId,
  272 |   });
  273 |   await db.insert(tasks).values({
  274 |     id: directTaskId, title: directTaskTitle, description: directTaskDescription,
  275 |     location: directTaskLocation, priority: 'HIGH', status: 'IN_PROGRESS', createdById: managerId,
  276 |   });
  277 |   await db.insert(tasks).values({
  278 |     id: inactiveAssigneeTaskId,
  279 |     title: inactiveAssigneeTaskTitle,
  280 |     description: 'مهمة لاختبار استبدال المسؤول غير النشط',
  281 |     location: 'المخيم',
  282 |     status: 'PENDING',
  283 |     assignedToId: inactiveOfficer.id,
  284 |     createdById: managerId,
  285 |   });
  286 | });
  287 | 
  288 | test.afterAll(async () => {
  289 |   // Delete only records owned by this suite; never alter the pre-existing manager.
  290 |   await db.delete(aidDistributionsTable).where(eq(aidDistributionsTable.aidId, aidId));
  291 |   await db.delete(needStatusHistoryTable).where(inArray(needStatusHistoryTable.needId,
  292 |     db.select({ id: familyNeedsTable.id }).from(familyNeedsTable).where(eq(familyNeedsTable.familyId, familyId))));
  293 |   await db.delete(familyNeedsTable).where(eq(familyNeedsTable.familyId, familyId));
  294 |   await db.delete(familiesTable).where(eq(familiesTable.id, familyId));
  295 |   await db.delete(tasks).where(eq(tasks.id, taskId));
  296 |   await db.delete(syncAuditEvents).where(and(
  297 |     eq(syncAuditEvents.entityType, 'TASK'),
  298 |     eq(syncAuditEvents.entityId, inactiveAssigneeTaskId),
  299 |   ));
  300 |   await db.delete(tasks).where(eq(tasks.id, inactiveAssigneeTaskId));
  301 |   await db.delete(syncAuditEvents).where(and(
  302 |     eq(syncAuditEvents.entityType, 'TASK'),
  303 |     eq(syncAuditEvents.entityId, directTaskId),
  304 |   ));
  305 |   await db.delete(tasks).where(eq(tasks.id, directTaskId));
  306 |   await db.delete(aids).where(eq(aids.id, aidId));
  307 |   await db.delete(syncAuditEvents).where(inArray(syncAuditEvents.actorStaffId,
  308 |     staffRoles.map((role) => staff[role].id)));
  309 |   await db.delete(sessionsTable).where(eq(sessionsTable.userId, familyUserId));
  310 |   await db.delete(usersTable).where(eq(usersTable.id, familyUserId));
  311 |   await db.delete(campSectorsTable).where(eq(campSectorsTable.id, sectorId));
  312 |   await db.delete(campsTable).where(eq(campsTable.id, campId));
  313 |   for (const role of staffRoles) {
  314 |     await db.delete(sessions).where(eq(sessions.userId, staff[role].id));
  315 |     await db.delete(staffUsers).where(eq(staffUsers.id, staff[role].id));
  316 |   }
  317 |   await db.delete(sessions).where(eq(sessions.userId, inactiveOfficer.id));
  318 |   await db.delete(staffUsers).where(eq(staffUsers.id, inactiveOfficer.id));
  319 |   await db.delete(sessions).where(eq(sessions.tokenHash, hashSessionToken(managerToken)));
  320 |   if (managerCreated) await db.delete(staffUsers).where(eq(staffUsers.id, managerId));
  321 | });
  322 | 
  323 | test('manager dashboard and operations actions stay readable and announced at 320px and 200% text', async ({ browser }) => {
  324 |   const { page, context } = await openSession(browser, 'DELEGATE');
  325 | 
  326 |   const homeActions = [
  327 |     'home-notifications',
  328 |     'home-staff-alert',
  329 |   ];
> 330 |   await expect(page.getByText('التقارير', { exact: true })).toBeVisible();
      |                                                             ^ Error: expect(locator).toBeVisible() failed
  331 |   await expect(page.getByText('إدارة الإعلانات', { exact: true })).toBeVisible();
  332 |   await page.getByText('التقارير', { exact: true }).click();
  333 |   await expect(page.getByText('إجمالي الأفراد')).toBeVisible();
  334 | 
  335 |   let release!: () => void;
  336 |   const blocked = new Promise<void>((resolve) => { release = resolve; });
  337 |   let requests = 0;
  338 |   let recovered = false;
  339 |   await page.route('**/api/content*', async (route) => {
  340 |     if (route.request().method() !== 'GET') return route.fallback();
  341 |     requests++;
  342 |     if (requests === 1) await blocked;
  343 |     if (!recovered) return route.fulfill({ status: 503, contentType: 'application/json', body: '{}' });
  344 |     return route.fulfill({ status: 200, contentType: 'application/json', body: '{"items":[],"total":0}' });
  345 |   });
  346 |   await page.goto(`${expoUrl}/content`);
  347 |   await expect(page.locator('[role="progressbar"]')).toBeVisible();
  348 |   release();
  349 |   await expect(page.getByText('تعذر جلب المحتوى.')).toBeVisible();
  350 |   recovered = true;
  351 |   await page.getByText('إعادة المحاولة').click();
  352 |   await expect(page.getByText('لا توجد إعلانات مسجلة بعد.')).toBeVisible();
  353 |   expect(requests).toBeGreaterThanOrEqual(3);
  354 |   await page.route('**/api/sync/needs', (route) => route.fulfill({
  355 |     status: 200, contentType: 'application/json', body: '[]',
  356 |   }));
  357 |   await page.goto(`${expoUrl}/needs`);
  358 |   await expect(page.getByText('لا توجد احتياجات مسجلة.')).toBeVisible();
  359 |   await context.close();
  360 | });
  361 | 
  362 | test('delegate creates a need, changes its status and assigns approved aid', async ({ browser }) => {
  363 |   const { page, context } = await openSession(browser, 'DELEGATE');
  364 | 
  365 |   const homeActions = [
  366 |     'home-notifications',
  367 |     'home-staff-alert',
  368 |   ];
  369 |   await expect(page.getByText('التقارير', { exact: true })).toHaveCount(0);
  370 |   await expect(page.getByText('الإعلانات', { exact: true })).toHaveCount(0);
  371 |   await page.goto(`${expoUrl}/reports`);
  372 |   await expect(page.getByText('هذه الصفحة مخصصة لمدراء النظام فقط.')).toBeVisible();
  373 |   await page.goto(expoUrl!);
  374 |   await expect(page.getByText('العائلات', { exact: true }).filter({ visible: true })).toBeVisible();
  375 |   await page.getByText('العائلات', { exact: true }).filter({ visible: true }).click({ timeout: 10_000 });
  376 |   await expect(page.getByText(`أسرة التجربة ${suffix}`)).toBeVisible();
  377 |   await page.goto(`${expoUrl}/needs`);
  378 |   await expect(page.getByText(`احتياج معتمد ${suffix}`)).toBeVisible();
  379 |   await page.getByTestId('add-need').click();
  380 |   await page.getByText(`أسرة التجربة ${suffix}`, { exact: true }).filter({ visible: true }).click();
  381 |   await page.getByPlaceholder('مثال: حليب أطفال، خيمة بديلة').fill(newNeedTitle);
  382 |   await page.getByText('إضافة الاحتياج', { exact: true }).click();
  383 |   await expect(page.getByText(newNeedTitle, { exact: true })).toBeVisible();
  384 |   await page.getByText(newNeedTitle, { exact: true }).click();
  385 |   await page.getByText('اعتماد الاحتياج', { exact: true }).click();
  386 |   await expect.poll(async () => (await db.select({ status: familyNeedsTable.status }).from(familyNeedsTable)
  387 |     .where(eq(familyNeedsTable.title, newNeedTitle)))[0]?.status).toBe('APPROVED');
  388 |   await page.getByText('تحديث إلى: قيد التنفيذ').click();
  389 |   await expect.poll(async () => (await db.select({ status: familyNeedsTable.status }).from(familyNeedsTable)
  390 |     .where(eq(familyNeedsTable.title, newNeedTitle)))[0]?.status).toBe('IN_PROGRESS');
  391 | 
  392 |   await page.goto(`${expoUrl}/operations`);
  393 |   await page.locator('[data-testid^="open-aid-"]').filter({ hasText: `مساعدة التجربة ${suffix}` }).click();
  394 |   await page.getByText(`أسرة التجربة ${suffix}`, { exact: true }).filter({ visible: true }).click();
  395 |   await page.getByText(`احتياج معتمد ${suffix}`, { exact: true }).filter({ visible: true }).click();
  396 |   await page.getByText('تخصيص وتوزيع').click();
  397 |   await expect(page.getByText(`أسرة: ${familyId}`)).toBeVisible();
  398 |   await context.close();
  399 | });
  400 | 
  401 | test('Expo web: security member submits a result and manager approves it at 375px and 150% text', async ({ browser }) => {
  402 |   const member = await openSession(browser, 'SECURITY_MEMBER', { width: 375, height: 812 });
  403 |   await expect(member.page.getByText('العائلات', { exact: true })).toHaveCount(0);
  404 |   await expect(member.page.getByText('التقارير', { exact: true })).toHaveCount(0);
  405 |   await expect(member.page.getByTestId('add-aid')).toHaveCount(0);
  406 |   await member.page.getByText('التنبيهات', { exact: true }).last().click();
  407 |   await expect(member.page.getByText(taskTitle)).toBeVisible();
  408 |   await member.page.goto(`${expoUrl}/task-form?id=${taskId}`);
  409 |   await member.page.getByText('تقديم نتيجة المهمة', { exact: true }).waitFor();
  410 |   await expect(member.page.getByTestId('archive-task')).toHaveCount(0);
  411 |   await expect(member.page.getByTestId('save-task')).toHaveCount(0);
  412 |   const submittedResult = 'اكتملت الجولة الأمنية';
  413 |   const updatedTaskTitle = `مهمة محدّثة ${suffix}`;
  414 |   await member.page.getByTestId('task-result-input').fill(submittedResult);
  415 |   let submitAttempts = 0;
  416 |   await member.page.route(`**/api/sync/tasks/${taskId}/submit`, async (route) => {
  417 |     submitAttempts++;
  418 |     if (submitAttempts === 1) {
  419 |       await route.fulfill({ status: 503, contentType: 'application/json', body: '{"error":"offline"}' });
  420 |       return;
  421 |     }
  422 |     if (submitAttempts === 2) {
  423 |       await db.update(tasks).set({
  424 |         title: updatedTaskTitle,
  425 |         version: sql`${tasks.version} + 1`,
  426 |         updatedAt: new Date(),
  427 |       }).where(eq(tasks.id, taskId));
  428 |     }
  429 |     await route.fallback();
  430 |   });
```
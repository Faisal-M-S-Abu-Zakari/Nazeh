import React, { useState } from "react";
import { Badge, Button, Card, Tabs, Text, Textarea, TextInput, Title, Select, Loader, SimpleGrid, ThemeIcon, Group, Timeline } from "@mantine/core";
import { AlertCircle, Home, MapPin, Send, Users, WifiOff, PackageOpen, ClipboardList, Info, HeartPulse, Clock, CheckCircle2, XCircle } from "lucide-react";
import useAuth from "@/hooks/useAuth";
import { useFamilyHead } from "@/hooks/useFamilyHead";
import { GENERAL_ACTOR_ROUTES } from "@/constants/routes";
import { cn } from "@/utils/cn";
import dayjs from "dayjs";
import relativeTime from "dayjs/plugin/relativeTime";
import 'dayjs/locale/ar';

dayjs.extend(relativeTime);
dayjs.locale('ar');

const categoryLabels: Record<string, string> = { FOOD: "غذاء", WATER: "ماء", MEDICAL: "رعاية طبية", SHELTER: "مأوى", HYGIENE: "مستلزمات نظافة", OTHER: "أخرى" };
const statusLabels: Record<string, string> = { REQUIRED: "بانتظار المراجعة", APPROVED: "معتمد للتوزيع", IN_PROGRESS: "قيد التنفيذ", FULFILLED: "تمت التلبية", CANCELLED: "ملغى" };
const statusColors: Record<string, string> = { REQUIRED: "yellow", APPROVED: "blue", IN_PROGRESS: "indigo", FULFILLED: "teal", CANCELLED: "red" };
const statusIcons: Record<string, React.ReactNode> = {
  REQUIRED: <Clock size={16} />,
  APPROVED: <CheckCircle2 size={16} />,
  IN_PROGRESS: <PackageOpen size={16} />,
  FULFILLED: <CheckCircle2 size={16} />,
  CANCELLED: <XCircle size={16} />
};

export default function FamilyHeadPage() {
  const { isDisplaced, isLoading: authLoading } = useAuth();
  const { profile, needs, draft, setDraft, createNeed, queuedNeeds, isLoading, error } = useFamilyHead();
  
  const [sending, setSending] = useState(false);
  const [message, setMessage] = useState("");
  const [activeTab, setActiveTab] = useState<string | null>("overview");

  if (authLoading || isLoading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[70vh] gap-4">
        <Loader color="teal" size="lg" type="bars" />
        <Text className="text-primary font-bold animate-pulse text-lg">جارٍ تحميل المنصة المركزية…</Text>
      </div>
    );
  }
  
  if (!isDisplaced) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[70vh] gap-4 p-4 text-center">
         <AlertCircle className="text-red-500" size={64} strokeWidth={1.5} />
         <Title order={2} className="font-display">هذه الشاشة مخصصة لرب الأسرة</Title>
         <Text c="dimmed" className="mb-4 max-w-md">لا تملك صلاحية رب الأسرة لعرض هذه الصفحة المخصصة للاحتياجات المباشرة.</Text>
         <Button component="a" href={GENERAL_ACTOR_ROUTES.OPERATIONS} size="md" color="teal">العودة للوحة العمليات</Button>
      </div>
    );
  }
  
  if (error && !profile) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[70vh] gap-4 p-4 text-center">
        <AlertCircle className="text-red-500" size={64} strokeWidth={1.5} />
        <Title order={3} c="red" className="font-display">تعذر تحميل بيانات الأسرة</Title>
        <Text c="dimmed" className="max-w-md">حدث خطأ أثناء محاولة جلب ملف الأسرة المرتبطة بهذا الحساب.</Text>
      </div>
    );
  }
  
  if (!profile) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[70vh] p-4">
        <ThemeIcon size={80} radius="100%" color="gray" variant="light" className="mb-4">
          <Users size={32} />
        </ThemeIcon>
        <Title order={3} className="font-display mb-2">لا توجد أسرة نشطة</Title>
        <Text c="dimmed" className="text-center max-w-md">لم يتم ربط هذا الحساب بأي أسرة نشطة في النظام حتى الآن.</Text>
      </div>
    );
  }

  const submitNeed = async () => {
    if (draft.title.trim().length < 2) return setMessage("اكتب عنوان الاحتياج أولاً.");
    setSending(true); setMessage("");
    try {
      const result = await createNeed({ ...draft, title: draft.title.trim(), description: draft.description?.trim() || undefined });
      setMessage(result.queued ? "لا يوجد اتصال. حُفظ الطلب محلياً وسيُرسل تلقائياً عند عودة الإنترنت." : "تم إرسال الطلب بنجاح.");
      setActiveTab("requests");
    } catch { 
      setMessage("تعذر إرسال الطلب. حاول مرة أخرى."); 
    } finally { 
      setSending(false); 
    }
  };

  return (
    <div className="w-full h-full flex flex-col space-y-6 animate-in fade-in pb-12 p-4 md:p-8">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-end gap-4 pb-4 border-b border-border">
        <div>
          <Text className="text-muted-foreground text-sm font-bold tracking-wider uppercase mb-1">بوابة المستفيد</Text>
          <Title order={2} className="text-2xl md:text-3xl font-display text-foreground tracking-tight">
            ملف الأسرة واحتياجاتها
          </Title>
        </div>
        <Badge size="xl" color="teal" variant="light" className="px-5 py-2 font-bold" leftSection={<div className="w-2.5 h-2.5 rounded-full bg-teal-500 animate-pulse" />}>
          المنصة متصلة
        </Badge>
      </div>

      <Tabs value={activeTab} onChange={setActiveTab} color="teal" radius="md" variant="pills" className="w-full">
        <Tabs.List className="bg-slate-100/80 dark:bg-slate-800/50 p-1.5 rounded-xl inline-flex w-full overflow-x-auto custom-scrollbar shadow-inner border border-border">
          <Tabs.Tab value="overview" leftSection={<Home size={16} />} className="flex-1 md:flex-none py-2.5 font-semibold">نظرة عامة</Tabs.Tab>
          <Tabs.Tab value="members" leftSection={<Users size={16} />} className="flex-1 md:flex-none py-2.5 font-semibold">أفراد الأسرة</Tabs.Tab>
          <Tabs.Tab value="requests" leftSection={<ClipboardList size={16} />} className="flex-1 md:flex-none py-2.5 font-semibold">
            سجل الطلبات
            {queuedNeeds.length > 0 && (
               <Badge size="xs" color="orange" circle className="mr-2">{queuedNeeds.length}</Badge>
            )}
          </Tabs.Tab>
          <Tabs.Tab value="new_request" leftSection={<Send size={16} />} className="flex-1 md:flex-none md:mr-auto bg-primary/10 text-primary data-[active]:bg-primary data-[active]:text-white py-2.5 font-bold transition-all">طلب مساعدة</Tabs.Tab>
        </Tabs.List>

        <Tabs.Panel value="overview" className="pt-6">
          <div className="grid grid-cols-1 xl:grid-cols-4 gap-6">
            <div className="xl:col-span-3 space-y-6">
              {/* Primary Info Card */}
              <Card withBorder radius="xl" shadow="sm" className="bg-card overflow-hidden">
                <div className="absolute top-0 left-0 right-0 h-2 bg-gradient-to-r from-primary to-teal-400"></div>
                <div className="flex flex-col md:flex-row gap-6 md:items-center justify-between border-b border-border pb-6 mb-6 mt-2">
                  <div className="flex items-center gap-5">
                    <ThemeIcon size={72} radius="lg" color="teal" variant="light" className="shadow-sm">
                      <UserAvatarIcon />
                    </ThemeIcon>
                    <div>
                      <Text size="xs" c="dimmed" className="mb-1 uppercase font-bold tracking-wider">رب الأسرة</Text>
                      <Title order={2} className="font-display text-2xl text-foreground">{profile.headName}</Title>
                    </div>
                  </div>
                  <Group gap="sm" className="flex-wrap">
                    <Badge variant="outline" color="gray" size="lg" radius="md" className="border-border text-foreground bg-slate-50 dark:bg-slate-900 font-mono">
                      رقم الملف: {profile.id.slice(0,8).toUpperCase()}
                    </Badge>
                    <Badge variant="dot" color={profile.status === 'ACTIVE' ? 'teal' : 'orange'} size="lg" radius="md" className="font-bold">
                      {profile.status === 'ACTIVE' ? 'أسرة نشطة' : 'قيد المراجعة'}
                    </Badge>
                  </Group>
                </div>
                
                <SimpleGrid cols={{ base: 1, sm: 2, md: 4 }} spacing="xl">
                  <InfoCard icon={<MapPin />} label="القطاع السكني" value={profile.sector.name} />
                  <InfoCard icon={<Home />} label="رقم الخيمة" value={profile.shelter?.code ?? "غير محددة"} />
                  <InfoCard icon={<Users />} label="حجم الأسرة" value={`${profile.members.length + 1} أفراد`} />
                  <InfoCard icon={<Info />} label="مندوب القطاع" value={profile.delegate ? profile.delegate.name : "لم يُعيّن"} />
                </SimpleGrid>
              </Card>

              {/* Needs Snapshot */}
              <div>
                <div className="flex justify-between items-center mb-5">
                  <Title order={4} className="font-display text-foreground flex items-center gap-2">
                    <PackageOpen size={20} className="text-primary" /> الطلبات الحديثة
                  </Title>
                  <Button variant="subtle" color="teal" size="xs" onClick={() => setActiveTab('requests')} rightSection={<ClipboardList size={14} />}>
                    عرض الكل
                  </Button>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                  {needs.slice(0, 3).map(need => (
                    <Card key={need.id} withBorder radius="lg" shadow="sm" className="hover:border-primary/50 transition-all hover:-translate-y-1">
                      <Group justify="space-between" mb="md">
                        <Badge color={statusColors[need.status]} variant="light" size="md" leftSection={statusIcons[need.status]}>
                          {statusLabels[need.status]}
                        </Badge>
                        <Text size="xs" c="dimmed" className="font-medium">{dayjs(need.createdAt).fromNow()}</Text>
                      </Group>
                      <Text fw={800} size="lg" className="line-clamp-1 mb-1 text-foreground">{need.title}</Text>
                      <Text size="sm" c="dimmed" className="mb-4 font-medium">{categoryLabels[need.category]}</Text>
                      <Button variant="light" color="gray" fullWidth size="sm" radius="md" onClick={() => setActiveTab('requests')}>
                        تفاصيل الطلب
                      </Button>
                    </Card>
                  ))}
                  {needs.length === 0 && (
                    <div className="col-span-full py-10 text-center border-2 border-dashed border-border rounded-xl bg-slate-50/50 dark:bg-slate-900/50">
                      <ClipboardList size={40} className="mx-auto text-slate-300 mb-3" />
                      <Text fw={600} className="text-foreground">لا توجد طلبات سابقة.</Text>
                      <Text size="sm" c="dimmed" className="mt-1">يمكنك تقديم طلب مساعدة جديد من تبويب "طلب مساعدة".</Text>
                    </div>
                  )}
                </div>
              </div>
            </div>
            
            {/* Sidebar / Alerts */}
            <div className="xl:col-span-1 space-y-6">
               <Card withBorder radius="xl" shadow="sm" className="bg-slate-50 dark:bg-sidebar h-full">
                 <Title order={5} className="font-display mb-5 flex items-center gap-2 text-foreground pb-3 border-b border-border">
                    <AlertCircle size={20} className="text-orange-500" />
                    لوحة التنبيهات
                 </Title>
                 <div className="space-y-4">
                   {profile.criticalNotes && (
                     <div className="p-4 bg-red-50 dark:bg-red-950/30 border border-red-100 dark:border-red-900 rounded-xl flex items-start gap-3 shadow-sm">
                       <HeartPulse size={20} className="text-red-500 shrink-0 mt-0.5" />
                       <div className="flex-1">
                         <Text size="sm" fw={700} className="text-red-800 dark:text-red-300 mb-1">حالة حرجة</Text>
                         <Text size="xs" className="text-red-700/80 dark:text-red-300/80 leading-relaxed">{profile.criticalNotes}</Text>
                       </div>
                     </div>
                   )}
                   {needs.filter(n => n.status === 'APPROVED' || n.status === 'IN_PROGRESS').length > 0 && (
                     <div className="p-4 bg-blue-50 dark:bg-blue-950/30 border border-blue-100 dark:border-blue-900 rounded-xl flex items-start gap-3 shadow-sm">
                       <PackageOpen size={20} className="text-blue-500 shrink-0 mt-0.5" />
                       <div className="flex-1">
                         <Text size="sm" fw={700} className="text-blue-800 dark:text-blue-300 mb-1">تجهيز المساعدات</Text>
                         <Text size="xs" className="text-blue-700/80 dark:text-blue-300/80 leading-relaxed">يوجد لديك طلبات معتمدة سيتم تسليمها قريباً.</Text>
                       </div>
                     </div>
                   )}
                   {!profile.criticalNotes && needs.filter(n => n.status === 'APPROVED' || n.status === 'IN_PROGRESS').length === 0 && (
                     <div className="text-center py-8">
                       <div className="w-12 h-12 rounded-full bg-slate-200 dark:bg-slate-800 flex items-center justify-center mx-auto mb-3">
                         <CheckCircle2 size={24} className="text-slate-400" />
                       </div>
                       <Text size="sm" fw={600} className="text-foreground">لا توجد تنبيهات نشطة</Text>
                       <Text size="xs" c="dimmed" className="mt-1">جميع أمور الأسرة مستقرة حالياً.</Text>
                     </div>
                   )}
                 </div>
               </Card>
            </div>
          </div>
        </Tabs.Panel>

        <Tabs.Panel value="members" className="pt-6">
          <Card withBorder radius="xl" shadow="sm" className="bg-card min-h-[50vh]">
            <div className="flex justify-between items-center mb-6 pb-4 border-b border-border">
              <div>
                <Title order={3} className="font-display text-foreground">أفراد الأسرة المسجلين</Title>
                <Text size="sm" c="dimmed" className="mt-1">الأفراد التابعين لرب الأسرة والمدرجين في التعداد الرسمي</Text>
              </div>
              <Badge size="xl" variant="filled" color="gray" radius="md" className="font-mono text-lg">
                {profile.members.length} أفراد
              </Badge>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              {profile.members.map((member) => (
                <div key={member.id} className="flex items-center gap-4 p-5 rounded-xl border border-border bg-slate-50/50 dark:bg-sidebar transition-colors hover:bg-slate-50 dark:hover:bg-slate-800/50">
                  <ThemeIcon size={48} radius="lg" color="gray" variant="light" className="shadow-sm">
                    <Users size={24} />
                  </ThemeIcon>
                  <div className="flex-1 min-w-0">
                    <div className="flex justify-between items-start gap-2 mb-1">
                      <Text fw={700} className="text-foreground truncate">{member.fullName}</Text>
                      {member.criticalCase && <Badge color="red" variant="filled" size="xs" className="shrink-0 animate-pulse">حالة حرجة</Badge>}
                    </div>
                    <Text size="sm" c="dimmed" className="font-medium">{member.relationship}</Text>
                    {member.nationalId && (
                       <Text size="xs" c="dimmed" className="mt-1 font-mono tracking-wider opacity-60">ID: {member.nationalId}</Text>
                    )}
                  </div>
                </div>
              ))}
              {!profile.members.length && (
                <div className="col-span-full text-center py-16">
                  <Users size={48} className="mx-auto text-slate-300 mb-4" />
                  <Text fw={600} className="text-lg">لا يوجد أفراد إضافيون</Text>
                  <Text c="dimmed" className="mt-1">لم يتم تسجيل أي أفراد إضافيين لهذه الأسرة.</Text>
                </div>
              )}
            </div>
          </Card>
        </Tabs.Panel>

        <Tabs.Panel value="new_request" className="pt-6">
          <div className="max-w-3xl mx-auto">
            <Card withBorder radius="xl" shadow="md" className="bg-card overflow-hidden">
              <div className="bg-primary/5 p-6 border-b border-primary/10">
                <Title order={3} className="font-display mb-2 text-primary flex items-center gap-2">
                  <Send size={22} /> إرسال طلب احتياج جديد
                </Title>
                <Text size="sm" className="text-primary/80">يرجى تعبئة النموذج أدناه بدقة لضمان معالجة طلبك في أسرع وقت ممكن.</Text>
              </div>
              
              <div className="p-6 md:p-8 space-y-6">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                  <Select 
                    label="نوع الاحتياج" 
                    value={draft.category} 
                    onChange={(value) => setDraft({ ...draft, category: (value ?? "OTHER") as typeof draft.category })} 
                    data={Object.entries(categoryLabels).map(([value, label]) => ({ value, label }))} 
                    required
                    size="md"
                    radius="md"
                    classNames={{ input: 'bg-slate-50 dark:bg-slate-900 border-border' }}
                  />
                  <Select 
                    label="مستوى الأولوية" 
                    value={draft.priority} 
                    onChange={(value) => setDraft({ ...draft, priority: (value ?? "MEDIUM") as typeof draft.priority })} 
                    data={[["LOW", "منخفضة"], ["MEDIUM", "متوسطة"], ["HIGH", "عالية"], ["CRITICAL", "طارئة"]].map(([value, label]) => ({ value, label }))} 
                    required
                    size="md"
                    radius="md"
                    classNames={{ input: 'bg-slate-50 dark:bg-slate-900 border-border' }}
                  />
                </div>
                
                <TextInput 
                  label="عنوان الطلب" 
                  value={draft.title} 
                  onChange={(event) => setDraft({ ...draft, title: event.currentTarget.value })} 
                  placeholder="مثال: حليب أطفال نوع X" 
                  required
                  size="md"
                  radius="md"
                  classNames={{ input: 'bg-slate-50 dark:bg-slate-900 border-border' }}
                />
                
                <Textarea 
                  label="تفاصيل إضافية (اختياري)" 
                  value={draft.description ?? ""} 
                  onChange={(event) => setDraft({ ...draft, description: event.currentTarget.value })} 
                  placeholder="أضف أي ملاحظات تساعدنا في تلبية طلبك بدقة..."
                  minRows={5} 
                  size="md"
                  radius="md"
                  classNames={{ input: 'bg-slate-50 dark:bg-slate-900 border-border' }}
                />
                
                <div className="flex flex-col sm:flex-row justify-between items-center gap-4 pt-6 border-t border-border mt-8">
                  <Text size="sm" fw={600} className={cn(message.includes("تعذر") ? "text-red-500" : "text-teal-600")}>
                    {message}
                  </Text>
                  <Button 
                    size="lg"
                    radius="md"
                    leftSection={<Send size={18} />} 
                    loading={sending} 
                    onClick={() => void submitNeed()}
                    className="w-full sm:w-auto bg-primary hover:bg-primary/90 shadow-md hover:shadow-lg transition-all"
                  >
                    إرسال الطلب للمراجعة
                  </Button>
                </div>
              </div>
            </Card>
          </div>
        </Tabs.Panel>

        <Tabs.Panel value="requests" className="pt-6">
          <Card withBorder radius="xl" shadow="sm" className="bg-card min-h-[50vh]">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6 pb-4 border-b border-border">
              <div>
                <Title order={3} className="font-display text-foreground">سجل الطلبات السابقة</Title>
                <Text size="sm" c="dimmed" className="mt-1">تتبع حالة كافة الطلبات المقدمة من قبل الأسرة</Text>
              </div>
              {queuedNeeds.length > 0 && (
                <Badge size="lg" color="orange" leftSection={<WifiOff size={14} />} className="shadow-sm">
                  {queuedNeeds.length} مسودة بانتظار الاتصال
                </Badge>
              )}
            </div>
            
            <div className="space-y-4">
              {!needs.length && !queuedNeeds.length && (
                <div className="text-center py-16 border-2 border-dashed border-border rounded-2xl bg-slate-50/50 dark:bg-slate-900/50">
                  <ClipboardList size={64} className="mx-auto text-slate-300 mb-4" />
                  <Text fw={700} className="text-xl text-foreground">لا يوجد سجل طلبات</Text>
                  <Text c="dimmed" className="mt-2 mb-6 max-w-sm mx-auto">لم تقم بإرسال أي طلبات احتياج عبر المنصة حتى الآن.</Text>
                  <Button size="md" radius="md" color="teal" onClick={() => setActiveTab('new_request')}>
                    إنشاء أول طلب
                  </Button>
                </div>
              )}
              
              {queuedNeeds.map((item) => (
                <NeedCard key={item.id} title={item.data.title} category={item.data.category} priority={item.data.priority} status="LOCAL" />
              ))}
              
              {needs.map((need) => (
                <NeedCard 
                  key={need.id} 
                  title={need.title} 
                  category={need.category} 
                  priority={need.priority} 
                  status={need.status} 
                  createdAt={need.createdAt} 
                  history={need.history} 
                />
              ))}
            </div>
          </Card>
        </Tabs.Panel>
      </Tabs>
    </div>
  );
}

function UserAvatarIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="w-8 h-8 opacity-80">
      <path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2" />
      <circle cx="12" cy="7" r="4" />
    </svg>
  );
}

function InfoCard({ icon, label, value, subValue }: { icon: React.ReactNode; label: string; value: string; subValue?: string }) {
  return (
    <div className="flex items-start gap-4 p-5 bg-slate-50/80 dark:bg-sidebar rounded-xl border border-border shadow-sm">
      <ThemeIcon size={44} radius="lg" color="teal" variant="light" className="shrink-0 bg-white dark:bg-slate-800 shadow-sm border border-slate-100 dark:border-slate-700">
        {icon}
      </ThemeIcon>
      <div className="min-w-0">
        <Text size="xs" fw={700} c="dimmed" className="mb-1 uppercase tracking-wide">{label}</Text>
        <Text fw={800} size="lg" className="text-foreground truncate">{value}</Text>
        {subValue && <Text size="xs" c="dimmed" dir="ltr" className="text-right mt-1 font-mono opacity-70">{subValue}</Text>}
      </div>
    </div>
  );
}

function NeedCard({ title, category, priority, status, createdAt, history = [] }: { title: string; category: string; priority: string; status: string; createdAt?: string; history?: Array<any> }) {
  const isLocal = status === "LOCAL";
  
  return (
    <div className="p-5 sm:p-6 rounded-2xl border border-border bg-white dark:bg-card hover:border-primary/40 hover:shadow-md transition-all">
      <div className="flex flex-col sm:flex-row justify-between items-start gap-5">
        <div className="flex-1">
          <Group gap="sm" mb="xs">
            <Badge size="md" variant="filled" color={priority === "CRITICAL" ? "red" : priority === "HIGH" ? "orange" : "gray"}>
              أولوية {priority === "CRITICAL" ? "طارئة" : priority === "HIGH" ? "عالية" : priority === "LOW" ? "منخفضة" : "متوسطة"}
            </Badge>
            <Text size="sm" fw={600} className="text-primary bg-primary/10 px-2 py-0.5 rounded-md">{categoryLabels[category]}</Text>
          </Group>
          <Text fw={800} size="xl" className="mb-2 text-foreground">{title}</Text>
          
          {createdAt && (
            <Text size="sm" c="dimmed" className="flex items-center gap-1.5 font-medium">
              <Clock size={14} /> أُضيف: {dayjs(createdAt).format('DD MMM YYYY, hh:mm A')}
            </Text>
          )}
        </div>
        <div className="shrink-0 text-left w-full sm:w-auto">
          <Badge 
            size="xl" 
            radius="md"
            variant={isLocal ? "outline" : "light"} 
            color={isLocal ? "orange" : statusColors[status]}
            leftSection={isLocal ? <WifiOff size={16} /> : statusIcons[status]}
            className="w-full sm:w-auto py-3 font-bold"
          >
            {isLocal ? "محفوظ محلياً" : statusLabels[status]}
          </Badge>
        </div>
      </div>
      
      {history && history.length > 0 && (
        <div className="mt-6 pt-5 border-t border-slate-100 dark:border-slate-800">
          <Text size="sm" fw={700} className="mb-4 text-foreground flex items-center gap-2">
            <Clock size={16} className="text-muted-foreground" />
            سجل تتبع الطلب:
          </Text>
          <Timeline active={history.length - 1} bulletSize={20} lineWidth={2} color="teal" className="mr-2">
            {history.map((entry, idx) => (
              <Timeline.Item key={entry.id} title={statusLabels[entry.toStatus]} bullet={statusIcons[entry.toStatus]}>
                <Text c="dimmed" size="xs" mt={4} className="font-mono">{dayjs(entry.changedAt).format('DD/MM/YYYY HH:mm')}</Text>
                {entry.note && (
                  <Text size="sm" mt={4} className="bg-slate-50 dark:bg-slate-800/50 p-2 rounded-md border border-border inline-block">
                    {entry.note}
                  </Text>
                )}
              </Timeline.Item>
            ))}
          </Timeline>
        </div>
      )}
    </div>
  );
}

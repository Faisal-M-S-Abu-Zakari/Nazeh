import React, { useState } from "react";
import { Badge, Button, Card, Tabs, Text, Textarea, TextInput, Title, Select, Loader, SimpleGrid, ActionIcon } from "@mantine/core";
import { AlertCircle, Home, MapPin, Send, Users, WifiOff, PackageOpen, ClipboardList, Info, HeartPulse } from "lucide-react";
import useAuth from "@/hooks/useAuth";
import { useFamilyHead } from "@/hooks/useFamilyHead";
import { GENERAL_ACTOR_ROUTES } from "@/constants/routes";
import { cn } from "@/utils/cn";
import dayjs from "dayjs";
import 'dayjs/locale/ar';

dayjs.locale('ar');

const categoryLabels: Record<string, string> = { FOOD: "غذاء", WATER: "ماء", MEDICAL: "رعاية طبية", SHELTER: "مأوى", HYGIENE: "نظافة", OTHER: "أخرى" };
const statusLabels: Record<string, string> = { REQUIRED: "بانتظار المراجعة", APPROVED: "معتمد للتوزيع", IN_PROGRESS: "قيد التنفيذ", FULFILLED: "تمت التلبية", CANCELLED: "ملغى" };
const statusColors: Record<string, string> = { REQUIRED: "yellow", APPROVED: "blue", IN_PROGRESS: "indigo", FULFILLED: "teal", CANCELLED: "gray" };

export default function FamilyHeadPage() {
  const { isDisplaced, isLoading: authLoading } = useAuth();
  const { profile, needs, draft, setDraft, createNeed, queuedNeeds, isLoading, error } = useFamilyHead();
  
  const [sending, setSending] = useState(false);
  const [message, setMessage] = useState("");
  const [activeTab, setActiveTab] = useState<string | null>("overview");

  if (authLoading || isLoading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh] gap-4">
        <Loader color="teal" />
        <Text className="text-primary font-medium">جارٍ تحميل ملف الأسرة…</Text>
      </div>
    );
  }
  
  if (!isDisplaced) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh] gap-4">
         <AlertCircle className="text-red-500" size={48} />
         <Title order={3} className="font-display">هذه الشاشة مخصصة لرب الأسرة</Title>
         <Button component="a" href={GENERAL_ACTOR_ROUTES.OPERATIONS} color="teal">العودة</Button>
      </div>
    );
  }
  
  if (error && !profile) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh] gap-4">
        <AlertCircle className="text-red-500" size={48} />
        <Text c="red" fw={500}>تعذر تحميل الأسرة المرتبطة بهذا الحساب.</Text>
      </div>
    );
  }
  
  if (!profile) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh]">
        <Text c="dimmed">لا توجد أسرة نشطة مرتبطة بالحساب.</Text>
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
    <div className="max-w-5xl mx-auto space-y-8 animate-in fade-in pb-12">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-border pb-6">
        <div>
          <Text className="text-muted-foreground text-sm font-medium mb-1">بوابة المستفيد</Text>
          <Title order={2} className="text-3xl font-display text-primary">ملف الأسرة واحتياجاتها</Title>
        </div>
        <Badge size="xl" color="teal" variant="light" className="px-4 py-2 border border-teal-200">
          أسرة نشطة
        </Badge>
      </div>

      <Tabs value={activeTab} onChange={setActiveTab} color="teal" radius="md">
        <Tabs.List className="border-border">
          <Tabs.Tab value="overview" leftSection={<Home size={16} />}>نظرة عامة</Tabs.Tab>
          <Tabs.Tab value="members" leftSection={<Users size={16} />}>أفراد الأسرة</Tabs.Tab>
          <Tabs.Tab value="new_request" leftSection={<Send size={16} />}>طلب جديد</Tabs.Tab>
          <Tabs.Tab value="requests" leftSection={<ClipboardList size={16} />}>
            سجل الطلبات
            {queuedNeeds.length > 0 && (
               <Badge size="xs" color="orange" circle className="ml-2 absolute -top-1 -right-1">{queuedNeeds.length}</Badge>
            )}
          </Tabs.Tab>
        </Tabs.List>

        <Tabs.Panel value="overview" className="pt-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <Card withBorder radius="lg" shadow="sm" className="md:col-span-2 space-y-6">
              <div className="flex items-center gap-3 mb-2">
                <div className="w-12 h-12 bg-primary/10 text-primary rounded-full flex items-center justify-center">
                  <UserAvatarIcon />
                </div>
                <div>
                  <Text size="xs" c="dimmed">رب الأسرة</Text>
                  <Title order={3} className="font-display text-primary">{profile.headName}</Title>
                </div>
              </div>
              
              <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="lg">
                <InfoCard icon={<Home />} label="المخيم والقطاع" value={`${profile.camp.name} · ${profile.sector.name}`} />
                <InfoCard icon={<MapPin />} label="وحدة الإيواء (الخيمة)" value={profile.shelter?.code ?? "غير محددة"} />
                <InfoCard icon={<Users />} label="عدد الأفراد الإجمالي" value={`${profile.members.length + 1} فرد`} />
                <InfoCard icon={<Info />} label="المندوب المسؤول" value={profile.delegate ? profile.delegate.name : "لم يُعيّن"} subValue={profile.delegate?.email} />
              </SimpleGrid>
            </Card>
            
            <Card withBorder radius="lg" shadow="sm" className="bg-slate-50 dark:bg-slate-900 border-border">
               <Title order={4} className="font-display mb-4 text-primary">تنبيهات هامة</Title>
               <div className="space-y-4">
                 {profile.criticalNotes && (
                   <div className="p-3 bg-red-50 border border-red-100 rounded-lg flex items-start gap-2 text-red-800 text-sm">
                     <HeartPulse size={16} className="mt-0.5 shrink-0" />
                     <p>{profile.criticalNotes}</p>
                   </div>
                 )}
                 {needs.filter(n => n.status === 'APPROVED' || n.status === 'IN_PROGRESS').length > 0 && (
                   <div className="p-3 bg-blue-50 border border-blue-100 rounded-lg flex items-start gap-2 text-blue-800 text-sm">
                     <PackageOpen size={16} className="mt-0.5 shrink-0" />
                     <p>لديك طلبات قيد التجهيز أو معتمدة للتوزيع. سيتم التواصل معك قريباً.</p>
                   </div>
                 )}
               </div>
            </Card>
          </div>
        </Tabs.Panel>

        <Tabs.Panel value="members" className="pt-6">
          <Card withBorder radius="lg" shadow="sm">
            <Title order={3} className="font-display mb-6">أفراد الأسرة المسجلين</Title>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {profile.members.map((member) => (
                <div key={member.id} className="flex items-center gap-4 p-4 rounded-xl border border-border bg-slate-50">
                  <div className="w-10 h-10 bg-white rounded-full flex items-center justify-center text-slate-400 shadow-sm">
                    <Users size={20} />
                  </div>
                  <div className="flex-1">
                    <div className="flex justify-between items-start">
                      <Text fw={600}>{member.fullName}</Text>
                      {member.criticalCase && <Badge color="red" variant="light" size="xs">حالة حرجة</Badge>}
                    </div>
                    <Text size="sm" c="dimmed" className="mt-1">{member.relationship}</Text>
                  </div>
                </div>
              ))}
              {!profile.members.length && (
                <Text c="dimmed" className="col-span-full text-center py-8">لا يوجد أفراد إضافيون مسجلون.</Text>
              )}
            </div>
          </Card>
        </Tabs.Panel>

        <Tabs.Panel value="new_request" className="pt-6">
          <Card withBorder radius="lg" shadow="sm" className="max-w-2xl mx-auto">
            <Title order={3} className="font-display mb-2 text-primary">إرسال طلب احتياج جديد</Title>
            <Text size="sm" c="dimmed" className="mb-6">يرجى تعبئة النموذج أدناه لطلب المساعدات العاجلة أو المتكررة.</Text>
            
            <div className="space-y-5">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Select 
                  label="نوع الاحتياج" 
                  value={draft.category} 
                  onChange={(value) => setDraft({ ...draft, category: (value ?? "OTHER") as typeof draft.category })} 
                  data={Object.entries(categoryLabels).map(([value, label]) => ({ value, label }))} 
                  required
                />
                <Select 
                  label="مستوى الأولوية" 
                  value={draft.priority} 
                  onChange={(value) => setDraft({ ...draft, priority: (value ?? "MEDIUM") as typeof draft.priority })} 
                  data={[["LOW", "منخفضة"], ["MEDIUM", "متوسطة"], ["HIGH", "عالية"], ["CRITICAL", "طارئة"]].map(([value, label]) => ({ value, label }))} 
                  required
                />
              </div>
              
              <TextInput 
                label="عنوان الطلب" 
                value={draft.title} 
                onChange={(event) => setDraft({ ...draft, title: event.currentTarget.value })} 
                placeholder="مثال: حليب أطفال نوع X" 
                required
              />
              
              <Textarea 
                label="تفاصيل إضافية (اختياري)" 
                value={draft.description ?? ""} 
                onChange={(event) => setDraft({ ...draft, description: event.currentTarget.value })} 
                placeholder="أضف أي ملاحظات تساعدنا في تلبية طلبك بدقة..."
                minRows={4} 
              />
              
              <div className="flex flex-col sm:flex-row justify-between items-center gap-4 pt-4 border-t border-border">
                <Text size="sm" className={cn(message.includes("تعذر") ? "text-red-500" : "text-teal-600 font-medium")}>
                  {message}
                </Text>
                <Button 
                  leftSection={<Send size={16} />} 
                  loading={sending} 
                  onClick={() => void submitNeed()}
                  className="w-full sm:w-auto bg-primary hover:bg-primary/90"
                >
                  إرسال الطلب للمراجعة
                </Button>
              </div>
            </div>
          </Card>
        </Tabs.Panel>

        <Tabs.Panel value="requests" className="pt-6">
          <Card withBorder radius="lg" shadow="sm">
            <div className="flex justify-between items-center mb-6">
              <Title order={3} className="font-display">سجل الطلبات السابقة</Title>
              {queuedNeeds.length > 0 && (
                <Badge color="orange" leftSection={<WifiOff size={13} />}>
                  {queuedNeeds.length} مسودة بانتظار الاتصال
                </Badge>
              )}
            </div>
            
            <div className="space-y-4">
              {!needs.length && !queuedNeeds.length && (
                <div className="text-center py-12 border-2 border-dashed border-border rounded-xl">
                  <ClipboardList size={48} className="mx-auto text-slate-300 mb-4" />
                  <Text c="dimmed">لم ترسل الأسرة أي طلبات بعد.</Text>
                  <Button variant="light" color="teal" className="mt-4" onClick={() => setActiveTab('new_request')}>
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
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-6 h-6">
      <path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2" />
      <circle cx="12" cy="7" r="4" />
    </svg>
  );
}

function InfoCard({ icon, label, value, subValue }: { icon: React.ReactNode; label: string; value: string; subValue?: string }) {
  return (
    <div className="flex items-start gap-4 p-4 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-border">
      <div className="w-10 h-10 bg-white dark:bg-slate-700 rounded-full flex items-center justify-center text-teal-600 shadow-sm shrink-0">
        {icon}
      </div>
      <div>
        <Text size="xs" c="dimmed" className="mb-1">{label}</Text>
        <Text fw={600} className="text-slate-800 dark:text-slate-200">{value}</Text>
        {subValue && <Text size="xs" c="dimmed" dir="ltr" className="text-right mt-1">{subValue}</Text>}
      </div>
    </div>
  );
}

function NeedCard({ title, category, priority, status, createdAt, history = [] }: { title: string; category: string; priority: string; status: string; createdAt?: string; history?: Array<any> }) {
  const isLocal = status === "LOCAL";
  
  return (
    <div className="p-4 sm:p-5 rounded-xl border border-border bg-white dark:bg-card hover:border-teal-200 transition-colors">
      <div className="flex flex-col sm:flex-row justify-between items-start gap-4">
        <div>
          <Text fw={700} size="lg" className="mb-1">{title}</Text>
          <div className="flex flex-wrap gap-2 items-center text-sm text-muted-foreground">
            <span className="font-medium text-slate-700 dark:text-slate-300">{categoryLabels[category]}</span>
            <span>•</span>
            <span>أولوية {priority === "CRITICAL" ? "طارئة" : priority === "HIGH" ? "عالية" : priority === "LOW" ? "منخفضة" : "متوسطة"}</span>
            {createdAt && (
              <>
                <span>•</span>
                <span>{dayjs(createdAt).format('DD MMM YYYY')}</span>
              </>
            )}
          </div>
        </div>
        <Badge size="lg" variant={isLocal ? "outline" : "light"} color={isLocal ? "orange" : statusColors[status]}>
          {isLocal ? "محفوظ محلياً" : statusLabels[status]}
        </Badge>
      </div>
      
      {history && history.length > 0 && (
        <div className="mt-4 pt-4 border-t border-slate-100 dark:border-slate-800">
          <Text size="xs" fw={600} className="mb-2 text-slate-500">سجل تتبع الطلب:</Text>
          <div className="space-y-2">
            {history.map((entry) => (
              <div key={entry.id} className="flex gap-2 text-xs">
                <span className="text-slate-400 w-24 shrink-0">{dayjs(entry.changedAt).format('DD/MM HH:mm')}</span>
                <span className="font-medium text-slate-700 dark:text-slate-300">{statusLabels[entry.toStatus]}</span>
                {entry.note && <span className="text-slate-500 truncate max-w-xs">- {entry.note}</span>}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
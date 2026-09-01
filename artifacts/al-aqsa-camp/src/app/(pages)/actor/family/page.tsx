import { useState } from "react";
import { Badge, Button, Card, Group, Loader, Select, Stack, Text, Textarea, TextInput, Title } from "@mantine/core";
import { AlertCircle, Home, MapPin, Send, Users, WifiOff } from "lucide-react";
import useAuth from "@/hooks/useAuth";
import { useFamilyHead } from "@/hooks/useFamilyHead";
import { GENERAL_ACTOR_ROUTES } from "@/constants/routes";

const categoryLabels: Record<string, string> = { FOOD: "غذاء", WATER: "ماء", MEDICAL: "رعاية طبية", SHELTER: "مأوى", HYGIENE: "نظافة", OTHER: "أخرى" };
const statusLabels: Record<string, string> = { REQUIRED: "بانتظار المراجعة", IN_PROGRESS: "قيد التجهيز", FULFILLED: "تمت التلبية", CANCELLED: "ملغى" };
const statusColors: Record<string, string> = { REQUIRED: "yellow", IN_PROGRESS: "blue", FULFILLED: "green", CANCELLED: "gray" };
const date = (value: string) => new Intl.DateTimeFormat("ar", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));

export default function FamilyHeadPage() {
  const { isDisplaced, isLoading: authLoading } = useAuth();
  const { profile, needs, draft, setDraft, createNeed, queuedNeeds, isLoading, error } = useFamilyHead();
  const [sending, setSending] = useState(false);
  const [message, setMessage] = useState("");

  if (authLoading || isLoading) return <Stack align="center" py={80}><Loader /><Text>جارٍ تحميل ملف الأسرة…</Text></Stack>;
  if (!isDisplaced) return <Stack align="center" py={80}><AlertCircle /><Title order={3}>هذه الشاشة مخصصة لرب الأسرة</Title><Button component="a" href={GENERAL_ACTOR_ROUTES.ADS}>العودة</Button></Stack>;
  if (error && !profile) return <Stack align="center" py={80}><AlertCircle /><Text c="red">تعذر تحميل الأسرة المرتبطة بهذا الحساب.</Text></Stack>;
  if (!profile) return <Stack align="center" py={80}><Text>لا توجد أسرة نشطة مرتبطة بالحساب.</Text></Stack>;

  const submit = async () => {
    if (draft.title.trim().length < 2) return setMessage("اكتب عنوان الاحتياج أولاً.");
    setSending(true); setMessage("");
    try {
      const result = await createNeed({ ...draft, title: draft.title.trim(), description: draft.description?.trim() || undefined });
      setMessage(result.queued ? "لا يوجد اتصال. حُفظ الطلب محلياً وسيُرسل تلقائياً عند عودة الإنترنت." : "تم إرسال الطلب بنجاح.");
    } catch { setMessage("تعذر إرسال الطلب. حاول مرة أخرى."); } finally { setSending(false); }
  };

  return <Stack gap="lg" maw={1100} mx="auto" p={{ base: "md", md: "xl" }} dir="rtl">
    <Group justify="space-between" align="flex-start">
      <div><Text c="dimmed" size="sm">بوابة الأسرة</Text><Title order={2}>ملف أسرتي واحتياجاتها</Title></div>
      <Badge size="lg" color="green">أسرة نشطة</Badge>
    </Group>
    <Card withBorder radius="lg" shadow="sm"><Stack gap="md">
      <Title order={3}>{profile.headName}</Title>
      <Group grow align="stretch">
        <Info icon={<Home size={18} />} label="المخيم والقطاع" value={`${profile.camp.name} · ${profile.sector.name}`} />
        <Info icon={<MapPin size={18} />} label="الخيمة" value={profile.shelter?.code ?? "غير محددة"} />
        <Info icon={<Users size={18} />} label="عدد الأفراد" value={`${profile.members.length + 1} أفراد`} />
      </Group>
      <Text size="sm" c="dimmed">{profile.delegate ? `المندوب المسؤول: ${profile.delegate.name} (${profile.delegate.email})` : "لم يُعيّن مندوب مسؤول بعد."}</Text>
    </Stack></Card>
    <Card withBorder radius="lg"><Stack>
      <Title order={3}>أفراد الأسرة</Title>
      {profile.members.map((member) => <Group key={member.id} justify="space-between" py="xs" style={{ borderBottom: "1px solid var(--mantine-color-gray-2)" }}><Text fw={600}>{member.fullName}</Text><Text size="sm" c="dimmed">{member.relationship}{member.criticalCase ? " · حالة حرجة" : ""}</Text></Group>)}
      {!profile.members.length && <Text c="dimmed">لا يوجد أفراد إضافيون مسجلون.</Text>}
    </Stack></Card>
    <Card withBorder radius="lg"><Stack>
      <Title order={3}>إرسال طلب احتياج</Title>
      <Group grow><Select label="نوع الاحتياج" value={draft.category} onChange={(value) => setDraft({ ...draft, category: (value ?? "OTHER") as typeof draft.category })} data={Object.entries(categoryLabels).map(([value, label]) => ({ value, label }))} /><Select label="الأولوية" value={draft.priority} onChange={(value) => setDraft({ ...draft, priority: (value ?? "MEDIUM") as typeof draft.priority })} data={[["LOW", "منخفضة"], ["MEDIUM", "متوسطة"], ["HIGH", "عالية"], ["CRITICAL", "طارئة"]].map(([value, label]) => ({ value, label }))} /></Group>
      <TextInput label="عنوان الطلب" value={draft.title} onChange={(event) => setDraft({ ...draft, title: event.currentTarget.value })} placeholder="مثال: حليب أطفال" />
      <Textarea label="تفاصيل إضافية" value={draft.description ?? ""} onChange={(event) => setDraft({ ...draft, description: event.currentTarget.value })} minRows={3} />
      <Group justify="space-between"><Text size="sm" c={message.includes("تعذر") ? "red" : "dimmed"}>{message}</Text><Button leftSection={<Send size={16} />} loading={sending} onClick={() => void submit()}>إرسال الطلب</Button></Group>
    </Stack></Card>
    <Card withBorder radius="lg"><Stack>
      <Group justify="space-between"><Title order={3}>طلبات الأسرة</Title>{queuedNeeds.length > 0 && <Badge color="orange" leftSection={<WifiOff size={13} />}>{queuedNeeds.length} مسودة بانتظار الاتصال</Badge>}</Group>
      {!needs.length && !queuedNeeds.length && <Text c="dimmed">لم ترسل الأسرة أي طلبات بعد.</Text>}
      {queuedNeeds.map((item) => <NeedCard key={item.id} title={item.data.title} category={item.data.category} priority={item.data.priority} status="LOCAL" />)}
      {needs.map((need) => <NeedCard key={need.id} title={need.title} category={need.category} priority={need.priority} status={need.status} createdAt={need.createdAt} history={need.history} />)}
    </Stack></Card>
  </Stack>;
}

function Info({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return <Group wrap="nowrap" align="flex-start"><span style={{ color: "var(--mantine-color-teal-7)" }}>{icon}</span><div><Text size="xs" c="dimmed">{label}</Text><Text fw={600}>{value}</Text></div></Group>;
}
function NeedCard({ title, category, priority, status, createdAt, history = [] }: { title: string; category: string; priority: string; status: string; createdAt?: string; history?: Array<{ id: string; toStatus: string; changedAt: string; note?: string | null }> }) {
  return <Card withBorder radius="md" p="md"><Group justify="space-between" align="flex-start"><div><Text fw={700}>{title}</Text><Text size="sm" c="dimmed">{categoryLabels[category]} · أولوية {priority === "CRITICAL" ? "طارئة" : priority === "HIGH" ? "عالية" : priority === "LOW" ? "منخفضة" : "متوسطة"}{createdAt ? ` · ${date(createdAt)}` : ""}</Text></div><Badge color={status === "LOCAL" ? "orange" : statusColors[status]}>{status === "LOCAL" ? "محفوظ محلياً" : statusLabels[status]}</Badge></Group>{history.length > 0 && <Stack gap={4} mt="sm">{history.map((entry) => <Text key={entry.id} size="xs" c="dimmed">{date(entry.changedAt)} · {statusLabels[entry.toStatus]}{entry.note ? ` · ${entry.note}` : ""}</Text>)}</Stack>}</Card>;
}
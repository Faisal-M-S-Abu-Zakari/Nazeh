import { useState } from 'react';
import {
  Badge,
  Button,
  Card,
  Group,
  Modal,
  SimpleGrid,
  Stack,
  Text,
  Textarea,
  TextInput,
  ThemeIcon,
  Title,
} from '@mantine/core';
import {
  Bell,
  CalendarDays,
  CheckCircle2,
  HandHeart,
  Megaphone,
  MessageSquareWarning,
  PackageCheck,
  Send,
} from 'lucide-react';
import {
  customFetch,
  getListContentQueryKey,
  getListManagedComplaintsQueryKey,
  getListNotificationsQueryKey,
  useCreateComplaint,
  useListContent,
  useListManagedComplaints,
  useListNotifications,
  useMarkNotificationRead,
} from '@workspace/api-client-react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import dayjs from 'dayjs';
import 'dayjs/locale/ar';
import { getAuthToken } from '@/utils/auth/getSession';
import { LoadingState, ErrorState } from '@/components/actors/workspace/shared/ui-states';
import useAuth from '@/hooks/useAuth';

dayjs.locale('ar');

type NotificationItem = {
  id: number;
  title: string;
  message: string;
  type: string;
  read: boolean;
  createdAt: string;
};

type AidDistribution = {
  distribution: { id: string; quantity: number; notes?: string | null; deliveredAt?: string | null; createdAt: string };
  aid: { id: string; title: string; category: string; unit: string; status: string };
  need: { id: string; title: string; category: string };
  executedBy: { name: string };
};

function PageHeader({ icon, title, description }: { icon: React.ReactNode; title: string; description: string }) {
  return (
    <div className="flex flex-col gap-3 border-b border-border pb-5 sm:flex-row sm:items-center">
      <ThemeIcon size={52} radius="lg" variant="light" color="teal">{icon}</ThemeIcon>
      <div>
        <Title order={2} className="font-display text-2xl text-foreground md:text-3xl">{title}</Title>
        <Text size="sm" c="dimmed" mt={3}>{description}</Text>
      </div>
    </div>
  );
}

function PageShell({ children }: { children: React.ReactNode }) {
  return (
    <div dir="rtl" className="min-h-full w-full bg-white px-4 py-6 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-6xl space-y-6">{children}</div>
    </div>
  );
}

export function FamilyNotificationsPage() {
  const queryClient = useQueryClient();
  const [selected, setSelected] = useState<NotificationItem | null>(null);
  const query = useListNotifications({ limit: 50 }, {
    query: { queryKey: getListNotificationsQueryKey({ limit: 50 }) },
  });
  const markRead = useMarkNotificationRead();

  const openNotification = (item: NotificationItem) => {
    setSelected(item);
    if (!item.read) {
      markRead.mutate({ id: item.id, data: { read: true } }, {
        onSuccess: () => queryClient.invalidateQueries({ queryKey: getListNotificationsQueryKey() }),
      });
    }
  };

  if (query.isLoading) return <LoadingState message="جارٍ تحميل إشعاراتك..." />;
  if (query.error) return <ErrorState message="تعذر تحميل الإشعارات." />;
  const items = (query.data?.items ?? []) as NotificationItem[];

  return (
    <PageShell>
      <PageHeader icon={<Bell size={25} />} title="إشعارات النازح" description="آخر التحديثات المرتبطة بأسرتك وطلباتك ومواعيد التسليم." />
      <Stack gap="sm">
        {items.map((item) => (
          <Card key={item.id} withBorder radius="lg" p="lg" className={item.read ? 'bg-white' : 'border-primary/40 bg-primary/[0.025]'}>
            <button type="button" onClick={() => openNotification(item)} className="w-full text-right">
              <Group justify="space-between" align="flex-start" wrap="nowrap">
                <div className="min-w-0">
                  <Group gap={8} mb={5}>
                    {!item.read && <span className="h-2 w-2 rounded-full bg-primary" />}
                    <Text fw={800}>{item.title}</Text>
                  </Group>
                  <Text size="sm" c="dimmed" lineClamp={2}>{item.message}</Text>
                </div>
                <Text size="xs" c="dimmed" className="shrink-0">{dayjs(item.createdAt).format('DD/MM/YYYY')}</Text>
              </Group>
            </button>
          </Card>
        ))}
        {!items.length && <EmptyCard icon={<Bell />} text="لا توجد إشعارات جديدة حالياً." />}
      </Stack>
      <Modal opened={Boolean(selected)} onClose={() => setSelected(null)} title="تفاصيل الإشعار" centered radius="lg" dir="rtl">
        {selected && (
          <Stack gap="md">
            <ThemeIcon size={48} radius="xl" variant="light" color="teal"><Bell size={22} /></ThemeIcon>
            <Title order={4}>{selected.title}</Title>
            <Text className="leading-7">{selected.message}</Text>
            <Group gap={7}><CalendarDays size={15} className="text-muted-foreground" /><Text size="xs" c="dimmed">{dayjs(selected.createdAt).format('DD MMMM YYYY - HH:mm')}</Text></Group>
            <Button onClick={() => setSelected(null)} leftSection={<CheckCircle2 size={17} />}>تم الاطلاع</Button>
          </Stack>
        )}
      </Modal>
    </PageShell>
  );
}

export function FamilyAdsPage() {
  const query = useListContent({ limit: 100 }, { query: { queryKey: getListContentQueryKey({ limit: 100 }) } });
  const [selected, setSelected] = useState<(NonNullable<typeof query.data>['items'][number]) | null>(null);
  if (query.isLoading) return <LoadingState message="جارٍ تحميل الإعلانات..." />;
  if (query.error) return <ErrorState message="تعذر تحميل الإعلانات." />;
  const posts = (query.data?.items ?? []).filter((post) => post.status === 'published');

  return (
    <PageShell>
      <PageHeader icon={<Megaphone size={25} />} title="إعلانات النازح" description="الإعلانات الرسمية ومواعيد الخدمات والتوزيع داخل المخيم." />
      <SimpleGrid cols={{ base: 1, md: 2 }} spacing="lg">
        {posts.map((post) => (
          <Card key={post.id} withBorder radius="lg" p={0} className="overflow-hidden bg-white">
            {post.imageUrl && <img src={post.imageUrl} alt="" className="h-44 w-full object-cover" />}
            <Stack p="lg" gap="sm">
              <Badge variant="light" color="teal" w="fit-content">إعلان رسمي</Badge>
              <Title order={4}>{post.title}</Title>
              <Text size="sm" c="dimmed" lineClamp={3}>{post.body}</Text>
              <Group justify="space-between">
                <Text size="xs" c="dimmed">{dayjs(post.publishedAt ?? post.createdAt).format('DD MMMM YYYY')}</Text>
                <Button variant="subtle" size="xs" onClick={() => setSelected(post)}>قراءة الإعلان</Button>
              </Group>
            </Stack>
          </Card>
        ))}
      </SimpleGrid>
      {!posts.length && <EmptyCard icon={<Megaphone />} text="لا توجد إعلانات منشورة حالياً." />}
      <Modal opened={Boolean(selected)} onClose={() => setSelected(null)} title="تفاصيل الإعلان" centered size="lg" radius="lg" dir="rtl">
        {selected && <Stack>{selected.imageUrl && <img src={selected.imageUrl} alt="" className="max-h-64 w-full rounded-xl object-cover" />}<Title order={3}>{selected.title}</Title><Text className="whitespace-pre-wrap leading-8">{selected.body}</Text></Stack>}
      </Modal>
    </PageShell>
  );
}

export function FamilyReceivedAidsPage() {
  const token = getAuthToken();
  const query = useQuery({
    queryKey: ['family-me-aid-distributions'],
    queryFn: ({ signal }) => customFetch<AidDistribution[]>('/api/family/me/aid-distributions', {
      signal,
      headers: { Authorization: token ? `Bearer ${token}` : '' },
    }),
  });
  if (query.isLoading) return <LoadingState message="جارٍ تحميل سجل المساعدات..." />;
  if (query.error) return <ErrorState message="تعذر تحميل سجل المساعدات المستلمة." />;
  const rows = query.data ?? [];

  return (
    <PageShell>
      <PageHeader icon={<HandHeart size={25} />} title="المساعدات المستلمة" description="سجل المساعدات التي خُصصت لأسرتك أو تم تسليمها بالفعل." />
      <Stack gap="md">
        {rows.map(({ distribution, aid, need, executedBy }) => (
          <Card key={distribution.id} withBorder radius="lg" p="lg">
            <Group justify="space-between" align="flex-start">
              <Group align="flex-start">
                <ThemeIcon size={44} radius="lg" color="teal" variant="light"><PackageCheck size={22} /></ThemeIcon>
                <div><Text fw={800}>{aid.title}</Text><Text size="sm" c="dimmed">مرتبط بطلب: {need.title}</Text></div>
              </Group>
              <Badge color={distribution.deliveredAt ? 'teal' : 'yellow'} variant="light">{distribution.deliveredAt ? 'تم الاستلام' : 'بانتظار التسليم'}</Badge>
            </Group>
            <SimpleGrid cols={{ base: 2, sm: 4 }} mt="lg">
              <Info label="الكمية" value={`${distribution.quantity} ${aid.unit}`} />
              <Info label="الفئة" value={aid.category} />
              <Info label="سلّمها" value={executedBy.name} />
              <Info label="التاريخ" value={dayjs(distribution.deliveredAt ?? distribution.createdAt).format('DD/MM/YYYY')} />
            </SimpleGrid>
          </Card>
        ))}
        {!rows.length && <EmptyCard icon={<HandHeart />} text="لا توجد مساعدات مسجلة لأسرتك حتى الآن." />}
      </Stack>
    </PageShell>
  );
}

export function FamilyComplaintsPage() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const complaints = useListManagedComplaints({ limit: 50 }, { query: { queryKey: getListManagedComplaintsQueryKey({ limit: 50 }) } });
  const createComplaint = useCreateComplaint();
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');

  const submit = () => {
    if (subject.trim().length < 3 || message.trim().length < 5) return;
    createComplaint.mutate({ data: {
      complainantName: user?.name || 'رب الأسرة',
      subject: subject.trim(),
      description: message.trim(),
    } }, {
      onSuccess: () => {
        setSubject('');
        setMessage('');
        queryClient.invalidateQueries({ queryKey: getListManagedComplaintsQueryKey() });
      },
    });
  };

  return (
    <PageShell>
      <PageHeader icon={<MessageSquareWarning size={25} />} title="شكاوى النازح" description="أرسل شكوى وتابع حالتها ورد إدارة المخيم عليها." />
      <div className="grid gap-6 lg:grid-cols-[380px_1fr]">
        <Card withBorder radius="lg" p="lg" className="h-fit">
          <Stack>
            <Title order={4}>إرسال شكوى جديدة</Title>
            <TextInput label="موضوع الشكوى" placeholder="اكتب عنواناً واضحاً" value={subject} onChange={(e) => setSubject(e.currentTarget.value)} />
            <Textarea label="تفاصيل الشكوى" placeholder="اشرح المشكلة بالتفصيل..." minRows={6} value={message} onChange={(e) => setMessage(e.currentTarget.value)} />
            <Button leftSection={<Send size={17} />} onClick={submit} loading={createComplaint.isPending} disabled={subject.trim().length < 3 || message.trim().length < 5}>إرسال الشكوى</Button>
            {createComplaint.isError && <Text c="red" size="sm">تعذر إرسال الشكوى. حاول مرة أخرى.</Text>}
          </Stack>
        </Card>
        <Stack gap="sm">
          {complaints.isLoading && <LoadingState message="جارٍ تحميل شكاواك..." />}
          {complaints.error && <ErrorState message="تعذر تحميل الشكاوى." />}
          {(complaints.data?.items ?? []).map((item) => (
            <Card key={item.id} withBorder radius="lg" p="lg">
              <Group justify="space-between" mb="sm"><Text fw={800}>{item.subject}</Text><Badge color={item.status === 'resolved' ? 'teal' : item.status === 'inProgress' ? 'blue' : 'yellow'} variant="light">{item.status === 'resolved' ? 'تم الحل' : item.status === 'inProgress' ? 'قيد المعالجة' : 'مرسلة'}</Badge></Group>
              <Text size="sm" c="dimmed">{item.message}</Text>
              {item.reply && <div className="mt-4 rounded-lg border border-primary/15 bg-primary/[0.035] p-3"><Text size="xs" fw={800} c="teal">رد الإدارة</Text><Text size="sm" mt={4}>{item.reply}</Text></div>}
              <Text size="xs" c="dimmed" mt="md">{dayjs(item.createdAt).format('DD MMMM YYYY')}</Text>
            </Card>
          ))}
          {!complaints.isLoading && !(complaints.data?.items.length) && <EmptyCard icon={<MessageSquareWarning />} text="لم ترسل أي شكاوى حتى الآن." />}
        </Stack>
      </div>
    </PageShell>
  );
}

function EmptyCard({ icon, text }: { icon: React.ReactNode; text: string }) {
  return <Card withBorder radius="lg" p="xl" className="text-center"><ThemeIcon mx="auto" mb="sm" size={50} radius="xl" variant="light" color="gray">{icon}</ThemeIcon><Text c="dimmed">{text}</Text></Card>;
}

function Info({ label, value }: { label: string; value: string }) {
  return <div><Text size="xs" c="dimmed">{label}</Text><Text size="sm" fw={700} mt={3}>{value}</Text></div>;
}
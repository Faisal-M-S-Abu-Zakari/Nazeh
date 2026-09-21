'use client';

import { useMemo, useState } from 'react';
import {
  Alert,
  Badge,
  Button,
  Card,
  CopyButton,
  Group,
  LoadingOverlay,
  Modal,
  Select,
  Stack,
  Table,
  Text,
  TextInput,
  Title,
} from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { useQueryClient } from '@tanstack/react-query';
import {
  getListStaffQueryKey,
  Role,
  type StaffUser,
  useCreateStaff,
  useIssueStaffPasswordReset,
  useListStaff,
  useRenewStaffInvite,
  useUpdateStaff,
} from '@workspace/api-client-react';
import { AlertCircle, Check, Copy, KeyRound, Plus, RefreshCw, UserCog } from 'lucide-react';
import useAuth from '@/hooks/useAuth';
import { AUTH_ROUTES } from '@/constants/routes';

const roles = [
  { value: Role.MANAGER, label: 'مدير' },
  { value: Role.DELEGATE, label: 'مندوب' },
  { value: Role.SECURITY_OFFICER, label: 'مسؤول أمن' },
  { value: Role.SECURITY_MEMBER, label: 'فرد أمن' },
];
const employeeRoles = roles.filter(({ value }) => value !== Role.MANAGER);

function errorMessage(error: unknown) {
  if (error && typeof error === 'object' && 'data' in error) {
    const data = (error as { data?: { message?: string; error?: string } }).data;
    if (data?.message || data?.error) return data.message || data.error || '';
  }
  return error instanceof Error ? error.message : 'تعذر إتمام العملية. حاول مرة أخرى.';
}

export default function StaffManagement() {
  const { isManager, isLoading: authLoading } = useAuth();
  const queryClient = useQueryClient();
  const [createOpen, setCreateOpen] = useState(false);
  const [invite, setInvite] = useState<{ token: string; expiresAt: string; kind: 'invite' | 'reset' } | null>(null);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<Role>(Role.DELEGATE);

  const staff = useListStaff({ query: { queryKey: getListStaffQueryKey(), enabled: isManager } });
  const refresh = () => queryClient.invalidateQueries({ queryKey: getListStaffQueryKey() });
  const create = useCreateStaff();
  const update = useUpdateStaff();
  const renew = useRenewStaffInvite();
  const resetPassword = useIssueStaffPasswordReset();
  const busy = create.isPending || update.isPending || renew.isPending || resetPassword.isPending;
  const items = useMemo(() => staff.data?.items ?? [], [staff.data]);

  const showError = (error: unknown) =>
    notifications.show({ title: 'تعذر إتمام العملية', message: errorMessage(error), color: 'red' });

  const submitCreate = async () => {
    if (name.trim().length < 2 || !email.trim()) return;
    try {
      const result = await create.mutateAsync({ data: { name: name.trim(), email: email.trim(), role } });
      await refresh();
      setCreateOpen(false);
      setName('');
      setEmail('');
      setRole(Role.DELEGATE);
      setInvite({ token: result.inviteToken, expiresAt: result.inviteExpiresAt, kind: 'invite' });
      notifications.show({ title: 'تم إنشاء الحساب', message: 'شارك رابط الدعوة الآمن مع الموظف.', color: 'green' });
    } catch (error) {
      showError(error);
    }
  };

  const changeRole = async (person: StaffUser, nextRole: string | null) => {
    if (!nextRole || nextRole === person.role) return;
    try {
      await update.mutateAsync({ staffId: person.id, data: { role: nextRole as Role } });
      await refresh();
      notifications.show({ message: 'تم تحديث صلاحية الموظف', color: 'green' });
    } catch (error) {
      showError(error);
    }
  };

  const toggleActive = async (person: StaffUser) => {
    const verb = person.active ? 'تعطيل' : 'إعادة تفعيل';
    if (!window.confirm(`هل تريد ${verb} حساب ${person.name}؟`)) return;
    try {
      await update.mutateAsync({ staffId: person.id, data: { active: !person.active } });
      await refresh();
      notifications.show({ message: `تم ${verb} الحساب`, color: 'green' });
    } catch (error) {
      showError(error);
    }
  };

  const reinvite = async (person: StaffUser) => {
    try {
      const result = await renew.mutateAsync({ staffId: person.id });
      setInvite({ token: result.inviteToken, expiresAt: result.inviteExpiresAt, kind: 'invite' });
      notifications.show({ message: 'تم إصدار دعوة جديدة وإلغاء الدعوة السابقة', color: 'green' });
    } catch (error) {
      showError(error);
    }
  };

  const issuePasswordReset = async (person: StaffUser) => {
    try {
      const result = await resetPassword.mutateAsync({ staffId: person.id });
      setInvite({ token: result.resetToken, expiresAt: result.resetExpiresAt, kind: 'reset' });
      notifications.show({ message: 'تم إصدار رابط إعادة تعيين كلمة المرور', color: 'green' });
    } catch (error) {
      showError(error);
    }
  };

  const inviteUrl = invite
    ? `${window.location.origin}${import.meta.env.BASE_URL.replace(/\/$/, '')}${AUTH_ROUTES.CREATE_NEW_PASSWORD}?token=${encodeURIComponent(invite.token)}`
    : '';

  if (authLoading) return <Stack p='xl'><LoadingOverlay visible /></Stack>;
  if (!isManager) {
    return (
      <Alert m='xl' color='red' icon={<AlertCircle />} title='غير مصرح' data-testid='staff-access-denied'>
        إدارة حسابات الموظفين متاحة للمدير فقط.
      </Alert>
    );
  }

  return (
    <Stack p={{ base: 'md', md: 'xl' }} gap='lg' pos='relative' dir='rtl'>
      <LoadingOverlay visible={busy} zIndex={1000} />
      <Group justify='space-between'>
        <div>
          <Title order={2} className="text-3xl font-display text-primary">إدارة الموظفين</Title>
          <Text className="text-muted-foreground mt-1">أنشئ الحسابات وحدد الصلاحيات وحالة الوصول بأمان.</Text>
        </div>
        <Button leftSection={<Plus size={18} />} onClick={() => setCreateOpen(true)} className="bg-primary hover:bg-primary/90" radius="md" size="md" data-testid='open-create-staff'>
          دعوة موظف
        </Button>
      </Group>

      <Card withBorder radius='lg' shadow='sm' p={0}>
        {staff.isLoading ? (
          <Text p='xl' ta='center'>جارٍ تحميل الموظفين...</Text>
        ) : staff.isError ? (
          <Alert color='red' icon={<AlertCircle />} title='تعذر تحميل الموظفين' m='md'>
            <Stack gap='sm'>
              <Text>{errorMessage(staff.error)}</Text>
              <Button variant='light' onClick={() => staff.refetch()}>إعادة المحاولة</Button>
            </Stack>
          </Alert>
        ) : items.length === 0 ? (
          <Stack align='center' p='xl'><UserCog size={42} /><Text>لا توجد حسابات موظفين بعد.</Text></Stack>
        ) : (
          <Table.ScrollContainer minWidth={850}>
            <Table striped highlightOnHover verticalSpacing='md' horizontalSpacing='lg'>
              <Table.Thead>
                <Table.Tr>
                  <Table.Th>الموظف</Table.Th>
                  <Table.Th>الصلاحية</Table.Th>
                  <Table.Th>الحالة</Table.Th>
                  <Table.Th>كلمة المرور</Table.Th>
                  <Table.Th>الإجراءات</Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {items.map((person) => (
                  <Table.Tr key={person.id} data-testid={`staff-row-${person.id}`}>
                    <Table.Td><Text fw={600}>{person.name}</Text><Text size='sm' c='dimmed' dir='ltr'>{person.email}</Text></Table.Td>
                    <Table.Td>
                      <Select
                        aria-label={`صلاحية ${person.name}`}
                        data-testid={`staff-role-${person.id}`}
                        data={roles}
                        value={person.role}
                        onChange={(value) => changeRole(person, value)}
                        disabled={busy || person.role === Role.ADMIN || person.role === Role.MANAGER}
                        w={160}
                      />
                    </Table.Td>
                    <Table.Td><Badge color={person.active ? 'green' : 'gray'}>{person.active ? 'نشط' : 'معطل'}</Badge></Table.Td>
                    <Table.Td><Badge variant='light' color={person.passwordSet ? 'blue' : 'orange'}>{person.passwordSet ? 'تم التعيين' : 'بانتظار القبول'}</Badge></Table.Td>
                    <Table.Td>
                      <Group gap='xs' wrap='nowrap'>
                        <Button
                          size='xs'
                          variant={person.active ? 'light' : 'filled'}
                          color={person.active ? 'red' : 'green'}
                          onClick={() => toggleActive(person)}
                          data-testid={`toggle-staff-${person.id}`}
                        >
                          {person.active ? 'تعطيل' : 'تفعيل'}
                        </Button>
                        <Button
                          size='xs'
                          variant='subtle'
                          leftSection={<RefreshCw size={14} />}
                          onClick={() => reinvite(person)}
                          disabled={person.passwordSet || person.active || busy}
                          title={person.passwordSet || person.active ? 'إعادة الدعوة متاحة للحسابات المعلقة فقط' : undefined}
                          data-testid={`reinvite-staff-${person.id}`}
                        >
                          إعادة الدعوة
                        </Button>
                        <Button
                          size='xs'
                          variant='subtle'
                          color='orange'
                          leftSection={<KeyRound size={14} />}
                          onClick={() => issuePasswordReset(person)}
                          disabled={!person.active || !person.passwordSet || busy}
                          title={!person.active || !person.passwordSet ? 'متاح للحسابات النشطة التي عيّنت كلمة المرور فقط' : undefined}
                          data-testid={`reset-staff-password-${person.id}`}
                        >
                          إعادة التعيين
                        </Button>
                      </Group>
                    </Table.Td>
                  </Table.Tr>
                ))}
              </Table.Tbody>
            </Table>
          </Table.ScrollContainer>
        )}
      </Card>

      <Modal opened={createOpen} onClose={() => setCreateOpen(false)} title='دعوة موظف جديد' centered dir='rtl'>
        <Stack>
          <TextInput label='الاسم' value={name} onChange={(event) => setName(event.currentTarget.value)} required data-testid='create-staff-name' />
          <TextInput label='البريد الإلكتروني' type='email' dir='ltr' value={email} onChange={(event) => setEmail(event.currentTarget.value)} required data-testid='create-staff-email' />
          <Select label='الصلاحية' data={employeeRoles} value={role} onChange={(value) => value && setRole(value as Role)} data-testid='create-staff-role' />
          <Button onClick={submitCreate} disabled={name.trim().length < 2 || !email.trim()} loading={create.isPending} data-testid='create-staff-submit'>
            إنشاء وإصدار الدعوة
          </Button>
        </Stack>
      </Modal>

      <Modal opened={Boolean(invite)} onClose={() => setInvite(null)} title={invite?.kind === 'reset' ? 'رابط إعادة التعيين لمرة واحدة' : 'رابط الدعوة لمرة واحدة'} centered dir='rtl'>
        <Stack>
          <Alert color='yellow' icon={<AlertCircle />}>سيظهر هذا الرابط الآن فقط. أرسله للموظف عبر قناة آمنة.</Alert>
          <TextInput value={inviteUrl} readOnly dir='ltr' data-testid={invite?.kind === 'reset' ? 'staff-password-reset-link' : 'staff-invite-link'} />
          {invite && <Text size='sm' c='dimmed'>ينتهي في: {new Date(invite.expiresAt).toLocaleString('ar')}</Text>}
          <CopyButton value={inviteUrl}>
            {({ copied, copy }) => (
              <Button onClick={copy} color={copied ? 'green' : undefined} leftSection={copied ? <Check size={16} /> : <Copy size={16} />} data-testid={invite?.kind === 'reset' ? 'copy-staff-password-reset' : 'copy-staff-invite'}>
                {copied ? 'تم النسخ' : invite?.kind === 'reset' ? 'نسخ رابط إعادة التعيين' : 'نسخ رابط الدعوة'}
              </Button>
            )}
          </CopyButton>
        </Stack>
      </Modal>
    </Stack>
  );
}
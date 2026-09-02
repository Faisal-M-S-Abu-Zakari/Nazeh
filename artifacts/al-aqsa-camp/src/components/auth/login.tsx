'use client';

import { useForm } from '@mantine/form';
import { zodResolver } from '@/lib/zod-resolver';
import { useEffect, useState } from 'react';
import {
  Button,
  Group,
  LoadingOverlay,
  PasswordInput,
  SegmentedControl,
  Stack,
  Text,
  TextInput,
} from '@mantine/core';
import { useMutation } from '@tanstack/react-query';
import { notifications } from '@mantine/notifications';
import useAuth from '@/hooks/useAuth';
import { loginSchema, loginType } from '@/validation/auth/loginSchema';
import {
  GENERAL_ACTOR_ROUTES,
} from '@/constants/routes';
import { useQueryClient } from '@tanstack/react-query';
import { login, loginFamilyHead, loginProps } from '@/actions/auth/login';
import { AuthSessionResponse, type User } from '@workspace/api-client-react';
import { setAuthRole, setAuthToken, setAuthUser } from '@/utils/auth/getSession';

export default function Login() {
  const [error, setError] = useState('');
  const [accountType, setAccountType] = useState<'staff' | 'family'>('staff');
  const { isAuthenticated, isDisplaced } = useAuth();
  const queryClient = useQueryClient();
  const navigateToApp = (path: string) => window.location.replace(path);

  // Redirect if already authenticated
  useEffect(() => {
    if (isAuthenticated) navigateToApp(isDisplaced ? GENERAL_ACTOR_ROUTES.FAMILY : GENERAL_ACTOR_ROUTES.OPERATIONS);
  }, [isAuthenticated, isDisplaced]);

  const form = useForm<loginType>({
    mode: 'uncontrolled',
    initialValues: { email: '', password: '' },
    validate: zodResolver(loginSchema),
  });

  const loginMutation = useMutation<AuthSessionResponse | Awaited<ReturnType<typeof loginFamilyHead>>, Error, loginProps>({
    mutationFn: (credentials) => accountType === 'family' ? loginFamilyHead(credentials) : login(credentials),
    onSuccess: (data) => {
      form.reset();

      {
        setAuthToken(data.token);
        setAuthRole(accountType === 'family' ? 'displaced' : data.user.role);
        setAuthUser(data.user as User);
        queryClient.clear();
        if (accountType === 'family') {
          navigateToApp(GENERAL_ACTOR_ROUTES.FAMILY);
          return;
        }
        navigateToApp(GENERAL_ACTOR_ROUTES.OPERATIONS);

        // defer non-critical work
        setTimeout(() => {
          try {
            notifications.show({
              title: 'مرحبا بك',
              message: 'تم تسجيل الدخول بنجاح',
              color: 'grape',
              position: 'top-left',
              withBorder: true,
            });
          } catch (err) {
            console.error('Error saving session or showing notification', err);
          }
        }, 0);

      }
    },
    onError: (error: any) => {
      const status = error?.status ?? error?.response?.status;
      const errorMessage = status === 429
        ? 'تم تجاوز عدد محاولات الدخول. انتظر قليلًا ثم حاول مجددًا.'
        : status === 401
          ? 'البريد الإلكتروني أو كلمة المرور غير صحيحة، أو تم اختيار نوع حساب غير مناسب.'
          : 'تعذر تسجيل الدخول الآن. تحقق من الاتصال وحاول مجددًا.';
      setError(errorMessage);

      notifications.show({
        title: 'خطأ',
        message: errorMessage,
        color: 'red',
        position: 'top-left',
        withBorder: true,
      });
    },
  });

  const handleSubmit = form.onSubmit((values: loginType) => {
    setError('');
    loginMutation.mutate({
      email: values.email,
      password: values.password,
    });
  });

  return (
    <Stack
      align='center'
      gap={40}
      bg={'white'}
      pt={{ base: 0, lg: 64 }}
      pb={20}
      h={'100%'}
      w={{ base: '100%', lg: 550 }}
      pos={'relative'}
      className='!rounded-xl'
    >
      <LoadingOverlay
        visible={loginMutation.isPending}
        zIndex={1000}
        overlayProps={{ radius: 'sm', blur: 0.3 }}
      />

      <Text fw={500} fz={{ base: 28, md: 32 }} ta={'center'}>
        تسجيل الدخول
      </Text>
      <SegmentedControl
        value={accountType}
        onChange={(value) => setAccountType(value as 'staff' | 'family')}
        data={[{ label: 'فريق المخيم', value: 'staff' }, { label: 'رب الأسرة', value: 'family' }]}
      />

      <form className='flex flex-col items-center gap-3' onSubmit={handleSubmit}>
        <TextInput
          data-testid='login-email'
          type='email'
          label={
            <Text fw={500} fz={16} mb={3}>
              البريد الاكتروني
            </Text>
          }
          placeholder={'ادخل البريد الاكتروني'}
          size='md'
          w={{ base: 343, md: 400 }}
          key={form.key('email')}
          {...form.getInputProps('email')}
          classNames={{
            input: '!text-dark placeholder:!text-sm !text-primary !font-normal',
            error: '!w-full !text-end !text-[#FD6265] !font-normal !text-sm',
          }}
        />

        <PasswordInput
          data-testid='login-password'
          type='password'
          label={
            <Text fw={500} fz={16} mb={3}>
              كلمة المرور
            </Text>
          }
          placeholder={'ادخل كلمة المرور'}
          size='md'
          w={{ base: 343, md: 400 }}
          key={form.key('password')}
          {...form.getInputProps('password')}
          classNames={{
            input: '!text-dark placeholder:!text-sm !text-primary !font-normal',
            error: '!w-full !text-end !text-[#FD6265] !font-normal !text-sm',
          }}
        />

        <Group wrap='nowrap' align='center' w={'100%'}>
          <Text size='sm' c='dimmed'>
            لاستعادة كلمة المرور، يرجى التواصل مع إدارة المخيم.
          </Text>
        </Group>

        <Button
          data-testid='login-submit'
          type='submit'
          size='sm'
          fz={18}
          fw={500}
          c={'white'}
          w={228}
          mt={32}
          className={`!shadow-lg max-lg:!mt-10 ${
            !form.getValues().password || !form.getValues().email ? '!bg-primary/70' : '!bg-primary'
          }`}
          disabled={!form.getValues().password || !form.getValues().email}
        >
          دخول
        </Button>

        {error && (
          <Text fw={'500'} mt={'sm'} size='sm' ta='center' c={'red'}>
            {error}
          </Text>
        )}
      </form>
    </Stack>
  );
}

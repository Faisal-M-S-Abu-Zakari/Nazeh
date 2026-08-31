'use client';

import { useForm } from '@mantine/form';
import { zodResolver } from '@/lib/zod-resolver';
import { useEffect, useState } from 'react';
import {
  Button,
  Group,
  LoadingOverlay,
  PasswordInput,
  Stack,
  Text,
  TextInput,
} from '@mantine/core';
import { useMutation } from '@tanstack/react-query';
import { notifications } from '@mantine/notifications';
import useAuth from '@/hooks/useAuth';
import { login, loginProps } from '@/actions/auth/login';
import { loginSchema, loginType } from '@/validation/auth/loginSchema';
import {
  GENERAL_ACTOR_ROUTES,
  LANDING_ROUTES,
} from '@/constants/routes';
import { AuthSessionResponse, Role } from '@workspace/api-client-react';
import { setAuthToken } from '@/utils/auth/getSession';
import { useQueryClient } from '@tanstack/react-query';

export default function Login() {
  const [error, setError] = useState('');
  const { isAuthenticated } = useAuth();
  const queryClient = useQueryClient();
  const navigateToApp = (path: string) => window.location.replace(path);

  // Redirect if already authenticated
  useEffect(() => {
    if (isAuthenticated) navigateToApp(LANDING_ROUTES.HOME);
  }, [isAuthenticated]);

  const form = useForm<loginType>({
    mode: 'uncontrolled',
    initialValues: { email: '', password: '' },
    validate: zodResolver(loginSchema),
  });

  const loginMutation = useMutation<AuthSessionResponse, Error, loginProps>({
    mutationFn: login,
    onSuccess: (data) => {
      form.reset();

      {
        setAuthToken(data.token);
        queryClient.clear();
        const roleRedirects = {
          [Role.ADMIN]: () => navigateToApp(GENERAL_ACTOR_ROUTES.STAFF),
          // Generated staff IDs are not IDs in the retired actor-profile
          // endpoints. Send non-admin staff to the neutral actor landing;
          // useAuth then establishes their session exclusively via /auth/me.
          [Role.MANAGER]: () => navigateToApp(GENERAL_ACTOR_ROUTES.ADS),
          [Role.DELEGATE]: () => navigateToApp(GENERAL_ACTOR_ROUTES.ADS),
          [Role.SECURITY_OFFICER]: () => navigateToApp(GENERAL_ACTOR_ROUTES.ADS),
          [Role.SECURITY_MEMBER]: () => navigateToApp(GENERAL_ACTOR_ROUTES.ADS),
        };

        roleRedirects[data.user.role]?.();

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
      const errorMessage = error?.response?.data?.error || error?.message;
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

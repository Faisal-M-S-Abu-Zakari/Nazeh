'use client';

import { useForm } from '@mantine/form';
import { zodResolver } from '@/lib/zod-resolver';
import { useEffect, useState } from 'react';
import {
  Button,
  Group,
  LoadingOverlay,
  PasswordInput,
  Select,
  Stack,
  Text,
  TextInput,
} from '@mantine/core';
import { Link as Link } from '@/lib/nextjs-mocks';
import { useMutation } from '@tanstack/react-query';
import { notifications } from '@mantine/notifications';
import useAuth from '@/hooks/useAuth';
import { login, loginProps } from '@/actions/auth/login';
import { loginSchema, loginType } from '@/validation/auth/loginSchema';
import {
  AUTH_ROUTES,
  DELEGATE_ROUTES_fUNC,
  DISPLACED_ROUTES_fUNC,
  LANDING_ROUTES,
  MANAGER_ROUTES_fUNC,
  SECURITY_ROUTES_fUNC,
} from '@/constants/routes';
import { LOCALSTORAGE_SESSION_KEY } from '@/constants/sessionKey';
import { USER_RANK_LABELS, USER_TYPE } from '@/constants/userTypes';
import { loginResponse } from '@/@types/auth/loginResponse.type';

export default function Login() {
  const [error, setError] = useState('');
  const { isAuthenticated } = useAuth();

  // Redirect if already authenticated
  useEffect(() => {
    if (isAuthenticated) window.location.replace(LANDING_ROUTES.HOME);
  }, [isAuthenticated]);

  const form = useForm<loginType>({
    mode: 'uncontrolled',
    initialValues: { email: '', password: '', userType: USER_TYPE.DISPLACED },
    validate: zodResolver(loginSchema),
  });

  const loginMutation = useMutation<loginResponse, Error, loginProps>({
    mutationFn: login,
    onSuccess: (data) => {
      form.reset();

      if (data.status === 200) {
        const roleRedirects = {
          [USER_TYPE.DISPLACED]:
            DISPLACED_ROUTES_fUNC({ displaced_Id: data.user.id }).PROFILE,
          [USER_TYPE.MANAGER]:
            MANAGER_ROUTES_fUNC({ manager_Id: data.user.id }).PROFILE,
          [USER_TYPE.DELEGATE]:
            DELEGATE_ROUTES_fUNC({ delegate_Id: data.user.id }).PROFILE,
          [USER_TYPE.SECURITY]:
            SECURITY_ROUTES_fUNC({ security_Id: data.user.id }).PROFILE,
        };

        localStorage.setItem(
          LOCALSTORAGE_SESSION_KEY,
          JSON.stringify({
            status: data.status,
            message: data.message,
            user: data.user,
          }),
        );

        notifications.show({
          title: 'مرحبا بك',
          message: 'تم تسجيل الدخول بنجاح',
          color: 'grape',
          position: 'top-left',
          withBorder: true,
        });

        window.location.replace(roleRedirects[data.user.role]);

        return;
      }

      throw new Error(data.error || 'فشل في تسجيل الدخول');
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
      userType: values.userType,
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
        <Select
          label={
            <Text fw={400} c={'#817C74'} fz={16}>
              تسجيل الدخول كَ ؟
            </Text>
          }
          data={Object.values(USER_TYPE).map((type) => ({
            label: USER_RANK_LABELS[type],
            value: type,
          }))}
          size='md'
          w={{ base: 343, md: 400 }}
          key={form.key('userType')}
          {...form.getInputProps('userType')}
          classNames={{
            input: 'placeholder:!text-sm !text-primary !font-normal',
            error: '!w-full !text-end !text-[#FD6265] !font-normal !text-sm',
          }}
        />

        <TextInput
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
          <Link href={AUTH_ROUTES.FORGET_PASSWORD} className='font-medium text-primary text-sm'>
            نسيت كلمة المرور ؟
          </Link>
        </Group>

        <Button
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

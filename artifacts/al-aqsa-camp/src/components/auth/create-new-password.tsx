'use client';
import { useState } from 'react';
import { Button, Stack, Text, PasswordInput, LoadingOverlay } from '@mantine/core';
import { useForm } from '@mantine/form';
import { zodResolver } from '@/lib/zod-resolver';
import { useRouter  } from '@/lib/nextjs-mocks';
import { notifications } from '@mantine/notifications';
import { useMutation } from '@tanstack/react-query';
import { useQueryStates, parseAsString } from 'nuqs';
import { createNewPassword, createNewPasswordProps } from '@/actions/auth/createNewPassword';
import {
  createNewPasswordSchema,
  createNewPasswordType,
} from '@/validation/auth/createNewPasswordSchema';
import { commonActionResponse } from '@/@types/common/action/commonActionResponse.type';

export default function Create_New_Password() {
  const [error, setError] = useState('');
  const router = useRouter();

  const form = useForm<createNewPasswordType>({
    mode: 'uncontrolled',
    initialValues: { password: '', confirm_password: '' },
    validate: zodResolver(createNewPasswordSchema),
  });

  const [query] = useQueryStates(
    { token: parseAsString.withDefault('') },
    { shallow: true }
  );

  const createNewPasswordMutation = useMutation<
    commonActionResponse,
    Error,
    createNewPasswordProps
  >({
    mutationFn: createNewPassword,
    onSuccess: (data) => {
      if (Number(data.status) == 200) {
        notifications.show({
          title: data.message,
          message: 'تم تحديث كلمة المرور بنجاح',
          color: 'grape',
          position: 'top-left',
          withBorder: true,
          loading: true,
        });

        // This component is rendered inside the nested /auth router.
        router.push('login');
        form.reset();
      } else {
        throw new Error(data.error || 'فشل في تحديث كلمة المرور');
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

  const handleSubmit = form.onSubmit((values: createNewPasswordType) => {
    createNewPasswordMutation.mutate({
      token: query.token,
      password: values.password,
      confirm_password: values.confirm_password,
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
      className='!rounded-xl'
      pos={'relative'}
    >
      <LoadingOverlay
        visible={createNewPasswordMutation.isPending}
        zIndex={1000}
        overlayProps={{ radius: 'sm', blur: 0.3 }}
      />

      <Text fw={500} fz={{ base: 28, md: 32 }} ta={'center'}>
        إنشاء كلمة مرور جديدة
      </Text>

      <Stack justify='center' align='center' gap={20}>
        <Text fw={400} fz={14} c={'#817C74'} ta={'center'} w={{ base: 343, md: 400 }}>
          أدخل كلمة المرور الجديدة وتأكيدها
        </Text>
        {!query.token && (
          <Text c='red' ta='center' data-testid='credential-token-error'>
            رابط تعيين كلمة المرور غير صالح أو ينقصه رمز التحقق.
          </Text>
        )}

        <form className='!relative !flex flex-col items-center gap-0' onSubmit={handleSubmit}>
          <PasswordInput
            data-testid='new-password'
            type='password'
            label={
              <Text fw={500} fz={16} mb={3}>
                كلمة المرور الجديدة
              </Text>
            }
            placeholder={'ادخل كلمة المرور الجديدة'}
            w={{ base: 343, md: 400 }}
            className='!border-second !border-w-1 focus:!border-none !outline-none'
            key={form.key('password')}
            {...form.getInputProps('password')}
            classNames={{
              input: '!text-dark placeholder:!text-sm !text-primary !font-normal',
              error: '!w-full !text-end !text-[#FD6265] !font-normal !text-sm',
            }}
          />

          <PasswordInput
            data-testid='confirm-password'
            type='password'
            label={
              <Text fw={500} fz={16} mb={3}>
                تأكيد كلمة المرور
              </Text>
            }
            placeholder={'ادخل تأكيد كلمة المرور'}
            w={{ base: 343, md: 400 }}
            mt={20}
            className='!border-second !border-w-1 focus:!border-none !outline-none'
            key={form.key('confirm_password')}
            {...form.getInputProps('confirm_password')}
            classNames={{
              input: '!text-dark placeholder:!text-sm !text-primary !font-normal',
              error: '!w-full !text-end !text-[#FD6265] !font-normal !text-sm',
            }}
          />

          <Button
            data-testid='complete-credential-submit'
            type='submit'
            mt={32}
            fz={20}
            fw={500}
            w={228}
            c={'white'}
            className={`!shadow-lg max-lg:!mt-10 ${
              !form.getValues().password || !form.getValues().confirm_password
                ? '!bg-primary/70'
                : '!bg-primary'
            }`}
            disabled={!query.token || !form.getValues().password || !form.getValues().confirm_password}
          >
            حفظ
          </Button>

          {error && (
            <Text fw={500} mt={'sm'} size='sm' ta='center' c='red'>
              {error}
            </Text>
          )}
        </form>
      </Stack>
    </Stack>
  );
}

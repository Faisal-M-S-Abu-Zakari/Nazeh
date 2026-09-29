'use client';

import { Button, Textarea, TextInput, Box, Text, Flex, LoadingOverlay, Stack } from '@mantine/core';
import { useForm } from '@mantine/form';
import { zodResolver } from '@/lib/zod-resolver';
import { notifications } from '@mantine/notifications';
import { contactUsSchema, contactUsType } from '@/validation/landing/contactUsSchema';
import { useMutation } from '@tanstack/react-query';
import { sendEmailFun } from '@/actions/landing/contact-us';
import { Custom_Phone_Input } from '@/components/common/custom/Custom_Phone_Input';
import PhoneInput from 'react-phone-number-input';
import 'react-phone-number-input/style.css';

export default function Footer_Form() {
  const form = useForm<contactUsType>({
    mode: 'controlled',
    initialValues: {
      name: '',
      email: '',
      phone_number: '',
      message: '',
    },
    validate: zodResolver(contactUsSchema),
  });

  const contactUSmutation = useMutation<unknown, unknown, contactUsType>({
    mutationFn: sendEmailFun,
    onSuccess: () => {
      form.reset();
      notifications.show({
        title: 'تم الإرسال',
        message: 'تم إرسال رسالتك بنجاح!',
        color: 'green',
        position: 'top-right',
        withBorder: true,
      });
    },
    onError: () => {
      notifications.show({
        title: 'خطأ',
        message: 'فشل إرسال الرسالة. حاول مرة أخرى.',
        color: 'red',
        position: 'top-right',
        withBorder: true,
      });
    },
  });

  const handleSubmit = form.onSubmit((values: contactUsType) => {
    contactUSmutation.mutate(values);
  });

  const commonInputProps = {
    radius: 'md' as const,
    size: 'sm' as const,
    w: '100%',
    errorProps: {
      sx: {
        textAlign: 'right',
        color: '#FD6265',
        fontWeight: 400,
        fontSize: 13,
      },
    },
    classNames: {
      input: '!font-normal placeholder:!font-normal !text-dark placeholder:!text-sm',
      label: '!mb-1',
    },
  };

  return (
    <Box
      p={20}
      w={{ base: '100%', lg: '80%' }}
      pos='relative'
      className='bg-gray-100 shadow-md border border-gray-300 rounded-lg'
    >
      <LoadingOverlay
        visible={contactUSmutation.isPending}
        zIndex={49}
        overlayProps={{ radius: 'md', blur: 1 }}
      />
      <form onSubmit={handleSubmit} className='space-y-3'>
        <Flex gap={16} direction={{ base: 'column', md: 'row' }}>
          <TextInput
            label={
              <Text fw={500} fz={16} c='dark'>
                الاسم :
              </Text>
            }
            placeholder='أدخل الاسم...'
            {...commonInputProps}
            {...form.getInputProps('name')}
          />

          <Stack w='100%' gap={0}>
            <Text fz={16} fw={500} mb={4} className='!text-black !text-nowrap'>
              رقم الجوال :
            </Text>
            <Box dir='ltr' className='w-full'>
              <PhoneInput
                name='phone_number'
                className='footer-phone-input'
                international
                countryCallingCodeEditable={false}
                defaultCountry='PS'
                inputComponent={Custom_Phone_Input}
                placeholder='ادخل رقم الجوال'
                key={form.key('phone_number')}
                {...form.getInputProps('phone_number')}
              />
            </Box>
          </Stack>
        </Flex>
        <TextInput
          label={
            <Text fw={500} fz={16} c='dark'>
              البريد الإلكتروني :
            </Text>
          }
          placeholder='أدخل البريد الإلكتروني...'
          type='email'
          {...commonInputProps}
          {...form.getInputProps('email')}
        />
        <Textarea
          label={
            <Text fw={500} fz={16} c='dark'>
              الرسالة :
            </Text>
          }
          placeholder='أدخل رسالتك...'
          minRows={20}
          {...commonInputProps}
          {...form.getInputProps('message')}
        />
        <Button
          type='submit'
          fullWidth
          size='sm'
          radius='sm'
          fz={16}
          fw={500}
          disabled={contactUSmutation.isPending}
          className='!bg-primary hover:!bg-primary/90 !text-white transition-colors'
        >
          إرسال
        </Button>
      </form>
    </Box>
  );
}

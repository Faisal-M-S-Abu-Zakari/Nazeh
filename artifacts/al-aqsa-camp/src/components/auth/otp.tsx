'use client';

import { Button, Divider, Group, Stack, Text } from '@mantine/core';
import { Link } from '@/lib/nextjs-mocks';

/**
 * Kept as a safe compatibility destination for legacy recovery links.
 * Password recovery is completed exclusively with an administrator-issued
 * one-time token; this app does not send or validate email OTPs.
 */
export default function OTP() {
  return (
    <Stack
      align='center'
      gap={32}
      bg='white'
      pt={{ base: 0, lg: 64 }}
      pb={20}
      h='100%'
      w={{ base: '100%', lg: 550 }}
      className='!rounded-xl'
    >
      <Text fw={500} fz={{ base: 28, md: 32 }} ta='center'>
        إعادة تعيين كلمة المرور
      </Text>
      <Stack justify='center' align='center' gap={20}>
        <Text fw={400} fz={16} c='#817C74' ta='center' w={{ base: 343, md: 400 }} data-testid='recovery-admin-instructions'>
          لا نرسل رموز تحقق عبر البريد الإلكتروني. تواصل مع مسؤول النظام للحصول
          على رابط إعادة تعيين آمن صالح لمرة واحدة.
        </Text>
        <Button
          component={Link}
          href='create-new-password'
          w={228}
          className='!shadow-lg !bg-primary'
          data-testid='recovery-token-completion'
        >
          لدي رابط إعادة التعيين
        </Button>
        <Group wrap='nowrap' align='center' w='100%'>
          <Divider h={1} bg='#DFDEDC' w='100%' flex={1} />
          <Text mx={8} fw={400} c='#817C74'>أو</Text>
          <Divider h={1} bg='#DFDEDC' w='100%' flex={1} />
        </Group>
        <Button component={Link} href='login' variant='subtle' className='!text-primary' data-testid='recovery-login'>
          العودة إلى تسجيل الدخول
        </Button>
      </Stack>
    </Stack>
  );
}
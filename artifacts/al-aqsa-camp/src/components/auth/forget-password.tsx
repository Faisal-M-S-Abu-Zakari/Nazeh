'use client';
import { Button, Divider, Group, Stack, Text } from '@mantine/core';
import { Link as Link } from '@/lib/nextjs-mocks';

export default function Forget_Password() {
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
      <Text fw={500} fz={{ base: 28, md: 32 }} ta={'center'}>
        نسيت كلمة المرور
      </Text>

      <Stack justify='center' align='center' gap={20} pos={'relative'}>
        <Text fw={400} fz={16} c='#817C74' ta='center' w={{ base: 343, md: 400 }} data-testid='forgot-password-instructions'>
          لإعادة تعيين كلمة المرور، تواصل مع مسؤول النظام. سيصدر لك رابطاً آمناً
          صالحاً لمرة واحدة لإعداد كلمة مرور جديدة.
        </Text>
        <Button
          component={Link}
          href='create-new-password'
          size='sm'
          fz={16}
          fw={500}
          w={228}
          className='!shadow-lg !bg-primary'
          data-testid='open-token-completion'
        >
          لدي رابط إعادة التعيين
        </Button>
        <Group wrap='nowrap' align='center' w={'100%'}>
          <Divider h={1} bg={'#DFDEDC'} w={'100%'} flex={1} />
          <Text mx={8} fw={400} c={'#817C74'}>
            أو
          </Text>
          <Divider h={1} bg={'#DFDEDC'} w={'100%'} flex={1} />
        </Group>

        <Button component={Link} href='login' variant='subtle' className='!text-primary' data-testid='forgot-password-login'>
          العودة إلى تسجيل الدخول
        </Button>
      </Stack>
    </Stack>
  );
}

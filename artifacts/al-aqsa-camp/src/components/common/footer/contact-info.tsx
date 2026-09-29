import { FOOTER_FOLLOW_US } from '@/content/common/footer';
import { Box, Group, Stack, Text, ThemeIcon } from '@mantine/core';
import { Phone, Mail, MapPin, Instagram, Linkedin, Facebook, X } from 'lucide-react';
import { Link as Link } from '@/lib/nextjs-mocks';

export default function Footer_Contact_Info({ className }: { className?: string }) {
  return (
    <Box className={className}>
      <Stack gap={20} mb={16}>
        <Group gap={8}>
          <ThemeIcon className='!bg-second-light !rounded-full !'>
            <Phone size={16} className='!text-primary' />
          </ThemeIcon>
          <Text component='a' href='tel:+972599091546' c='dark' fz={16} fw={500} dir='ltr'>
            +972 599 091 546
          </Text>
        </Group>
        <Group gap={8}>
          <ThemeIcon className='!bg-second-light !rounded-full !'>
            <Mail size={16} className='!text-primary' />
          </ThemeIcon>
          <Text component='a' href='mailto:zkryfysl@gmail.com' c='dark' fz={16} fw={500} dir='ltr'>
            zkryfysl@gmail.com
          </Text>
        </Group>
        <Group gap={8}>
          <ThemeIcon className='!bg-second-light !rounded-full !'>
            <MapPin size={16} className='!text-primary' />
          </ThemeIcon>
          <Text c='dark' fz={16} fw={500} dir='ltr'>
            Gaza, Palestine
          </Text>
        </Group>
      </Stack>
      <Box mb={16}>
        <Text mb={8} fz={16} fw={600} className='!text-primary'>
          {FOOTER_FOLLOW_US} :
        </Text>
        <Group gap={20}>
          <Link href='#'>
            <Instagram size={22} className='!text-primary' />
          </Link>
          <Link href='#'>
            <Linkedin size={22} className='!text-primary' />
          </Link>
          <Link href='#'>
            <Facebook size={22} className='!text-primary' />
          </Link>
          <Link href='#'>
            <X size={22} className='!text-primary' />
          </Link>
        </Group>
      </Box>
    </Box>
  );
}

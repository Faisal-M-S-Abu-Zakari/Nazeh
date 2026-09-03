import React from 'react';
import useAuth from '@/hooks/useAuth';
import { Card, Title, Text, Avatar, Button, TextInput, Stack, Divider } from '@mantine/core';
import { ShieldCheck, User as UserIcon, Mail, Hash } from 'lucide-react';
import { USER_TYPE } from '@/constants/userTypes';

export default function ProfileSection() {
  const { user, isSecurityOfficer, isSecurity, isDelegate, isManager } = useAuth();
  
  if (!user) return null;

  const roleText = 
    isManager ? 'مدير النظام' :
    isDelegate ? 'مندوب ميداني' :
    isSecurityOfficer ? 'مسؤول أمن' :
    isSecurity ? 'فرد أمن' : 'مستخدم مصرح';
    
  return (
    <div className="space-y-6 max-w-4xl mx-auto animate-in fade-in">
      <div className="mb-8">
        <Title order={2} className="text-3xl font-display text-primary">الملف الشخصي</Title>
      </div>

      <Card withBorder shadow="sm" radius="lg" p={0} className="overflow-hidden">
        <div className="h-32 bg-primary/10 relative"></div>
        <div className="px-6 sm:px-10 pb-10 relative">
          <div className="flex flex-col sm:flex-row items-center sm:items-end gap-6 -mt-12 sm:-mt-16 mb-6">
            <div className="w-24 h-24 sm:w-32 sm:h-32 rounded-full border-4 border-white dark:border-card bg-primary text-white flex items-center justify-center shadow-lg relative z-10">
              <span className="text-4xl sm:text-5xl font-display">{user.name.charAt(0)}</span>
            </div>
            <div className="text-center sm:text-right pb-2">
              <Title order={2} className="font-display text-2xl sm:text-3xl">{user.name}</Title>
              <div className="flex items-center justify-center sm:justify-start gap-2 mt-1 text-primary font-medium">
                <ShieldCheck size={18} />
                <span>{roleText}</span>
              </div>
            </div>
          </div>
          
          <Divider my="xl" />
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <Stack gap="md">
              <Title order={4} className="font-display text-sidebar">معلومات الحساب</Title>
              
              <div className="flex items-center gap-4 bg-slate-50 dark:bg-slate-900/50 p-4 rounded-xl border border-border">
                <div className="w-10 h-10 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center">
                  <UserIcon size={20} />
                </div>
                <div>
                  <Text size="xs" c="dimmed">الاسم الكامل</Text>
                  <Text fw={600}>{user.name}</Text>
                </div>
              </div>
              
              <div className="flex items-center gap-4 bg-slate-50 dark:bg-slate-900/50 p-4 rounded-xl border border-border">
                <div className="w-10 h-10 rounded-full bg-teal-100 text-teal-600 flex items-center justify-center">
                  <Mail size={20} />
                </div>
                <div>
                  <Text size="xs" c="dimmed">البريد الإلكتروني</Text>
                  <Text fw={600} dir="ltr" className="text-right">{user.email}</Text>
                </div>
              </div>
              
              <div className="flex items-center gap-4 bg-slate-50 dark:bg-slate-900/50 p-4 rounded-xl border border-border">
                <div className="w-10 h-10 rounded-full bg-orange-100 text-orange-600 flex items-center justify-center">
                  <Hash size={20} />
                </div>
                <div>
                  <Text size="xs" c="dimmed">المعرف الوظيفي</Text>
                  <Text fw={600} dir="ltr" className="text-right">{user.identity}</Text>
                </div>
              </div>
            </Stack>
            
            <Stack gap="md">
              <Title order={4} className="font-display text-sidebar">تحديث كلمة المرور</Title>
              <Card withBorder shadow="none" radius="md" className="bg-transparent">
                 <Stack gap="sm">
                   <TextInput label="كلمة المرور الحالية" type="password" required />
                   <TextInput label="كلمة المرور الجديدة" type="password" required />
                   <TextInput label="تأكيد كلمة المرور الجديدة" type="password" required />
                   <Button className="mt-2 bg-primary hover:bg-primary/90">تحديث كلمة المرور</Button>
                 </Stack>
              </Card>
            </Stack>
          </div>
        </div>
      </Card>
    </div>
  );
}
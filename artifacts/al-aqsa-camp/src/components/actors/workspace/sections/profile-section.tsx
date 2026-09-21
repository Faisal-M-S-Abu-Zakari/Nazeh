import React, { useRef, useState } from 'react';
import useAuth from '@/hooks/useAuth';
import { Card, Title, Text, Avatar, Button, Stack, Divider } from '@mantine/core';
import { ShieldCheck, User as UserIcon, Mail, Hash, Camera, Trash2 } from 'lucide-react';
import { getAuthRole, getAuthToken } from '@/utils/auth/getSession';
import { getGetCurrentUserQueryKey, getGetFamilyMeQueryKey } from '@workspace/api-client-react';
import { useQueryClient } from '@tanstack/react-query';

export default function ProfileSection() {
  const { user, isSecurityOfficer, isSecurity, isDelegate, isManager } = useAuth();
  const queryClient = useQueryClient();
  const fileInput = useRef<HTMLInputElement>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState('');
  
  if (!user) return null;

  const roleText = 
    isManager ? 'مدير' :
    isDelegate ? 'مندوب ميداني' :
    isSecurityOfficer ? 'مسؤول أمن' :
    isSecurity ? 'فرد أمن' : 'مستخدم مصرح';
    
  const avatarUrl = user.profile_image?.startsWith('/objects/')
    ? `/api/storage${user.profile_image}`
    : user.profile_image || undefined;
  const isDisplaced = getAuthRole() === 'displaced';

  const saveAvatar = async (objectPath: string | null) => {
    const token = getAuthToken();
    const endpoint = isDisplaced ? '/api/family/me/avatar' : '/api/auth/avatar';
    const response = await fetch(endpoint, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: token ? `Bearer ${token}` : '',
      },
      body: JSON.stringify({ objectPath }),
    });
    if (!response.ok) throw new Error('تعذر حفظ الصورة الشخصية.');
    await queryClient.invalidateQueries({
      queryKey: isDisplaced ? getGetFamilyMeQueryKey() : getGetCurrentUserQueryKey(),
    });
  };

  const handleAvatarFile = async (file?: File) => {
    if (!file) return;
    setUploadError('');
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type) || file.size > 5 * 1024 * 1024) {
      setUploadError('اختر صورة JPG أو PNG أو WebP بحجم لا يتجاوز 5 ميجابايت.');
      return;
    }
    setIsUploading(true);
    try {
      const token = getAuthToken();
      const endpoint = isDisplaced ? '/api/family/me/avatar/upload-url' : '/api/auth/avatar/upload-url';
      const request = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: token ? `Bearer ${token}` : '',
        },
        body: JSON.stringify({ name: file.name, size: file.size, contentType: file.type }),
      });
      if (!request.ok) throw new Error('تعذر تجهيز رفع الصورة.');
      const { uploadUrl, objectPath } = await request.json() as { uploadUrl: string; objectPath: string };
      const upload = await fetch(uploadUrl, {
        method: 'PUT',
        headers: { 'Content-Type': file.type },
        body: file,
      });
      if (!upload.ok) throw new Error('تعذر رفع الصورة.');
      await saveAvatar(objectPath);
    } catch (error) {
      setUploadError(error instanceof Error ? error.message : 'تعذر تحديث الصورة الشخصية.');
    } finally {
      setIsUploading(false);
      if (fileInput.current) fileInput.current.value = '';
    }
  };

  const removeAvatar = async () => {
    setUploadError('');
    setIsUploading(true);
    try {
      await saveAvatar(null);
    } catch (error) {
      setUploadError(error instanceof Error ? error.message : 'تعذر حذف الصورة الشخصية.');
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div className="space-y-6 max-w-4xl mx-auto animate-in fade-in">
      <div className="mb-8">
        <Title order={2} className="text-3xl font-display text-primary">الملف الشخصي</Title>
      </div>

      <Card withBorder shadow="sm" radius="lg" p={0} className="overflow-hidden">
        <div className="h-32 bg-primary/10 relative"></div>
        <div className="px-6 sm:px-10 pb-10 relative">
          <div className="flex flex-col sm:flex-row items-center sm:items-end gap-6 -mt-12 sm:-mt-16 mb-6">
            <Avatar src={avatarUrl} size={128} radius={999} className="border-4 border-white shadow-lg relative z-10 bg-primary text-white">
              <span className="text-4xl font-display">{user.name.charAt(0)}</span>
            </Avatar>
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
              <Title order={4} className="font-display text-sidebar">الصورة الشخصية</Title>
              <Card withBorder shadow="none" radius="md" className="bg-transparent">
                <Stack gap="sm">
                  <Text size="sm" c="dimmed">يمكنك رفع صورة JPG أو PNG أو WebP بحجم أقصى 5 ميجابايت.</Text>
                  <input
                    ref={fileInput}
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    className="hidden"
                    onChange={(event) => void handleAvatarFile(event.currentTarget.files?.[0])}
                  />
                  <Button
                    leftSection={<Camera size={17} />}
                    onClick={() => fileInput.current?.click()}
                    loading={isUploading}
                  >
                    تغيير الصورة
                  </Button>
                  {avatarUrl && (
                    <Button
                      variant="light"
                      color="red"
                      leftSection={<Trash2 size={17} />}
                      onClick={() => void removeAvatar()}
                      disabled={isUploading}
                    >
                      حذف الصورة
                    </Button>
                  )}
                  {uploadError && <Text size="sm" c="red">{uploadError}</Text>}
                </Stack>
              </Card>
            </Stack>
          </div>
        </div>
      </Card>
    </div>
  );
}
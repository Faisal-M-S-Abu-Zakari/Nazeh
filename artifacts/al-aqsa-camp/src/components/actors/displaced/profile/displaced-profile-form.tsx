'use client';

import {
  Text,
  Group,
  Stack,
  Checkbox,
  Divider,
  Box,
  SimpleGrid,
  LoadingOverlay,
  ActionIcon,
  Button,
  TextInput,
  NativeSelect,
  NumberInput,
  Textarea,
  Select,
} from '@mantine/core';
import { Image } from '@/lib/nextjs-mocks';
import { MAN } from '@/assets/actor';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { DisplacedProfileResponse } from '@/@types/actors/displaced/profile/displacedProfileResponse.type';
import { getDisplacedProfile } from '@/actions/actors/displaced/profile/getDisplacedProfile';
import {
  ACCOMMODATION_TYPE_LABELS,
  AGES,
  AGES_LABELS,
  FAMILY_STATUS_TYPE_LABELS,
  SOCIAL_STATUS,
  SOCIAL_STATUS_LABELS,
  ACCOMMODATION_TYPE,
  ACTION_ADD_EDIT_DISPLAY,
  GENDER,
  GENDER_LABELS,
  FAMILY_STATUS_TYPE,
} from '@/@types/actors/common-types/index.type';
import { useUploadThing } from '@/utils/uploadthing/uploadthing';
import { useEffect, useMemo, useState } from 'react';
import useAuth from '@/hooks/useAuth';
import { useRouter  } from '@/lib/nextjs-mocks';
import { parseAsStringEnum, useQueryState } from 'nuqs';
import { useForm } from '@mantine/form';
import { zodResolver } from '@/lib/zod-resolver';
import {
  displacedProfileSchema,
  DisplacedProfileSchemaType,
} from '@/validation/actor/displaceds/profile/displaced-profile-schema';
import { handleUploadMedia } from '@/utils/uploadthing/handleUploadMedia';
import { notifications } from '@mantine/notifications';
import { GENERAL_ACTOR_ROUTES } from '@/constants/routes';
import {
  addNewDisplaced,
  AddNewDisplacedProps,
} from '@/actions/actors/displaced/profile/addNewDisplaced';
import {
  updateDisplacedProfile,
  UpdateDisplacedProfileProps,
} from '@/actions/actors/displaced/profile/updateDisplacedProfile';
import Upload_Media from '../../common/upload-files/Upload_Media';
import { Camera, UserPen, Save, Plus, Trash, Eye } from 'lucide-react';
import { Custom_Phone_Input } from '@/components/common/custom/Custom_Phone_Input';
import PhoneInput from 'react-phone-number-input';
import 'react-phone-number-input/style.css';
import useGetDelegatesNames from '@/hooks/useGetDelegatesNames';

interface DisplacedProfileFormProps {
  displaced_Id?: number;
  destination?: ACTION_ADD_EDIT_DISPLAY;
}

export default function Displaced_Profile_Form({
  displaced_Id,
  destination,
}: DisplacedProfileFormProps) {
  const queryClient = useQueryClient();
  const router = useRouter();

  const [query, setQuery] = useQueryState(
    'action',
    parseAsStringEnum<ACTION_ADD_EDIT_DISPLAY>(Object.values(ACTION_ADD_EDIT_DISPLAY)).withDefault(
      destination ?? ACTION_ADD_EDIT_DISPLAY.DISPLAY
    )
  );

  const { isDisplaced, isDelegate, isManager, user } = useAuth();

  const isAddMode = (isManager || isDelegate) && destination === ACTION_ADD_EDIT_DISPLAY.ADD;
  const isEditMode = (isManager || isDelegate) && query === ACTION_ADD_EDIT_DISPLAY.EDIT;
  const isDisplayMode =
    query === ACTION_ADD_EDIT_DISPLAY.DISPLAY && destination !== ACTION_ADD_EDIT_DISPLAY.ADD;

  const { startUpload } = useUploadThing('mediaUploader');
  const [uploading, setUploading] = useState(false);
  const [profileImage, setProfileImage] = useState<File | string | null>(MAN);

  const form = useForm<DisplacedProfileSchemaType>({
    mode: 'uncontrolled',
    initialValues: {
      name: '',
      email: '',
      identity: '',
      gender: GENDER.MALE,
      nationality: '',
      original_address: '',
      phone_number: '',
      profile_image: null,
      alternative_phone_number: '',
      wives: [],
      social_status: {
        status: SOCIAL_STATUS.SINGLE,
        number_of_wives: 0,
        number_of_males: 0,
        number_of_females: 0,
        total_family_members: 1,
        age_groups: {
          [AGES.LESS_THAN_6_MONTHS]: 0,
          [AGES.FROM_6_MONTHS_TO_2_YEARS]: 0,
          [AGES.FROM_2_YEARS_To_6_YEARS]: 0,
          [AGES.FROM_6_YEARS_To_12_YEARS]: 0,
          [AGES.FROM_12_YEARS_To_18_YEARS]: 0,
          [AGES.MORE_THAN_18]: 0,
        },
      },
      displacement: {
        tent_number: '',
        tent_type: ACCOMMODATION_TYPE.INDOOR_TENT,
        family_status_type: FAMILY_STATUS_TYPE.NORMAL,
        displacement_date: '',
        delegate: {
          id: '',
          name: '',
        },
      },
      war_injuries: [],
      martyrs: [],
      medical_conditions: [],
      additional_notes: '',
    },
    validate: zodResolver(displacedProfileSchema),
    validateInputOnChange: true,
  });

  const {
    data: displacedProfileData,
    isLoading: isLoadingFetch,
    refetch,
  } = useQuery<DisplacedProfileResponse>({
    queryKey: ['displaced-profile', displaced_Id],
    queryFn: () => getDisplacedProfile({ displaced_Id: displaced_Id as number }),
    enabled: !!displaced_Id && (isDisplayMode || isEditMode),
  });

  // Fetch delegate data based on mode
  const {
    delegatedData,
    hasError: errorDelegate,
    isLoading: isLoadingDelegates,
  } = useGetDelegatesNames({
    ids:
      isDisplayMode && displaced_Id
        ? [Number(displacedProfileData?.user.displacement.delegate.id)]
        : undefined,
    mode: query,
  });

  const [delegatesNames, setDelegatesNames] = useState<{ id: string; name: string }[]>([]);

  useEffect(() => {
    if (delegatedData?.delegate_names) {
      setDelegatesNames(
        delegatedData.delegate_names.map((item) => ({
          ...item,
          id: item.id.toString(),
        }))
      );
    }
  }, [delegatedData, isLoadingDelegates]);

  const delegateOptions = useMemo(
    () =>
      delegatesNames.map((delegate) => ({
        value: delegate.id.toString(),
        label: delegate.name,
      })),
    [delegatesNames]
  );

  const applyData = ({
    displacedData,
  }: {
    displacedData: DisplacedProfileResponse | undefined;
  }) => {
    if (!isAddMode && displacedData && displacedData.status === 200 && displacedData.user) {
      const userData = displacedData.user;

      setProfileImage(userData.profile_image ?? MAN);

      const delegate = delegatesNames.find(
        (item) => item.id.toString() === userData.displacement.delegate.id.toString()
      ) || {
        id: userData.displacement.delegate.id.toString(),
        name: userData.displacement.delegate.name,
      };

      form.setValues({
        name: userData.name,
        email: userData.email || '',
        identity: userData.identity,
        gender: userData.gender,
        nationality: userData.nationality,
        original_address: userData.original_address,
        profile_image: userData.profile_image || null,
        phone_number:
          userData.phone_number.length === 10
            ? `+970${userData.phone_number}`
            : userData.phone_number,
        alternative_phone_number:
          userData.alternative_phone_number?.length === 10
            ? `+970${userData.alternative_phone_number}`
            : userData.alternative_phone_number || '',
        wives: userData.wives || [],
        social_status: {
          status: userData.social_status?.status || SOCIAL_STATUS.SINGLE,
          number_of_wives: userData.social_status?.number_of_wives || 0,
          number_of_males: userData.social_status?.number_of_males || 0,
          number_of_females: userData.social_status?.number_of_females || 0,
          total_family_members: userData.social_status?.total_family_members || 1,
          age_groups: {
            [AGES.LESS_THAN_6_MONTHS]:
              userData.social_status?.age_groups?.[AGES.LESS_THAN_6_MONTHS] || 0,
            [AGES.FROM_6_MONTHS_TO_2_YEARS]:
              userData.social_status?.age_groups?.[AGES.FROM_6_MONTHS_TO_2_YEARS] || 0,
            [AGES.FROM_2_YEARS_To_6_YEARS]:
              userData.social_status?.age_groups?.[AGES.FROM_2_YEARS_To_6_YEARS] || 0,
            [AGES.FROM_6_YEARS_To_12_YEARS]:
              userData.social_status?.age_groups?.[AGES.FROM_6_YEARS_To_12_YEARS] || 0,
            [AGES.FROM_12_YEARS_To_18_YEARS]:
              userData.social_status?.age_groups?.[AGES.FROM_12_YEARS_To_18_YEARS] || 0,
            [AGES.MORE_THAN_18]: userData.social_status?.age_groups?.[AGES.MORE_THAN_18] || 0,
          },
        },
        displacement: {
          tent_number: userData.displacement?.tent_number || '',
          tent_type: userData.displacement?.tent_type || ACCOMMODATION_TYPE.INDOOR_TENT,
          family_status_type:
            userData.displacement?.family_status_type || FAMILY_STATUS_TYPE.NORMAL,
          displacement_date: userData.displacement?.displacement_date || '',
          delegate,
        },
        war_injuries: userData.war_injuries || [],
        martyrs: userData.martyrs || [],
        medical_conditions: userData.medical_conditions || [],
        additional_notes: userData.additional_notes || '',
      });
      form.clearErrors();
      form.resetTouched();
      form.resetDirty();
    } else if (isAddMode) {
      form.reset();
      setProfileImage(MAN);
      form.setFieldValue('displacement.delegate', { id: '', name: '' });
    }
  };

  useEffect(() => {
    applyData({ displacedData: displacedProfileData });
  }, [displacedProfileData, isAddMode, isLoadingDelegates, delegatesNames]);

  useEffect(() => {
    if (profileImage instanceof File) {
      const objectUrl = URL.createObjectURL(profileImage);
      return () => URL.revokeObjectURL(objectUrl);
    }
  }, [profileImage]);

  const updateProfileMutation = useMutation<
    DisplacedProfileResponse,
    Error,
    UpdateDisplacedProfileProps
  >({
    mutationFn: updateDisplacedProfile,
    onSuccess: (data) => {
      setQuery(ACTION_ADD_EDIT_DISPLAY.DISPLAY);
      if (data.status === 200) {
        notifications.show({
          title: 'تم التحديث',
          message: 'تم تحديث الملف الشخصي للنازح بنجاح',
          color: 'grape',
          position: 'top-left',
          withBorder: true,
        });
        applyData({ displacedData: data });
        refetch();
        queryClient.invalidateQueries({ queryKey: ['displaced-profile'] });
      } else {
        throw new Error(data.error || 'فشل في تحديث الملف الشخصي للنازح');
      }
    },
    onError: (error) => {
      setQuery(ACTION_ADD_EDIT_DISPLAY.DISPLAY);
      const errorMessage = error?.message || 'حدث خطأ أثناء تحديث الملف الشخصي للنازح';
      form.setErrors({ general: errorMessage });
      notifications.show({
        title: 'خطأ',
        message: errorMessage,
        color: 'red',
        position: 'top-left',
        withBorder: true,
      });
    },
  });

  const addDisplacedProfileMutation = useMutation<
    DisplacedProfileResponse,
    Error,
    AddNewDisplacedProps
  >({
    mutationFn: addNewDisplaced,
    onSuccess: (data) => {
      if (data.status === 201) {
        notifications.show({
          title: 'تم الإضافة',
          message: 'تمت إضافة نازح جديد بنجاح',
          color: 'grape',
          position: 'top-left',
          withBorder: true,
        });
        queryClient.invalidateQueries({ queryKey: ['displaceds'] });
        router.push(GENERAL_ACTOR_ROUTES.DISPLACEDS);
      } else {
        throw new Error(data.error || 'فشل في إضافة النازح الجديد');
      }
    },
    onError: (error) => {
      setQuery(ACTION_ADD_EDIT_DISPLAY.DISPLAY);
      const errorMessage = error?.message || 'حدث خطأ أثناء إضافة النازح الجديد';
      form.setErrors({ general: errorMessage });
      notifications.show({
        title: 'خطأ',
        message: errorMessage,
        color: 'red',
        position: 'top-left',
        withBorder: true,
      });
    },
  });

  const uploadImages = async (file: File | null): Promise<string | null> => {
    if (!file) return null;
    try {
      setUploading(true);
      const mediaUrl = await handleUploadMedia(file, startUpload);
      if (!mediaUrl) throw new Error('فشل في رفع الصورة. يرجى المحاولة مرة أخرى.');
      return mediaUrl;
    } catch {
      notifications.show({
        title: 'فشل الرفع',
        message: 'فشل في رفع الصورة. يرجى المحاولة مرة أخرى.',
        color: 'red',
        position: 'top-left',
        withBorder: true,
      });
      return null;
    } finally {
      setUploading(false);
    }
  };

  const handleSubmit = form.onSubmit(async (values: DisplacedProfileSchemaType) => {
    console.log('🚀 ~ values:', values);
    const avatarUrl =
      profileImage instanceof File
        ? await uploadImages(profileImage)
        : (profileImage as string | null) ?? null;

    const payload: DisplacedProfileSchemaType = {
      ...values,
      profile_image: avatarUrl,
    };

    const handleError = (error: unknown) => {
      const errorMessage = (error as Error)?.message || 'فشل في حفظ الملف الشخصي للنازح';
      form.setErrors({ general: errorMessage });
      notifications.show({
        title: 'خطأ',
        message: errorMessage,
        color: 'red',
        position: 'top-left',
        withBorder: true,
      });
    };

    try {
      if (isAddMode) {
        addDisplacedProfileMutation.mutate({ payload }, { onError: handleError });
      }
      if (isEditMode) {
        updateProfileMutation.mutate(
          { displaced_Id: displaced_Id as number, payload },
          { onError: handleError }
        );
      }
    } catch (error) {
      handleError(error);
    }
  });

  const addWife = () => {
    form.insertListItem('wives', {
      name: '',
      identity: '',
      nationality: '',
      is_pregnant: false,
      is_wet_nurse: false,
    });
  };

  const removeWife = (index: number) => {
    form.removeListItem('wives', index);
  };

  const addWarInjury = () => {
    form.insertListItem('war_injuries', { name: '', injury: '' });
  };

  const removeWarInjury = (index: number) => {
    form.removeListItem('war_injuries', index);
  };

  const addMartyr = () => {
    form.insertListItem('martyrs', { name: '' });
  };

  const removeMartyr = (index: number) => {
    form.removeListItem('martyrs', index);
  };

  const addMedicalCondition = () => {
    form.insertListItem('medical_conditions', { name: '', condition: '' });
  };

  const removeMedicalCondition = (index: number) => {
    form.removeListItem('medical_conditions', index);
  };

  const isMutationLoading =
    updateProfileMutation.isPending || addDisplacedProfileMutation.isPending;

  const handleOpenDelegateProfile = (event: React.MouseEvent) => {
    event.preventDefault();
    const selectedDelegateId = form.getValues().displacement.delegate.id;
    if (selectedDelegateId) {
      router.push(GENERAL_ACTOR_ROUTES.DELEGATES);
    }
  };

  return (
    <Stack p={{ base: 10, md: 20 }} pos='relative'>
      <LoadingOverlay
        visible={isLoadingFetch || isMutationLoading || uploading}
        zIndex={49}
        overlayProps={{ radius: 'sm', blur: 0.3 }}
      />

      <Box
        w='100%'
        h={80}
        className='!relative !bg-gradient-to-l !from-primary !via-second !to-white !rounded-[20px]'
      >
        <Box
          pos='absolute'
          bottom='-50%'
          left='50%'
          className='bg-primary border-1 border-second !rounded-full !overflow-hidden !- multiculturalism-x-1/2'
          w={100}
          h={100}
        >
          {profileImage ? (
            profileImage instanceof File ? (
              <img
                src={URL.createObjectURL(profileImage)}
                alt='Avatar'
                className='w-[100px] h-[100px] !object-contain'
              />
            ) : (
              <img
                src={profileImage}
                alt='Avatar'
                className='w-[100px] h-[100px] !object-contain'
              />
            )
          ) : (
            <Image src={MAN} alt='Avatar' className='w-[100px] h-[100px]' priority />
          )}
          {(isEditMode || isAddMode) && (
            <Upload_Media File_Type='image' setFileObject={setProfileImage}>
              <ActionIcon
                variant='outline'
                color='gray.5'
                radius='100%'
                pos='absolute'
                left='50%'
                top='50%'
                w={30}
                h={30}
                className='border-1 border-gray rounded-full -translate-x-1/2 -translate-y-1/2'
                component='label'
              >
                <Camera size={20} />
              </ActionIcon>
            </Upload_Media>
          )}
        </Box>
      </Box>

      <Stack my={30}>
        <form onSubmit={handleSubmit}>
          <Group wrap='nowrap' align='center'>
            <Text ta='start' fz={18} fw={600} className='!text-primary'>
              {isAddMode ? 'إضافة نازح جديد :' : 'البيانات الشخصية :'}
            </Text>
            {(isManager || isDelegate) && isDisplayMode && (
              <Button
                variant='filled'
                size='xs'
                color='primary'
                rightSection={<UserPen size={16} />}
                loading={isMutationLoading}
                onClick={() => setQuery(ACTION_ADD_EDIT_DISPLAY.EDIT)}
                fw={500}
                fz={16}
                className='shadow-sm'
              >
                تعديل
              </Button>
            )}
          </Group>

          <SimpleGrid
            cols={{ base: 1, md: 3 }}
            my={20}
            w='100%'
            className='bg-gray-50 shadow-md rounded-lg'
            p={16}
          >
            <TextInput
              label={
                <Text fz={16} fw={500} mb={4} className='!text-black !text-nowrap'>
                  الاسم :
                </Text>
              }
              placeholder='ادخل الاسم...'
              size='sm'
              w='100%'
              classNames={{
                input:
                  'disabled:!cursor-text !bg-white placeholder:!text-sm !text-primary !font-normal',
              }}
              {...form.getInputProps('name')}
              disabled={isDisplayMode}
            />
            <TextInput
              type='email'
              label={
                <Text fz={16} fw={500} mb={4} className='!text-black !text-nowrap'>
                  البريد الإلكتروني :
                </Text>
              }
              placeholder='ادخل البريد الإلكتروني...'
              size='sm'
              w='100%'
              classNames={{
                input:
                  'disabled:!cursor-text !bg-white placeholder:!text-sm !text-primary !font-normal',
              }}
              {...form.getInputProps('email')}
              disabled={isDisplayMode}
            />
            <TextInput
              label={
                <Text fz={16} fw={500} mb={4} className='!text-black !text-nowrap'>
                  رقم الهوية :
                </Text>
              }
              placeholder='ادخل رقم الهوية...'
              size='sm'
              w='100%'
              classNames={{
                input:
                  'disabled:!cursor-text !bg-white placeholder:!text-sm !text-primary !font-normal',
              }}
              {...form.getInputProps('identity')}
              disabled={isDisplayMode}
            />
            <NativeSelect
              label={
                <Text fz={16} fw={500} mb={4} className='!text-black !text-nowrap'>
                  الجنس :
                </Text>
              }
              data={Object.entries(GENDER).map(([key, value]) => ({
                value,
                label: GENDER_LABELS[value as GENDER],
              }))}
              size='sm'
              w='100%'
              classNames={{
                input:
                  'disabled:!cursor-text !bg-white placeholder:!text-sm !text-primary !font-normal',
              }}
              {...form.getInputProps('gender')}
              disabled={isDisplayMode}
            />
            <TextInput
              label={
                <Text fz={16} fw={500} mb={4} className='!text-black !text-nowrap'>
                  الجنسية :
                </Text>
              }
              placeholder='ادخل الجنسية...'
              size='sm'
              w='100%'
              classNames={{
                input:
                  'disabled:!cursor-text !bg-white placeholder:!text-sm !text-primary !font-normal',
              }}
              {...form.getInputProps('nationality')}
              disabled={isDisplayMode}
            />
            <TextInput
              label={
                <Text fz={16} fw={500} mb={4} className='!text-black !text-nowrap'>
                  عنوان السكن الأصلي :
                </Text>
              }
              placeholder='ادخل عنوان السكن الأصلي...'
              size='sm'
              w='100%'
              classNames={{
                input:
                  'disabled:!cursor-text !bg-white placeholder:!text-sm !text-primary !font-normal',
              }}
              {...form.getInputProps('original_address')}
              disabled={isDisplayMode}
            />
            <Stack w='100%' gap={0}>
              <Text fz={16} fw={500} mb={4} className='!text-black !text-nowrap'>
                رقم الجوال :
              </Text>
              <Box dir='ltr' className='w-full'>
                <PhoneInput
                  name='phone_number'
                  international
                  countryCallingCodeEditable={true}
                  defaultCountry='PS'
                  inputComponent={Custom_Phone_Input}
                  placeholder='ادخل رقم الجوال...'
                  value={form.getValues().phone_number as string}
                  key={form.key('phone_number')}
                  {...form.getInputProps('phone_number')}
                  disabled={isDisplayMode}
                />
              </Box>
            </Stack>
            {(isEditMode ||
              isAddMode ||
              (displacedProfileData?.user.alternative_phone_number &&
                displacedProfileData.user.alternative_phone_number !== '')) && (
              <Stack w='100%' gap={0}>
                <Text fz={16} fw={500} mb={4} className='!text-black !text-nowrap'>
                  رقم بديل :
                </Text>
                <Box dir='ltr' className='w-full'>
                  <PhoneInput
                    name='alternative_phone_number'
                    international
                    countryCallingCodeEditable={false}
                    defaultCountry='PS'
                    inputComponent={Custom_Phone_Input}
                    placeholder='ادخل رقم بديل...'
                    value={form.getValues().alternative_phone_number as string}
                    {...form.getInputProps('alternative_phone_number')}
                    disabled={isDisplayMode}
                  />
                </Box>
              </Stack>
            )}
          </SimpleGrid>

          <Divider h={2} w='100%' mt={20} />

          <Stack my={20}>
            <Group justify='space-between' align='center'>
              <Text fz={18} fw={600} className='!text-primary'>
                بيانات الزوجات :
              </Text>
              {(isEditMode || isAddMode) && (
                <Button
                  variant='outline'
                  size='xs'
                  color='primary'
                  rightSection={<Plus size={16} />}
                  onClick={addWife}
                >
                  إضافة زوجة
                </Button>
              )}
            </Group>
            <Box className='bg-gray-50 shadow-md rounded-lg' p={16}>
              {form.getValues().wives.map((wife, index) => (
                <Box key={index}>
                  <SimpleGrid cols={{ base: 1, sm: 2, md: 4 }} w={'100%'}>
                    <TextInput
                      label={
                        <Text fz={16} fw={500} mb={4} className='!text-black !text-nowrap'>
                          اسم الزوجة :
                        </Text>
                      }
                      placeholder='ادخل اسم الزوجة...'
                      size='sm'
                      w='100%'
                      classNames={{
                        input:
                          'disabled:!cursor-text !bg-white placeholder:!text-sm !text-primary !font-normal',
                      }}
                      {...form.getInputProps(`wives.${index}.name`)}
                      disabled={isDisplayMode}
                    />
                    <TextInput
                      label={
                        <Text fz={16} fw={500} mb={4} className='!text-black !text-nowrap'>
                          رقم هوية الزوجة :
                        </Text>
                      }
                      placeholder='ادخل رقم هوية الزوجة...'
                      size='sm'
                      w='100%'
                      classNames={{
                        input:
                          'disabled:!cursor-text !bg-white placeholder:!text-sm !text-primary !font-normal',
                      }}
                      {...form.getInputProps(`wives.${index}.identity`)}
                      disabled={isDisplayMode}
                    />
                    <TextInput
                      label={
                        <Text fz={16} fw={500} mb={4} className='!text-black !text-nowrap'>
                          جنسية الزوجة :
                        </Text>
                      }
                      placeholder='ادخل جنسية الزوجة...'
                      size='sm'
                      w='100%'
                      classNames={{
                        input:
                          'disabled:!cursor-text !bg-white placeholder:!text-sm !text-primary !font-normal',
                      }}
                      {...form.getInputProps(`wives.${index}.nationality`)}
                      disabled={isDisplayMode}
                    />
                    <Group gap={10}>
                      <Checkbox
                        label={
                          <Text fz={16} fw={500} className='!text-gray-700'>
                            حامل
                          </Text>
                        }
                        {...form.getInputProps(`wives.${index}.is_pregnant`, {
                          type: 'checkbox',
                        })}
                        disabled={isDisplayMode}
                      />
                      <Checkbox
                        label={
                          <Text fz={16} fw={500} className='!text-gray-700'>
                            مرضعة
                          </Text>
                        }
                        {...form.getInputProps(`wives.${index}.is_wet_nurse`, {
                          type: 'checkbox',
                        })}
                        disabled={isDisplayMode}
                      />
                      {(isEditMode || isAddMode) && (
                        <ActionIcon variant='outline' color='red' onClick={() => removeWife(index)}>
                          <Trash size={16} />
                        </ActionIcon>
                      )}
                    </Group>
                  </SimpleGrid>
                  <Divider
                    h={2}
                    w='95%'
                    mt={10}
                    mx={'auto'}
                    hidden={form.getValues().wives.length == index + 1}
                  />
                </Box>
              ))}
            </Box>
          </Stack>

          <Stack my={20}>
            <Text fz={18} fw={600} className='!text-primary'>
              بيانات الحالة الاجتماعية :
            </Text>
            <SimpleGrid
              cols={{ base: 2, md: 4 }}
              w={'100%'}
              className='bg-gray-50 shadow-md rounded-lg преимуще'
              p={16}
            >
              <NativeSelect
                label={
                  <Text fz={16} fw={500} mb={4} className='!text-black !text-nowrap'>
                    الحالة الاجتماعية :
                  </Text>
                }
                data={Object.entries(SOCIAL_STATUS).map(([key, value]) => ({
                  value,
                  label: SOCIAL_STATUS_LABELS[value as SOCIAL_STATUS],
                }))}
                size='sm'
                w='100%'
                classNames={{
                  input:
                    'disabled:!cursor-text !bg-white placeholder:!text-sm !text-primary !font-normal',
                }}
                {...form.getInputProps('social_status.status')}
                disabled={isDisplayMode}
              />

              <NumberInput
                label={
                  <Text fz={16} fw={500} mb={4} className='!text-black !text-nowrap'>
                    عدد الذكور :
                  </Text>
                }
                placeholder='ادخل عدد الذكور...'
                size='sm'
                w='100%'
                value={form.getValues().social_status.number_of_males}
                key={form.key('social_status.number_of_males')}
                {...form.getInputProps('social_status.number_of_males')}
                disabled={isDisplayMode}
                classNames={{
                  input:
                    'disabled:!cursor-text !bg-white placeholder:!text-sm !text-primary !font-normal',
                }}
              />

              <NumberInput
                label={
                  <Text fz={16} fw={500} mb={4} className='!text-black !text-nowrap'>
                    عدد الإناث :
                  </Text>
                }
                placeholder='ادخل عدد الإناث...'
                size='sm'
                w='100%'
                value={form.getValues().social_status.number_of_females}
                key={form.key('social_status.number_of_females')}
                {...form.getInputProps('social_status.number_of_females')}
                disabled={isDisplayMode}
                classNames={{
                  input:
                    'disabled:!cursor-text !bg-white placeholder:!text-sm !text-primary !font-normal',
                }}
              />

              {Object.values(AGES).map((ageGroup) => {
                const value = form.getValues().social_status.age_groups[ageGroup];
                return (
                  <NumberInput
                    key={ageGroup}
                    label={
                      <Text fz={16} fw={500} mb={4} className='!text-black !text-nowrap'>
                        {AGES_LABELS[ageGroup]} :
                      </Text>
                    }
                    placeholder={`ادخل عدد ${AGES_LABELS[ageGroup]}...`}
                    size='sm'
                    w='100%'
                    value={value}
                    {...form.getInputProps(`social_status.age_groups.${ageGroup}`)}
                    disabled={isDisplayMode}
                    classNames={{
                      input:
                        'disabled:!cursor-text !bg-white placeholder:!text-sm !text-primary !font-normal',
                    }}
                  />
                );
              })}
            </SimpleGrid>
          </Stack>

          <Stack my={20}>
            <Text fz={18} fw={600} className='!text-primary'>
              بيانات النزوح :
            </Text>
            <SimpleGrid
              cols={{ base: 1, md: 3 }}
              w='100%'
              className='bg-gray-50 shadow-md rounded-lg'
              p={16}
            >
              <TextInput
                label={
                  <Text fz={16} fw={500} mb={4} className='!text-black !text-nowrap'>
                    رقم الخيمة :
                  </Text>
                }
                placeholder='ادخل رقم الخيمة...'
                size='sm'
                w='100%'
                classNames={{
                  input:
                    'disabled:!cursor-text !bg-white placeholder:!text-sm !text-primary !font-normal',
                }}
                {...form.getInputProps('displacement.tent_number')}
                disabled={isDisplayMode}
              />
              <NativeSelect
                label={
                  <Text fz={16} fw={500} mb={4} className='!text-black !text-nowrap'>
                    نوع الإيواء :
                  </Text>
                }
                data={Object.entries(ACCOMMODATION_TYPE).map(([key, value]) => ({
                  value,
                  label: ACCOMMODATION_TYPE_LABELS[value as ACCOMMODATION_TYPE],
                }))}
                size='sm'
                w='100%'
                classNames={{
                  input:
                    'disabled:!cursor-text !bg-white placeholder:!text-sm !text-primary !font-normal',
                }}
                {...form.getInputProps('displacement.tent_type')}
                disabled={isDisplayMode}
              />
              <NativeSelect
                label={
                  <Text fz={16} fw={500} mb={4} className='!text-black !text-nowrap'>
                    نوع حالة الأسرة :
                  </Text>
                }
                data={Object.entries(FAMILY_STATUS_TYPE).map(([key, value]) => ({
                  value,
                  label: FAMILY_STATUS_TYPE_LABELS[value as FAMILY_STATUS_TYPE],
                }))}
                size='sm'
                w='100%'
                classNames={{
                  input:
                    'disabled:!cursor-text !bg-white placeholder:!text-sm !text-primary !font-normal',
                }}
                {...form.getInputProps('displacement.family_status_type')}
                disabled={isDisplayMode}
              />
              <TextInput
                label={
                  <Text fz={16} fw={500} mb={4} className='!text-black !text-nowrap'>
                    تاريخ النزوح :
                  </Text>
                }
                type='date'
                placeholder='ادخل تاريخ النزوح...'
                size='sm'
                w='100%'
                classNames={{
                  input:
                    'disabled:!cursor-text !bg-white placeholder:!text-sm !text-primary !font-normal',
                }}
                {...form.getInputProps('displacement.displacement_date')}
                disabled={isDisplayMode}
              />
              <Select
                label={
                  <Group w={'100%'} justify='space-between'>
                    <Text fz={16} fw={500} mb={4} className='!text-black !text-nowrap'>
                      المندوب :
                    </Text>
                    {form.getValues().displacement.delegate.id && (
                      <ActionIcon size={20} variant='light' onClick={handleOpenDelegateProfile}>
                        <Eye size={18} />
                      </ActionIcon>
                    )}
                  </Group>
                }
                placeholder='اختر المندوب...'
                size='sm'
                w='100%'
                classNames={{
                  label: '!w-full',
                  input:
                    'disabled:!cursor-text !bg-white placeholder:!text-sm !text-primary !font-normal',
                }}
                data={delegateOptions}
                searchable
                clearable
                disabled={isDisplayMode || isLoadingDelegates || !isManager}
                aria-label='اختر المندوب'
                clearButtonProps={{ 'aria-label': 'مسح المندوب' }}
                value={form.getValues().displacement.delegate.id.toString() || undefined}
                onChange={(value, option) => {
                  form.setFieldValue('displacement.delegate', {
                    id: value ? value.toString() : '',
                    name: value ? option?.label || '' : '',
                  });
                }}
              />
            </SimpleGrid>
          </Stack>

          <Box className='bg-gray-50 shadow-md rounded-lg' p={16}>
            <Stack>
              <Group justify='space-between' align='center'>
                <Text fz={18} fw={600} className='!text-primary'>
                  إصابات الحرب :
                </Text>
                {(isEditMode || isAddMode) && (
                  <Button
                    variant='outline'
                    size='xs'
                    color='primary'
                    rightSection={<Plus size={16} />}
                    onClick={addWarInjury}
                  >
                    إضافة إصابة
                  </Button>
                )}
              </Group>
              {form.getValues().war_injuries.map((injury, index) => (
                <SimpleGrid key={index} cols={{ base: 1, md: 3 }} w='100%'>
                  <TextInput
                    label={
                      <Text fz={16} fw={500} mb={4} className='!text-black !text-nowrap'>
                        اسم المصاب :
                      </Text>
                    }
                    placeholder='ادخل اسم المصاب...'
                    size='sm'
                    w='100%'
                    classNames={{
                      input:
                        'disabled:!cursor-text !bg-white placeholder:!text-sm !text-primary !font-normal',
                    }}
                    {...form.getInputProps(`war_injuries.${index}.name`)}
                    disabled={isDisplayMode}
                  />
                  <TextInput
                    label={
                      <Text fz={16} fw={500} mb={4} className='!text-black !text-nowrap'>
                        الإصابة :
                      </Text>
                    }
                    placeholder='ادخل وصف الإصابة...'
                    size='sm'
                    w='100%'
                    classNames={{
                      input:
                        'disabled:!cursor-text !bg-white placeholder:!text-sm !text-primary !font-normal',
                    }}
                    {...form.getInputProps(`war_injuries.${index}.injury`)}
                    disabled={isDisplayMode}
                  />
                  {(isEditMode || isAddMode) && (
                    <ActionIcon
                      variant='outline'
                      color='red'
                      onClick={() => removeWarInjury(index)}
                      size={24}
                      mt={30}
                      radius={8}
                    >
                      <Trash size={16} />
                    </ActionIcon>
                  )}
                </SimpleGrid>
              ))}
            </Stack>

            <Divider h={2} w='100%' mt={20} />

            <Stack my={20} gap={0}>
              <Group justify='space-between' align='center'>
                <Text fz={18} fw={600} className='!text-primary'>
                  الشهداء :
                </Text>
                {(isEditMode || isAddMode) && (
                  <Button
                    variant='outline'
                    size='xs'
                    color='primary'
                    rightSection={<Plus size={16} />}
                    onClick={addMartyr}
                  >
                    إضافة شهيد
                  </Button>
                )}
              </Group>
              {form.getValues().martyrs.map((martyr, index) => (
                <SimpleGrid key={index} cols={{ base: 1, md: 3 }} w='100%'>
                  <TextInput
                    label={
                      <Text fz={16} fw={500} mb={4} className='!text-black !text-nowrap'>
                        اسم الشهيد :
                      </Text>
                    }
                    placeholder='ادخل اسم الشهيد...'
                    size='sm'
                    w='100%'
                    classNames={{
                      input:
                        'disabled:!cursor-text !bg-white placeholder:!text-sm !text-primary !font-normal',
                    }}
                    {...form.getInputProps(`martyrs.${index}.name`)}
                    disabled={isDisplayMode}
                  />
                  {(isEditMode || isAddMode) && (
                    <ActionIcon
                      variant='outline'
                      color='red'
                      onClick={() => removeMartyr(index)}
                      size={24}
                      mt={30}
                      radius={8}
                    >
                      <Trash size={16} />
                    </ActionIcon>
                  )}
                </SimpleGrid>
              ))}
            </Stack>

            <Divider h={2} w='100%' mt={20} />

            <Stack my={20} gap={0}>
              <Group justify='space-between' align='center'>
                <Text fz={18} fw={600} className='!text-primary'>
                  الحالات المرضية :
                </Text>
                {(isEditMode || isAddMode) && (
                  <Button
                    variant='outline'
                    size='xs'
                    color='primary'
                    rightSection={<Plus size={16} />}
                    onClick={addMedicalCondition}
                  >
                    إضافة حالة مرضية
                  </Button>
                )}
              </Group>
              {form.getValues().medical_conditions.map((condition, index) => (
                <SimpleGrid key={index} cols={{ base: 1, md: 3 }} w='100%'>
                  <TextInput
                    label={
                      <Text fz={16} fw={500} mb={4} className='!text-black !text-nowrap'>
                        اسم المريض :
                      </Text>
                    }
                    placeholder='ادخل اسم المريض...'
                    size='sm'
                    w='100%'
                    classNames={{
                      input:
                        'disabled:!cursor-text !bg-white placeholder:!text-sm !text-primary !font-normal',
                    }}
                    {...form.getInputProps(`medical_conditions.${index}.name`)}
                    disabled={isDisplayMode}
                  />
                  <TextInput
                    label={
                      <Text fz={16} fw={500} mb={4} className='!text-black !text-nowrap'>
                        الحالة المرضية :
                      </Text>
                    }
                    placeholder='ادخل الحالة المرضية...'
                    size='sm'
                    w='100%'
                    classNames={{
                      input:
                        'disabled:!cursor-text !bg-white placeholder:!text-sm !text-primary !font-normal',
                    }}
                    {...form.getInputProps(`medical_conditions.${index}.condition`)}
                    disabled={isDisplayMode}
                  />
                  {(isEditMode || isAddMode) && (
                    <ActionIcon
                      variant='outline'
                      color='red'
                      onClick={() => removeMedicalCondition(index)}
                      size={24}
                      mt={30}
                      radius={8}
                    >
                      <Trash size={16} />
                    </ActionIcon>
                  )}
                </SimpleGrid>
              ))}
            </Stack>

            <Divider h={2} w='100%' mt={20} />
            <Stack my={20}>
              <Textarea
                label={
                  <Text fz={18} fw={600} mb={4} className='!text-primary !text-nowrap'>
                    ملاحظات إضافية :
                  </Text>
                }
                placeholder='ادخل ملاحظات إضافية...'
                size='sm'
                w='100%'
                classNames={{
                  input:
                    'disabled:!cursor-text !bg-white placeholder:!text-sm !text-primary !font-normal',
                }}
                {...form.getInputProps('additional_notes')}
                disabled={isDisplayMode}
              />
            </Stack>
          </Box>

          {(isEditMode || isAddMode) && (
            <Group justify='center' w={'100%'} mt={20}>
              <Button
                type='submit'
                variant='filled'
                size='xs'
                color='primary'
                loading={isMutationLoading}
                fw={500}
                fz={16}
                className='shadow-sm'
                rightSection={isEditMode ? <UserPen size={16} /> : <Save size={16} />}
              >
                {isAddMode ? 'إضافة' : 'حفظ التعديلات'}
              </Button>
            </Group>
          )}
        </form>
      </Stack>
    </Stack>
  );
}

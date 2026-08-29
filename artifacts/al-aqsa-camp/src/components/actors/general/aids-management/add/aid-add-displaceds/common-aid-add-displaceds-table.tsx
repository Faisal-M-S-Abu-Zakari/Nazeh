'use client';

import {
  ActionIcon,
  Checkbox,
  Group,
  LoadingOverlay,
  Pagination,
  Stack,
  Table,
  Text,
} from '@mantine/core';
import { parseAsInteger, parseAsString, useQueryStates } from 'nuqs';
import { useQuery } from '@tanstack/react-query';
import { Dispatch, SetStateAction, useEffect, useState } from 'react';
import { cn } from '@/utils/cn';
import { DisplacedsResponse } from '@/@types/actors/general/displaceds/displacesResponse.type';
import { getDisplaceds } from '@/actions/actors/general/displaceds/getDisplaceds';
import { Aid } from '@/@types/actors/manager/aid-management/add-aid-management.types';
import { notifications } from '@mantine/notifications';
import { displacedsFilterValuesType } from '@/validation/actor/general/displaceds/displaceds-filter-form';
import { ListChecks, ListX } from 'lucide-react';
import { getDisplacedsIds } from '@/actions/actors/general/displaceds/getDisplaceds-Ids';

interface DisplacedsTableProps {
  setDisplacedNum: React.Dispatch<React.SetStateAction<number>>;
  localFilters: displacedsFilterValuesType;
  aid_Data?: Aid;
  actor_Id: number;
  role: 'MANAGER' | 'DELEGATE';
  selectedDisplacedIds: number[];
  setSelectedDisplacedIds: Dispatch<SetStateAction<number[]>>;
}

export default function Aid_Add_Displaceds_Table({
  localFilters,
  setDisplacedNum,
  aid_Data,
  actor_Id,
  role,
  selectedDisplacedIds,
  setSelectedDisplacedIds,
}: DisplacedsTableProps) {
  const limitSelectedDisplaced =
    role == 'DELEGATE'
      ? (aid_Data?.selected_delegates_portions?.find((item) => item.delegate_Id == actor_Id)
          ?.portion as number)
      : -1;

  const [selectAllAcrossPages, setSelectAllAcrossPages] = useState(false);

  const [query, setQuery] = useQueryStates(
    {
      displaced_page: parseAsInteger.withDefault(1),
      search: parseAsString.withDefault(''),
    },
    { shallow: true }
  );

  const currentPage = query.displaced_page || 1;
  const limit = 10;
  const offset = (currentPage - 1) * limit;

  const {
    data: addDisplacedData,
    isLoading: isLoadingRegular,
    error: queryError,
  } = useQuery<DisplacedsResponse, Error>({
    queryKey: ['add_displaceds_to_aids', query, localFilters],
    queryFn: () =>
      getDisplaceds({
        page: query.displaced_page,
        limit: 7,
        search: query.search,
        filters: {
          ...localFilters,
          delegate: role == 'DELEGATE' ? [actor_Id.toString()] : [],
        },
      }),
    retry: 1,
  });

  const {
    data: allDisplacedIds,
    isLoading: isLoadingAll,
    error: allQueryError,
  } = useQuery<number[], Error>({
    queryKey: ['displaceds_all', query.search, localFilters],
    queryFn: async () => {
      const response = await getDisplacedsIds({
        filters: localFilters,
      });
      return response.displaceds_Ids;
    },
    enabled: selectAllAcrossPages,
    retry: 1,
  });

  const displacedData = addDisplacedData;

  const isLoading = isLoadingAll || isLoadingRegular;
  const error = allQueryError || queryError;

  useEffect(() => {
    if (displacedData) {
      setDisplacedNum(displacedData?.pagination?.total_items || 0);
    }
  }, [displacedData, setDisplacedNum]);

  useEffect(() => {
    if (allDisplacedIds && selectAllAcrossPages) {
      setSelectedDisplacedIds(allDisplacedIds);
    }
  }, [allDisplacedIds, selectAllAcrossPages, setSelectedDisplacedIds]);

  const isRowSelected = (id: number) => selectedDisplacedIds.includes(id);

  const areAllPagesRowsSelected = () =>
    selectedDisplacedIds.length === (displacedData?.pagination?.total_items || 0);

  const handleRowSelection = (id: number, checked: boolean) => {
    if (checked) {
      if (role == 'DELEGATE') {
        if (limitSelectedDisplaced > selectedDisplacedIds.length) {
          setSelectedDisplacedIds((prev) => [...prev.filter((rowId) => rowId !== id), id]);
          if (areAllPagesRowsSelected()) setSelectAllAcrossPages(true);
        } else {
          notifications.show({
            title: 'بلغت الحد الأقصى',
            message: `لا يمكن إضافة أكثر من ${limitSelectedDisplaced} نازح`,
            color: 'red',
            position: 'top-left',
            withBorder: true,
          });
        }
      } else {
        setSelectedDisplacedIds((prev) => [...prev.filter((rowId) => rowId !== id), id]);
        if (areAllPagesRowsSelected()) setSelectAllAcrossPages(true);
      }
    } else {
      setSelectedDisplacedIds((prev) => prev.filter((rowId) => rowId !== id));
      setSelectAllAcrossPages(false);
    }
  };

  const handleSelectAllAcrossAllPages = (checked: boolean) => {
    if (checked) {
      if (role == 'DELEGATE') {
        if (limitSelectedDisplaced > (allDisplacedIds?.length as number)) {
          setSelectAllAcrossPages(true);
          setSelectedDisplacedIds(allDisplacedIds || []);
        } else {
          notifications.show({
            title: 'بلغت الحد الأقصى',
            message: `لا يمكن إضافة أكثر من ${limitSelectedDisplaced} نازح`,
            color: 'red',
            position: 'top-left',
            withBorder: true,
          });
        }
      } else {
        setSelectAllAcrossPages(true);
        setSelectedDisplacedIds(allDisplacedIds || []);
      }
    } else {
      setSelectAllAcrossPages(false);
      setSelectedDisplacedIds([]);
    }
  };

  const headers = (
    <Table.Tr>
      <Table.Th px={5} ta='center' style={{ width: 40 }}>
        <ActionIcon
          variant='light'
          aria-label='Select all rows across all pages'
          onClick={() => handleSelectAllAcrossAllPages(!areAllPagesRowsSelected())}
        >
          {areAllPagesRowsSelected() ? <ListX size={18} /> : <ListChecks size={18} />}
        </ActionIcon>
      </Table.Th>
      <Table.Th px={5} ta='center' w='fit-content'>
        الرقم
      </Table.Th>
      <Table.Th px={5} ta='center' w='fit-content' style={{ whiteSpace: 'nowrap' }}>
        اسم النازح
      </Table.Th>
      <Table.Th px={5} ta='center' w='fit-content' style={{ whiteSpace: 'nowrap' }}>
        رقم الهوية
      </Table.Th>
      <Table.Th px={5} ta='center' w='fit-content' style={{ whiteSpace: 'nowrap' }}>
        رقم الخيمة
      </Table.Th>
      <Table.Th px={5} ta='center' w='fit-content'>
        عدد الأفراد
      </Table.Th>
      <Table.Th px={5} ta='center' w='fit-content'>
        رقم الجوال
      </Table.Th>
      <Table.Th px={5} ta='center' w='fit-content' style={{ whiteSpace: 'nowrap' }}>
        اسم المندوب
      </Table.Th>
    </Table.Tr>
  );

  const rows = (displacedData?.displaceds || []).map((element, index) => (
    <Table.Tr
      key={element.id}
      bg={isRowSelected(Number(element.id)) ? 'var(--mantine-color-blue-light)' : undefined}
    >
      <Table.Td px={5} ta='center' w='fit-content'>
        <Checkbox
          aria-label='Select row'
          checked={isRowSelected(Number(element.id))}
          onChange={(e) => handleRowSelection(Number(element.id), e.currentTarget.checked)}
        />
      </Table.Td>
      <Table.Td px={5} ta='center' w='fit-content'>
        {((query.displaced_page ?? (displacedData?.pagination?.page as number)) - 1) *
          (displacedData?.pagination?.limit || 7) +
          index +
          1}
      </Table.Td>
      <Table.Td px={5} ta='center' w='fit-content' style={{ whiteSpace: 'nowrap' }}>
        {element.name}
      </Table.Td>
      <Table.Td px={5} ta='center' w='fit-content'>
        {element.identity}
      </Table.Td>
      <Table.Td px={5} ta='center' w='fit-content'>
        {element.tent}
      </Table.Td>
      <Table.Td px={5} ta='center' w='fit-content'>
        {element.family_number}
      </Table.Td>
      <Table.Td px={5} ta='center' w='fit-content'>
        {element.mobile_number}
      </Table.Td>
      <Table.Td px={5} w='fit-content' ta='center' style={{ whiteSpace: 'nowrap' }}>
        {element.delegate.name}
      </Table.Td>
    </Table.Tr>
  ));

  return (
    <Stack>
      <Group
        flex={1}
        justify='space-between'
        align='center'
        wrap='nowrap'
        hidden={!selectedDisplacedIds?.length || false}
      >
        {selectedDisplacedIds?.length === 0 ? (
          <Text size='md' fw={500} c='dimmed'>
            لم يتم تحديد أي عنصر
          </Text>
        ) : selectAllAcrossPages ||
          selectedDisplacedIds?.length === displacedData?.pagination?.total_items ? (
          <Text size='md' fw={500} style={{ whiteSpace: 'nowrap' }}>
            تم تحديد جميع العناصر عبر جميع الصفحات
            {isLoadingAll && ' (جاري تحميل البيانات...)'}
            {allQueryError && ` (خطأ: ${allQueryError.message})`}
          </Text>
        ) : (
          <Text size='md' fw={500}>
            تم تحديد {selectedDisplacedIds.length} عنصر
          </Text>
        )}
      </Group>

      <Table.ScrollContainer
        minWidth='100%'
        w='100%'
        pos='relative'
        className={cn(isLoading && '!min-h-[300px]')}
      >
        <LoadingOverlay
          visible={isLoading || isLoadingAll}
          zIndex={1000}
          overlayProps={{ radius: 'sm', blur: 0.3 }}
        />

        {error && (
          <Text fw={500} size='sm' ta='center' c='red'>
            {error.message}
          </Text>
        )}

        {!isLoading && (!displacedData?.displaceds || displacedData.displaceds.length === 0) && (
          <Text fw={500} size='sm' ta='center' c='dimmed'>
            لا توجد بيانات للنازحين
          </Text>
        )}

        <Table horizontalSpacing='xs' striped highlightOnHover withTableBorder withColumnBorders>
          <Table.Thead>{headers}</Table.Thead>
          <Table.Tbody>{rows}</Table.Tbody>
        </Table>
      </Table.ScrollContainer>

      <Pagination
        value={query.displaced_page}
        onChange={(page) => setQuery((prev) => ({ ...prev, displaced_page: page }))}
        total={displacedData?.pagination?.total_pages || 0}
        pt={30}
        size='sm'
        mx='auto'
        radius='xl'
        withControls={false}
        classNames={{
          dots: '!rounded-full !text-gray-300 border-1',
          control: '!rounded-full',
        }}
      />
    </Stack>
  );
}

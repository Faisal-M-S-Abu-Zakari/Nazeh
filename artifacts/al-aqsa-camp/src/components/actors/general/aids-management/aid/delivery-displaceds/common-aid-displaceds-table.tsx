'use client';

import { LoadingOverlay, Pagination, Table, Text } from '@mantine/core';
import { parseAsInteger, parseAsString, useQueryStates } from 'nuqs';
import { useQuery } from '@tanstack/react-query';
import { useEffect } from 'react';
import { cn } from '@/utils/cn';
import { DisplacedsResponse } from '@/@types/actors/general/displaceds/displacesResponse.type';
import { getDisplacedByIds } from '@/actions/actors/general/displaceds/getDisplacedByIds';
import { Aid } from '@/@types/actors/manager/aid-management/add-aid-management.types';
import Common_Receive_Displaced_Aid from '../receive-displaceds-aid/common-receive-displaceds-aid';

interface CommonAidDisplacedsTableProps {
  setDisplacedNum: React.Dispatch<React.SetStateAction<number>>;
  aid_Data: Aid;
}

export default function Common_Aid_Displaceds_Table({
  setDisplacedNum,
  aid_Data,
}: CommonAidDisplacedsTableProps) {
  const receivedDisplacedIds = aid_Data.received_displaceds?.map((res) => res.displaced_Id) || [];

  const [query, setQuery] = useQueryStates(
    {
      displaced_page: parseAsInteger.withDefault(1),
      search: parseAsString.withDefault(''),
    },
    { shallow: true }
  );

  const {
    data: aid_Displaceds,
    isLoading: isLoadingAidDisplaced,
    error: selectedQueryError,
  } = useQuery<DisplacedsResponse, Error>({
    queryKey: ['aid_Displaceds', receivedDisplacedIds, query],
    queryFn: () =>
      getDisplacedByIds({
        Ids: aid_Data.selected_displaced_Ids,
        page: query.displaced_page,
        limit: 7,
      }),
    retry: 1,
  });

  const DISPLACED_DATA = aid_Displaceds;
  const isLoading = isLoadingAidDisplaced;
  const error = selectedQueryError;

  useEffect(() => {
    setDisplacedNum(DISPLACED_DATA?.pagination?.total_items || 0);
  }, [DISPLACED_DATA, setDisplacedNum]);

  const isRowReceived = (id: number) => receivedDisplacedIds?.includes(id) || false;

  const headers = (
    <Table.Tr>
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
      <Table.Th px={5} ta='center' w='fit-content' style={{ whiteSpace: 'nowrap' }}>
        حالة التسليم
      </Table.Th>
    </Table.Tr>
  );

  const rows = (DISPLACED_DATA?.displaceds || []).map((element, index) => (
    <Table.Tr
      key={element.id}
      bg={isRowReceived(Number(element.id)) ? 'var(--mantine-color-blue-light)' : undefined}
    >
      <Table.Td px={5} ta='center' w='fit-content'>
        {((query.displaced_page ?? (DISPLACED_DATA?.pagination?.page as number)) - 1) *
          (DISPLACED_DATA?.pagination?.limit || 7) +
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
      <Table.Td px={5} ta='center' w='fit-content'>
        {isRowReceived(Number(element.id)) ? (
          'تم'
        ) : (
          <Common_Receive_Displaced_Aid
            displaced_Id={Number(element.id)}
            aid_Id={aid_Data.id as number}
          />
        )}
      </Table.Td>
    </Table.Tr>
  ));

  return (
    <>
      <Table.ScrollContainer
        minWidth='100%'
        w='100%'
        pos='relative'
        className={cn(isLoading && '!min-h-[300px]')}
      >
        <LoadingOverlay
          visible={isLoading}
          zIndex={1000}
          overlayProps={{ radius: 'sm', blur: 0.3 }}
        />
        {error && (
          <Text fw={500} size='sm' ta='center' c='red'>
            {error.message}
          </Text>
        )}
        {!isLoading && (!DISPLACED_DATA?.displaceds || DISPLACED_DATA.displaceds.length === 0) && (
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
        onChange={(value) => setQuery((prev) => ({ ...prev, displaced_page: value }))}
        total={DISPLACED_DATA?.pagination?.total_pages || 0}
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
    </>
  );
}

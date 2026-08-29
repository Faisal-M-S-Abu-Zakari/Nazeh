'use client';

import {
  Checkbox,
  Group,
  LoadingOverlay,
  Pagination,
  Table,
  Text,
  ScrollArea,
  Loader,
  ActionIcon,
  Center,
  Stack,
  ThemeIcon,
} from '@mantine/core';
import { parseAsInteger, parseAsString, useQueryStates } from 'nuqs';
import { useEffect, useMemo, useState } from 'react';
import { displacedsFilterValuesType } from '@/validation/actor/general/displaceds/displaceds-filter-form';
import { Displaced, DisplacedsResponse } from '@/@types/actors/general/displaceds/displacesResponse.type';
import Displaced_Table_Actions from '@/components/actors/general/displaceds/displaced-table-actions';
import { ListChecks, ListX, Users } from 'lucide-react';
import { cn } from '@/utils/cn';
import { getListPeopleQueryKey, useListPeople } from '@workspace/api-client-react';

interface DisplacedsTableProps {
  localFilters: displacedsFilterValuesType;
  setDisplacedNum: React.Dispatch<React.SetStateAction<number>>;
}

export default function Displaceds_Table({ localFilters, setDisplacedNum }: DisplacedsTableProps) {
  const [selectedDisplacedIds, setSelectedDisplacedIds] = useState<number[]>([]);
  const [selectAllAcrossPages, setSelectAllAcrossPages] = useState(false);

  const [query, setQuery] = useQueryStates(
    {
      displaced_page: parseAsInteger.withDefault(1),
      search: parseAsString.withDefault(''),
    },
    { shallow: true }
  );

  const currentPage = query.displaced_page || 1;
  const limit = 7;
  const offset = (currentPage - 1) * limit;

  const peopleQuery = useListPeople({ query: { queryKey: getListPeopleQueryKey(), refetchInterval: 20_000 } });
  const matching = (peopleQuery.data ?? []).filter((person) =>
    !query.search || `${person.fullName} ${person.nationalId} ${person.tentNumber}`.includes(query.search)
  );
  const allDisplacedIDs = matching.map((_, index) => index + 1);
  const displacedData: DisplacedsResponse = {
    status: 200,
    displaceds: matching.slice(offset, offset + limit).map((person, index) => ({
      id: offset + index + 1,
      apiId: person.id,
      version: person.version,
      name: person.fullName,
      identity: person.nationalId,
      tent: person.tentNumber,
      family_number: person.familySize,
      mobile_number: person.phone ?? '—',
      delegate: { id: 0, name: 'إدارة المخيم' },
    })),
    pagination: {
      page: currentPage, limit, total_items: matching.length,
      total_pages: Math.ceil(matching.length / limit),
    },
  };
  const isLoadingAll = false;
  const isLoadingRegular = peopleQuery.isLoading;
  const allQueryError = null;
  const queryError = peopleQuery.error;
  const isLoading = isLoadingRegular;
  const error = queryError;

  useEffect(() => {
    setDisplacedNum(displacedData?.pagination?.total_items || 0);
  }, [displacedData, setDisplacedNum]);

  useEffect(() => {
    if (allDisplacedIDs && selectAllAcrossPages) {
      setSelectedDisplacedIds(allDisplacedIDs);
    }
  }, [matching.length, selectAllAcrossPages]);

  const isRowSelected = (id: number) => selectedDisplacedIds.includes(id);

  const areAllPagesRowsSelected = () =>
    selectedDisplacedIds.length === (displacedData?.pagination?.total_items || 0);

  const handleRowSelection = (id: number, checked: boolean) => {
    if (checked) {
      setSelectedDisplacedIds((prev) => [...prev.filter((rowId) => rowId !== id), id]);
      if (areAllPagesRowsSelected()) setSelectAllAcrossPages(true);
    } else {
      setSelectedDisplacedIds((prev) => prev.filter((rowId) => rowId !== id));
      setSelectAllAcrossPages(false);
    }
  };

  const handleSelectAllAcrossAllPages = (checked: boolean) => {
    if (checked) {
      setSelectAllAcrossPages(true);
      setSelectedDisplacedIds(allDisplacedIDs || []);
    } else {
      setSelectAllAcrossPages(false);
      setSelectedDisplacedIds([]);
    }
  };

  const columns = (
    <Table.Tr>
      <Table.Th px={5} ta='center' style={{ width: 40 }}>
        <ActionIcon
          variant='light'
          aria-label='Select all rows across all pages'
          disabled={!displacedData?.displaceds?.length}
          onClick={() => handleSelectAllAcrossAllPages(!areAllPagesRowsSelected())}
        >
          {areAllPagesRowsSelected() ? <ListX size={18} /> : <ListChecks size={18} />}
        </ActionIcon>
      </Table.Th>
      <Table.Th px={5} ta='center'>
        الرقم
      </Table.Th>
      <Table.Th px={5} ta='center' style={{ whiteSpace: 'nowrap' }}>
        اسم النازح
      </Table.Th>
      <Table.Th px={5} ta='right'>
        رقم الهوية
      </Table.Th>
      <Table.Th px={5} ta='center'>
        رقم الخيمة
      </Table.Th>
      <Table.Th px={5} ta='center'>
        عدد الأفراد
      </Table.Th>
      <Table.Th px={5} ta='center'>
        رقم الجوال
      </Table.Th>
      <Table.Th px={5} ta='center' style={{ whiteSpace: 'nowrap' }}>
        اسم المندوب
      </Table.Th>
      <Table.Th px={5} ta='center'>
        الإجراءات
      </Table.Th>
    </Table.Tr>
  );

  const rows = useMemo(() => {
    return (displacedData?.displaceds || []).map((element, index) => (
      <Table.Tr
        key={element.id}
        bg={isRowSelected(element.id) ? 'var(--mantine-color-blue-light)' : undefined}
      >
        <Table.Td px={5} ta='center'>
          <Checkbox
            aria-label='Select row'
            checked={isRowSelected(element.id)}
            onChange={(e) => handleRowSelection(element.id, e.currentTarget.checked)}
          />
        </Table.Td>
        <Table.Td px={5} ta='center'>
          {offset + index + 1}
        </Table.Td>
        <Table.Td px={5} ta='center' style={{ whiteSpace: 'nowrap' }}>
          {element.name}
        </Table.Td>
        <Table.Td px={5} ta='right'>
          {element.identity}
        </Table.Td>
        <Table.Td px={5} ta='center'>
          {element.tent}
        </Table.Td>
        <Table.Td px={5} ta='center'>
          {element.family_number}
        </Table.Td>
        <Table.Td px={5} ta='center'>
          {element.mobile_number}
        </Table.Td>
        <Table.Td px={5} ta='center' style={{ whiteSpace: 'nowrap' }}>
          {element.delegate.name}
        </Table.Td>
        <Table.Td px={5} ta='center'>
          <Displaced_Table_Actions displaced={element} />
        </Table.Td>
      </Table.Tr>
    ));
  }, [displacedData, selectedDisplacedIds]);

  const noDisplaceds = (
    <Table.Tr>
      <Table.Td colSpan={9}>
        <Center w='100%' py={30}>
          <Stack align='center' gap={8}>
            <ThemeIcon variant='light' radius='xl' size={50} color='gray'>
              <Users size={25} />
            </ThemeIcon>
            <Text ta='center' c='dimmed' fw={500} size='md'>
              لا توجد بيانات للنازحين
            </Text>
          </Stack>
        </Center>
      </Table.Td>
    </Table.Tr>
  );

  return (
    <>
      <Group
        justify='space-between'
        align='center'
        wrap='nowrap'
        hidden={selectedDisplacedIds.length === 0}
      >
        <Group flex={1}>
          {selectAllAcrossPages ? (
            <Text size='md' fw={500} style={{ whiteSpace: 'nowrap' }}>
              تم تحديد جميع العناصر عبر جميع الصفحات
              {isLoadingAll && <Loader size='xs' ml={5} />}
            </Text>
          ) : (
            <Text size='md' fw={500}>
              تم تحديد {selectedDisplacedIds.length} عنصر
            </Text>
          )}
        </Group>

      </Group>

      <Table.ScrollContainer
        minWidth='100%'
        pos='relative'
        className={cn(isLoading && '!min-h-[300px]')}
      >
        <>
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
        </>

        <Table horizontalSpacing='xs' striped highlightOnHover withTableBorder withColumnBorders>
          <Table.Thead>{columns}</Table.Thead>
          <Table.Tbody>{rows.length === 0 ? noDisplaceds : rows}</Table.Tbody>
        </Table>
      </Table.ScrollContainer>

      <Pagination
        value={currentPage}
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
    </>
  );
}

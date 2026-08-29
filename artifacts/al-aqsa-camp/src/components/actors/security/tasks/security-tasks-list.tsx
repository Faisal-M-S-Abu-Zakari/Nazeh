'use client';

import { Stack, Text, Flex, Pagination, Center } from '@mantine/core';
import { MessageCircleWarning } from 'lucide-react';
import { parseAsInteger, useQueryStates } from 'nuqs';
import { Task } from '@/@types/actors/security/tasks/TasksResponse.type';
import Security_Tasks_Card from './task/security-task-card';
import Security_Task_Skeleton from './task/security-task-skeleton';

interface SecurityTasksListProps {
  tasks: Task[];
  total_pages: number;
  limit: number;
  loading: boolean;
  security_Id: number;
}

export default function Security_Tasks_List({
  tasks,
  total_pages,
  limit,
  loading,
  security_Id,
}: SecurityTasksListProps) {
  const [query, setQuery] = useQueryStates({
    'tasks-page': parseAsInteger.withDefault(1),
  });

  return (
    <Stack pos={'relative'}>
      {loading ? (
        <Stack gap='xs'>
          {Array.from({ length: limit }).map((_, index) => (
            <Security_Task_Skeleton key={index} />
          ))}
        </Stack>
      ) : tasks.length === 0 ? (
        <Center mt={30} mih={200} className='bg-gray-50 p-6 border-1 border-gray-200 rounded-md'>
          <Stack align='center' gap={6}>
            <MessageCircleWarning size={40} className='text-primary' />
            <Text fw={600} fz='lg' className='text-primary'>
              لا توجد مهام لعرضها
            </Text>
          </Stack>
        </Center>
      ) : (
        <Stack gap='xs'>
          {tasks.map((task) => (
            <Security_Tasks_Card key={task.apiId ?? task.id} task={task} security_Id={security_Id} />
          ))}
        </Stack>
      )}

      {!loading && total_pages > 1 && (
        <Flex justify='center' mt='xl'>
          <Pagination
            value={query['tasks-page']}
            onChange={(value: number) => setQuery({ 'tasks-page': value })}
            total={total_pages}
            size='sm'
            radius='xl'
            withControls={false}
            mx='auto'
            classNames={{
              dots: '!rounded-full !text-gray-300 border-1',
              control: '!rounded-full',
            }}
          />
        </Flex>
      )}
    </Stack>
  );
}

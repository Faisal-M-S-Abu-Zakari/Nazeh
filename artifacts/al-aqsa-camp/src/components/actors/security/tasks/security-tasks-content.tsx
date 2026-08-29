'use client';

import { Box, Center, Paper, Text, ThemeIcon } from '@mantine/core';
import { parseAsInteger, parseAsStringEnum, useQueryStates } from 'nuqs';
import { TasksResponse } from '@/@types/actors/security/tasks/TasksResponse.type';
import Security_Tasks_List from './security-tasks-list';
import { CalendarCheck, MessageCircleWarning } from 'lucide-react';
import { TASKS_TABS } from '@/@types/actors/common-types/index.type';
import { getListTasksQueryKey, TaskStatus, useListTasks } from '@workspace/api-client-react';
import useAuth from '@/hooks/useAuth';

interface SecurityTasksContentProps {
  security_Id: number;
}

export default function Security_Tasks_Content({ security_Id }: SecurityTasksContentProps) {
  const [query, setQuery] = useQueryStates({
    'tasks-tab': parseAsStringEnum<TASKS_TABS>(Object.values(TASKS_TABS)).withDefault(
      TASKS_TABS.COMPLETED_TASKS
    ),
    'tasks-page': parseAsInteger.withDefault(1),
  });


  const limit = 7;

  const tasksQuery = useListTasks({
    query: { queryKey: getListTasksQueryKey(), refetchInterval: 15_000 },
  });
  const completed = query['tasks-tab'] === TASKS_TABS.COMPLETED_TASKS;
  const filtered = (tasksQuery.data ?? []).filter((task) =>
    completed ? task.status === TaskStatus.COMPLETED : task.status !== TaskStatus.COMPLETED
  );
  const start = (query['tasks-page'] - 1) * limit;
  const tasksData: TasksResponse = {
    status: 200,
    tasks: filtered.slice(start, start + limit).map((task, index) => ({
      id: index + 1,
      apiId: task.id,
      version: task.version,
      dateTime: new Date(task.dueAt ?? task.createdAt),
      title: task.title,
      body: `${task.description}${task.location ? ` — ${task.location}` : ''}`,
      security_men: [],
      type: task.status === TaskStatus.COMPLETED ? TASKS_TABS.COMPLETED_TASKS : TASKS_TABS.UPCOMING_TASKS,
    })),
    pagination: { page: query['tasks-page'], limit, total_items: filtered.length, total_pages: Math.max(1, Math.ceil(filtered.length / limit)) },
  };
  const isLoading = tasksQuery.isLoading;
  const error = tasksQuery.error;

  if (!security_Id) {
    return <Text c='red'>لا يمكن تحميل المهام، لم يتم تحديد هوية المستخدم.</Text>;
  }

  const hasError = Boolean(error);

  return (
    <Box dir='rtl' w='100%' p='sm'>
      {hasError ? (
        <Paper p='md' withBorder mt='md' className='!bg-red-100 rounded-md text-center'>
          <Box>
            <Center mb='sm'>
              <ThemeIcon color='red' variant='light' size='lg'>
                <MessageCircleWarning />
              </ThemeIcon>
            </Center>
            <Text c='red' fw={600}>
              {error?.message || 'حدث خطأ أثناء جلب المهام. تحقق من الاتصال ثم أعد المحاولة.'}
            </Text>
          </Box>
        </Paper>
      ) : (
        <Security_Tasks_List
          tasks={tasksData?.tasks || []}
          total_pages={tasksData?.pagination.total_pages || 1}
          limit={tasksData?.pagination.limit || 10}
          loading={isLoading}
          security_Id={security_Id}
        />
      )}

    </Box>
  );
}

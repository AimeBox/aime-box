import { ComponentTypes } from '@/types';
import { ids } from 'webpack';
import { z } from 'zod';

export type BaseAction = {
  name: string;
  description: string;
  schema: z.ZodTypeAny;
};

const DoneAction: BaseAction = {
  name: 'done',
  description:
    'Call this tool when you are done with the task, and supply your answer or summary.',
  schema: z.object({
    text: z.string(),
    success: z.boolean(),
  }),
};

const PlanAction: BaseAction = {
  name: 'plan',
  description: '任务规划',
  schema: z.object({}),
};

const ExecuteAction: BaseAction = {
  name: 'execute',
  description:
    '执行任务,根据之前的消息判断用户操作是否是继续的行动(如:用户说继续任务等)',
  schema: z.object({
    is_continue_action: z.boolean().default(false),
  }),
};

const HumanFeedbackAction: BaseAction = {
  name: 'human_feedback',
  description:
    '任务的详细总结,若有文件则在全文最后使用<file>文件路径</file>输出文件',
  schema: z.object({
    question: z.string(),
    // form: z.array(
    //   z
    //     .object({
    //       component: z.enum(ComponentTypes),
    //       componentProps: z.any().optional(),
    //       subLabel: z.string().optional(),
    //       label: z.string(),
    //       field: z.string(),
    //       required: z.boolean().default(false).optional(),
    //     })
    //     .describe('表单项')
    //     .optional(),
    // ),
  }),
};

const HandoffAction: BaseAction = {
  name: 'handoff',
  description: '将任务交给专业agent完成',
  schema: z.object({ agent_name: z.string(), task: z.string() }),
};

const LockedTaskAction: BaseAction = {
  name: 'locked_task',
  description: 'Lock the task for subsequent loop processing.',
  schema: z.object({
    task: z.string(),
  }),
};

const SearchMemoryAction: BaseAction = {
  name: 'search_memory',
  description: 'search the memory by keyword',
  schema: z.object({
    keyword: z.string(),
  }),
};

const GetMemoryAction: BaseAction = {
  name: 'get_memory',
  description: 'get the memory by ids',
  schema: z.object({
    ids: z.array(z.string()),
  }),
};

const SaveMemoryAction: BaseAction = {
  name: 'save_memory',
  description:
    'save or update the important data to memory,if you need update please provide the id',
  schema: z.object({
    id: z.string().optional(),
    description: z.string(),
    content: z.string().describe('The content of the memory.'),
    type: z.enum(['text', 'json', 'file']).default('text'),
    persistent: z
      .boolean()
      .describe('It will appear in the content.')
      .default(false),
  }),
};

const RemoveMemoryAction: BaseAction = {
  name: 'remove_memory',
  description: 'remove the memory by ids',
  schema: z.object({
    ids: z.array(z.string()),
  }),
};

export {
  DoneAction,
  PlanAction,
  ExecuteAction,
  HumanFeedbackAction,
  HandoffAction,
  LockedTaskAction,
  SearchMemoryAction,
  GetMemoryAction,
  SaveMemoryAction,
  RemoveMemoryAction,
};

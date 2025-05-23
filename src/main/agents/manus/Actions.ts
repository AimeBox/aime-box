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
    question: z.string(),
  }),
};

const PlanAction: BaseAction = {
  name: 'plan',
  description: '任务规划',
  schema: z.object({}),
};

const HumanFeedbackAction: BaseAction = {
  name: 'human_feedback',
  description:
    '任务的详细总结,若有文件则在全文最后使用<file>文件路径</file>输出文件',
  schema: z.object({
    question: z.string(),
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

export {
  DoneAction,
  PlanAction,
  HumanFeedbackAction,
  HandoffAction,
  LockedTaskAction,
};

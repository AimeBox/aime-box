import {
  ChatPromptTemplate,
  MessagesPlaceholder,
  PromptTemplate,
  SystemMessagePromptTemplate,
  HumanMessagePromptTemplate,
} from '@langchain/core/prompts';
import {
  BaseChatModel,
  BaseChatModelParams,
} from '@langchain/core/language_models/chat_models';
import {
  JsonOutputParser,
  StringOutputParser,
} from '@langchain/core/output_parsers';
import { tool, Tool, ToolParams } from '@langchain/core/tools';
import { Annotation, MessagesAnnotation, task } from '@langchain/langgraph';
import {
  AIMessage,
  BaseMessage,
  HumanMessage,
  isSystemMessage,
  ToolMessage,
} from '@langchain/core/messages';
import { message } from 'antd';
import z from 'zod';
import { BaseTool } from '@/main/tools/BaseTool';
import { renderTextDescription } from 'langchain/tools/render';
import { RunnableConfig } from '@langchain/core/runnables';
import { v4 as uuidv4 } from 'uuid';
import { MessageManager } from '../message_manager';
import { title } from 'node:process';
import { isArray } from '@/main/utils/is';

const PlannerSystemPrompt = `
You are a planning agent that helps break down tasks into smaller steps and reason about the current state.
Your role is to:
1. Analyze the current state and history
2. Evaluate progress towards the ultimate goal
3. Suggest the next high-level steps to take

Inside your messages, there will be AI messages from different agents with different formats.

Your output format should be always a JSON object with the following fields:
{
    "state_analysis": "Brief analysis of the current state and what has been done so far",
    "progress_evaluation": "Evaluation of progress towards the ultimate goal (as percentage and description)",
    "next_steps": "List 2-3 concrete next steps to take",
    "reasoning": "Explain your reasoning for the suggested next steps"
}

Ignore the other AI messages output structures.

Keep your responses concise and focused on actionable insights.
`;

export const PlannerAnnotation = {
  todo: Annotation<string>,
  task: Annotation<string>,
  plans: Annotation<z.infer<typeof PlanSchema>>,
  currentStep: Annotation<string>,
};

export const PlanSchema = z.object({
  title: z.string(),
  outline: z.array(
    z.object({
      title: z.string(),
      steps: z.array(
        z.object({
          title: z.string(),
          status: z.enum(['not_started', 'done', 'skip']),
        }),
      ),
    }),
  ),
});

export const CreatePlanSchema = z.object({
  title: z.string(),
  outline: z.array(
    z.object({
      title: z.string(),
      steps: z.array(z.string()),
    }),
  ),
});

export const UpdatePlanSchema = z.object({
  actions: z.object({
    update_status: z.array(
      z.object({
        index: z.number().min(1),
        status: z.enum(['done', 'skip']),
      }),
    ),
    update_title: z.array(
      z.object({
        index: z.number().min(1),
        title: z.string(),
      }),
    ),
    insert_step: z.array(
      z.object({
        index: z.number().min(1),
        title: z.string(),
      }),
    ),
  }),
});

const renderPlan = (
  plans: z.infer<typeof PlanSchema>,
  showIndex: boolean = false,
) => {
  let content = `# ${plans.title}\n`;
  let index = 1;
  for (const outline of plans.outline) {
    content += `## ${outline.title}\n`;
    for (const step of outline.steps) {
      let status = ' ';
      if (step.status) {
        if (step.status == 'done') {
          status = 'x';
        } else if (step.status == 'skip') {
          status = '-';
        }
      }
      content += `- ${showIndex && status != 'done' ? `${index}.` : ''} [${status}] ${step.title || step}\n`;
      index++;
    }
    content += '\n';
  }
  return content;
};

export const PlannerNode = (params: {
  llm: BaseChatModel;
  messageManager: MessageManager;
  systemPrompt?: string;
  structuredMethod: 'functionCalling' | 'jsonMode' | 'jsonSchema' | 'raw';
  tools: BaseTool[];
  agentDescription?: string;
  callBack?: (message: BaseMessage, state: 'start' | 'end') => Promise<void>;
}) => {
  const name = 'Planner';
  return async (
    state: typeof MessagesAnnotation.State & typeof PlannerAnnotation,
    config: RunnableConfig,
  ) => {
    const {
      llm,
      systemPrompt,
      structuredMethod = 'functionCalling',
      agentDescription,
      tools,
      callBack,
    } = params;
    const prompt_template = ChatPromptTemplate.fromMessages([
      ['system', systemPrompt || PlannerSystemPrompt],
      new MessagesPlaceholder('messages'),
    ]);

    const actions = [];
    // const create_plan = tool(
    //   async (input: typeof PlanSchema) => {
    //     return 'create plan success';
    //   },
    //   {
    //     name: 'create_plan',
    //     description: 'Create a plan for the task',
    //   },
    // );

    const update_steps = tool(
      async (input) => {
        return 'update_steps';
      },
      {
        name: 'update_steps',
        description: 'Update the steps for the task',
        schema: UpdatePlanSchema,
      },
    );
    // const insert_steps = tool(
    //   async (input) => {
    //     return 'insert_steps';
    //   },
    //   {
    //     name: 'insert_steps',
    //     description: 'Insert the steps for the task',
    //     schema: z.object({
    //       steps: z.array(
    //         z.object({
    //           index: z.number(),
    //           step: z.string(),
    //         }),
    //       ),
    //     }),
    //   },
    // );

    // const complete = tool(
    //   async (input) => {
    //     return 'complete';
    //   },
    //   {
    //     name: 'complete',
    //     description: 'Complete the task',
    //     schema: z.object({}),
    //   },
    // );
    actions.push(update_steps);

    const messages = params.messageManager.getMessages([
      'init',
      'task',
      'agent',
    ]);

    if (state.plans) {
      const todo = renderPlan(state.plans, true);
      messages.push(
        new HumanMessage(
          `Update the following todo.md based on the above history messages.\nCurrent step: ${state.currentStep}\n\n---todo.md start---\n${todo}\n\n---todo.md end---\n`,
        ),
      );
    } else {
      messages.push(
        new HumanMessage(
          `The Main Task: \n${state.task}\n\n---\nPlease create a plan to action the task`,
        ),
      );
    }

    const renderedTools = renderTextDescription(tools);

    const id = '1';
    const startMessage = new AIMessage({
      id: uuidv4(),
      content: '',
      name: name,
      tool_calls: [
        {
          name: 'planning',
          args: {},
          id,
          type: 'tool_call',
        },
      ],
    });
    const toolMessage = new ToolMessage({
      content: '',
      tool_call_id: id,
      id: uuidv4(),
    });
    await callBack?.(startMessage, 'start');
    await callBack?.(startMessage, 'end');
    await callBack?.(toolMessage, 'start');

    if (!state.todo) {
      let plans: z.infer<typeof PlanSchema>;
      if (structuredMethod == 'raw') {
        const res = await prompt_template.pipe(llm).invoke(
          {
            messages,
            renderedTools,
            agentDescription: agentDescription || '- Empty Agents',
          },
          { tags: ['ignore'] },
        );
        const plan_json = await new JsonOutputParser<
          z.infer<typeof CreatePlanSchema>
        >().parse(res.text);
        plans = plan_json;
      } else {
        const llmWithStructured = llm.withStructuredOutput(CreatePlanSchema, {
          method: structuredMethod,
          name: 'planning',
          includeRaw: true,
        });
        const res = await prompt_template.pipe(llmWithStructured).invoke(
          {
            messages,
            renderedTools,
            agentDescription: agentDescription || '- Empty Agents',
          },
          { tags: ['ignore'] },
        );
        plans = {
          ...res.parsed,
          outline: res.parsed.outline.map((outline) => {
            const _steps = outline.steps.map((step) => {
              const _step = { title: step, status: 'not_started' as const };
              return _step;
            });
            return { ...outline, steps: _steps };
          }),
        };
      }
      const todo = renderPlan(plans, true);
      console.log(todo);
      toolMessage.content = todo;
      await callBack?.(toolMessage, 'end');
      return {
        plans,
        todo,
        currentStep: plans.outline[0].steps[0],
      };
    } else {
      const llmWithTools = llm.bindTools(actions, {
        tool_choice: 'any',
      });
      const response = await llmWithTools.invoke(messages, {
        tags: ['ignore'],
      });

      const { tool_calls } = response;
      if (tool_calls && tool_calls.length > 0) {
        for (const tool_call of tool_calls) {
          const tool = actions.find((x) => x.name == tool_call.name);
          const args = tool_call.args as z.infer<typeof UpdatePlanSchema>;
          if (tool_call.name == 'update_steps') {
            const { actions } = args;
            const { plans } = state;
            const new_plans: z.infer<typeof PlanSchema> = {
              ...plans,
            };

            const getStep = (index: number) => {
              let stepIndex = 1;
              for (let i = 0; i < plans.outline.length; i++) {
                const steps = plans.outline[i].steps;
                for (let j = 0; j < steps.length; j++) {
                  if (steps[j].status == 'done' || steps[j].status == 'skip') {
                    continue;
                  }
                  if (stepIndex == index) {
                    return {
                      outlineIndex: i,
                      stepIndex: j,
                    };
                  }
                  stepIndex += 1;
                }
              }
              return null;
            };
            console.log(actions);
            if (isArray(actions.update_status)) {
              for (const action of actions.update_status) {
                const step = getStep(action.index);
                if (step) {
                  new_plans.outline[step.outlineIndex].steps[
                    step.stepIndex
                  ].status = action.status;
                }
              }
            }
            if (isArray(actions.update_title)) {
              for (const action of actions.update_title) {
                const step = getStep(action.index);
                if (step) {
                  new_plans.outline[step.outlineIndex].steps[
                    step.stepIndex
                  ].title = action.title;
                }
              }
            }
            if (isArray(actions.insert_step)) {
              for (const action of actions.insert_step) {
                const step = getStep(action.index);
                if (step) {
                  new_plans.outline[step.outlineIndex].steps.splice(
                    step.stepIndex,
                    0,
                    { title: action.title, status: 'not_started' as const },
                  );
                }
              }
            }
            const todo = renderPlan(new_plans, true);
            console.log(todo);
            toolMessage.content = todo;
            await callBack?.(toolMessage, 'end');

            let currentStep;
            for (let i = 0; i < new_plans.outline.length; i++) {
              const { steps } = new_plans.outline[i];
              for (let j = 0; j < steps.length; j++) {
                if (steps[j].status == 'not_started') {
                  currentStep = steps[j];
                  break;
                }
              }
            }
            return {
              plans: new_plans,
              todo,
              currentStep: currentStep,
            };
          }
        }
      }
    }
  };
};

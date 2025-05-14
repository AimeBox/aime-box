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
import { Tool, ToolParams } from '@langchain/core/tools';
import { MessagesAnnotation } from '@langchain/langgraph';
import { isSystemMessage } from '@langchain/core/messages';
import { message } from 'antd';
import z from 'zod';
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

export const PlannerNode = (
  llm: BaseChatModel,
  systemPrompt?: string,
  schema?: z.ZodSchema,
) => {
  return async (state: typeof MessagesAnnotation.State) => {
    const prompt_template = ChatPromptTemplate.fromMessages([
      ['system', systemPrompt || PlannerSystemPrompt],
      new MessagesPlaceholder('messages'),
    ]);

    //const plannerMessages = convertMessagesForNonFunctionCallingModels()

    //const prompt_template = PromptTemplate.fromTemplate(prompt);
    const plan = await prompt_template.pipe(llm).invoke({
      messages: state.messages.filter((message) => !isSystemMessage(message)),
    });

    if (!schema) {
      schema = z.object({
        next_steps: z.array(z.string()),
        reasoning: z.string(),
      });
    }
    const plan_json = await new JsonOutputParser<
      z.infer<typeof schema>
    >().parse(plan.text);
    return {
      plan: plan_json,
    };
  };
};

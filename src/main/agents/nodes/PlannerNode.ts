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

export const PlannerNode = (llm: BaseChatModel, tools: Tool[] = []) => {
  const old = `(1) Google[input]: Worker that searches results from Google. Useful when you need to find short
and succinct answers about a specific topic. The input should be a search query.
(2) LLM[input]: A pretrained LLM like yourself. Useful when you need to act with general
world knowledge and common sense. Prioritize it when you are confident in solving the problem
yourself. Input can be any instruction.`;

  const prompt = `For the following task, make plans that can solve the problem step by step. For each plan, indicate \
which external tool together with tool input to retrieve evidence. You can store the evidence into a \
variable #E that can be called by later tools. (Plan, #E1, Plan, #E2, Plan, ...)

Tools can be one of the following:
${tools
  .map((x, index) => {
    return '(' + (index + 1) + ')' + x.name + '[input]: ' + x.description;
  })
  .join('\r\n')}
(${
    tools.length + 1
  }) LLM[input]: A pretrained LLM like yourself. Useful when you need to act with general
world knowledge and common sense. Prioritize it when you are confident in solving the problem
yourself. Input can be any instruction.

For example,
Task: Thomas, Toby, and Rebecca worked a total of 157 hours in one week. Thomas worked x
hours. Toby worked 10 hours less than twice what Thomas worked, and Rebecca worked 8 hours
less than Toby. How many hours did Rebecca work?
Plan: Given Thomas worked x hours, translate the problem into algebraic expressions and solve
with Wolfram Alpha. #E1 = WolframAlpha[Solve x + (2x − 10) + ((2x − 10) − 8) = 157]
Plan: Find out the number of hours Thomas worked. #E2 = LLM[What is x, given #E1]
Plan: Calculate the number of hours Rebecca worked. #E3 = Calculator[(2 ∗ #E2 − 10) − 8]

Begin!
Describe your plans with rich details. Each Plan should be followed by only one #E.

Task: {task}`;
  // const prompt_template = ChatPromptTemplate.fromMessages([
  //   new HumanMessagePromptTemplate(prompt),
  // ]);
  const prompt_template = ChatPromptTemplate.fromMessages([
    ['user', prompt],
    // new MessagesPlaceholder('messages'),
    // new MessagesPlaceholder('agent_scratchpad'),
  ]);
  //const prompt_template = PromptTemplate.fromTemplate(prompt);
  const planner_node = prompt_template.pipe(llm).pipe(new StringOutputParser());
  return planner_node;
};

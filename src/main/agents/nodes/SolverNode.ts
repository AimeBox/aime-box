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

export const SolverNode = (llm: BaseChatModel) => {
  const prompt = `Solve the following task or problem. To solve the problem, we have made step-by-step Plan and \
retrieved corresponding Evidence to each Plan. Use them with caution since long evidence might \
contain irrelevant information.

{plan}

Now solve the question or task according to provided Evidence above. Respond with the answer
directly with no extra words.

Task: {task}
Response:`;
  // const prompt_template = ChatPromptTemplate.fromMessages([
  //   new HumanMessagePromptTemplate(prompt),
  // ]);
  const prompt_template = PromptTemplate.fromTemplate(prompt);
  const node = prompt_template.pipe(llm).pipe(new StringOutputParser());
  return node;
};

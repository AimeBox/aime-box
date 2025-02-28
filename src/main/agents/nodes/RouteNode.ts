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
import { JsonOutputFunctionsParser } from '@langchain/core/output_parsers/openai_functions';
import { z } from 'zod';
import { zodToJsonSchema } from 'zod-to-json-schema';
import { OllamaFunctions } from '@langchain/community/experimental/chat_models/ollama_functions';
import { RunnableLambda } from '@langchain/core/runnables';
import {
  AIMessage,
  BaseMessage,
  HumanMessage,
  SystemMessage,
  ToolMessage,
} from '@langchain/core/messages';
import { ChatGroq } from '@langchain/groq';

export const RouteNode = async (
  llm: BaseChatModel,
  roles: { name: string; describe: string }[],
): Promise<any> => {
  const prompt_template = ChatPromptTemplate.fromTemplate(
    `你是一个意图分类助手,根据用户的问题分派给指定的\`role\`去处理

=====角色=====
{roles}
==============

用户问题:{question}`,
  );
  const rolesName = roles.map((x) => x.name) as string[];
  const _roles = roles
    .map((x) => {
      return `${x.name}: ${x.describe}`;
    })
    .join('\n');
  const outputSchema = z.object({
    role: z.enum(rolesName as any),
  });
  const llmwithStructured = llm.withStructuredOutput(outputSchema);

  // const functions = [
  //   {
  //     name: 'role',
  //     parameters: zodToJsonSchema(z.object({ role: z.enum(rolesName as any) })),
  //   },
  // ];
  // const llm_with_functions = (llm as any).bind({
  //   functions: functions,
  //   function_call: functions[0],
  // });
  // console.log(functions);

  const chain = (await prompt_template.partial({ roles: _roles })).pipe(
    llmwithStructured,
  );
  //.pipe(new JsonOutputFunctionsParser({ argsOnly: true }));
  // .pipe(
  //   new RunnableLambda({
  //     func: (ai_message: BaseMessage, options: any) => {
  //       ai_message.name = options.name;
  //       return ai_message;
  //     },
  //   }),
  // );

  return chain;
};

import {
  JsonOutputParser,
  StringOutputParser,
} from '@langchain/core/output_parsers';
import {
  ChatPromptTemplate,
  MessagesPlaceholder,
  PromptTemplate,
  SystemMessagePromptTemplate,
  HumanMessagePromptTemplate,
} from '@langchain/core/prompts';

const Summary = async (llm) => {
  const prompt = PromptTemplate.fromTemplate(
    `<question>
{question}
</question>

<answer>
{generations}
</answer>

根据问题合并以上信息,可以排除无效的回答.


结果:
`,
  );
  const summary_chain = prompt.pipe(llm).pipe(new StringOutputParser());
  return summary_chain;
};
export default Summary;

import { AIMessage, HumanMessage, BaseMessage } from '@langchain/core/messages';
import { ChatMessageHistory } from 'langchain/stores/message/in_memory';
import type { DocumentInterface } from '@langchain/core/documents';
import {
  ChatPromptTemplate,
  MessagesPlaceholder,
  PromptTemplate,
  SystemMessagePromptTemplate,
  HumanMessagePromptTemplate,
} from '@langchain/core/prompts';
import { AgentExecutor } from 'langchain/agents';
import {
  JsonOutputParser,
  StringOutputParser,
} from '@langchain/core/output_parsers';
import { END, START, StateGraph } from '@langchain/langgraph';
import {
  VectorStoreRetriever,
  VectorStore,
} from '@langchain/core/vectorstores';
import { pull } from 'langchain/hub';
import { Runnable } from '@langchain/core/runnables';
import { ParentDocumentRetriever } from 'langchain/retrievers/parent_document';
import { RecursiveCharacterTextSplitter } from 'langchain/text_splitter';
import { InMemoryStore } from 'langchain/storage/in_memory';
import { Transformers } from '../../utils/transformers';
import { toolsManager } from '../../tools';
import { kbManager } from '../../knowledgebase';
import { getChatModel } from '../../llm';
import { ChatOptions } from '../../../entity/Chat';
import { ChatResponse } from '@/main/chat/ChatResponse';

const question_rewriter = (llm) => {
  const re_write_prompt = PromptTemplate.fromTemplate(
    `You a question re-writer that converts an input question to a better version that is optimized \n
     for vectorstore retrieval. Look at the initial and formulate an improved question. \n
     Here is the initial question: \n\n {question}. Improved question with no preamble: \n `,
  );

  const question_rewriter = re_write_prompt
    .pipe(llm)
    .pipe(new StringOutputParser());

  return question_rewriter;
};
const question_router = (llm) => {
  const prompt =
    PromptTemplate.fromTemplate(`You are an expert at routing a user question to a vectorstore or web search.
Use the vectorstore for questions on LLM  agents, prompt engineering, and adversarial attacks.
You do not need to be stringent with the keywords in the question related to these topics.
Otherwise, use web-search. Give a binary choice 'web_search' or 'vectorstore' based on the question.
Return the a JSON with a single key 'datasource' and no premable or explaination.
Question to route: {question}`);
  const question_router = prompt.pipe(llm).pipe(new JsonOutputParser());
  return question_router;
};

// 检测回答是否有用
const answer_grader = (llm) => {
  //   `You are a grader assessing whether an answer is useful to resolve a question. \n
  // Here is the answer:
  // \n ------- \n
  // {generation}
  // \n ------- \n
  // Here is the question: {question}
  // Give a binary score 'yes' or 'no' to indicate whether the answer is useful to resolve a question. \n
  // Provide the binary score as a JSON with a single key 'score' and no preamble or explanation.`;
  const prompt =
    PromptTemplate.fromTemplate(`你正在评估一个答案是否对解决一个问题有用.

<question>
{question}
</question>

<answer>
{generation}
</answer>

请用"yes"或"no",以表明该答案对解决问题是否有用.
Provide the binary score as a JSON with a single key 'score' and no preamble or explanation.`);
  const answer_grader = prompt.pipe(llm).pipe(new JsonOutputParser());
  return answer_grader;
};
// 检测回答是否存在幻觉
const hallucination_grader = (llm) => {
  const prompt =
    PromptTemplate.fromTemplate(`You are a grader assessing whether an answer is grounded in / supported by a set of facts. \n
Here are the facts:
\n ------- \n
{documents}
\n ------- \n
Here is the answer: {generation}
Give a binary score 'yes' or 'no' score to indicate whether the answer is grounded in / supported by a set of facts. \n
Provide the binary score as a JSON with a single key 'score' and no preamble or explanation.`);
  const hallucination_grader = prompt.pipe(llm).pipe(new JsonOutputParser());
  return hallucination_grader;
};

const summary_chain = async (llm) => {
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

const rag_chain = async (llm) => {
  // `
  // You are an assistant for question-answering tasks. Use the following pieces of retrieved context to answer the question. If you don't know the answer, just say that you don't know. Use three sentences maximum and keep the answer concise.
  // Question: {question}
  // Context:
  //  -------
  // {context}
  //  -------
  // Answer:`
  const prompt =
    PromptTemplate.fromTemplate(`你是一个问答任务的助手。使用以下检索到的上下文片段来回答这个问题。如果你不知道答案，就直接说不知道。尽可能详细回答,并保存上下文的重要信息 如金额、日期、数字等.

<content>
{context}
</content>

问题: {question}
回答:`);
  // const prompt = await pull('rlm/rag-prompt');
  const rag_chain = prompt.pipe(llm).pipe(new StringOutputParser());
  return rag_chain;
};

const retrieval_grader = (llm) => {
  const prompt =
    PromptTemplate.fromTemplate(`You are a grader assessing relevance of a retrieved document to a user question. \n
Here is the retrieved document: \n\n {document} \n\n
Here is the user question: {question} \n
If the document contains keywords related to the user question, grade it as relevant. \n
It does not need to be a stringent test. The goal is to filter out erroneous retrievals. \n
Give a binary score 'yes' or 'no' score to indicate whether the document is relevant to the question. \n
Provide the binary score as a JSON with a single key 'score' and no premable or explaination.`);
  const retrieval_grader = prompt.pipe(llm).pipe(new JsonOutputParser());

  return retrieval_grader;
};

interface GraphState {
  question: string;
  generation: string;
  documents: DocumentInterface<any>[];
}

const BuildGraph = (llm, retriever: VectorStoreRetriever<VectorStore>) => {
  const agentState = {
    question: {
      value: String,
    },
    generation: {
      value: String,
    },
    documents: {
      value: (x: DocumentInterface<any>[], y: DocumentInterface<any>[]) => y,
      // x.concat(y),
      default: () => [],
    },
  };

  const { tool } = toolsManager.tools.find(
    (x) => x.tool.name == 'tavily_search_results_json',
  );

  const web_search = async (state: GraphState) => {
    console.log('---WEB SEARCH---');
    const { question } = state;
    const docs = await tool.invoke({ input: question });
    const web_results = JSON.parse(docs);
    const documents = [];
    web_results.map((x) => {
      const doc = {
        pageContent: x.content,
        metadata: {
          source: x.url,
          title: x.title,
        },
      } as DocumentInterface;

      documents.push(doc);
    });
    // const web_results = new Document({});

    return { documents, question: question };
  };
  // 检索文档
  const retrieve = async (state: GraphState) => {
    console.log('---RETRIEVE---');
    const { question } = state;
    retriever.filter = 'isenable = true';
    // const parentDocumentRetriever = new ParentDocumentRetriever({
    //   vectorstore: retriever.vectorStore,
    //   byteStore: new InMemoryStore<Uint8Array>(),
    //   parentSplitter: new RecursiveCharacterTextSplitter({
    //     chunkOverlap: 0,
    //     chunkSize: 500,
    //   }),
    //   childSplitter: new RecursiveCharacterTextSplitter({
    //     chunkOverlap: 0,
    //     chunkSize: 50,
    //   }),
    //   childK: 20,
    //   parentK: 5,
    //   idKey: 'kbitemid',
    // });
    // //parentDocumentRetriever.vectorstore.FilterType = 'isenable = true';
    // const documents =
    //   await retriever.getRelevantDocuments(question);
    const documents = await retriever.invoke(question);
    //const documents = await retriever.getRelevantDocuments(question);

    return { documents: documents, question: question };
  };

  const grade_documents = async (state: GraphState) => {
    console.log('---CHECK DOCUMENT RELEVANCE TO QUESTION---');
    const { question } = state;
    const { documents } = state;

    const filtered_docs = [];
    for (let index = 0; index < documents.length; index++) {
      const document = documents[index];
      // const score = await retrieval_grader(llm).invoke({
      //   question: question,
      //   document: document.pageContent,
      // });
      // const grade = score['score'];
      const res = await new Transformers({
        modelName: 'bge-reranker-large',
      }).rank(question, [document.pageContent]);
      if (res[0].score > 0.02) {
        console.log('---GRADE: DOCUMENT RELEVANT---');
        filtered_docs.push(document);
      } else {
        console.log('---GRADE: DOCUMENT NOT RELEVANT---');
        continue;
      }
      // if (grade == 'yes') {
      //   console.log('---GRADE: DOCUMENT RELEVANT---');
      //   filtered_docs.push(document);
      // } else {
      //   console.log('---GRADE: DOCUMENT NOT RELEVANT---');
      //   continue;
      // }
    }

    return { documents: filtered_docs, question: question };
  };

  const route_question = async (state: GraphState) => {
    console.log('---ROUTE QUESTION---');
    const { question } = state;
    console.log(question);
    const source = (await question_router(llm).invoke({
      question: question,
    })) as any;
    console.log(source);
    console.log(source.datasource);
    if (source.datasource == 'web_search') {
      console.log('---ROUTE QUESTION TO WEB SEARCH---');
      return 'web_search';
    } else if (source.datasource == 'vectorstore') {
      console.log('---ROUTE QUESTION TO RAG---');
      return 'vectorstore';
    }
  };

  const generate = async (state: GraphState) => {
    console.log('---GENERATE---');
    const { question } = state;
    const { documents } = state;

    const generations = [];
    for (let index = 0; index < documents.length; index++) {
      const document = documents[index];
      const generation = await (
        await rag_chain(llm)
      ).invoke({
        context: document.pageContent,
        question: question,
      });
      // const res = await answer_grader(llm).invoke({
      //   generation,
      //   question,
      // });
      // if (res.score == 'yes') {
      //   generations.push(generation);
      // }
      generations.push(`${generation} [${index + 1}]`);
    }

    const res = await (
      await summary_chain(llm)
    ).invoke({
      question,
      generations: generations.join('\n-------\n'),
    });
    // const generation = await (
    //   await rag_chain(llm)
    // ).invoke({
    //   context: documents.map((x) => x.pageContent).join('\n ------- \n'),
    //   question: question,
    // });
    return { documents: documents, question: question, generation: res };
  };
  const transform_query = async (state: GraphState) => {
    console.log('---TRANSFORM QUERY---');
    const { question } = state;
    const { documents } = state;

    const better_question = await question_rewriter(llm).invoke({
      question: question,
    });
    return {
      documents: documents,
      question: better_question,
    };
  };
  const decide_to_generate = (state) => {
    console.log('---ASSESS GRADED DOCUMENTS---');
    const { question } = state;
    const filtered_documents = state.documents;

    if (!filtered_documents || filtered_documents.length == 0) {
      console.log(
        '---DECISION: ALL DOCUMENTS ARE NOT RELEVANT TO QUESTION, TRANSFORM QUERY---',
      );
      return 'transform_query';
    } else {
      console.log('---DECISION: GENERATE---');
      return 'generate';
    }
  };
  const grade_generation_v_documents_and_question = async (state) => {
    console.log('---CHECK HALLUCINATIONS---');
    const { question, documents, generation } = state;

    const score = (await hallucination_grader(llm).invoke({
      documents: documents.map((x) => x.pageContent),
      generation: generation,
    })) as any;
    const grade = score.score;

    // Check hallucination
    if (grade === 'yes') {
      console.log('---DECISION: GENERATION IS GROUNDED IN DOCUMENTS---');
      // Check question-answering
      console.log('---GRADE GENERATION vs QUESTION---');
      const score = (await answer_grader(llm).invoke({
        question: question,
        generation: generation,
      })) as any;
      const grade = score.score;
      if (grade === 'yes') {
        console.log('---DECISION: GENERATION ADDRESSES QUESTION---');
        return 'useful';
      } else {
        console.log('---DECISION: GENERATION DOES NOT ADDRESS QUESTION---');
        return 'not useful';
      }
    } else {
      console.log(
        '---DECISION: GENERATION IS NOT GROUNDED IN DOCUMENTS, RE-TRY---',
      );
      return 'not supported';
    }
  };
  const workflow = new StateGraph<
    GraphState,
    GraphState,
    Partial<GraphState>,
    | '__start__'
    | 'web_search'
    | 'generate'
    | 'retrieve'
    | 'grade_documents'
    | 'transform_query'
  >({
    channels: agentState,
  });
  workflow.addNode('web_search', web_search);
  workflow.addNode('retrieve', retrieve);
  workflow.addNode('grade_documents', grade_documents);
  workflow.addNode('generate', generate);

  workflow.addNode('transform_query', transform_query);

  // Build graph

  // workflow.set_conditional_entry_point(route_question, {
  //   web_search: 'web_search',
  //   vectorstore: 'retrieve',
  // });
  workflow.addEdge('web_search', 'generate');
  workflow.addEdge('retrieve', 'grade_documents');
  workflow.addConditionalEdges('grade_documents', decide_to_generate, {
    transform_query: 'transform_query',
    generate: 'generate',
  });
  workflow.addEdge('transform_query', 'web_search');
  workflow.addConditionalEdges(
    'generate',
    grade_generation_v_documents_and_question,
    {
      'not supported': 'generate',
      useful: END,
      'not useful': 'transform_query',
    },
  );
  workflow.addEdge(START, 'retrieve');
  // Compile
  const app = workflow.compile();
  console.log(app.getGraph().drawMermaid());
  return app;
};

export const chatWithAdvancedRagAgent = async (
  question: string,
  connectionName: string,
  modelName: string,
  toolNames: string[],
  options: ChatOptions,
  history: BaseMessage[],
  vectorStores: string[],
): Promise<ChatResponse> => {
  options.temperature = 0;
  const vectorstore = await kbManager.getVectorStore(vectorStores[0]);
  const retriever = vectorstore.asRetriever();

  const llm = await getChatModel(connectionName, modelName, options);
  const inputs = { question: question };
  const app = BuildGraph(llm, retriever);
  const ress = await app.stream(inputs);
  let res;
  let result;
  let documents = [];
  while (true) {
    res = await ress.next();
    if (res.done) {
      break;
    }
    const generation = res.value?.generate?.generation;
    documents = res.value?.generate?.documents;
    result = generation;
  }
  return { documents, output: result };
};

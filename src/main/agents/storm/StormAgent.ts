import {
  BaseCheckpointSaver,
  END,
  START,
  StateGraph,
} from '@langchain/langgraph';

import {
  ChatPromptTemplate,
  MessagesPlaceholder,
  PromptTemplate,
  SystemMessagePromptTemplate,
  HumanMessagePromptTemplate,
} from '@langchain/core/prompts';
import {
  AIMessage,
  BaseMessage,
  HumanMessage,
  SystemMessage,
  ToolMessage,
} from '@langchain/core/messages';
import { z } from 'zod';
import { zodToJsonSchema } from 'zod-to-json-schema';
import { v4 as uuidv4 } from 'uuid';
// import { SqliteSaver } from '@langchain/langgraph/checkpoint/sqlite';

import { OllamaFunctions } from '@langchain/community/experimental/chat_models/ollama_functions';
import { JsonOutputFunctionsParser } from '@langchain/core/output_parsers/openai_functions';

import type { DocumentInterface } from '@langchain/core/documents';
import { RunnableLambda } from '@langchain/core/runnables';
import { RunnableConfig } from '@langchain/core/dist/runnables/config';
import connectionsManager from '../../providers';
import { ChatOptions } from '../../../entity/Chat';
import { getChatModel } from '../../llm';
import { toolsManager } from '../../tools';
import { isArray } from '../../utils/is';
import { dbManager } from '../../db';
import { ChatResponse } from '@/main/chat/ChatResponse';

class Subsection {
  subsection_title: string;

  description: string;

  static schema = z.object({
    subsection_title: z.string().describe('Title of the subsection'),
    description: z.string().describe('Content of the subsection'),
  });
}

class Section {
  section_title: string;

  description: string;

  subsections?: Subsection[];

  static schema = z.object({
    section_title: z.string().describe('Title of the section'),
    description: z.string().describe('Content of the section'),
    subsections: z
      .array(Subsection.schema)
      .optional()
      .describe(
        'Titles and descriptions for each subsection of the Wikipedia page.',
      ),
  });

  static as_str = (section: Section): string => {
    const _subsections = (section.subsections || [])
      .map((subsection) => {
        return `### ${subsection.subsection_title}\n\n${subsection.description}`;
      })
      .join('\n\n');
    return `## ${section.section_title}\n\n${section.description}\n\n${_subsections}`.trim();
  };
}

class Outline {
  page_title: string;

  sections: Section[];

  static schema = z.object({
    page_title: z.string().describe('Title of the Wikipedia page'),
    sections: z
      .array(Section.schema)
      .describe(
        'Titles and descriptions for each section of the Wikipedia page.',
      ),
  });

  static to_function = () => {
    const f = {
      name: 'Outline',
      parameters: zodToJsonSchema(Outline.schema),
    };
    // delete f.parameters['$schema'];
    // delete f.parameters['additionalProperties'];
    // console.log(f);
    return f;
  };

  static as_str = (outline: Outline): string => {
    const _sections = outline.sections
      .map((section) => {
        return Section.as_str(section);
      })
      .join('\n\n');
    return `# ${outline.page_title}\n\n${_sections}`.trim();
  };
}

class RelatedSubjects {
  topics: string[];

  static schema = z
    .object({ topics: z.array(z.string()) })
    .describe('Comprehensive list of related subjects as background research.');

  static to_function = () => {
    const f = {
      name: 'RelatedSubjects',
      parameters: zodToJsonSchema(RelatedSubjects.schema),
    };
    // delete f.parameters.$schema;
    // delete f.parameters.additionalProperties;
    return f;
  };
}

class Editor {
  affiliation: string;

  name: string;

  role: string;

  description: string;

  persona = (): string => {
    return `Name: ${this.name}\nRole: ${this.role}\nAffiliation: ${this.affiliation}\nDescription: ${this.description}\n`;
  };

  static schema = z.object({
    affiliation: z.string().describe('Primary affiliation of the editor.'),
    name: z.string().describe('Name of the editor.'),
    role: z
      .string()
      .describe('Role of the editor in the context of the topic.'),
    description: z
      .string()
      .describe("Description of the editor's focus, concerns, and motives."),
  });

  static to_function = () => {
    const f = {
      name: 'Editor',
      parameters: zodToJsonSchema(Editor.schema),
    };
    return f;
  };
}
class Perspectives {
  editors: Editor[];

  static schema = z
    .object({ editors: z.array(Editor.schema) })
    .describe(
      'Comprehensive list of editors with their roles and affiliations.',
    );

  static to_function = () => {
    const f = {
      name: 'Perspectives',
      parameters: zodToJsonSchema(Perspectives.schema),
    };
    // delete f.parameters['$schema'];
    // delete f.parameters['additionalProperties'];
    return f;
  };
}
interface ResearchState {
  topic: string;
  outline: Outline | null;
  editors: any[];
  interview_results: any[];
  sections: any[];
  article: string;
}

const researchState = {
  topic: {
    value: null,
  },
  outline: {
    value: null,
    default: () => {
      return null;
    },
  },
  editors: {
    value: (x, y) => x.concat(y),
    default: () => [],
  },
  interview_results: {
    value: (x, y) => x.concat(y),
    default: () => [],
  },
  sections: {
    value: (x, y) => x.concat(y),
    default: () => {
      return [];
    },
  },
  article: {
    value: null,
  },
  actions: {
    value: (x, y) => {
      return x.concat(y);
    },
    default: () => [],
  },
};

const interviewState = {
  messages: {
    value: (x: any[] | any, y: any[] | any) => {
      if (!isArray(x)) {
        x = [x];
      }
      if (!isArray(y)) {
        y = [y];
      }
      return x.concat(y);
    },
    default: () => [] as BaseMessage[],
  },
  references: {
    value: (x, y) => {
      if (!x) {
        x = {};
      }
      return { ...x, ...y };
    },
    default: () => {},
  },
  editor: {
    value: (x, y) => {
      if (!x) return y;
      return x;
    },
    default: () => {
      return null;
    },
  },
};
class InterviewState {
  messages: any[];

  references?: any;

  editor?: Editor | null;
}

class Queries {
  queries: string[];

  static schema = z
    .object({ queries: z.array(z.string()) })
    .describe(
      "Comprehensive list of search engine queries to answer the user's questions.",
    );

  static to_function = () => {
    const f = {
      name: 'Queries',
      parameters: zodToJsonSchema(Queries.schema),
    };
    // delete f.parameters['$schema'];
    // delete f.parameters['additionalProperties'];
    return f;
  };
}

class AnswerWithCitations {
  answer: string;

  cited_urls: string[];

  static schema = z.object({
    answer: z
      .string()
      .describe("Comprehensive answer to the user's question with citations."),
    cited_urls: z
      .array(z.string())
      .describe('List of urls cited in the answer.'),
  });

  static to_function = () => {
    const f = {
      name: 'AnswerWithCitations',
      parameters: zodToJsonSchema(AnswerWithCitations.schema),
    };
    // delete f.parameters.$schema;
    // delete f.parameters.additionalProperties;
    return f;
  };

  as_str() {
    return `${this.answer}\n\nCitations:\n\n${this.cited_urls
      .map((url, i) => {
        `[${i + 1}]: ${url}`;
      })
      .join('\n')}`;
  }
}

export const StormAgent = async (
  connectionName: string,
  modelName: string,
  options: ChatOptions,
  memory?: BaseCheckpointSaver,
) => {
  const example_topic =
    'Impact of million-plus token context window language models on RAG';
  const connection = await (
    await connectionsManager.getProviders()
  ).find((x) => x.name === connectionName);
  const llm = await getChatModel(connectionName, modelName, options);
  const tools = toolsManager.tools
    .filter((x) => (options?.toolNames ?? []).includes(x.name))
    .map((x) => x.tool);

  // const direct_gen_outline_prompt = ChatPromptTemplate.fromMessages([
  //   SystemMessagePromptTemplate.fromTemplate(
  //     'You are a Wikipedia writer. Write an outline for a Wikipedia page about a user-provided topic. Be comprehensive and specific.',
  //   ),
  //   HumanMessagePromptTemplate.fromTemplate('{topic}'),
  // ]);
  const direct_gen_outline_prompt = ChatPromptTemplate.fromTemplate(
    'You are a Wikipedia writer. Write an outline for a Wikipedia page about a user-provided topic. Be comprehensive and specific.\n\ntopic:{topic}',
  );
  const generate_outline_direct = direct_gen_outline_prompt.pipe(
    connection.type == 'ollama'
      ? new OllamaFunctions(llm)
          .bind({
            functions: [Outline.to_function()],
            function_call: Outline.to_function(),
          })
          .pipe(new JsonOutputFunctionsParser({ argsOnly: true }))
      : llm.withStructuredOutput(Outline.schema),
  );

  const gen_related_topics_prompt = ChatPromptTemplate.fromTemplate(
    `I'm writing a Wikipedia page for a topic mentioned below. Please identify and recommend some Wikipedia pages on closely related subjects. I'm looking for examples that provide insights into interesting aspects commonly associated with this topic, or examples that help me understand the typical content and structure included in Wikipedia pages for similar topics.

Please list the as many subjects and urls as you can.

Topic of interest: {topic}`,
  );
  const expand_chain = gen_related_topics_prompt.pipe(
    connection.type == 'ollama'
      ? new OllamaFunctions(llm)
          .bind({
            functions: [RelatedSubjects.to_function()],
            function_call: RelatedSubjects.to_function(),
          })
          .pipe(new JsonOutputFunctionsParser({ argsOnly: true }))
      : llm.withStructuredOutput(RelatedSubjects.schema),
  );

  const gen_perspectives_prompt = ChatPromptTemplate.fromTemplate(
    `You need to select a diverse (and distinct) group of Wikipedia editors who will work together to create a comprehensive article on the topic. Each of them represents a different perspective, role, or affiliation related to this topic.\
You can use other Wikipedia pages of related topics for inspiration. For each editor, add a description of what they will focus on.

Wiki page outlines of related topics for inspiration:
{examples}

Topic of interest: {topic}
`,
  );
  const gen_perspectives_chain = gen_perspectives_prompt.pipe(
    connection.type == 'ollama'
      ? new OllamaFunctions(llm)
          .bind({
            functions: [Perspectives.to_function()],
            function_call: Perspectives.to_function(),
          })
          .pipe(new JsonOutputFunctionsParser({ argsOnly: true }))
      : llm.withStructuredOutput(Perspectives.schema),
  );

  const survey_subjects = async (topic: string) => {
    const wikipedia = tools.find((x) => x.name === 'wikipedia-api');
    const related_subjects = await expand_chain.invoke({ topic });
    const all_docs = [];
    for (let index = 0; index < related_subjects.topics.length; index++) {
      const topic = related_subjects.topics[index];
      const res = await wikipedia.invoke(topic);
      const st = res.indexOf('Summary: ');

      const title = res.substring(5, st - 1);
      const summary = res.substring(st + 9);
      const doc = {
        pageContent: summary,
        metadata: {
          title,
        },
      } as DocumentInterface;
      all_docs.push(doc);
    }
    const formatted = all_docs
      .map((doc) => {
        return `### ${doc.metadata.title}\n\nSummary: ${doc.pageContent}`;
      })
      .join('\n\n');
    console.log(`=====WIKI找到共${all_docs.length}篇文章======`);

    return await gen_perspectives_chain.invoke({
      examples: formatted,
      topic,
    });
  };

  const initialize_research = async (state: ResearchState) => {
    const { topic } = state;
    console.log(`======主题 : ${topic}======`);
    console.log('======生成初始大纲======');
    const outline = await generate_outline_direct.invoke({ topic });
    console.log(Outline.as_str(outline as Outline));
    const { editors } = await survey_subjects(topic);

    console.log({
      outline,
      editors,
    });
    return {
      outline,
      editors,
    };
  };

  const conduct_interviews = async (state: ResearchState) => {
    const { topic } = state;
    const { editors } = state;
    const initial_states = editors.map((editor) => {
      return {
        editor,
        messages: [
          new AIMessage({
            content: `So you said you were writing an article on ${topic}?`,
            name: 'Subject_Matter_Expert',
          }),
        ],
      };
    });
    const interview_results = (await getInterviewGraph()).batch(initial_states);

    return {
      ...state,
      interview_results,
    };
  };

  const gen_qn_prompt = ChatPromptTemplate.fromMessages([
    SystemMessagePromptTemplate.fromTemplate(`You are an experienced Wikipedia writer and want to edit a specific page. \
Besides your identity as a Wikipedia writer, you have a specific focus when researching the topic. \
Now, you are chatting with an expert to get information. Ask good questions to get more useful information.

When you have no more questions to ask, say "Thank you so much for your help!" to end the conversation.\
Please only ask one question at a time and don't ask what you have asked before.\
Your questions should be related to the topic you want to write.
Be comprehensive and curious, gaining as much unique insight from the expert as possible.\

Stay true to your specific perspective:

{persona}`),
    new MessagesPlaceholder({ variableName: 'messages', optional: true }),
  ]);
  const swap_roles = (state: InterviewState, options: any) => {
    const converted = [];
    for (let index = 0; index < state.messages.length; index++) {
      let message = state.messages[index];
      if (message instanceof AIMessage && message.name != options.name) {
        message = new HumanMessage(message.content as string);
      }
      converted.push(message);
    }
    return { messages: converted };
  };
  const generate_question = async (state: InterviewState) => {
    const { editor } = state;
    const persona = `Name: ${editor.name}\nRole: ${editor.role}\nAffiliation: ${editor.affiliation}\nDescription: ${editor.description}\n`;
    const ss = await gen_qn_prompt.partial({ persona });

    const ral = (new RunnableLambda({ func: swap_roles }) as any).bind({
      name: editor.name,
    });

    const gn_chain = ral
      .pipe(ss)
      .pipe(llm)
      .pipe(
        (
          new RunnableLambda({
            func: (ai_message: AIMessage, options: any) => {
              ai_message.name = options.name;
              return ai_message;
            },
          }) as any
        ).bind({
          name: editor.name,
        }),
      );
    console.log('=======生成问题======');
    const result = await gn_chain.invoke(state);

    console.log(result.content);
    return { messages: [result] };
  };
  const gen_queries_prompt = ChatPromptTemplate.fromMessages([
    SystemMessagePromptTemplate.fromTemplate(
      `You are a helpful research assistant. Query the search engine to answer the user's questions.`,
    ),
    new MessagesPlaceholder('messages'),
  ]);
  const gen_queries_chain = gen_queries_prompt.pipe(
    connection.type == 'ollama'
      ? new OllamaFunctions(llm)
          .bind({
            functions: [Queries.to_function()],
            function_call: Queries.to_function(),
          })
          .pipe(new JsonOutputFunctionsParser({ argsOnly: false }))
      : llm.withStructuredOutput(Queries.schema, { includeRaw: true }),
  );

  const gen_answer_prompt = ChatPromptTemplate.fromMessages([
    SystemMessagePromptTemplate.fromTemplate(`You are an expert who can use information effectively. You are chatting with a Wikipedia writer who wants\
 to write a Wikipedia page on the topic you know. You have gathered the related information and will now use the information to form a response.

Make your response as informative as possible and make sure every sentence is supported by the gathered information.
Each response must be backed up by a citation from a reliable source, formatted as a footnote, reproducing the URLS after your response.but don't output the Citations URLS`),

    new MessagesPlaceholder({ variableName: 'messages', optional: true }),
  ]);

  // const gen_answer_chain = gen_answer_prompt
  //   .pipe(
  //     connection.type == 'ollama'
  //       ? new OllamaFunctions(llm)
  //           .bind({
  //             functions: [AnswerWithCitations.to_function()],
  //             function_call: AnswerWithCitations.to_function(),
  //           })
  //           .pipe(new JsonOutputFunctionsParser({ argsOnly: false }))
  //       : llm.withStructuredOutput(AnswerWithCitations.schema, {
  //           includeRaw: true,
  //         }),
  //   )
  //   .withConfig({ runName: 'GenerateAnswer' });

  const gen_answer_chain = gen_answer_prompt
    .pipe(llm)
    .withConfig({ runName: 'GenerateAnswer' });
  const gen_answer = async (
    state: InterviewState,
    config?: RunnableConfig | any,
    name: string = 'Subject_Matter_Expert',
    max_str_len: number = 4000,
  ) => {
    const swapped_state = swap_roles(state, name);
    console.log('==========生成网络查询所需要的关键字=============');
    const queries = (await gen_queries_chain.invoke(swapped_state)) as any;

    const all_query_results = {};
    const search_engine = tools.find(
      (x) => x.name == 'tavily_search_results_json',
    );
    let queriesList;
    if (Object.keys(queries).includes('parsed')) {
      queriesList = queries.parsed;
    } else if (Object.keys(queries).includes('arguments')) {
      queriesList = queries.arguments;
    }
    console.log(queriesList.queries);
    for (let index = 0; index < queriesList.queries.length; index++) {
      const q = queriesList.queries[index];
      const res = await search_engine.invoke(q);
      const j = JSON.parse(res);
      j.forEach((item) => {
        all_query_results[item.url] = item.content;
      });
    }

    // const all_query_results = {
    //     res["url"]: res["content"] for results in successful_results for res in results
    // }

    const dumped = JSON.stringify(all_query_results).substring(0, max_str_len);

    if (!queries.raw) {
      queries.raw = new AIMessage({
        content: '',
        additional_kwargs: {
          tool_calls: [
            {
              id: uuidv4(),
            } as any,
          ],
        },
      });
    }
    if (connection.type === 'ollama') {
      swapped_state.messages.push(
        new HumanMessage(
          `使用网络搜索找到以下相关文章:\n\n ========\n${Object.entries(
            all_query_results,
          )
            .map((x) => x[1])
            .join(
              '\n\n',
            )}\n ======== \n你的回答尽可能翔实，并确保每句话都有收集到的信息支持。\n回答:`,
        ),
      );
    } else {
      const ai_message: AIMessage = queries.raw;
      const tool_call = queries.raw.additional_kwargs.tool_calls[0];
      const tool_id = tool_call.id;
      const tool_message = new ToolMessage(dumped, tool_id);
      swapped_state.messages.push(ai_message);
      swapped_state.messages.push(tool_message);
    }

    console.log('==========回答问题=============');

    swapped_state.messages.forEach((m) => {
      console.log(`[${(m as BaseMessage)._getType()}]: ${m.content}`);
    });

    const generated = await gen_answer_chain.invoke(swapped_state);
    const answer = generated.content;
    const cited_urls = Object.entries(all_query_results).map((x) => x[0]);
    // const cited_urls = [...new Set(generated['parsed'].cited_urls)];
    // const cited_references = {};
    // Object.keys(all_query_results).forEach((k) => {
    //   if (cited_urls.includes(k)) {
    //     cited_references[k] = all_query_results[k];
    //   }
    // });
    // const content =
    //   `${generated['parsed'].answer}\n\nCitations:\n\n` +
    //   generated['parsed'].cited_urls
    //     .map((url, i) => {
    //       return `[${i + 1}]: ${url}`;
    //     })
    //     .join('\n');

    const content = `${answer}\n\nCitations:\n\n${cited_urls
      .map((url, i) => {
        return `[${i + 1}]: ${url}`;
      })
      .join('\n')}`;
    const formatted_message = new AIMessage({
      name,
      content,
    });

    console.log(content);
    return { messages: [formatted_message], references: all_query_results };
  };

  const refine_outline_prompt = ChatPromptTemplate.fromMessages([
    SystemMessagePromptTemplate.fromTemplate(`You are a Wikipedia writer. You have gathered information from experts and search engines. Now, you are refining the outline of the Wikipedia page. \
You need to make sure that the outline is comprehensive and specific. \
Topic you are writing about: {topic}

Old outline:

{old_outline}`),
    HumanMessagePromptTemplate.fromTemplate(
      `Refine the outline based on your conversations with subject-matter experts:\n\nConversations:\n\n{conversations}\n\nWrite the refined Wikipedia outline:`,
    ),
  ]);

  const refine_outline_chain = refine_outline_prompt.pipe(
    connection.type === 'ollama'
      ? new OllamaFunctions(llm)
          .bind({
            functions: [Outline.to_function()],
            function_call: Outline.to_function(),
          })
          .pipe(new JsonOutputFunctionsParser({ argsOnly: false }))
      : llm.withStructuredOutput(Outline.schema, { includeRaw: true }),
  );
  const refine_outline = async (state: ResearchState) => {
    const convos = state.interview_results
      .map((interview_state) => {
        const { messages } = interview_state;
        const convo = messages
          .map((m) => {
            return `${m.name}: ${m.content}`;
          })
          .join('\n');
        return `Conversation with ${interview_state.editor.name}\n\n${convo}`;
      })
      .join('\n\n');
    const old_outline = Outline.as_str(state.outline);
    const updated_outline = await refine_outline_chain.invoke({
      topic: state.topic,
      old_outline,
      conversations: convos,
    });
    return { ...state, outline: updated_outline };
  };

  // 采访者
  const getInterviewGraph = async () => {
    const max_num_turns = 1;
    const builder = new StateGraph<
      InterviewState,
      InterviewState,
      Partial<InterviewState>,
      'answer_question' | 'ask_question'
    >({
      channels: interviewState,
    });
    function route_messages(
      state: InterviewState,
      config?: RunnableConfig | any,
    ): string | string[] {
      const name = 'Subject_Matter_Expert';
      const { messages } = state;
      const num_responses = messages.filter(
        (x) => x instanceof AIMessage && x.name === name,
      ).length;
      if (num_responses >= max_num_turns) return END;
      const last_question = messages[messages.length - 2];
      if (last_question.content.endsWith('Thank you so much for your help!'))
        return END;
      return 'ask_question';
    }

    builder.addNode('ask_question', generate_question);
    builder.addNode('answer_question', gen_answer);
    builder.addConditionalEdges('answer_question', route_messages);
    builder.addEdge('ask_question', 'answer_question');

    builder.addEdge(START, 'ask_question');
    const interview_graph = builder
      .compile({ checkpointer: memory })
      .withConfig({ runName: 'Conduct Interviews' });

    return interview_graph;
  };

  const buildGraph = () => {
    const builder_of_storm = new StateGraph<
      ResearchState,
      ResearchState,
      Partial<any>,
      'init_research' | 'conduct_interviews' | 'refine_outline'
    >({
      channels: researchState,
    });

    builder_of_storm.addNode('init_research', initialize_research);
    builder_of_storm.addEdge('init_research', 'conduct_interviews');
    builder_of_storm.addNode('conduct_interviews', conduct_interviews);
    builder_of_storm.addEdge('conduct_interviews', 'refine_outline');
    builder_of_storm.addNode('refine_outline', refine_outline);
    builder_of_storm.addEdge('refine_outline', END);
    // builder_of_storm.addEdge(START,);
    builder_of_storm.addEdge(START, 'init_research');
    const app = builder_of_storm.compile({ checkpointer: memory });
    return app;
  };

  return buildGraph();
};

export const chatWithStormAgent = async (
  query: string,
  connectionName: string,
  modelName: string,
  options: ChatOptions,
): Promise<ChatResponse> => {
  const memory = dbManager.langgraphMemory;
  const app = await StormAgent(connectionName, modelName, options, memory);
  const config = {
    recursionLimit: 50,
    configurable: { thread_id: 'conversation-num-1' },
  };
  for await (const event of await app.stream(
    {
      topic: 'Groq, NVIDIA, Llamma.cpp and the future of LLM Inference',
    },
    config,
  )) {
    console.log(event);
  }

  let result;
  const actions = [];
  return {
    output: '',
  };
};

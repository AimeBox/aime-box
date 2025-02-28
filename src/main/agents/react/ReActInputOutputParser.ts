import { AgentActionOutputParser } from 'langchain/agents';
import { renderTemplate } from '@langchain/core/prompts';

const FORMAT_INSTRUCTIONS =
  'Use the following format:\n\nQuestion: the input question you must answer\nThought: you should always think about what to do\nAction: the action to take, should be one of [{tool_names}]\nAction Input: the input to the action\nObservation: the result of the action\n... (this Thought/Action/Action Input/Observation can repeat N times)\nThought: I now know the final answer\nFinal Answer: the final answer to the original input question';
const FINAL_ANSWER_ACTION = 'Final Answer:';
const FINAL_ANSWER_AND_PARSABLE_ACTION_ERROR_MESSAGE =
  'Parsing LLM output produced both a final answer and a parse-able action:';

export class ReActInputOutputParser extends AgentActionOutputParser {
  lc_namespace: string[];

  private toolNames;

  constructor(fields: { toolNames: string[] }) {
    super(...arguments);
    Object.defineProperty(this, 'lc_namespace', {
      enumerable: true,
      configurable: true,
      writable: true,
      value: ['langchain', 'agents', 'react'],
    });
    Object.defineProperty(this, 'toolNames', {
      enumerable: true,
      configurable: true,
      writable: true,
      value: void 0,
    });
    this.toolNames = fields.toolNames;
  }

  tryGetJson(str: string): Object | undefined {
    try {
      return JSON.parse(str);
    } catch (e) {
      return undefined;
    }
  }

  /**
   * Parses the given text into an AgentAction or AgentFinish object. If an
   * output fixing parser is defined, uses it to parse the text.
   * @param text Text to parse.
   * @returns Promise that resolves to an AgentAction or AgentFinish object.
   */
  async parse(text: string) {
    const includesAnswer = text.includes(FINAL_ANSWER_ACTION);
    const regex =
      /Action\s*\d*\s*:[\s]*(.*?)[\s]*Action\s*\d*\s*Input\s*\d*\s*:[\s]*(.*)/;
    const actionMatch = text.match(regex);
    if (actionMatch) {
      if (includesAnswer) {
        throw new Error(
          `${FINAL_ANSWER_AND_PARSABLE_ACTION_ERROR_MESSAGE}: ${text}`,
        );
      }
      const action = actionMatch[1];
      const actionInput = actionMatch[2];
      let toolInput = this.tryGetJson(actionInput.trim());
      if (toolInput === undefined) {
        toolInput = actionInput.trim().replace(/"/g, '');
      }
      return {
        tool: action,
        toolInput,
        log: text,
      };
    }
    if (includesAnswer) {
      const finalAnswerText = text.split(FINAL_ANSWER_ACTION)[1].trim();
      return {
        returnValues: {
          output: finalAnswerText,
        },
        log: text,
      };
    }
    throw new Error(`Could not parse LLM output: ${text}`);
  }

  getFormatInstructions() {
    return renderTemplate(FORMAT_INSTRUCTIONS, 'f-string', {
      tool_names: this.toolNames.join(', '),
    });
  }
}

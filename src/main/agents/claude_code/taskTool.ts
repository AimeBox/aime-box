import { CallbackManagerForToolRun } from '@langchain/core/callbacks/manager';
import { RunnableConfig } from '@langchain/core/runnables';
import { IterableReadableStream } from '@langchain/core/utils/stream';
import sharp from 'sharp';
import fs from 'fs';
import path from 'path';
import z from 'zod';
import { BaseTool } from '@/main/tools/BaseTool';
import { BaseAgent } from '../BaseAgent';
import { FileRead, FileWrite, GlobTool } from '@/main/tools/FileSystemTool';
import { AgentInfo, agentManager } from '..';
import {
  BaseMessage,
  HumanMessage,
  SystemMessage,
} from '@langchain/core/messages';
import { toolsManager } from '@/main/tools';
import { Agent } from '@/entity/Agent';

export const createTaskTool = (agents: BaseAgent[], signal?: AbortSignal) => {
  return new TaskTool(agents, signal);
};

export class TaskTool extends BaseTool {
  schema: z.ZodObject<any>;

  name: string = 'task';

  description: string = ``;

  agents: BaseAgent[];

  signal?: AbortSignal;

  constructor(agents: BaseAgent[], signal?: AbortSignal) {
    super();
    this.agents = agents;
    this.signal = signal;
    if (agents.length > 0) {
      this.schema = z.object({
        description: z
          .string()
          .describe('A short (3-5 word) description of the task'),
        prompt: z.string().describe('The task for the agent to perform'),
        subagent_type: z
          .enum(['general-purpose', ...agents.map((agent) => agent.name)])
          .describe('The type of specialized agent to use for this task'),
      });
    } else {
      this.schema = z.object({
        description: z
          .string()
          .describe('A short (3-5 word) description of the task'),
        prompt: z.string().describe('The task for the agent to perform'),
        subagent_type: z
          .enum(['general-purpose'])
          .describe('The type of specialized agent to use for this task'),
      });
    }
    this.description = `Launch a new agent to handle complex, multi-step tasks autonomously.

Available agent types and the tools they have access to:

- general-purpose: General-purpose agent for researching complex questions, searching for code, and executing multi-step tasks. When you are searching for a keyword or file and are not confident that you will find the right match in the first few tries use this agent to perform the search for you. (Tools: \\_)
${
  agents.length > 0
    ? `- ${agents
        .map((agent) => {
          return `${agent.name}: ${agent.description}`;
        })
        .join('\n')}\n`
    : ''
}

When using the Task tool, you must specify a subagent_type parameter to select which agent type to use.

When NOT to use the Agent tool:

- If you want to read a specific file path, use the '${FileRead.Name}' or '${GlobTool.Name}' tool instead of the Agent tool, to find the match more quickly
- If you are searching for a specific class definition like "class Foo", use the '${GlobTool.Name}' tool instead, to find the match more quickly
- If you are searching for code within a specific file or set of 2-3 files, use the '${FileRead.Name}' tool instead of the Agent tool, to find the match more quickly
- Other tasks that are not related to the agent descriptions above


Usage notes:
1. Launch multiple agents concurrently whenever possible, to maximize performance; to do that, use a single message with multiple tool uses
2. When the agent is done, it will return a single message back to you. The result returned by the agent is not visible to the user. To show the user the result, you should send a text message back to the user with a concise summary of the result.
3. Each agent invocation is stateless. You will not be able to send additional messages to the agent, nor will the agent be able to communicate with you outside of its final report. Therefore, your prompt should contain a highly detailed task description for the agent to perform autonomously and you should specify exactly what information the agent should return back to you in its final and only message to you.
4. The agent's outputs should generally be trusted
5. Clearly tell the agent whether you expect it to write code or just to do research (search, file reads, web fetches, etc.), since it is not aware of the user's intent
6. If the agent description mentions that it should be used proactively, then you should try your best to use it without the user having to ask for it first. Use your judgement.

Example usage:

<example_agent_descriptions>
"code-reviewer": use this agent after you are done writing a signficant piece of code
"greeting-responder": use this agent when to respond to user greetings with a friendly joke
</example_agent_description>

<example>
user: "Please write a function that checks if a number is prime"
assistant: Sure let me write a function that checks if a number is prime
assistant: First let me use the '${FileWrite.Name}' tool to write a function that checks if a number is prime
assistant: I'm going to use the '${FileWrite.Name}' tool to write the following code:
<code>
function isPrime(n) {
 if (n <= 1) return false
 for (let i = 2; i * i <= n; i++) {
 if (n % i === 0) return false
 }
 return true
}
</code>
<commentary>
Since a signficant piece of code was written and the task was completed, now use the code-reviewer agent to review the code
</commentary>
assistant: Now let me use the code-reviewer agent to review the code
assistant: Uses the 'task' tool to launch the with the code-reviewer agent
</example>

<example>
user: "Hello"
<commentary>
Since the user is greeting, use the greeting-responder agent to respond with a friendly joke
</commentary>
assistant: "I'm going to use the 'task' tool to launch the with the greeting-responder agent"
</example>`;
  }

  async _call(
    input: z.infer<typeof this.schema>,
    runManager?: CallbackManagerForToolRun,
    config?: RunnableConfig,
  ): Promise<string> {
    const stream = await this.stream(input, config);
    let output = '';
    let last_chunk;
    for await (const chunk of stream) {
      last_chunk = chunk;
    }
    return last_chunk;
  }

  async stream(
    input: z.infer<typeof this.schema>,
    config?: RunnableConfig,
  ): Promise<IterableReadableStream<any>> {
    let that = this;
    async function* generateStream() {
      const { description, prompt, subagent_type } = input;
      const _agent: AgentInfo = await agentManager.getAgent(subagent_type);
      if (_agent) {
        const _tools = await toolsManager.buildTools(_agent.tools);
        const subAgent = await agentManager.buildAgent({
          agent: _agent as Agent,
          model: _agent.model,
          signal: that.signal,
          tools: _tools,
        });

        let input_message = new HumanMessage(prompt);

        const response = await subAgent.stream(
          {
            messages: [input_message],
          },
          {
            ...(config || {}),
            tags: ['ignore'],
          },
        );
        let _messages = [];
        for await (const chunk of response) {
          console.log(chunk);
          _messages = chunk.messages;
          yield _messages[_messages.length - 1];
        }

        yield {
          is_success: true,
          messages: [
            ...(_agent.prompt ? [new SystemMessage(_agent.prompt)] : []),
            ..._messages,
          ],
        };
      } else {
        yield {
          is_success: false,
          error: `Agent "${subagent_type}" not found`,
        };
      }
      //yield output.base64Image;
    }

    const stream = IterableReadableStream.fromAsyncGenerator(generateStream());
    return stream;
  }
}

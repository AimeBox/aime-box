import { Tool, ToolParams, StructuredTool } from '@langchain/core/tools';
import { z } from 'zod';
import { promises as fsPromises, existsSync } from 'fs';
import { BaseTool } from './BaseTool';
import { FormSchema } from '@/types/form';
import { getProviderModel } from '../utils/providerUtil';
import { HumanMessage, SystemMessage } from '@langchain/core/messages';
import { isUrl } from '../utils/is';
import { t } from 'i18next';

export interface ThinkParameters extends ToolParams {}

export class Think extends BaseTool {
  static readonly Name = 'think';

  schema = z.object({
    thought: z.string().describe('Your thoughts.'),
  });

  name: string = 'think';

  description: string = `Use the tool to think about something. It will not obtain new information or make any changes to the repository, but just log the thought. Use it when complex reasoning or brainstorming is needed.

Common use cases:
1. When exploring a repository and discovering the source of a bug, call this tool to brainstorm several unique ways of fixing the bug, and assess which change(s) are likely to be simplest and most effective
2. After receiving test results, use this tool to brainstorm ways to fix failing tests
3. When planning a complex refactoring, use this tool to outline different approaches and their tradeoffs
4. When designing a new feature, use this tool to think through architecture decisions and implementation details
5. When debugging a complex issue, use this tool to organize your thoughts and hypotheses

The tool simply logs your thought process for better transparency and does not execute any code or make changes.`;

  constructor(params?: ThinkParameters) {
    super();
  }

  async _call(
    input: z.infer<typeof this.schema>,
    runManager,
    config,
  ): Promise<string> {
    return 'Your thought has been logged.';
  }
}

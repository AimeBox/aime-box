import { Tool, ToolParams, StructuredTool } from '@langchain/core/tools';
import { z } from 'zod';
import { promises as fsPromises, existsSync } from 'fs';
import settingsManager from '../settings';
import { BaseTool } from './BaseTool';
import { FormSchema } from '@/types/form';
import { getProviderModel } from '../utils/providerUtil';
import { getChatModel } from '../llm';
import { HumanMessage, SystemMessage } from '@langchain/core/messages';
import { isUrl } from '../utils/is';
import { t } from 'i18next';

export interface VisionParameters extends ToolParams {
  model: string;
}

export class Think extends BaseTool {
  schema = z.object({
    thought: z.string().describe('Your thoughts.'),
  });

  name: string = 'think';

  description: string =
    'Use the tool to think about something. It will not obtain new information or make any changes to the repository, but just log the thought. Use it when complex reasoning or brainstorming is needed. For example, if you explore the repo and discover the source of a bug, call this tool to brainstorm several unique ways of fixing the bug, and assess which change(s) are likely to be simplest and most effective. Alternatively, if you receive some test results, call this tool to brainstorm ways to fix the failing tests.';

  constructor(params?: VisionParameters) {
    super();
  }

  async _call(
    input: z.infer<typeof this.schema>,
    runManager,
    config,
  ): Promise<string> {
    return 'I have thought about it.';
  }
}

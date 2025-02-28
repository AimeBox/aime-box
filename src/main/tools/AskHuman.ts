/* eslint-disable import/prefer-default-export */
import { CallbackManagerForToolRun } from '@langchain/core/callbacks/manager';
import { RunnableConfig } from '@langchain/core/runnables';
import { Tool, StructuredTool } from '@langchain/core/tools';

import { z } from 'zod';
import { isUrl } from '../utils/is';
import fs from 'fs';

export class AskHuman extends StructuredTool {
  schema = z.object({
    question: z.string().describe('Ask human questions'),
    displayFormat: z
      .enum(['string', 'radio', 'checkbox', 'file', 'date-range', 'date'])
      .describe('base64'),
    radioConfig: z
      .optional(z.array(z.string()))
      .describe('if displayFormat is radio this is required'),
    checkboxConfig: z
      .optional(z.array(z.string()))
      .describe('if displayFormat is checkbox this is required'),
    fileConfig: z
      .optional(z.object({ multiple: z.boolean() }))
      .describe('if displayFormat is file this is required'),
  });

  name = 'ask-human';

  description = 'Ask human question and show ui Format to human action';

  async _call(input: z.infer<typeof this.schema>): Promise<string> {
    return JSON.stringify(input);
  }
}

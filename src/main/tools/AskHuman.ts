/* eslint-disable import/prefer-default-export */
import { CallbackManagerForToolRun } from '@langchain/core/callbacks/manager';
import { RunnableConfig } from '@langchain/core/runnables';
import { Tool, StructuredTool } from '@langchain/core/tools';

import { z } from 'zod';
import { isUrl } from '../utils/is';
import fs from 'fs';
import { BaseTool } from './BaseTool';
import type { ComponentType } from '@/types';

export class AskHuman extends BaseTool {
  schema = z.object({
    question: z.string().describe('Ask human questions'),
    form_items: z
      .array(
        z.object({
          component: z.enum([
            'Input',
            'InputTextArea',
            'Select',
            'Switch',
            'DatePicker',
          ]),
          componentProps: z.any().optional(),
          field: z.string(),
          label: z.string(),
          defaultValue: z.string().optional(),
          required: z.boolean().default(false),
        }),
      )
      .optional(),
  });

  name = 'ask-human';

  description = [
    'Ask human question or show ui Format to human action',
    'componentProps: ',
    '- if `Input` : null',
    '- if `InputTextArea` : null',
    '- if `Select` : {options:[{label:string,value:string},...],mode: "multiple" | "tags" | undefined}',
    '- if `Switch` : null',
    '- if `File` : null',
    '- if `DatePicker` : null',
  ].join('\n');

  async _call(input: z.infer<typeof this.schema>): Promise<string> {
    return 'wait human answer';
  }
}

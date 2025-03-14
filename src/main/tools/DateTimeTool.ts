import { Tool, ToolParams } from '@langchain/core/tools';
import {
  exec,
  execSync,
  execFileSync,
  ExecSyncOptionsWithStringEncoding,
} from 'child_process';
import { isArray, isString } from '../utils/is';
import { z } from 'zod';
import iconv from 'iconv-lite';
import dayjs from 'dayjs';
import { BaseTool } from './BaseTool';

export class DateTimeTool extends BaseTool {
  // static lc_name() {
  //   return 'datetime_tool';
  // }

  schema = z.object({});

  name: string = 'datetime_tool';

  description: string = 'Get Current Datetime or Currnet Week';

  constructor() {
    super();
  }

  async _call(input: any, runManager, config): Promise<string> {
    return dayjs().format('YYYY-MM-DD HH:mm:ss dddd');
  }
}

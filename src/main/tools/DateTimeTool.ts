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

export class DateTimeTool extends Tool {
  static lc_name() {
    return 'DateTimeTool';
  }

  name: string;

  description: string;

  constructor() {
    super();
    Object.defineProperty(this, 'name', {
      enumerable: true,
      configurable: true,
      writable: true,
      value: 'datetime_tool',
    });
    Object.defineProperty(this, 'description', {
      enumerable: true,
      configurable: true,
      writable: true,
      value: 'Get Current Datetime or Currnet Week',
    });
    // Object.defineProperty(this, 'schema', {
    //   enumerable: true,
    //   configurable: true,
    //   writable: true,
    //   value: z.object({
    //     format: z.enum(['date', 'time', 'datetime', 'week', 'full']),
    //   }),
    // });
  }

  async _call(input: any, runManager, config): Promise<string> {
    return dayjs().format('YYYY-MM-DD HH:mm:ss dddd');
  }
}

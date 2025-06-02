import { StructuredTool, Tool, ToolParams } from '@langchain/core/tools';
import {
  exec,
  execSync,
  execFileSync,
  ExecSyncOptionsWithStringEncoding,
} from 'child_process';
import { isArray, isString } from '../utils/is';
import { z } from 'zod';
import iconv from 'iconv-lite';
import path, { resolve } from 'path';
import { app } from 'electron';
import fs from 'fs';

// import sherpa_onnx from 'sherpa-onnx-node';
import { v4 as uuidv4 } from 'uuid';
import { BaseTool } from './BaseTool';
import { FormSchema } from '@/types/form';
import { t } from 'i18next';
import { ChatPromptTemplate } from '@langchain/core/prompts';
import { RunnableConfig } from '@langchain/core/runnables';
import { getProviderModel } from '../utils/providerUtil';
import { IterableReadableStream } from '@langchain/core/utils/stream';
import dayjs from 'dayjs';

export class UnixTimestampConvert extends BaseTool {
  schema = z.object({
    timestamps: z.array(z.string()).describe('多个Unix时间戳或日期字符串'),
    targetFormat: z
      .enum(['toDate', 'toTimestamp'])
      .describe('Convert to date or timestamp format'),
  });

  name: string = 'unixtimestamp-convert';

  description: string =
    '时间戳转换工具，可以将Unix时间戳转换为日期时间格式，或将日期时间转换为Unix时间戳\n' +
    '支持单个或多个时间戳/日期的批量转换\n' +
    'toTimestamp:2024-05-20 02:40:00 -> 1716144000\n' +
    'toDate:1716144000 -> 2024-05-20 02:40:00\n' +
    '可以使用数组传入多个值: ["1716144000", "1716230400"]';

  constructor() {
    super();
  }

  private convertToDate(timestamp: string): string {
    try {
      const unixTimestamp = Number(timestamp);
      if (Number.isNaN(unixTimestamp)) {
        throw new Error(`无效的Unix时间戳: ${timestamp}`);
      }

      // 处理毫秒和秒两种时间戳
      const date =
        unixTimestamp > 10000000000
          ? dayjs(unixTimestamp) // 毫秒
          : dayjs.unix(unixTimestamp); // 秒

      // 格式化为 YYYY-MM-DD HH:mm:ss
      return date.format('YYYY-MM-DD HH:mm:ss');
    } catch (error) {
      if (error instanceof Error) {
        return `转换错误: ${error.message}`;
      }
      return '未知转换错误';
    }
  }

  private convertToTimestamp(dateString: string): string {
    try {
      const date = dayjs(dateString);
      if (!date.isValid()) {
        throw new Error(`无效的日期格式: ${dateString}`);
      }

      // 返回秒级时间戳
      return date.unix().toString();
    } catch (error) {
      if (error instanceof Error) {
        return `转换错误: ${error.message}`;
      }
      return '未知转换错误';
    }
  }

  async _call(
    input: z.infer<typeof this.schema>,
    runManager,
    config,
  ): Promise<string> {
    const { timestamps, targetFormat } = input;

    // 处理输入可能是字符串或数组的情况
    const timestampArray = Array.isArray(timestamps)
      ? timestamps
      : [timestamps];

    // 根据目标格式选择转换函数
    const convertFn =
      targetFormat === 'toDate'
        ? this.convertToDate.bind(this)
        : this.convertToTimestamp.bind(this);

    // 转换所有时间戳
    const results = timestampArray.map((ts, index) => {
      const result = convertFn(ts);
      return result;
    });

    // 合并结果
    const outputResult = results.join('\n');
    this.output = outputResult;
    return outputResult;
  }
}

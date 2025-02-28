import { Tool, ToolParams, StructuredTool } from '@langchain/core/tools';
import { z } from 'zod';

import fs from 'fs';
import tree from 'tree-node-cli';
import { BaseTool } from './BaseTool';

export interface FileWriteParameters extends ToolParams {}
export interface FileReadParameters extends ToolParams {}

export class FileWrite extends BaseTool {
  schema = z.object({
    path: z.string().describe('local file path'),
    data: z.string().describe('file data'),
  });

  //output = und;

  static lc_name() {
    return 'file-write';
  }

  name = 'file-write';

  description: string = 'create file and write';

  constructor(params?: FileWriteParameters) {
    super(params);
  }

  async _call(
    input: z.infer<typeof this.schema>,
    runManager,
    config,
  ): Promise<string> {
    fs.writeFileSync(input.path, input.data);
    return 'file write is success';
  }
}

export class FileRead extends Tool {
  static lc_name() {
    return 'file-read';
  }

  name: string;

  description: string;

  constructor(params?: FileReadParameters) {
    super(params);
    Object.defineProperty(this, 'name', {
      enumerable: true,
      configurable: true,
      writable: true,
      value: 'file-read',
    });
    Object.defineProperty(this, 'description', {
      enumerable: true,
      configurable: true,
      writable: true,
      value: 'read file',
    });
  }

  async _call(input: string, runManager, config): Promise<string> {
    return fs.readFileSync(input).toString();
  }
}

export class ListDirectory extends BaseTool {
  schema = z.object({
    path: z.string().describe('local dir path'),
    recursive: z
      .optional(z.boolean())
      .default(false)
      .describe('local file path'),
  });

  output = 'path\n├── file-1.mp4\n├── file-2.mp4\n├── ...';

  static lc_name() {
    return 'list-directory';
  }

  name: string = 'list-directory';

  description: string = 'list directory';

  constructor(params?: FileWriteParameters) {
    super(params);
  }

  async _call(
    input: z.infer<typeof this.schema>,
    runManager,
    config,
  ): Promise<string[] | string> {
    const treeOutput = tree(input.path, {
      maxDepth: input.recursive ? Number.POSITIVE_INFINITY : 1,
    });
    return treeOutput;
  }
}

import {
  BaseToolkit as LangchainBaseToolkit,
  StructuredTool,
  ToolParams,
} from '@langchain/core/tools';
import { FormSchema } from '@/types/form';

export const ToolTag = {
  IMAGE: 'image',
  VIDEO: 'video',
  AUDIO: 'audio',
  WEBSEARCH: 'websearch',
  MUSIC: 'music',
} as const;

export abstract class BaseTool extends StructuredTool {
  static lc_name() {
    return this.name;
  }

  officialLink?: string;

  toolKitName?: string;

  output?: string;

  outputFormat?: 'json' | 'markdown' = 'markdown';

  configSchema?: FormSchema[] = [];

  displayMode?: 'list' | 'markdown' = 'markdown';

  tags?: string[] = [];
}

export abstract class BaseToolKit<
  T extends ToolParams = any,
> extends LangchainBaseToolkit {
  name: string;

  description?: string;

  officialLink?: string;

  configSchema?: FormSchema[] = [];

  tools: BaseTool[] = [];

  params?: T;

  constructor(params: T) {
    super();
    this.params = params;
  }

  abstract getTools(): BaseTool[];
}

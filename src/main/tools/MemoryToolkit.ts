import { FormSchema } from '@/types/form';
import { BaseTool, BaseToolKit } from './BaseTool';
import { ToolParams, ToolRunnableConfig } from '@langchain/core/tools';
import { z } from 'zod';
import { CallbackManagerForToolRun } from '@langchain/core/callbacks/manager';
import path from 'path';
import fs from 'fs';

export interface MemoryParameters extends ToolParams {
  //providerId: string;
}

const memorySaveToolDescription = `
Saves a specific piece of information or fact to your long-term memory.

Use this tool:

- When the user explicitly asks you to remember something (e.g., "Remember that I like pineapple on pizza", "Please save this: my cat's name is Whiskers").
- When the user states a clear, concise fact about themselves, their preferences, or their environment that seems important for you to retain for future interactions to provide a more personalized and effective assistance.

Do NOT use this tool:

- To remember conversational context that is only relevant for the current session.
- To save long, complex, or rambling pieces of text. The fact should be relatively short and to the point.
- If you are unsure whether the information is a fact worth remembering long-term. If in doubt, you can ask the user, "Should I remember that for you?"

## Parameters

- \`fact\` (string, required): The specific fact or piece of information to remember. This should be a clear, self-contained statement. For example, if the user says "My favorite color is blue", the fact would be "My favorite color is blue".
`;

const memoryReadToolDescription = `
Reads your long-term memory.
`;

export const MEMORY_SECTION_HEADER = '## Added Memories';

export class MemorySave extends BaseTool {
  static readonly Name = 'save_memory';

  name: string = 'save_memory';

  description: string = memorySaveToolDescription;

  schema = z.object({
    fact: z
      .string()
      .describe(
        'The specific fact or piece of information to remember. Should be a clear, self-contained statement.',
      ),
  });

  constructor(params?: MemoryParameters) {
    super(params);
  }

  ensureNewlineSeparation(currentContent: string): string {
    if (currentContent.length === 0) return '';
    if (currentContent.endsWith('\n\n') || currentContent.endsWith('\r\n\r\n'))
      return '';
    if (currentContent.endsWith('\n') || currentContent.endsWith('\r\n'))
      return '\n';
    return '\n\n';
  }

  async _call(
    input: z.infer<typeof this.schema>,
    runManager?: CallbackManagerForToolRun,
    config?: ToolRunnableConfig,
  ): Promise<any> {
    const { fact } = input;
    const workspace = config?.configurable?.workspace;
    let memoryPath;

    if (workspace) {
      memoryPath = path.join(workspace, '.memory', 'memory.md');
    } else {
      throw new Error('must use in chat workspace');
    }
    const dirPath = path.dirname(memoryPath);
    if (!fs.existsSync(dirPath)) {
      fs.mkdirSync(dirPath, { recursive: true });
    }
    let processedText = fact.trim();
    // Remove leading hyphens and spaces that might be misinterpreted as markdown list items
    processedText = processedText.replace(/^(-+\s*)+/, '').trim();
    const newMemoryItem = `- ${processedText}`;

    let content = '';
    try {
      content = await fs.promises.readFile(memoryPath, 'utf-8');
    } catch (_e) {
      // File doesn't exist, will be created with header and item.
    }

    const headerIndex = content.indexOf(MEMORY_SECTION_HEADER);

    if (headerIndex === -1) {
      // Header not found, append header and then the entry
      const separator = this.ensureNewlineSeparation(content);
      content += `${separator}${MEMORY_SECTION_HEADER}\n${newMemoryItem}\n`;
    } else {
      // Header found, find where to insert the new memory entry
      const startOfSectionContent = headerIndex + MEMORY_SECTION_HEADER.length;
      let endOfSectionIndex = content.indexOf('\n## ', startOfSectionContent);
      if (endOfSectionIndex === -1) {
        endOfSectionIndex = content.length; // End of file
      }

      const beforeSectionMarker = content
        .substring(0, startOfSectionContent)
        .trimEnd();
      let sectionContent = content
        .substring(startOfSectionContent, endOfSectionIndex)
        .trimEnd();
      const afterSectionMarker = content.substring(endOfSectionIndex);

      sectionContent += `\n${newMemoryItem}`;
      content = `${`${beforeSectionMarker}\n${sectionContent.trimStart()}\n${afterSectionMarker}`.trimEnd()}\n`;
    }

    await fs.promises.writeFile(memoryPath, content, 'utf-8');
    const successMessage = `Okay, I've remembered that: "${fact}"`;

    return successMessage;
  }
}

export class MemoryRead extends BaseTool {
  static readonly Name = 'read_memory';

  name: string = 'read_memory';

  description: string = memoryReadToolDescription;

  schema = z.object({});

  constructor(params?: MemoryParameters) {
    super(params);
  }

  async _call(
    input: z.infer<typeof this.schema>,
    runManager?: CallbackManagerForToolRun,
    config?: ToolRunnableConfig,
  ): Promise<any> {
    const workspace = config?.configurable?.workspace;
    let memoryPath;

    if (workspace) {
      memoryPath = path.join(workspace, '.memory', 'memory.md');
    } else {
      throw new Error('must use in chat workspace');
    }
    let content = '';
    if (!fs.existsSync(memoryPath)) {
      content = 'Memory is currently empty.';
    } else {
      content = await fs.promises.readFile(memoryPath, 'utf-8');
    }

    return `--- Context from: ./.memory/memory.md ---\n${content}\n--- End of Context from: ./.memory/memory.md ---`;
  }
}

export class MemoryToolkit extends BaseToolKit {
  name: string = 'memory_toolkit';

  configSchema: FormSchema[] = [];

  constructor(params?: MemoryParameters) {
    super(params);
    //this.apiKey = params?.apiKey;
  }

  getTools(): BaseTool[] {
    return [new MemorySave(this.params)];
  }
}

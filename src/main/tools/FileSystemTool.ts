import { Tool, ToolParams, StructuredTool } from '@langchain/core/tools';
import { z } from 'zod';

import fs from 'fs';
import path from 'path';
import tree from 'tree-node-cli';
import { BaseTool } from './BaseTool';
import { PDFLoader } from '@langchain/community/document_loaders/fs/pdf';
import { TextLoader } from 'langchain/document_loaders/fs/text';
import { DocxLoader } from '@langchain/community/document_loaders/fs/docx';
import { PPTXLoader } from '@langchain/community/document_loaders/fs/pptx';
import { ImageLoader } from '../loaders/ImageLoader';

export interface FileWriteParameters extends ToolParams {}
export interface FileReadParameters extends ToolParams {}

export class FileWrite extends BaseTool {
  toolKitName?: string = 'file-system';

  schema = z.object({
    path: z.string().describe('local file path'),
    data: z.string().describe('file data'),
    mode: z
      .enum(['append', 'overwrite'])
      .optional()
      .default('overwrite')
      .nullable(),
  });

  //output = und;

  name = 'file_write';

  description: string = 'create file and write';

  constructor(params?: FileWriteParameters) {
    super(params);
  }

  async _call(
    input: z.infer<typeof this.schema>,
    runManager,
    config,
  ): Promise<string> {
    const { workspace } = config.configurable;
    let filePath = input.path;
    if (workspace) {
      filePath = path.join(workspace, input.path);
    }
    const { mode = 'overwrite' } = input;
    if (mode === 'append') {
      await fs.promises.appendFile(filePath, input.data);
    } else {
      await fs.promises.writeFile(filePath, input.data);
    }
    return `The file was successfully written and saved in:\n<file>${filePath.replaceAll('\\', '/')}</file>`;
  }
}

export class FileRead extends BaseTool {
  toolKitName?: string = 'file-system';

  name: string = 'file_read';

  description: string = 'read file';

  schema = z.object({
    path: z.string().describe('local file path'),
  });

  constructor(params?: FileReadParameters) {
    super(params);
  }

  async _call(
    input: z.infer<typeof this.schema>,
    runManager,
    config,
  ): Promise<string> {
    return fs.readFileSync(input.path).toString();
  }
}

export class ListDirectory extends BaseTool {
  toolKitName?: string = 'file-system';

  schema = z.object({
    path: z.string().describe('local dir path'),
    recursive: z
      .optional(z.boolean())
      .default(false)
      .describe('local file path'),
  });

  output = 'path\n├── file-1.mp4\n├── file-2.mp4\n├── ...';

  name: string = 'list_directory';

  description: string =
    'Get a detailed listing of all files and directories in a specified path. Results distinguish between files and directories with [FILE] and [DIR] prefixes. Only works within allowed directories.';

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

export class CreateDirectory extends BaseTool {
  toolKitName?: string = 'file-system';

  schema = z.object({
    paths: z.array(z.string()),
  });

  name: string = 'create_directory';

  description: string =
    'Create a new directory or ensure a directory exists.  Can create multiple nested directories in one operation.  Only works within allowed directories.';

  constructor(params?: FileWriteParameters) {
    super(params);
  }

  async _call(
    input: z.infer<typeof this.schema>,
    runManager,
    config,
  ): Promise<string> {
    const { workspace } = config.configurable;
    let filePaths = input.paths;
    if (workspace) {
      filePaths = input.paths.map((x) => path.join(workspace, x));
    }

    if (filePaths && filePaths.length > 0) {
      for (const path of filePaths) {
        fs.mkdirSync(path, { recursive: true });
      }
      return 'Directory created successfully';
    } else {
      return 'No directory to create';
    }
  }
}

export class SearchFiles extends BaseTool {
  toolKitName?: string = 'file-system';

  schema = z.object({
    path: z.string(),
    pattern: z.string(),
    content:z.string().optional().describe('搜索的文字内容, 空格分割关键字'),
    recursive: z.boolean()
      .optional()
      .default(true)
      .describe('是否递归搜索子目录'),
  });

  name: string = 'search_files';

  description: string =
    'Finds files by name using a case-insensitive matching. Supports wildcard patterns like *.md and ? for single character matching. Searches through all subdirectories from the starting path when recursive is true (default). Has a default timeout of 30 seconds which can be customized using the timeoutMs parameter. Only searches within allowed directories.';

  constructor(params?: FileWriteParameters) {
    super(params);
  }

  async _call(
    input: z.infer<typeof this.schema>,
    runManager,
    config,
  ): Promise<string> {
    const results: string[] = [];

    // 创建用于匹配的正则表达式
    // 将glob通配符转换为正则表达式
    const pattern = input.pattern
      .replace(/\./g, '\\.')
      .replace(/\*/g, '.*')
      .replace(/\?/g, '.');
    const regex = new RegExp(pattern, 'i');

    // 递归搜索函数
    const searchRecursively = (dir: string) => {
      try {
        const files = fs.readdirSync(dir, { withFileTypes: true });

        for (const file of files) {
          const fullPath = path.join(dir, file.name);

          // 匹配文件名
          if (regex.test(file.name)) {
            results.push(fullPath);
          }

          // 如果是目录且启用了递归搜索，则递归搜索
          if (file.isDirectory() && input.recursive) {
            searchRecursively(fullPath);
          }
        }
      } catch (error) {
        // 忽略权限错误等
      }
    };

    searchRecursively(input.path);

    if (results.length === 0) {
      return '未找到匹配的文件';
    }

    if(input.content){
      // 搜索关键字
      const list = [];
      for (let index = 0; index < results.length; index++) {
        const filePath = results[index];
        let content = ''
        const ext = path.extname(filePath).toLowerCase();
        if (ext.toLowerCase() == '.pdf') {
          const loader = new PDFLoader(filePath);
          const docs = await loader.load();
          content = docs.map((x) => x.pageContent).join('\n\n');
        } else if (ext.toLowerCase() == '.txt') {
          const loader = new TextLoader(filePath);
          const docs = await loader.load();
          content = docs.map((x) => x.pageContent).join('\n\n');
        } else if (ext.toLowerCase() == '.docx') {
          const loader = new DocxLoader(filePath, { type: 'docx' });
          const docs = await loader.load();
          content = docs.map((x) => x.pageContent).join('\n\n');
        } else if (ext.toLowerCase() == '.doc') {
          const loader = new DocxLoader(filePath, { type: 'doc' });
          const docs = await loader.load();
          content = docs.map((x) => x.pageContent).join('\n\n');
        } else if (ext.toLowerCase() == '.pptx') {
          const loader = new PPTXLoader(filePath);
          const docs = await loader.load();
          content = docs.map((x) => x.pageContent).join('\n\n');
        }  else if (
          ext.toLowerCase() == '.jpg' ||
          ext.toLowerCase() == '.png'||
          ext.toLowerCase() == '.bmp'||
          ext.toLowerCase() == '.jpeg' ||
          ext.toLowerCase() == '.webp'
          ) {
          const loader = new ImageLoader(filePath);
          const docs = await loader.load();
          content = docs.map((x) => x.pageContent).join('\n\n');
        } else{
          continue;
        }


        const keywords = [...new Set(input.content.split(' '))];
        for(const keyword of keywords){
          let startIndex = content.indexOf(keyword);
          if(startIndex >= 0){
            startIndex = startIndex - 100;
            if(startIndex < 0) startIndex = 0;
            let endIndex = content.indexOf(keyword) + keyword.length + 100;
            if(endIndex> content.length)endIndex = content.length;

            const item = list.find(x=>x.path == filePath);
            const match = (startIndex > 0 ? '...':'') + content.substring(startIndex, endIndex) + ( endIndex < content.length  ? '...':'')
            if(item){

              item.match.push(match);
            }else{
              list.push({
                path: filePath,
                match: [match]
              });
            }
            
          }
        }
      }
      return JSON.stringify(list);
      
    }

    return results.join('\n');
  }
}

export class MoveFile extends BaseTool {
  schema = z.object({
    source: z.string(),
    destination: z.string(),
  });

  name: string = 'move_file';

  description: string =
    'Move or rename files and directories. Can move files between directories and rename them in a single operation. Both source and destination must be within allowed directories.';

  toolKitName?: string = 'file-system';

  constructor(params?: FileWriteParameters) {
    super(params);
  }

  async _call(
    input: z.infer<typeof this.schema>,
    runManager,
    config,
  ): Promise<string> {
    fs.renameSync(input.source, input.destination);
    return 'File moved successfully';
  }
}

export class DeleteFile extends BaseTool {
  toolKitName?: string = 'file-system';

  schema = z.object({
    path: z.string(),
  });

  //output = und;

  name = 'delete_file';

  description: string = 'Removes a file. absolute paths.';

  constructor(params?: FileWriteParameters) {
    super(params);
  }

  async _call(
    input: z.infer<typeof this.schema>,
    runManager,
    config,
  ): Promise<string> {
    await fs.promises.rm(input.path);
    return 'file has been deleted.';
  }
}

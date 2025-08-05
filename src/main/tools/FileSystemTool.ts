/* eslint-disable guard-for-in */
/* eslint-disable no-lonely-if */
/* eslint-disable no-continue */
import {
  Tool,
  ToolParams,
  StructuredTool,
  ToolRunnableConfig,
} from '@langchain/core/tools';
import { z } from 'zod';

import fs from 'fs';
import path from 'path';
import tree from 'tree-node-cli';
import { BaseTool, BaseToolKit } from './BaseTool';
import { PDFLoader } from '@langchain/community/document_loaders/fs/pdf';
import { TextLoader } from 'langchain/document_loaders/fs/text';
import { DocxLoader } from '@langchain/community/document_loaders/fs/docx';
import { PPTXLoader } from '@langchain/community/document_loaders/fs/pptx';
import { ImageLoader } from '../loaders/ImageLoader';
import { filesize } from 'filesize';
import { CallbackManagerForToolRun } from '@langchain/core/callbacks/manager';
import mime from 'mime-types';
import { globby } from 'globby';
import { runCommand } from '../utils/exec';
import { spawn } from 'child_process';
import { glob } from 'glob';
import { EOL } from 'os';
import { isString } from '../utils/is';

export interface FileWriteParameters extends ToolParams {}
export interface FileReadParameters extends ToolParams {}

const DEFAULT_MAX_LINES_TEXT_FILE = 2000;
const MAX_LINE_LENGTH_TEXT_FILE = 2000;

export class FileWrite extends BaseTool {
  static readonly Name = 'file_write';

  toolKitName?: string = 'file-system';

  schema = z.object({
    file_path: z.string().describe('local file path'),
    data: z.string().describe('The content to write to the file.'),
    mode: z.enum(['append', 'overwrite']).optional().default('overwrite'),
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
    const workspace = config?.configurable?.workspace;
    let filePath = input.file_path;

    if (!path.isAbsolute(filePath)) {
      if (workspace) {
        filePath = path.join(workspace, filePath);
      }
    }

    const dirPath = path.dirname(filePath);
    if (!fs.existsSync(dirPath)) {
      fs.mkdirSync(dirPath, { recursive: true });
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

export class FileInfo extends BaseTool {
  toolKitName?: string = 'file-system';

  name: string = 'file_info';

  description: string = 'get file info';

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
    const workspace = config?.configurable?.workspace;
    let filePath = input.path;
    if (workspace) {
      filePath = path.isAbsolute(filePath)
        ? filePath
        : path.join(workspace, filePath);
    }
    const stats = await fs.promises.stat(filePath);

    return JSON.stringify({
      fullPath: filePath,
      isFile: stats.isFile(),

      name: path.basename(filePath),
      size: filesize(stats.size), // 文件大小(字节)
      createdAt: stats.birthtime, // 创建时间
      modifiedAt: stats.mtime, // 修改时间
      //lineCount: lineCount, // 行数
    });
  }
}

export class FileRead extends BaseTool {
  static readonly Name = 'file_read';

  toolKitName?: string = 'file-system';

  name: string = 'file_read';

  description: string = `Reads a file from the local filesystem. You can access any file directly by using this tool.
Assume this tool is able to read all files on the machine. If the User provides a path to a file assume that path is valid. It is okay to read a file that does not exist; an error will be returned.

Usage:
- The file_path parameter must be an absolute path, not a relative path
- By default, it reads up to ${DEFAULT_MAX_LINES_TEXT_FILE} lines starting from the beginning of the file
- You can optionally specify a line offset and limit (especially handy for long files), but it's recommended to read the whole file by not providing these parameters
- Any lines longer than ${MAX_LINE_LENGTH_TEXT_FILE} characters will be truncated
- If show_line_index is true, Results are returned using cat -n format, with line numbers starting at 1
- This tool allows to read images (eg PNG, JPG, etc). When reading an image file the contents are presented visually by a multimodal LLM.
- You have the capability to call multiple tools in a single response. It is always better to speculatively read multiple files as a batch that are potentially useful.
- You will regularly be asked to read screenshots. If the user provides a path to a screenshot ALWAYS use this tool to view the file at the path. This tool will work with all temporary file paths like /var/folders/123/abc/T/TemporaryItems/NSIRD_screencaptureui_ZfB1tD/Screenshot.png
- If you read a file that exists but has empty contents you will receive a system reminder warning in place of file contents.`;

  schema = z.object({
    file_path: z.string().describe('local file path'),
    offset: z
      .number()
      .optional()
      .describe(
        'The line number to start reading from. Only provide if the file is too large to read at once.',
      ),
    limit: z
      .number()
      .min(1000)
      .optional()
      .describe(
        'The number of lines to read. Only provide if the file is too large to read at once(min 1000).',
      ),
    show_line_index: z
      .boolean()
      .optional()
      .default(false)
      .describe(
        `Optional: Whether to show line index (e.g., 1\tline1... 2\tline2...)`,
      ),
  });

  constructor(params?: FileReadParameters) {
    super(params);
  }

  async _call(
    input: z.infer<typeof this.schema>,
    runManager,
    config,
  ): Promise<string> {
    const { offset, limit } = input;

    if (offset !== undefined && offset < 0) {
      throw new Error('Offset must be a non-negative number');
    }
    if (limit !== undefined && limit <= 0) {
      throw new Error('Limit must be a positive number');
    }

    const workspace = config?.configurable?.workspace;
    let filePath = input.file_path;
    if (!path.isAbsolute(filePath)) {
      if (workspace) {
        filePath = path.join(workspace, filePath);
      }
    }

    if (!fs.existsSync(filePath)) {
      throw new Error('File not found');
    }
    const stats = await fs.promises.stat(filePath);
    if (stats.isDirectory()) {
      throw new Error(`Path is a directory, not a file: ${filePath}`);
    }

    const fileSizeInBytes = stats.size;
    // 20MB limit
    const maxFileSize = 20 * 1024 * 1024;

    if (fileSizeInBytes > maxFileSize) {
      throw new Error(
        `File size exceeds the 20MB limit: ${filePath} (${(
          fileSizeInBytes /
          (1024 * 1024)
        ).toFixed(2)}MB)`,
      );
    }

    let content = '';

    const lookedUpMimeType = mime.lookup(filePath);

    if (lookedUpMimeType === 'application/pdf') {
      const loader = new PDFLoader(filePath);
      const docs = await loader.load();
      content = docs.map((x) => x.pageContent).join('\n\n');
    } else if (
      isString(lookedUpMimeType) &&
      lookedUpMimeType.startsWith('image/')
    ) {
      const loader = new ImageLoader(filePath);
      const docs = await loader.load();
      content = docs.map((x) => x.pageContent).join('\n\n');
    } else {
      content = fs.readFileSync(filePath).toString();
    }

    const lines = content.split('\n');
    const originalLineCount = lines.length;
    const startLine = offset || 0;
    const effectiveLimit =
      limit === undefined
        ? DEFAULT_MAX_LINES_TEXT_FILE
        : Math.min(limit, DEFAULT_MAX_LINES_TEXT_FILE);
    // Ensure endLine does not exceed originalLineCount
    const endLine = Math.min(startLine + effectiveLimit, originalLineCount);
    // Ensure selectedLines doesn't try to slice beyond array bounds if startLine is too high
    const actualStartLine = Math.min(startLine, originalLineCount);
    const selectedLines = lines.slice(actualStartLine, endLine);

    if (startLine >= originalLineCount) {
      throw new Error(
        `Error: offset is out of range, offset: ${startLine}, originalLineCount: ${originalLineCount}`,
      );
    }

    let linesWereTruncatedInLength = false;
    const formattedLines = selectedLines.map((line) => {
      if (line.length > MAX_LINE_LENGTH_TEXT_FILE) {
        linesWereTruncatedInLength = true;
        return `${line.substring(0, MAX_LINE_LENGTH_TEXT_FILE)}... [truncated]`;
      }
      return line;
    });

    const contentRangeTruncated = endLine < originalLineCount;
    const isTruncated = contentRangeTruncated || linesWereTruncatedInLength;

    let llmTextContent = '';
    if (contentRangeTruncated) {
      llmTextContent += `[File content truncated: showing lines ${actualStartLine + 1}-${endLine} of ${originalLineCount} total lines. Use offset/limit parameters to view more.]\n`;
    } else if (linesWereTruncatedInLength) {
      llmTextContent += `[File content partially truncated: some lines exceeded maximum length of ${MAX_LINE_LENGTH_TEXT_FILE} characters.]\n`;
    }

    if (input.show_line_index) {
      llmTextContent += formattedLines
        .map((line, index) => `     ${index + 1 + actualStartLine}\t${line}`)
        .join('\n');
    } else {
      llmTextContent += formattedLines.join('\n');
    }
    return llmTextContent;
  }
}

export class ListDirectory extends BaseTool {
  toolKitName?: string = 'file-system';

  schema = z.object({
    path: z
      .string()
      .describe(
        'The absolute path to the directory to list (must be absolute, not relative)',
      ),
    ignore: z.array(z.string()).optional().describe('List of RegExp to ignore'),
    recursive: z.boolean().optional().default(false),
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
    const workspace = config?.configurable?.workspace;
    let filePath = input.path;
    if (workspace) {
      filePath = path.isAbsolute(filePath)
        ? filePath
        : path.join(workspace, filePath);
    }
    let ignore = input.ignore || [];

    ignore.push('\\/node_modules\\/', '\\/\\.git\\/');

    ignore = [...new Set(ignore)];

    const treeOutput = tree(filePath, {
      maxDepth: input.recursive ? Number.POSITIVE_INFINITY : 1,
      exclude: input.ignore?.map((x) => new RegExp(x)) || [],
    });
    return `Directory listing for ${filePath}:\n${treeOutput}`;
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
    const workspace = config?.configurable?.workspace;
    let filePaths = input.paths;
    if (workspace) {
      filePaths = input.paths.map((x) =>
        path.isAbsolute(x) ? x : path.join(workspace, x),
      );
    }

    if (filePaths && filePaths.length > 0) {
      for (const path of filePaths) {
        fs.mkdirSync(path, { recursive: true });
      }
      const folders = filePaths.map((x) => `<folder>${x}</folder>`).join('\n');
      return `Directory created successfully\n\n${folders}`;
    } else {
      return 'No directory to create';
    }
  }
}

export class SearchFiles extends BaseTool {
  toolKitName?: string = 'file-system';

  schema = z.object({
    path: z
      .string()
      .optional()
      .describe(
        'Optional: The absolute path to the directory to search within. If omitted, searches the root directory.',
      ),
    pattern: z
      .string()
      .default('*.*')
      .describe(
        "The glob pattern to match against (e.g., '**/*.py', 'docs/*.md').",
      ),
    content: z
      .string()
      .optional()
      .describe(
        'Search file contents by keyword (separated by spaces), supporting pdf, txt, docx, doc, pptx, jpg, png, bmp, jpeg, webp formats.',
      ),
    recursive: z.boolean().optional().default(true),
  });

  name: string = 'search_files';

  description: string =
    'Finds files by name using a case-insensitive matching. Supports wildcard patterns like *.md and ? for single character matching. Searches through all subdirectories from the starting path when recursive is true (default). ';

  constructor(params?: FileWriteParameters) {
    super(params);
  }

  async _call(
    input: z.infer<typeof this.schema>,
    runManager,
    config,
  ): Promise<string> {
    const workspace = config?.configurable?.workspace;
    let filePath = input.path;
    if (workspace) {
      filePath = path.isAbsolute(filePath)
        ? filePath
        : path.join(workspace, filePath);
    }

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

    searchRecursively(filePath);

    if (results.length === 0) {
      return '未找到匹配的文件';
    }

    if (input.content) {
      // 搜索关键字
      const list = [];
      for (let index = 0; index < results.length; index++) {
        const filePath = results[index];
        let content = '';
        const ext = path.extname(filePath).toLowerCase();
        try {
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
          } else if (
            ext.toLowerCase() == '.jpg' ||
            ext.toLowerCase() == '.png' ||
            ext.toLowerCase() == '.bmp' ||
            ext.toLowerCase() == '.jpeg' ||
            ext.toLowerCase() == '.webp'
          ) {
            const loader = new ImageLoader(filePath);
            const docs = await loader.load();
            if (!docs) continue;
            content = docs.map((x) => x.pageContent).join('\n\n');
          } else {
            continue;
          }
        } catch (err) {
          console.error(err);
          continue;
        }

        const keywords = [...new Set(input.content.split(' '))];
        for (const keyword of keywords) {
          let startIndex = content.indexOf(keyword);
          if (startIndex >= 0) {
            startIndex -= 100;
            if (startIndex < 0) startIndex = 0;
            let endIndex = content.indexOf(keyword) + keyword.length + 100;
            if (endIndex > content.length) endIndex = content.length;

            const item = list.find((x) => x.path == filePath);
            const match =
              (startIndex > 0 ? '...' : '') +
              content.substring(startIndex, endIndex) +
              (endIndex < content.length ? '...' : '');
            if (item) {
              item.match.push(match);
            } else {
              list.push({
                path: filePath,
                match: [match],
              });
            }
          }
        }
      }
      return list.length > 0 ? JSON.stringify(list) : 'No match any file';
    }

    return JSON.stringify(results);
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
    const workspace = config?.configurable?.workspace;
    let sourcePath = input.source;
    let destinationPath = input.destination;
    if (workspace) {
      sourcePath = path.isAbsolute(sourcePath)
        ? sourcePath
        : path.join(workspace, sourcePath);
      destinationPath = path.isAbsolute(destinationPath)
        ? destinationPath
        : path.join(workspace, destinationPath);
    }

    fs.renameSync(sourcePath, destinationPath);
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

const replaceSnippetWithContext = (
  text,
  oldString,
  newString,
  contextLines = 4,
) => {
  // Calculate the line number where the oldString appears
  const lineNumber = (text.split(oldString)[0] ?? '').split(/\r?\n/).length - 1;

  // Replace the oldString with newString in the text
  const replacedText = safeReplace(text, oldString, newString).split(/\r?\n/);

  // Calculate the start and end lines for the context window
  const startLine = Math.max(0, lineNumber - contextLines);
  const endLine = lineNumber + contextLines + oldString.split(/\r?\n/).length;

  // Return the snippet with context and the starting line number
  return {
    snippet: replacedText.slice(startLine, endLine).join(`\n`),
    startLine: startLine + 1, // Converting to 1-based line numbering
  };
};

const formatCodeWithLineNumbers = ({
  content: codeContent,
  startLine: startingLine,
}) => {
  if (!codeContent) return '';

  return codeContent
    .split(/\r?\n/)
    .map((line, index) => {
      const lineNumber = index + startingLine;
      const lineNumberStr = String(lineNumber);

      // Format line number with padding if needed
      if (lineNumberStr.length >= 6) {
        return `${lineNumberStr}→${line}`;
      }
      return `${lineNumberStr.padStart(6, ' ')}→${line}`;
    })
    .join('\n');
};

const safeReplace = (
  sourceString: string,
  searchValue: string,
  replaceValue: string,
  replaceAll = false,
) => {
  let replacer = replaceAll
    ? (str: string, search: string, replace: string) =>
        str.replaceAll(search, () => replace)
    : (str: string, search: string, replace: string) =>
        str.replace(search, () => replace);

  if (replaceValue !== '')
    return replacer(sourceString, searchValue, replaceValue);

  return !searchValue.endsWith(`\n`) &&
    sourceString.includes(`${searchValue}\n`)
    ? replacer(sourceString, `${searchValue}\n`, replaceValue)
    : replacer(sourceString, searchValue, replaceValue);
};

const patchFile = (
  filePath: string,
  fileContents: string,
  edits: { old_string: string; new_string: string; replace_all: boolean }[],
) => {
  let contents = fileContents;
  let newContents: string[] = [];
  for (let edit of edits) {
    let oldString = edit.old_string.replace(/\n+$/, '');
    for (let newContent of newContents)
      if (oldString !== '' && newContent.includes(oldString))
        throw new Error(
          'Cannot edit file: old_string is a substring of a new_string from a previous edit.',
        );
    let W = contents;
    contents =
      edit.old_string === ''
        ? edit.new_string
        : safeReplace(
            contents,
            edit.old_string,
            edit.new_string,
            edit.replace_all,
          );

    if (contents === W)
      throw new Error('String not found in file. Failed to apply edit.');
    newContents.push(edit.new_string);
  }
  if (contents === fileContents)
    throw new Error(
      'Original and edited file match exactly. Failed to apply edit.',
    );
  return contents;
};
export class Edit extends BaseTool {
  toolKitName?: string = 'file-system';

  name: string = 'edit';

  description: string = `Performs exact string replacements in files.

Usage:
- You must use your \`file_read\` tool at least once in the conversation before editing. This tool will error if you attempt an edit without reading the file.
- When editing text from Read tool output, ensure you preserve the exact indentation (tabs/spaces) as it appears AFTER the line number prefix. The line number prefix format is: spaces + line number + tab. Everything after that tab is the actual file content to match. Never include any part of the line number prefix in the old_string or new_string.
- ALWAYS prefer editing existing files in the codebase. NEVER write new files unless explicitly required.
- Only use emojis if the user explicitly requests it. Avoid adding emojis to files unless asked.
- The edit will FAIL if \`old_string\` is not unique in the file. Either provide a larger string with more surrounding context to make it unique or use \`replace_all\` to change every instance of \`old_string\`.
- Use \`replace_all\` for replacing and renaming strings across the file. This parameter is useful if you want to rename a variable for instance.`;

  schema = z.object({
    file_path: z.string().describe('The path to the file to modify.'),
    old_string: z.string().describe('The text to replace'),
    new_string: z
      .string()
      .describe(
        'The text to replace it with (must be different from old_string)',
      ),
    replace_all: z
      .boolean()
      .default(false)
      .describe('Replace all occurences of old_string (default false)'),
  });

  async _call(
    input: z.infer<typeof this.schema>,
    runManager?: CallbackManagerForToolRun,
    config?: ToolRunnableConfig,
  ): Promise<any> {
    const workspace = config?.configurable?.workspace;

    const { file_path, old_string, new_string, replace_all } = input;
    let _file_path = file_path;

    if (!path.isAbsolute(file_path)) {
      _file_path = path.join(workspace, file_path);
    }

    let content = '';

    if (fs.existsSync(_file_path)) {
      content = fs.readFileSync(_file_path, 'utf-8').replaceAll(`\r\n`, `\n`);
    }
    // if (old_string === new_string)
    //   throw new Error('old_string and new_string are the same');

    let new_content = patchFile(_file_path, content, [
      {
        old_string,
        new_string,
        replace_all,
      },
    ]);
    await fs.promises.writeFile(_file_path, new_content);

    if (replace_all)
      return `The file ${_file_path} has been updated. All occurrences of '${old_string}' were successfully replaced with '${new_string}'.`;

    const { snippet, startLine } = replaceSnippetWithContext(
      content || '',
      old_string,
      new_string,
    );
    return `The file ${_file_path} has been updated. Here's the result of running \`cat -n\` on a snippet of the edited file:
${formatCodeWithLineNumbers({ content: snippet, startLine })}`;
  }
}
export class MultiEdit extends BaseTool {
  name: string = 'multi_edit';

  description: string = `This is a tool for making multiple edits to a single file in one operation. It is built on top of the \`edit\` tool and allows you to perform multiple find-and-replace operations efficiently. Prefer this tool over the \`edit\` tool when you need to make multiple edits to the same file.

Before using this tool:

1. Use the \`file_read\` tool to understand the file's contents and context
2. Verify the directory path is correct

To make multiple file edits, provide the following:
1. file_path: The absolute path to the file to modify (must be absolute, not relative)
2. edits: An array of edit operations to perform, where each edit contains:
   - old_string: The text to replace (must match the file contents exactly, including all whitespace and indentation)
   - new_string: The edited text to replace the old_string
   - replace_all: Replace all occurences of old_string. This parameter is optional and defaults to false.

IMPORTANT:
- All edits are applied in sequence, in the order they are provided
- Each edit operates on the result of the previous edit
- All edits must be valid for the operation to succeed - if any edit fails, none will be applied
- This tool is ideal when you need to make several changes to different parts of the same file

CRITICAL REQUIREMENTS:
1. All edits follow the same requirements as the single Edit tool
2. The edits are atomic - either all succeed or none are applied
3. Plan your edits carefully to avoid conflicts between sequential operations

WARNING:
- The tool will fail if edits.old_string doesn't match the file contents exactly (including whitespace)
- The tool will fail if edits.old_string and edits.new_string are the same
- Since edits are applied in sequence, ensure that earlier edits don't affect the text that later edits are trying to find

When making edits:
- Ensure all edits result in idiomatic, correct code
- Do not leave the code in a broken state
- Always use absolute file paths (starting with /)
- Only use emojis if the user explicitly requests it. Avoid adding emojis to files unless asked.
- Use replace_all for replacing and renaming strings across the file. This parameter is useful if you want to rename a variable for instance.

If you want to create a new file, use:
- A new file path, including dir name if needed
- First edit: empty old_string and the new file's contents as new_string
- Subsequent edits: normal edit operations on the created content`;

  schema = z.strictObject({
    file_path: z.string().describe('The path to the file to modify.'),
    edits: z
      .array(
        z.object({
          old_string: z.string().describe('The text to replace'),
          new_string: z.string().describe('The text to replace it with'),
          replace_all: z
            .boolean()
            .default(false)
            .optional()
            .describe('Replace all occurences of old_string (default false).'),
        }),
      )
      .min(1, 'At least one edit is required')
      .describe('Array of edit operations to perform sequentially on the file'),
  });

  async _call(
    input: z.infer<typeof this.schema>,
    runManager?: CallbackManagerForToolRun,
    parentConfig?: ToolRunnableConfig,
  ): Promise<any> {
    const workspace = parentConfig?.configurable?.workspace;

    const { file_path, edits } = input;
    let _file_path = file_path;

    if (!path.isAbsolute(file_path)) {
      _file_path = path.join(workspace, file_path);
    }

    let content = '';

    if (fs.existsSync(_file_path)) {
      content = fs.readFileSync(_file_path, 'utf-8').replaceAll(`\r\n`, `\n`);
    }
    const new_content = patchFile(_file_path, content, edits);

    fs.mkdirSync(path.dirname(_file_path), { recursive: true });

    await fs.promises.writeFile(_file_path, new_content);

    return `Applied ${edits.length} edit${edits.length === 1 ? '' : 's'} to ${_file_path}:
${edits
  .map(
    (Z, D) =>
      `${D + 1}. Replaced "${Z.old_string.substring(0, 50)}${Z.old_string.length > 50 ? '...' : ''}" with "${Z.new_string.substring(0, 50)}${Z.new_string.length > 50 ? '...' : ''}"`,
  )
  .join(`\n`)}`;
  }
}

interface GrepMatch {
  filePath: string;
  lineNumber: number;
  line: string;
}
export class GrepTool extends BaseTool {
  static readonly Name = 'grep';

  toolKitName?: string = 'file-system';

  name: string = 'grep';

  description: string =
    'Searches for a regular expression pattern within the content of files in a specified directory (or current working directory). Can filter files by a glob pattern. Returns the lines containing matches, along with their file paths and line numbers.';

  schema = z.object({
    pattern: z
      .string()
      .describe(
        "The regular expression (regex) pattern to search for within file contents (e.g., 'function\\s+myFunction', 'import\\s+\\{.*\\}\\s+from\\s+.*').",
      ),
    path: z
      .string()
      .optional()
      .describe(
        'Optional: The absolute path to the directory to search within. If omitted, searches the current working directory.',
      ),
    include: z
      .string()
      .optional()
      .describe(
        "Optional: A glob pattern to filter which files are searched (e.g., '*.js', '*.{ts,tsx}', 'src/**'). If omitted, searches all files (respecting potential global ignores).",
      ),
  });

  private parseGrepOutput(output: string, basePath: string): GrepMatch[] {
    const results: GrepMatch[] = [];
    if (!output) return results;

    const lines = output.split(EOL); // Use OS-specific end-of-line

    for (const line of lines) {
      if (!line.trim()) continue;

      // Find the index of the first colon.
      const firstColonIndex = line.indexOf(':');
      if (firstColonIndex === -1) continue; // Malformed

      // Find the index of the second colon, searching *after* the first one.
      const secondColonIndex = line.indexOf(':', firstColonIndex + 1);
      if (secondColonIndex === -1) continue; // Malformed

      // Extract parts based on the found colon indices
      const filePathRaw = line.substring(0, firstColonIndex);
      const lineNumberStr = line.substring(
        firstColonIndex + 1,
        secondColonIndex,
      );
      const lineContent = line.substring(secondColonIndex + 1);

      const lineNumber = parseInt(lineNumberStr, 10);

      // eslint-disable-next-line no-restricted-globals
      if (!isNaN(lineNumber)) {
        const absoluteFilePath = path.resolve(basePath, filePathRaw);
        const relativeFilePath = path.relative(basePath, absoluteFilePath);

        results.push({
          filePath: relativeFilePath || path.basename(absoluteFilePath),
          lineNumber,
          line: lineContent,
        });
      }
    }
    return results;
  }

  private async performGrepSearch(options: {
    pattern: string;
    path: string; // Expects absolute path
    include?: string;
    signal: AbortSignal;
  }): Promise<GrepMatch[]> {
    const { pattern, path: absolutePath, include } = options;
    let strategyUsed = 'none';

    try {
      // --- Strategy 1: git grep ---
      // const isGit = isGitRepository(absolutePath);
      // const gitAvailable = isGit && (await this.isCommandAvailable('git'));

      // if (gitAvailable) {
      //   strategyUsed = 'git grep';
      //   const gitArgs = [
      //     'grep',
      //     '--untracked',
      //     '-n',
      //     '-E',
      //     '--ignore-case',
      //     pattern,
      //   ];
      //   if (include) {
      //     gitArgs.push('--', include);
      //   }

      //   try {
      //     const output = await new Promise<string>((resolve, reject) => {
      //       const child = spawn('git', gitArgs, {
      //         cwd: absolutePath,
      //         windowsHide: true,
      //       });
      //       const stdoutChunks: Buffer[] = [];
      //       const stderrChunks: Buffer[] = [];

      //       child.stdout.on('data', (chunk) => stdoutChunks.push(chunk));
      //       child.stderr.on('data', (chunk) => stderrChunks.push(chunk));
      //       child.on('error', (err) =>
      //         reject(new Error(`Failed to start git grep: ${err.message}`)),
      //       );
      //       child.on('close', (code) => {
      //         const stdoutData = Buffer.concat(stdoutChunks).toString('utf8');
      //         const stderrData = Buffer.concat(stderrChunks).toString('utf8');
      //         if (code === 0) resolve(stdoutData);
      //         else if (code === 1)
      //           resolve(''); // No matches
      //         else
      //           reject(
      //             new Error(`git grep exited with code ${code}: ${stderrData}`),
      //           );
      //       });
      //     });
      //     return this.parseGrepOutput(output, absolutePath);
      //   } catch (gitError: unknown) {
      //     console.debug(
      //       `GrepLogic: git grep failed: ${getErrorMessage(gitError)}. Falling back...`,
      //     );
      //   }
      // }

      // --- Strategy 2: System grep ---
      const grepAvailable = true;
      if (grepAvailable) {
        strategyUsed = 'system grep';
        const grepArgs = ['-r', '-n', '-H', '-E'];
        const commonExcludes = ['.git', 'node_modules', 'bower_components'];
        commonExcludes.forEach((dir) => grepArgs.push(`--exclude-dir=${dir}`));
        if (include) {
          grepArgs.push(`--include=${include}`);
        }
        grepArgs.push(pattern);
        grepArgs.push('.');

        try {
          const output = await new Promise<string>((resolve, reject) => {
            const child = spawn('grep', grepArgs, {
              cwd: absolutePath,
              windowsHide: true,
            });
            const stdoutChunks: Buffer[] = [];
            const stderrChunks: Buffer[] = [];

            const onData = (chunk: Buffer) => stdoutChunks.push(chunk);
            const onStderr = (chunk: Buffer) => {
              const stderrStr = chunk.toString();
              // Suppress common harmless stderr messages
              if (
                !stderrStr.includes('Permission denied') &&
                !/grep:.*: Is a directory/i.test(stderrStr)
              ) {
                stderrChunks.push(chunk);
              }
            };
            const onError = (err: Error) => {
              cleanup();
              reject(new Error(`Failed to start system grep: ${err.message}`));
            };
            const onClose = (code: number | null) => {
              const stdoutData = Buffer.concat(stdoutChunks).toString('utf8');
              const stderrData = Buffer.concat(stderrChunks)
                .toString('utf8')
                .trim();
              cleanup();
              if (code === 0) resolve(stdoutData);
              else if (code === 1)
                resolve(''); // No matches
              else {
                if (stderrData)
                  reject(
                    new Error(
                      `System grep exited with code ${code}: ${stderrData}`,
                    ),
                  );
                else resolve(''); // Exit code > 1 but no stderr, likely just suppressed errors
              }
            };

            const cleanup = () => {
              child.stdout.removeListener('data', onData);
              child.stderr.removeListener('data', onStderr);
              child.removeListener('error', onError);
              child.removeListener('close', onClose);
              if (child.connected) {
                child.disconnect();
              }
            };

            child.stdout.on('data', onData);
            child.stderr.on('data', onStderr);
            child.on('error', onError);
            child.on('close', onClose);
          });
          return this.parseGrepOutput(output, absolutePath);
        } catch (grepError: unknown) {
          console.debug(
            `GrepLogic: System grep failed: ${grepError.message}. Falling back...`,
          );
        }
      }

      // --- Strategy 3: Pure JavaScript Fallback ---
      console.debug(
        'GrepLogic: Falling back to JavaScript grep implementation.',
      );
      strategyUsed = 'javascript fallback';
      const globPattern = include || '**/*';
      const ignorePatterns = [
        '.git/**',
        'node_modules/**',
        'bower_components/**',
        '.svn/**',
        '.hg/**',
      ]; // Use glob patterns for ignores here

      const filesStream = glob.sync(globPattern, {
        cwd: absolutePath,
        dot: true,
        ignore: ignorePatterns,
        absolute: true,
        nodir: true,
        // signal: options.signal,
      });

      const regex = new RegExp(pattern, 'i');
      const allMatches: GrepMatch[] = [];

      for await (const filePath of filesStream) {
        const fileAbsolutePath = filePath as string;
        try {
          const content = await fs.promises.readFile(fileAbsolutePath, 'utf8');
          const lines = content.split(/\r?\n/);
          lines.forEach((line, index) => {
            if (regex.test(line)) {
              allMatches.push({
                filePath:
                  path.relative(absolutePath, fileAbsolutePath) ||
                  path.basename(fileAbsolutePath),
                lineNumber: index + 1,
                line,
              });
            }
          });
        } catch (readError: unknown) {
          // Ignore errors like permission denied or file gone during read
          // if (!isNodeError(readError) || readError.code !== 'ENOENT') {
          //   console.debug(
          //     `GrepLogic: Could not read/process ${fileAbsolutePath}: ${getErrorMessage(readError)}`,
          //   );
          // }
        }
      }

      return allMatches;
    } catch (error: unknown) {
      console.error(
        `GrepLogic: Error in performGrepSearch (Strategy: ${strategyUsed}): ${error.message}`,
      );
      throw error; // Re-throw
    }
  }

  async _call(
    input: z.infer<typeof this.schema>,
    runManager?: CallbackManagerForToolRun,
    config?: ToolRunnableConfig,
  ): Promise<any> {
    try {
      // eslint-disable-next-line no-new
      new RegExp(input.pattern);
    } catch (error) {
      throw new Error(
        `Invalid regular expression pattern provided: ${input.pattern}. Error: ${error.message}`,
      );
    }

    const workspace = config?.configurable?.workspace;
    let filePath = input.path;
    if (workspace) {
      filePath = path.isAbsolute(filePath)
        ? filePath
        : path.join(workspace, filePath);
    }
    const searchDirDisplay = input.path || '.';

    const matches: GrepMatch[] = await this.performGrepSearch({
      pattern: input.pattern,
      path: filePath,
      include: input.include,
      signal: config?.signal,
    });
    if (matches.length === 0) {
      const noMatchMsg = `No matches found for pattern "${input.pattern}" in path "${searchDirDisplay}"${input.include ? ` (filter: "${input.include}")` : ''}.`;
      return noMatchMsg;
    }

    const matchesByFile = matches.reduce(
      (acc, match) => {
        const relativeFilePath =
          path.relative(filePath, path.resolve(filePath, match.filePath)) ||
          path.basename(match.filePath);
        if (!acc[relativeFilePath]) {
          acc[relativeFilePath] = [];
        }
        acc[relativeFilePath].push(match);
        acc[relativeFilePath].sort((a, b) => a.lineNumber - b.lineNumber);
        return acc;
      },
      {} as Record<string, GrepMatch[]>,
    );

    const matchCount = matches.length;
    const matchTerm = matchCount === 1 ? 'match' : 'matches';

    let llmContent = `Found ${matchCount} ${matchTerm} for pattern "${input.pattern}" in path "${searchDirDisplay}"${input.include ? ` (filter: "${input.include}")` : ''}:\n---\n`;

    for (const filePath in matchesByFile) {
      llmContent += `File: ${filePath}\n`;
      matchesByFile[filePath].forEach((match) => {
        const trimmedLine = match.line.trim();
        llmContent += `L${match.lineNumber}: ${trimmedLine}\n`;
      });
      llmContent += '---\n';
    }
    return llmContent;
  }
}

export class GlobTool extends BaseTool {
  static readonly Name = 'glob';

  toolKitName?: string = 'file-system';

  name: string = 'glob';

  description: string = `- Fast file pattern matching tool that works with any codebase size
- Supports glob patterns like "**/*.js" or "src/**/*.ts"
- Returns matching file paths sorted by modification time
- Use this tool when you need to find files by name patterns
- When you are doing an open ended search that may require multiple rounds of globbing and grepping, use the Agent tool instead
- You have the capability to call multiple tools in a single response. It is always better to speculatively perform multiple searches as a batch that are potentially useful.`;

  schema = z.object({
    pattern: z
      .string()
      .describe(
        "The glob pattern to match against (e.g., '**/*.py', 'docs/*.md').",
      ),
    path: z
      .string()
      .optional()
      .describe(
        'Optional: The absolute path to the directory to search within. If omitted, searches the root directory.',
      ),
    case_sensitive: z
      .boolean()
      .optional()
      .default(false)
      .describe(
        'Optional: Whether the search should be case-sensitive. Defaults to false.',
      ),
  });

  async _call(
    input: z.infer<typeof this.schema>,
    runManager?: CallbackManagerForToolRun,
    config?: ToolRunnableConfig,
  ): Promise<any> {
    const entries = glob.sync(input.pattern, {
      cwd: searchDirAbsolute,
      withFileTypes: true,
      nodir: true,
      stat: true,
      nocase: !input.case_sensitive,
      dot: true,
      ignore: ['**/node_modules/**', '**/.git/**'],
      follow: false,
      signal: config?.signal,
    });
    throw new Error('Method not implemented.');
  }
}

export class FileSystemToolKit extends BaseToolKit {
  name: string = 'file_system';

  getTools(): BaseTool[] {
    return [
      new FileWrite(),
      new FileRead(),
      new FileInfo(),
      new ListDirectory(),
      new CreateDirectory(),
      new SearchFiles(),
      new MoveFile(),
      new DeleteFile(),
      new Edit(),
      new MultiEdit(),
      new GrepTool(),
    ];
  }
}

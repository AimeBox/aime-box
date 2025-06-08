import { ChatInputAttachment } from '@/types/chat';

export function splitContextAndFiles(input: string): {
  context: string;
  attachments: ChatInputAttachment[];
} {
  const attachments: ChatInputAttachment[] = [];
  const fileRegex = /<file>([\s\S]*?)<\/file>/g;
  let match: RegExpExecArray | null;

  // 提取所有 <file>xxx</file> 内容

  while ((match = fileRegex.exec(input)) !== null) {
    const attachment = parseMarkdownFileLink(match[1], 'file');
    if (attachment) {
      attachments.push(attachment);
    }
  }

  // 去掉所有 <file>...</file> 后，剩下的就是 context
  let context = input.replace(fileRegex, '').trim();

  const folderRegex = /<folder>([\s\S]*?)<\/folder>/g;
  while ((match = folderRegex.exec(input)) !== null) {
    const attachment = parseMarkdownFileLink(match[1], 'folder');
    if (attachment) {
      attachments.push(attachment);
    }
  }
  context = context.replace(folderRegex, '').trim();

  return { context, attachments: attachments };
}

function parseMarkdownFileLink(
  md: string,
  type: 'file' | 'folder',
): ChatInputAttachment | undefined {
  let _md = md;
  if (md.endsWith('/')) {
    _md = md.substring(0, md.length - 1);
  }
  const name = _md.split(/[/\\]/).pop();

  const path = _md;
  const ext = `.${name.split('.').pop()}`;
  return {
    name,
    path,
    type: type,
    ext: ext,
  };
}

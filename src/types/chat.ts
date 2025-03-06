export interface ChatInputAttachment {
  path: string;
  name: string;
  type: 'file' | 'folder';
  ext: string | undefined;
}

export interface ChatInputExtend {
  attachments: ChatInputAttachment[];
}

export type ChatMode = 'default' | 'task' | 'agent' | 'file';

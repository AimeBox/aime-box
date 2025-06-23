import { v4 as uuidv4 } from 'uuid';

export class Memory {
  memory: MemoryItem[] = [];

  constructor(memory?: MemoryItem[]) {
    if (memory) {
      this.memory = memory;
    }
  }

  addOrUpdate(data: {
    id?: string;
    description: string;
    content: string;
    type: 'text' | 'json' | 'file' | string;
    persistent: boolean;
  }) {
    if (data.id) {
      let item = this.memory.find((x) => x.id == data.id);
      if (item) {
        item = data;
        return item;
      } else {
        const item = new MemoryItem(
          data.id,
          data.description,
          data.content,
          data.type,
          data.persistent,
        );
        this.memory.push(item);
        return item;
      }
    } else {
      const item = new MemoryItem(
        this.memory.length.toString(),
        data.description,
        data.content,
        data.type,
        data.persistent,
      );
      this.memory.push(item);
      return item;
    }
  }

  get(): MemoryItem[] {
    return this.memory;
  }

  getByIds(ids: string[]): MemoryItem[] {
    return this.memory.filter((item) => ids.includes(item.id));
  }

  clear() {
    this.memory = [];
  }

  remove(ids: string[]) {
    this.memory = this.memory.filter((item) => !ids.includes(item.id));
  }

  print() {
    return this.memory
      .map(
        (item) =>
          `<memory id="${item.id}">${item.description}${item.persistent ? `\n${item.content}` : ''}</memory>`,
      )
      .join('\n');
  }

  search(keywords: string[]) {}
}

export class MemoryItem {
  description: string;

  id: string;

  content: string;

  type: 'text' | 'json' | 'file' | string;

  persistent: boolean;

  constructor(
    id: string,
    description: string,
    content: string,
    type: 'text' | 'json' | 'file' | string,
    persistent: boolean,
  ) {
    this.id = id || uuidv4();
    this.type = type;
    this.description = description;
    this.content = content;
    this.persistent = persistent;
  }
}

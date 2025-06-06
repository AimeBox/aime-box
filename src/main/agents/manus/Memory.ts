import { v4 as uuidv4 } from 'uuid';

export class Memory {
  private memory: MemoryItem[] = [];

  constructor(memory?: MemoryItem[]) {
    if (memory) {
      this.memory = memory;
    }
  }

  add(description: string, content: string) {
    this.memory.push(
      new MemoryItem(this.memory.length.toString(), description, content),
    );
  }

  get() {
    return this.memory;
  }

  clear() {
    this.memory = [];
  }

  print() {
    return this.memory
      .map((item) => `[${item.id}]: ${item.description}`)
      .join('\n');
  }
}

export class MemoryItem {
  description: string;

  id: string;

  content: string;

  type: 'text' | 'code' | string;

  constructor(
    id: string,
    description: string,
    content: string,
    type: 'text' | 'code' | string,
  ) {
    this.id = id || uuidv4();
    this.type = type;
    this.description = description;
    this.content = content;
  }
}

/* eslint-disable max-classes-per-file */
import {
  Entity,
  Column,
  PrimaryColumn,
  OneToMany,
  ManyToOne,
  RelationOptions,
  JoinColumn,
  OneToOne,
  OneOrMore,
} from 'typeorm';
import { v4 as uuidv4 } from 'uuid';
import { ChatInputAttachment, ChatMode } from '@/types/chat';

export class ChatOptions {
  system?: string | undefined;

  temperature?: number | undefined;

  top_k?: number | undefined;

  top_p?: number | undefined;

  history?: Array<{ role: string; content: string }> | undefined;

  allwaysClear?: boolean = false;

  stop?: string[] | undefined = undefined;

  maxTokens?: number | undefined;

  agentNames?: string[] = [];

  toolNames?: string[] = [];

  kbList?: string[] = [];

  streaming?: boolean = true;

  format?: string;
}

export interface IChatPlannerPlanStep {
  agent: string;
  id: number;
  description: string;
  status: string;
  note: string;
}

export interface IChatPlannerPlan {
  title: string;
  steps: IChatPlannerPlanStep[];
  thought: string;
}

export interface IChatPlanner {
  id: string;

  chatId: string;

  task?: string;

  plans?: IChatPlannerPlan[];
}

export enum ChatStatus {
  SUCCESS = 'success',
  ERROR = 'error',
  RUNNING = 'running',
}

@Entity('chat')
export class Chat {
  constructor(
    id?: string,
    title?: string,
    model?: string,
    mode?: ChatMode,
    agent?: string,
  ) {
    this.id = id || uuidv4();
    this.title = title || 'New Chat';
    this.tags = [];
    this.timestamp = new Date().getTime();
    this.mode = mode || 'default';
    this.model = model;
    this.agent = agent;
  }

  @PrimaryColumn()
  id!: string;

  @Column()
  title!: string;

  @Column('json')
  tags: any;

  @Column({ nullable: true })
  current_chat_id: string;

  @Column()
  timestamp!: number;

  @Column({ nullable: true })
  model?: string;

  // eslint-disable-next-line no-use-before-define
  @OneToMany((type) => ChatMessage, (chatMessage) => chatMessage.chat) // note: we will create author property in the Photo class below
  chatMessages?: ChatMessage[];

  @OneToMany((type) => ChatFile, (chatFile) => chatFile.chat) // note: we will create author property in the Photo class below
  chatFiles?: ChatFile[];

  @OneToOne((type) => ChatPlanner, (chatPlanner) => chatPlanner.chat) // note: we will create author property in the Photo class below
  chatPlanner?: IChatPlanner;

  @Column('json', { nullable: true })
  options?: any;

  @Column({ nullable: true })
  mode: string = 'default';

  @Column({ nullable: true })
  agent?: string;
}

@Entity('chat_message')
export class ChatMessage {
  constructor(
    id?: string,
    parentId?: string,
    chat?: Chat,
    model?: string,
    role?: string | 'user' | 'assistant' | 'system' | 'tool',
    content?: any,
    status?: ChatStatus,
    response?: string,
    usage_metadata?: {
      total_tokens?: number;
      input_tokens?: number;
      output_tokens?: number;
    },
  ) {
    this.id = id || uuidv4();
    this.parentId = parentId;
    this.chat = chat;
    this.model = model;
    this.role = role;
    this.content = content;
    this.status = status;
    this.timestamp = new Date().getTime();
    this.response = response;
    this.total_tokens = usage_metadata?.total_tokens;
    this.input_tokens = usage_metadata?.input_tokens;
    this.output_tokens = usage_metadata?.output_tokens;
  }

  @PrimaryColumn()
  id!: string;

  @Column({ nullable: true })
  parentId?: string;

  @Column({ nullable: false })
  chatId!: string;

  @ManyToOne(() => Chat, (chat: any) => chat.chatMessages, {
    nullable: false,
    onDelete: 'CASCADE',
    onUpdate: 'CASCADE',
  } as RelationOptions)
  @JoinColumn()
  chat!: Chat;

  @Column()
  model!: string;

  @Column({ nullable: true })
  provider_type?: string;

  @Column('json', { nullable: true })
  options?: any;

  @Column({ enum: ChatStatus })
  status!: ChatStatus;

  @Column()
  role!: string;

  @Column('json', { nullable: true })
  content?: any;

  @Column('json', { nullable: true })
  tool_calls?: any[];

  @Column('json', { nullable: true })
  actions?: any;

  @Column('json', { nullable: true })
  documents?: any;

  @Column('json', { nullable: true })
  extend?: any;

  @Column()
  timestamp!: number;

  @Column({ nullable: true })
  error_msg?: string;

  @Column({ nullable: true })
  response?: string;

  @Column({ nullable: true })
  total_tokens?: number;

  @Column({ nullable: true })
  input_tokens?: number;

  @Column({ nullable: true })
  output_tokens?: number;

  @Column({ nullable: true })
  divider?: boolean = false;

  //耗时
  @Column({ nullable: true })
  time_cost?: number;

  @Column('json', { nullable: true })
  additional_kwargs?: any;

  public setUsage(usage_metadata: {
    total_tokens?: number;
    input_tokens?: number;
    output_tokens?: number;
  }) {
    this.total_tokens = usage_metadata?.total_tokens;
    this.input_tokens = usage_metadata?.input_tokens;
    this.output_tokens = usage_metadata?.output_tokens;
  }
}

@Entity('chat_file')
export class ChatFile {
  constructor(id?: string, chatId?: string, file?: ChatInputAttachment) {
    this.id = id || uuidv4();
    this.chatId = chatId;
    this.file = file;
  }

  @PrimaryColumn()
  id!: string;

  @Column({ nullable: false })
  chatId!: string;

  @ManyToOne(() => Chat, (chat: any) => chat.chatFiles, {
    nullable: false,
    onDelete: 'CASCADE',
    onUpdate: 'CASCADE',
  } as RelationOptions)
  @JoinColumn()
  chat!: Chat;

  @Column('json')
  file!: any;

  @Column({ nullable: true })
  content?: string;

  @Column('json', { nullable: true })
  additional_kwargs?: any;
}

@Entity('chat_planner')
export class ChatPlanner implements IChatPlanner {
  constructor(id?: string, chatId?: string) {
    this.id = id || uuidv4();
    this.chatId = chatId;
  }

  @PrimaryColumn()
  id!: string;

  @Column({ nullable: false })
  chatId!: string;

  @OneToOne(() => Chat, (chat) => chat.chatPlanner, {
    nullable: false,
    onDelete: 'CASCADE',
    onUpdate: 'CASCADE',
  } as RelationOptions)
  @JoinColumn()
  chat!: Chat;

  @Column({ nullable: true, type: 'json' })
  plans?: any;

  @Column({ nullable: true })
  task?: string;
}

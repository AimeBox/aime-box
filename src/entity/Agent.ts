import { v4 as uuidv4 } from 'uuid';
import {
  Entity,
  Column,
  PrimaryColumn,
  OneToMany,
  ManyToOne,
  RelationOptions,
  JoinColumn,
  Index,
} from 'typeorm';

@Entity('agent')
export class Agent {
  constructor(
    id: string,
    name: string,
    description?: string,
    prompt?: string,
    type?: string | 'react' | 'supervisor' | 'built-in' | 'a2a' | 'anp',
    tools?: any[],
    agents?: any[],
    model?: string,
    recursionLimit?: number,
    config?: any,
  ) {
    this.id = id || uuidv4();
    this.name = name;
    this.description = description;
    this.prompt = prompt;
    this.type = type;
    this.tools = tools;
    this.agents = agents;
    this.model = model;
    this.recursionLimit = recursionLimit;
    this.config = config;
    this.static = false;
  }

  @PrimaryColumn()
  id!: string;

  @Index({ unique: true })
  @Column()
  name!: string;

  @Column({ nullable: true })
  description?: string;

  @Column({ nullable: true })
  prompt?: string;

  @Column({ type: 'json', nullable: true })
  tags?: string[];

  @Column({ nullable: true })
  type?: string | 'react' | 'supervisor' | 'built-in' | 'a2a' | 'anp';

  @Column({ type: 'json', nullable: true })
  tools?: any[];

  @Column({ type: 'json', nullable: true })
  agents?: any[];

  @Column({ nullable: true })
  model?: string;

  @Column({ type: 'json', nullable: true })
  config?: any;

  @Column({ nullable: true })
  static?: boolean;

  @Column({ nullable: true })
  mermaid?: string;

  @Column({ nullable: true })
  supervisorOutputMode?: string;

  @Column({ nullable: true })
  recursionLimit?: number;

  @Column({ nullable: true })
  remote_url?: string;
}

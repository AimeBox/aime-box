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
    name: string,
    description?: string,
    prompt?: string,
    type?: string | 'react' | 'supervisor',
    tools?: any[],
    agents?: any[],
    model?: string,
    config?: any,
  ) {
    this.id = uuidv4();
    this.name = name;
    this.description = description;
    this.prompt = prompt;
    this.type = type;
    this.tools = tools;
    this.agents = agents;
    this.model = model;
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
  type?: string | 'react' | 'supervisor';

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
}

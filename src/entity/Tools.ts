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

@Entity('tools')
export class Tools {
  constructor(
    name: string,
    description?: string,
    type?: string | 'custom' | 'mcp' | 'built-in',
    config?: any,
  ) {
    this.name = name;
    this.description = description;
    this.type = type;
    this.config = config;
  }

  @PrimaryColumn()
  name!: string;

  @Column({ nullable: true })
  description?: string;

  @Column({ type: 'json', nullable: true })
  config?: any;

  @Column()
  type!: string | 'custom' | 'mcp' | 'built-in';

  @Column()
  enabled!: boolean;

  @Column({ nullable: true })
  toolkit_name?: string;

  @Column({ type: 'json', nullable: true })
  tags?: string[];

  @Column({ nullable: true })
  mcp_id?: string;

  @Column({ default: false })
  is_toolkit: boolean;
}

@Entity('mcp_servers')
export class McpServers {
  constructor(
    id: string,
    name: string,
    description?: string,
    type?: 'sse' | 'stdio' | 'ws',
    command?: string,

    config?: any,
    env?: any,
  ) {
    this.id = id;
    this.name = name;
    this.description = description;
    this.type = type;
    this.command = command;
    this.config = config;
    this.env = env;
  }

  @PrimaryColumn()
  id!: string;

  @Column()
  @Index({ unique: true })
  name!: string;

  @Column({ nullable: true })
  description?: string;

  @Column({ type: 'json', nullable: true })
  config?: any;

  @Column({ type: 'json', nullable: true })
  env?: any;

  @Column()
  type!: string | 'sse' | 'command';

  @Column()
  enabled!: boolean;

  @Column()
  command!: string;

  @Column({ nullable: true })
  version?: string;
}

import {
  Entity,
  Column,
  PrimaryColumn,
  OneToMany,
  ManyToOne,
  RelationOptions,
  JoinColumn,
} from 'typeorm';

@Entity('agent')
export class Agent {
  constructor(
    name: string,
    description?: string,
    tags?: string[],
    config?: any,
  ) {
    this.name = name;
    this.description = description;
    this.tags = tags;
    this.config = config;
    this.static = false;
  }

  @PrimaryColumn()
  name!: string;

  @Column({ nullable: true })
  description?: string;

  @Column({ type: 'json', nullable: true })
  tags?: string[];

  @Column({ nullable: true })
  type?: string;

  @Column({ type: 'json', nullable: true })
  config?: any;

  @Column({ nullable: true })
  static?: boolean;
}

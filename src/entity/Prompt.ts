import {
  Entity,
  Column,
  PrimaryColumn,
  OneToMany,
  ManyToOne,
  RelationOptions,
  JoinColumn,
} from 'typeorm';

export class PromptItem {
  role?: string;

  content: string;
}
@Entity('prompt_group')
export class PromptGroup {
  @PrimaryColumn()
  id!: string;

  @Column()
  name!: string;

  @OneToMany((type) => Prompt, (prompt) => prompt.group)
  prompts?: Prompt[];
}

@Entity('prompt')
export class Prompt {
  @PrimaryColumn()
  id!: string;

  @Column({ nullable: true })
  role?: string;

  @Column({ nullable: true })
  content: string;

  @Column({ nullable: true })
  description?: string;

  @Column({ type: 'json', nullable: true })
  tags?: string[];

  @ManyToOne((type) => PromptGroup, (group) => group.prompts, {
    nullable: false,
    onDelete: 'CASCADE',
    onUpdate: 'CASCADE',
  } as RelationOptions)
  @JoinColumn()
  group!: PromptGroup;

  @Column()
  timestamp!: number;
}

import {
  Entity,
  Column,
  PrimaryColumn,
  RelationOptions,
  ManyToOne,
  OneToMany,
  JoinColumn,
} from 'typeorm';

@Entity('memoy-history')
export class MemoyHistory {
  @PrimaryColumn()
  id!: string;

  @Column()
  memoryId!: string;

  @Column({ nullable: true })
  userId?: string;

  @Column({ nullable: true })
  agentId?: string;

  @Column({ nullable: true })
  sessionId?: string;

  @Column({ nullable: true })
  preValue?: string;

  @Column({ nullable: true })
  newValue?: string;

  @Column('json', { nullable: true })
  categories?: any;

  @Column({ nullable: true })
  event?: string;

  @Column()
  timestamp!: number;

  @Column()
  isDeleted: boolean;
}

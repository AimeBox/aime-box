/* eslint-disable max-classes-per-file */
import { Entity, Column, PrimaryColumn } from 'typeorm';

@Entity('langgraph_checkpoints')
export class LanggraphCheckPoints {
  @PrimaryColumn()
  thread_id!: string;

  @PrimaryColumn()
  checkpoint_ns!: string;

  @PrimaryColumn()
  checkpoint_id!: string;

  @Column({ nullable: true })
  parent_checkpoint_id?: string;

  @Column({ nullable: true })
  type?: string;

  @Column({ nullable: true, type: 'blob' })
  checkpoint?: Buffer;

  @Column({ nullable: true, type: 'blob' })
  metadata?: Buffer;
}

@Entity('langgraph_writes')
export class LanggraphWrites {
  @PrimaryColumn()
  thread_id!: string;

  @PrimaryColumn()
  checkpoint_ns!: string;

  @PrimaryColumn()
  checkpoint_id!: string;

  @PrimaryColumn()
  task_id!: string;

  @PrimaryColumn()
  idx!: number;

  @Column({ nullable: false })
  channel!: string;

  @Column({ nullable: true })
  type?: string;

  @Column({ nullable: true, type: 'blob' })
  value?: Buffer;
}

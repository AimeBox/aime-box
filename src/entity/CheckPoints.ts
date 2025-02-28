/* eslint-disable max-classes-per-file */
import { Entity, Column, PrimaryColumn } from 'typeorm';

@Entity('checkpoints')
export class CheckPoints {
  @PrimaryColumn()
  thread_id!: string;

  @PrimaryColumn()
  checkpoint_id!: string;

  @Column({ nullable: true })
  parent_id?: string;

  @Column({ nullable: true })
  checkpoint?: string;

  @Column({ nullable: true })
  metadata?: string;
}

import {
  Entity,
  Column,
  PrimaryColumn,
  RelationOptions,
  ManyToOne,
  OneToMany,
  JoinColumn,
} from 'typeorm';

@Entity('plugins')
export class Plugins {
  @PrimaryColumn()
  id!: string;

  @Column()
  name!: string;

  @Column()
  description?: string;

  @Column()
  version!: string;

  @Column()
  author?: string;

  @Column()
  path!: string;

  @Column()
  isEnable: boolean;

  @Column({ type: 'json', nullable: true })
  config?: any;
}

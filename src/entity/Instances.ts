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

export enum InstanceType {
  BROWSER = 'browser',
}

@Entity('instances')
export class Instances {
  @PrimaryColumn()
  id!: string;

  @Index({ unique: true })
  @Column()
  name!: string;

  @Column()
  type!: string;

  @Column({ type: 'json', nullable: true })
  config?: any;

  @Column({ default: false })
  static: boolean = false;

  constructor(id: string, name: string, type: InstanceType, config: any) {
    this.id = id || uuidv4();
    this.name = name;
    this.type = type;
    this.config = config;
  }
}

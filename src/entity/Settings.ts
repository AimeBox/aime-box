import { Entity, Column, PrimaryColumn } from 'typeorm';

@Entity('settings')
export default class Settings {
  @PrimaryColumn()
  id!: string;

  @Column({ nullable: true })
  value?: string;
}

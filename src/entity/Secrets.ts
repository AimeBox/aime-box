import { Column, Entity, Index, PrimaryColumn } from 'typeorm';

@Entity('secrets')
export class Secrets {
  @PrimaryColumn()
  id!: string;

  @Index({ unique: true })
  @Column()
  key!: string;

  @Column()
  value!: string;

  @Column({ nullable: true })
  description?: string;
}

import { Entity, Column, PrimaryColumn, Index } from 'typeorm';

export enum ProviderType {
  OLLAMA = 'ollama',
  OPENAI = 'openai',
  TONGYI = 'tongyi',
  ZHIPU = 'zhipu',
  GROQ = 'groq',
  ANTHROPIC = 'anthropic',
  TOGETHERAI = 'togetherai',
  GOOGLE = 'google',
  OPENROUTER = 'openrouter',
  SILICONFLOW = 'siliconflow',
  DEEPSEEK = 'deepseek',
  BAIDU = 'baidu',
  LMSTUDIO = 'lmstudio',
  AZURE_OPENAI = 'azure_openai',
  VOLCANOENGINE = 'volcanoengine',
}

@Entity('providers')
export class Providers {
  @PrimaryColumn()
  id!: string;

  @Column()
  @Index({ unique: true })
  name!: string;

  @Column({ enum: ProviderType })
  type!: string;

  @Column({ nullable: true })
  api_base?: string;

  @Column()
  api_key?: string;

  @Column('json', { nullable: true })
  models?: any;

  static: boolean;

  @Column('json', { nullable: true })
  config?: any;

   @Column({ nullable: true })
  icon?: string;

}

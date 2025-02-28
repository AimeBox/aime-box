import {
  Entity,
  Column,
  PrimaryColumn,
  RelationOptions,
  ManyToOne,
  OneToMany,
  JoinColumn,
} from 'typeorm';

export enum VectorStoreType {
  LanceDB = 'lancedb',
  Vectra = 'vectra',
  PGVector = 'pgvector',
  Milvus = 'milvus',
}

@Entity('knowledgebase')
export class KnowledgeBase {
  @PrimaryColumn()
  id!: string;

  @Column()
  name!: string;

  @Column()
  description?: string;

  @Column('json', { nullable: true })
  tags?: any;

  @Column({ enum: VectorStoreType })
  vectorStoreType?: VectorStoreType;

  @Column('json', { nullable: true })
  vectorStoreConfig?: any;

  @Column()
  embedding: string;

  @Column({ nullable: true })
  reranker?: string;

  @OneToMany((type) => KnowledgeBaseItem, (item) => item.knowledgeBase) // note: we will create author property in the Photo class below
  items?: KnowledgeBaseItem[];
}

export enum KnowledgeBaseItemState {
  Pending = 'pending',
  Processing = 'processing',
  Completed = 'completed',
  Fail = 'fail',
}
export enum KnowledgeBaseSourceType {
  Web = 'web',
  File = 'file',
  Folder = 'folder',
}
@Entity('knowledgebase_item')
export class KnowledgeBaseItem {
  @PrimaryColumn()
  id!: string;

  @Column({ nullable: false })
  knowledgeBaseId!: string;

  @ManyToOne((type) => KnowledgeBase, (kb) => kb.items, {
    nullable: false,
    onDelete: 'CASCADE',
    onUpdate: 'CASCADE',
  } as RelationOptions)
  @JoinColumn()
  knowledgeBase!: KnowledgeBase;

  @Column()
  name!: string;

  @Column({ nullable: true })
  source?: string;

  @Column({ enum: KnowledgeBaseSourceType })
  sourceType?: KnowledgeBaseSourceType;

  @Column('json', { nullable: true })
  tags?: any;

  @Column('json', { nullable: true })
  metadata?: any;

  @Column()
  isEnable: boolean = true;

  @Column({ enum: KnowledgeBaseItemState })
  state!: KnowledgeBaseItemState;

  @Column({ nullable: true })
  chunkCount?: number;

  @Column()
  timestamp!: number;

  @Column({ nullable: true })
  sha256?: string;

  @Column('json', { nullable: true })
  config?: any;

  @Column({ nullable: true })
  content?: string;
}

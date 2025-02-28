import { DataSource, LessThan, Repository } from 'typeorm';
import { BaseCheckpointSaver, Checkpoint } from '@langchain/langgraph';
import { SerializerProtocol } from '@langchain/langgraph-checkpoint';
import { RunnableConfig } from '@langchain/core/runnables';
import {
  CheckpointMetadata,
  PendingWrite,
} from '@langchain/langgraph-checkpoint/dist/types';
import {
  CheckpointListOptions,
  CheckpointTuple,
} from '@langchain/langgraph-checkpoint/dist/base';
import { CheckPoints } from '../../entity/CheckPoints';

export class TypeormSaver extends BaseCheckpointSaver {
  db: DataSource;

  checkpoints!: Repository<CheckPoints>;

  protected isSetup: boolean;

  constructor(db: DataSource, serde?: SerializerProtocol) {
    super(serde);
    Object.defineProperty(this, 'db', {
      enumerable: true,
      configurable: true,
      writable: true,
      value: void 0,
    });
    Object.defineProperty(this, 'isSetup', {
      enumerable: true,
      configurable: true,
      writable: true,
      value: void 0,
    });
    this.db = db;
    this.isSetup = false;
  }

  setup() {
    if (this.isSetup) {
      return;
    }
    try {
      // this.db.pragma('journal_mode=WAL');
      // this.db.createEntityManager()
      this.checkpoints = this.db.getRepository(CheckPoints);
      //       const res = await this.db.query(`
      // CREATE TABLE IF NOT EXISTS checkpoints (
      //   thread_id TEXT NOT NULL,
      //   checkpoint_id TEXT NOT NULL,
      //   parent_id TEXT,
      //   checkpoint BLOB,
      //   metadata BLOB,
      //   PRIMARY KEY (thread_id, checkpoint_id)
      // );`);
    } catch (error) {
      console.log('Error creating checkpoints table', error);
      throw error;
    }
    this.isSetup = true;
  }

  async getTuple(config: any): Promise<CheckpointTuple | undefined> {
    this.setup();
    const thread_id = config.configurable?.thread_id;
    const checkpoint_id = config.configurable?.checkpoint_id;
    if (checkpoint_id) {
      try {
        const row = await this.checkpoints.findOne({
          where: { thread_id, checkpoint_id },
        });
        if (row) {
          return {
            config,
            checkpoint: await this.serde.loadsTyped(
              'json',
              row.checkpoint as string,
            ),
            metadata: await this.serde.loadsTyped(
              'json',
              row.metadata as string,
            ),
            parentConfig: row.parent_id
              ? {
                  configurable: {
                    thread_id,
                    checkpoint_id: row.parent_id,
                  },
                }
              : undefined,
          } as CheckpointTuple;
        }
      } catch (error) {
        console.log('Error retrieving checkpoint', error);
        throw error;
      }
    } else {
      const row = await this.checkpoints.findOne({
        where: { thread_id },
        order: {
          checkpoint_id: 'DESC',
        },
      });
      if (row) {
        return {
          config: {
            configurable: {
              thread_id: row.thread_id,
              checkpoint_id: row.checkpoint_id,
            },
          },
          checkpoint: await this.serde.loadsTyped(
            'json',
            row.checkpoint as string,
          ),
          metadata: await this.serde.loadsTyped('json', row.metadata as string),
          parentConfig: row.parent_id
            ? {
                configurable: {
                  thread_id: row.thread_id,
                  checkpoint_id: row.parent_id,
                },
              }
            : undefined,
        } as CheckpointTuple;
      }
    }
    return undefined;
  }

  async put(config: any, checkpoint: Checkpoint, metadata: CheckpointMetadata) {
    this.setup();
    try {
      // const row = [
      //   config.configurable?.thread_id,
      //   checkpoint.id,
      //   config.configurable?.checkpoint_id,
      //   this.serde.stringify(checkpoint),
      //   this.serde.stringify(metadata),
      // ];
      const cp = new CheckPoints();
      cp.thread_id = config.configurable?.thread_id;
      cp.checkpoint_id = checkpoint.id;
      cp.parent_id = config.configurable?.checkpoint_id;
      cp.checkpoint = this.serde.dumpsTyped(checkpoint).toString();
      cp.metadata = this.serde.dumpsTyped(metadata).toString();

      await this.checkpoints.save(cp);

      // this.db
      //   .prepare(
      //     `INSERT OR REPLACE INTO checkpoints (thread_id, checkpoint_id, parent_id, checkpoint, metadata) VALUES (?, ?, ?, ?, ?)`,
      //   )
      //   .run(...row);
    } catch (error) {
      console.log('Error saving checkpoint', error);
      throw error;
    }
    return {
      configurable: {
        thread_id: config.configurable?.thread_id,
        checkpoint_id: checkpoint.id,
      },
    };
  }

  async *list(
    config: RunnableConfig,
    options?: CheckpointListOptions,
  ): AsyncGenerator<CheckpointTuple> {
    this.setup();
    const thread_id = config.configurable?.thread_id;

    let q = this.checkpoints.createQueryBuilder();

    q = q.where({ thread_id });
    if (options?.before) {
      q = q.andWhere({
        checkpoint_id: LessThan(options?.before?.configurable?.checkpoint_id),
      });
    }
    q = q.addOrderBy('checkpoint_id', 'DESC');
    if (options?.limit) {
      q = q.limit(options?.limit);
    }

    try {
      const rows = await q.getMany();
      if (rows) {
        for (const row of rows) {
          yield {
            config: {
              configurable: {
                thread_id: row.thread_id,
                checkpoint_id: row.checkpoint_id,
              },
            },

            checkpoint: (await this.serde.loadsTyped(
              'json',
              row.checkpoint as string,
            )) as Checkpoint,
            metadata: (await this.serde.loadsTyped(
              'json',
              row.metadata as string,
            )) as CheckpointMetadata,
            parentConfig: row.parent_id
              ? ({
                  configurable: {
                    thread_id: row.thread_id,
                    checkpoint_id: row.parent_id,
                  },
                } as RunnableConfig)
              : undefined,
          } as CheckpointTuple;
        }
      }
    } catch (error) {
      console.log('Error listing checkpoints', error);
      throw error;
    }
  }

  putWrites(
    config: RunnableConfig,
    writes: PendingWrite[],
    taskId: string,
  ): Promise<void> {
    throw new Error('Method not implemented.');
  }
}

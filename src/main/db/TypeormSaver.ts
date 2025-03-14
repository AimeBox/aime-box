import { DataSource, LessThan, Repository } from 'typeorm';
// import { BaseCheckpointSaver, Checkpoint } from '@langchain/langgraph';
import {
  BaseCheckpointSaver,
  type Checkpoint,
  type CheckpointListOptions,
  type CheckpointTuple,
  type SerializerProtocol,
  type PendingWrite,
  type CheckpointMetadata,
  TASKS,
  copyCheckpoint,
} from '@langchain/langgraph-checkpoint';
import { RunnableConfig } from '@langchain/core/runnables';
// import {
//   CheckpointMetadata,
//   PendingWrite,
// } from '@langchain/langgraph-checkpoint/dist/types';
// import {
//   CheckpointListOptions,
//   CheckpointTuple,
// } from '@langchain/langgraph-checkpoint/dist/base';
import {
  LanggraphCheckPoints,
  LanggraphWrites,
} from '../../entity/CheckPoints';

// 定义常量
// const TASKS = 'tasks';

// 定义接口
interface PendingWriteColumn {
  task_id: string;
  channel: string;
  type?: string;
  value?: string;
}

interface PendingSendColumn {
  type?: string;
  value?: string;
}

export class TypeormSaver extends BaseCheckpointSaver {
  db: DataSource;

  checkpoints!: Repository<LanggraphCheckPoints>;

  writes!: Repository<LanggraphWrites>;

  protected isSetup: boolean;

  constructor(db: DataSource, serde?: SerializerProtocol) {
    super(serde);
    this.db = db;
    this.isSetup = false;
  }

  setup() {
    if (this.isSetup) {
      return;
    }
    try {
      this.checkpoints = this.db.getRepository(LanggraphCheckPoints);
      this.writes = this.db.getRepository(LanggraphWrites);
    } catch (error) {
      console.log('Error creating checkpoints table', error);
      throw error;
    }
    this.isSetup = true;
  }

  async getTuple(config: RunnableConfig): Promise<CheckpointTuple | undefined> {
    this.setup();
    const {
      thread_id,
      checkpoint_ns = '',
      checkpoint_id,
    } = config.configurable ?? {};

    try {
      // 构建基本查询
      const queryBuilder = this.checkpoints
        .createQueryBuilder('checkpoints')
        .where('checkpoints.thread_id = :thread_id', { thread_id })
        .andWhere('checkpoints.checkpoint_ns = :checkpoint_ns', {
          checkpoint_ns,
        });

      // 根据是否有 checkpoint_id 添加条件
      if (checkpoint_id) {
        queryBuilder.andWhere('checkpoints.checkpoint_id = :checkpoint_id', {
          checkpoint_id,
        });
      } else {
        queryBuilder.orderBy('checkpoints.checkpoint_id', 'DESC').limit(1);
      }

      // 执行查询
      const row = await queryBuilder.getOne();

      if (!row) {
        return undefined;
      }

      // 确定最终配置
      let finalConfig = config;
      if (!checkpoint_id) {
        finalConfig = {
          configurable: {
            thread_id: row.thread_id,
            checkpoint_ns,
            checkpoint_id: row.checkpoint_id,
          },
        };
      }

      if (
        finalConfig.configurable?.thread_id === undefined ||
        finalConfig.configurable?.checkpoint_id === undefined
      ) {
        throw new Error('Missing thread_id or checkpoint_id');
      }

      // 获取 pending_writes
      const pendingWritesRows = await this.writes.find({
        where: {
          thread_id: row.thread_id,
          checkpoint_ns: row.checkpoint_ns,
          checkpoint_id: row.checkpoint_id,
        },
      });

      const pendingWrites = await Promise.all(
        pendingWritesRows.map(async (write) => {
          return [
            write.task_id,
            write.channel,
            await this.serde.loadsTyped(
              write.type ?? 'json',
              write.value ?? '',
            ),
          ] as [string, string, unknown];
        }),
      );

      // 获取 pending_sends
      const pendingSendsRows = await this.writes.find({
        where: {
          thread_id: row.thread_id,
          checkpoint_ns: row.checkpoint_ns,
          checkpoint_id: row.parent_checkpoint_id,
          channel: TASKS,
        },
        order: {
          idx: 'ASC',
        },
      });

      const pending_sends = await Promise.all(
        pendingSendsRows.map(async (send) =>
          this.serde.loadsTyped(send.type ?? 'json', send.value ?? ''),
        ),
      );

      // 构建 checkpoint 对象
      const checkpointObj = await this.serde.loadsTyped(
        row.type ?? 'json',
        row.checkpoint ? Buffer.from(row.checkpoint).toString() : '',
      );

      const checkpoint = {
        ...checkpointObj,
        pending_sends,
      } as Checkpoint;

      // 返回结果
      return {
        checkpoint,
        config: finalConfig,
        metadata: (await this.serde.loadsTyped(
          row.type ?? 'json',
          row.metadata,
        )) as CheckpointMetadata,
        parentConfig: row.parent_checkpoint_id
          ? {
              configurable: {
                thread_id: row.thread_id,
                checkpoint_ns,
                checkpoint_id: row.parent_checkpoint_id,
              },
            }
          : undefined,
        pendingWrites,
      };
    } catch (error) {
      console.log('Error retrieving checkpoint', error);
      throw error;
    }
  }

  async put(config: any, checkpoint: Checkpoint, metadata: CheckpointMetadata) {
    this.setup();
    if (!config.configurable) {
      throw new Error('Empty configuration supplied.');
    }

    const thread_id = config.configurable?.thread_id;
    const checkpoint_ns = config.configurable?.checkpoint_ns ?? '';
    const parent_checkpoint_id = config.configurable?.checkpoint_id;

    if (!thread_id) {
      throw new Error(
        `Missing "thread_id" field in passed "config.configurable".`,
      );
    }
    const preparedCheckpoint: Partial<Checkpoint> = copyCheckpoint(checkpoint);
    delete preparedCheckpoint.pending_sends;

    const [type1, serializedCheckpoint] =
      this.serde.dumpsTyped(preparedCheckpoint);
    const [type2, serializedMetadata] = this.serde.dumpsTyped(metadata);
    if (type1 !== type2) {
      throw new Error(
        'Failed to serialized checkpoint and metadata to the same type.',
      );
    }
    const row = [
      thread_id,
      checkpoint_ns,
      checkpoint.id,
      parent_checkpoint_id,
      type1,
      serializedCheckpoint,
      serializedMetadata,
    ];

    try {
      const cp = new LanggraphCheckPoints();
      cp.thread_id = thread_id;
      cp.checkpoint_ns = checkpoint_ns;
      cp.checkpoint_id = checkpoint.id;
      cp.parent_checkpoint_id = parent_checkpoint_id;
      cp.type = type1;
      cp.checkpoint = Buffer.from(serializedCheckpoint);
      cp.metadata = Buffer.from(serializedMetadata);

      await this.checkpoints.save(cp);
    } catch (error) {
      console.log('Error saving checkpoint', error);
      throw error;
    }
    return {
      configurable: {
        thread_id,
        checkpoint_ns,
        checkpoint_id: checkpoint.id,
      },
    };
  }

  async *list(
    config: RunnableConfig,
    options?: CheckpointListOptions,
  ): AsyncGenerator<CheckpointTuple> {
    const { limit, before, filter } = options ?? {};
    this.setup();

    const thread_id = config.configurable?.thread_id;
    const checkpoint_ns = config.configurable?.checkpoint_ns;

    try {
      // 构建基本查询
      const queryBuilder = this.checkpoints
        .createQueryBuilder('checkpoints')
        .orderBy('checkpoints.checkpoint_id', 'DESC');

      // 添加条件
      if (thread_id) {
        queryBuilder.andWhere('checkpoints.thread_id = :thread_id', {
          thread_id,
        });
      }

      if (checkpoint_ns !== undefined && checkpoint_ns !== null) {
        queryBuilder.andWhere('checkpoints.checkpoint_ns = :checkpoint_ns', {
          checkpoint_ns,
        });
      }

      if (before?.configurable?.checkpoint_id !== undefined) {
        queryBuilder.andWhere('checkpoints.checkpoint_id < :checkpoint_id', {
          checkpoint_id: before.configurable.checkpoint_id,
        });
      }

      // 处理过滤条件
      if (filter && Object.keys(filter).length > 0) {
        // 直接使用filter中的所有键值对
        for (const [key, value] of Object.entries(filter)) {
          if (value !== undefined) {
            // 使用JSON_EXTRACT或等效函数，具体取决于数据库类型
            queryBuilder.andWhere(
              `JSON_EXTRACT(checkpoints.metadata, '$.${key}') = :${key}Value`,
              {
                [`${key}Value`]: JSON.stringify(value),
              },
            );
          }
        }
      }

      // 添加限制
      if (limit) {
        queryBuilder.limit(parseInt(String(limit), 10));
      }

      // 执行查询
      const rows = await queryBuilder.getMany();

      // 处理结果
      for (const row of rows) {
        // 获取 pending_writes
        const pendingWritesRows = await this.writes.find({
          where: {
            thread_id: row.thread_id,
            checkpoint_ns: row.checkpoint_ns,
            checkpoint_id: row.checkpoint_id,
          },
        });

        const pendingWrites = await Promise.all(
          pendingWritesRows.map(async (write) => {
            return [
              write.task_id,
              write.channel,
              await this.serde.loadsTyped(
                write.type ?? 'json',
                write.value ? Buffer.from(write.value).toString() : '',
              ),
            ] as [string, string, unknown];
          }),
        );

        // 获取 pending_sends
        const pendingSendsRows = await this.writes.find({
          where: {
            thread_id: row.thread_id,
            checkpoint_ns: row.checkpoint_ns,
            checkpoint_id: row.parent_checkpoint_id,
            channel: TASKS,
          },
          order: {
            idx: 'ASC',
          },
        });

        const pending_sends = await Promise.all(
          pendingSendsRows.map(async (send) =>
            this.serde.loadsTyped(
              send.type ?? 'json',
              send.value ? Buffer.from(send.value).toString() : '',
            ),
          ),
        );

        // 构建 checkpoint 对象
        const checkpointObj = await this.serde.loadsTyped(
          row.type ?? 'json',
          row.checkpoint ? Buffer.from(row.checkpoint).toString() : '',
        );

        const checkpoint = {
          ...checkpointObj,
          pending_sends,
        } as Checkpoint;

        // 返回结果
        yield {
          config: {
            configurable: {
              thread_id: row.thread_id,
              checkpoint_ns: row.checkpoint_ns,
              checkpoint_id: row.checkpoint_id,
            },
          },
          checkpoint,
          metadata: (await this.serde.loadsTyped(
            row.type ?? 'json',
            row.metadata ? Buffer.from(row.metadata).toString() : '',
          )) as CheckpointMetadata,
          parentConfig: row.parent_checkpoint_id
            ? {
                configurable: {
                  thread_id: row.thread_id,
                  checkpoint_ns: row.checkpoint_ns,
                  checkpoint_id: row.parent_checkpoint_id,
                },
              }
            : undefined,
          pendingWrites,
        };
      }
    } catch (error) {
      console.log('Error listing checkpoints', error);
      throw error;
    }
  }

  async putWrites(
    config: RunnableConfig,
    writes: PendingWrite[],
    taskId: string,
  ): Promise<void> {
    this.setup();
    if (!config.configurable) {
      throw new Error('Empty configuration supplied.');
    }

    if (!config.configurable?.thread_id) {
      throw new Error('Missing thread_id field in config.configurable.');
    }

    if (!config.configurable?.checkpoint_id) {
      throw new Error('Missing checkpoint_id field in config.configurable.');
    }
    try {
      const rows = writes.map((write, idx) => {
        const [type, serializedWrite] = this.serde.dumpsTyped(write[1]);
        const data = new LanggraphWrites();
        data.thread_id = config.configurable?.thread_id;
        data.checkpoint_ns = config.configurable?.checkpoint_ns;
        data.checkpoint_id = config.configurable?.checkpoint_id;
        data.task_id = taskId;
        data.idx = idx;
        data.channel = write[0] as string;
        data.type = type;
        data.value = Buffer.from(serializedWrite);
        return data;
      });
      // for (let i = 0; i < writes.length; i++) {
      //   const [channel, value] = writes[i];
      //   const [type, serializedWrite] = this.serde.dumpsTyped(write[1]);
      //   const write = new LanggraphWrites();
      //   write.thread_id = config.configurable.thread_id;
      //   write.checkpoint_ns = config.configurable.checkpoint_ns || '';
      //   write.checkpoint_id = config.configurable.checkpoint_id;
      //   write.task_id = taskId;
      //   write.idx = i;
      //   write.channel = channel;
      //   write.type = 'json';
      //   write.value = this.serde.dumpsTyped(value).toString();

      // }
      await this.writes.save(rows);
    } catch (error) {
      console.log('Error saving writes', error);
      throw error;
    }
  }
}

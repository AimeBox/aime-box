import {
  Button,
  Divider,
  Input,
  Menu,
  message,
  Modal,
  ModalProps,
  Skeleton,
  Space,
  Tag,
} from 'antd';
import React, {
  createContext,
  ForwardedRef,
  useState,
  useMemo,
  useEffect,
} from 'react';
import { ScrollArea } from '../components/ui/scroll-area';
import InfiniteScroll from 'react-infinite-scroll-component';
import { ToolInfo } from '@/main/tools';
import { FaBook, FaCheck, FaInfoCircle, FaSearch } from 'react-icons/fa';
import { Link } from 'react-router-dom';
import { t } from 'i18next';
import { Prompt, PromptGroup } from '@/entity/Prompt';
import { KnowledgeBase } from '@/entity/KnowledgeBase';
import Alert from 'antd/es/alert/Alert';

interface KnowledgeBaseModalProps extends ModalProps {
  onSelect?: (kbs: KnowledgeBase[]) => void;
  selectedKnowledgeBases: KnowledgeBase[];
  setSelectedKnowledgeBases: (kbs: KnowledgeBase[]) => void;
}

interface KnowledgeBaseModalPropsRef {}

export const KnowledgeBaseModal = React.forwardRef(
  (
    props: KnowledgeBaseModalProps,
    ref: ForwardedRef<KnowledgeBaseModalPropsRef>,
  ) => {
    const {
      onSelect = (kbs: KnowledgeBase[]) => {},
      selectedKnowledgeBases = [],
      setSelectedKnowledgeBases = (kbs: KnowledgeBase[]) => {},
    } = props;

    const [knowledgeBases, setKnowledgeBases] = useState<KnowledgeBase[]>([]);
    const [loading, setLoading] = useState(false);
    const onSearch = (v) => {};

    const getGroups = async () => {
      setLoading(true);
      try {
        const res = window.electron.db.getMany<KnowledgeBase>(
          'knowledgebase',
          {},
        );
        setKnowledgeBases(res);
      } catch (e) {
        console.error(e);
        message.error(e.message);
      } finally {
        setLoading(false);
      }
    };

    return (
      <Modal
        title={t('knowledgebase.select_knowledgebase')}
        {...props}
        width={800}
        afterClose={() => {
          setKnowledgeBases([]);
        }}
        afterOpenChange={async (open) => {
          if (open) {
            await getGroups();
          }
        }}
      >
        <Space direction="vertical" className="w-full">
          {/* <Input.Search
            placeholder="input search"
            enterButton
            onSearch={onSearch}
          /> */}
          <div className="flex flex-row">
            <ScrollArea className="flex-1 my-1 w-full">
              {loading ? (
                <Skeleton active />
              ) : (
                <div className="flex flex-col gap-1">
                  {knowledgeBases.map((knowledgeBase) => {
                    return (
                      <Tag
                        color={
                          selectedKnowledgeBases.some(
                            (x) => x.id == knowledgeBase.id,
                          )
                            ? 'processing'
                            : 'default'
                        }
                        className="cursor-pointer"
                        onClick={() => {
                          const existingIds = selectedKnowledgeBases.map(
                            (kb) => kb.id,
                          );
                          let items = [...selectedKnowledgeBases];

                          if (!existingIds.includes(knowledgeBase.id)) {
                            items.push(knowledgeBase);
                          } else {
                            items = items.filter(
                              (kb) => kb.id != knowledgeBase.id,
                            );
                          }

                          setSelectedKnowledgeBases(items);
                          onSelect?.(items);
                        }}
                      >
                        <div className="flex flex-col p-2">
                          <strong className="flex flex-row gap-1 items-center text-lg">
                            <FaBook></FaBook>
                            {knowledgeBase.name}
                          </strong>
                          {knowledgeBase.description && (
                            <span>{knowledgeBase.description}</span>
                          )}
                        </div>
                      </Tag>
                    );
                  })}
                </div>
              )}
            </ScrollArea>
          </div>
        </Space>
      </Modal>
    );
  },
);

import {
  Button,
  Divider,
  Input,
  Menu,
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
import { FaCheck, FaInfoCircle, FaPlus, FaSearch } from 'react-icons/fa';
import { Link } from 'react-router-dom';
import { t } from 'i18next';
import { Prompt, PromptGroup } from '@/entity/Prompt';

interface PromptsModalProps extends ModalProps {
  role?: string | undefined;
  onSelect: (prompt: Prompt) => void;
}

interface PromptsModalPropsRef {}

export const PromptsModal = React.forwardRef(
  (props: PromptsModalProps, ref: ForwardedRef<PromptsModalPropsRef>) => {
    const { onSelect = (prompt: Prompt) => {}, role = undefined } = props;
    const [groups, setGroups] = useState<PromptGroup[]>([]);
    const [prompts, setPrompts] = useState<Prompt[]>([]);
    const [loading, setLoading] = useState(false);
    const onSearch = (v) => {};

    const getGroups = async () => {
      const groups = await window.electron.prompts.getGroups();
      setGroups(groups);
    };

    const getPrompts = async (groupId: string | undefined) => {
      setLoading(true);
      const prompts = await window.electron.prompts.getPrompts(groupId, role);
      setPrompts(prompts);
      setLoading(false);
    };

    useEffect(() => {
      getGroups();
    }, [role]);

    return (
      <Modal
        title={t('prompts.select_prompt')}
        {...props}
        width={800}
        afterClose={() => {
          setPrompts([]);
        }}
        afterOpenChange={async (open) => {
          if (open) {
            await getGroups();
            await getPrompts(undefined);
          }
        }}
      >
        <Space direction="vertical" className="w-full">
          <div className="flex flex-row gap-2">
            <Input.Search placeholder="input search" onSearch={onSearch} />
            <Button type="primary" icon={<FaPlus />} />
          </div>
          <div className="flex flex-row">
            <div className="pr-2 border-r border-gray-300 border-solid">
              <Menu
                style={{ border: 'none' }}
                className="bg-transparent"
                defaultSelectedKeys={['']}
                onSelect={({ key }) => {
                  getPrompts(key);
                }}
                items={[
                  {
                    key: '',
                    label: <span>{t('all')}</span>,
                  },
                  ...groups.map((group) => ({
                    key: group.id,
                    label: <span>{group.name}</span>,
                  })),
                ]}
              />
            </div>
            <ScrollArea className="flex-1 pl-2 my-1 w-full">
              {loading ? (
                <Skeleton active />
              ) : (
                <div className="flex flex-col gap-1">
                  {prompts.map((prompt) => {
                    return (
                      <Button
                        key={prompt.description}
                        type="text"
                        className="flex flex-col justify-between items-start h-40 bg-gray-50"
                        onClick={() => {
                          onSelect(prompt);
                        }}
                      >
                        <span className="text-left whitespace-pre-line line-clamp-4">
                          {prompt.content}
                        </span>
                        <small className="flex flex-col gap-1 mb-2 text-left text-gray-500">
                          <div>
                            {prompt?.tags?.map((tag) => {
                              return <Tag key={tag}>{tag}</Tag>;
                            })}
                          </div>
                          {prompt.description && (
                            <span>{prompt.description}</span>
                          )}
                        </small>
                      </Button>
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

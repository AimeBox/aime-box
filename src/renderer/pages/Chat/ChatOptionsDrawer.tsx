import { ChatOptions } from '@/entity/Chat';
import { ToolInfo } from '@/main/tools';
import { ScrollArea } from '@/renderer/components/ui/scroll-area';
import {
  Button,
  ConfigProvider,
  Divider,
  Drawer,
  DrawerProps,
  Input,
  Slider,
  Switch,
  Tabs,
  TabsProps,
  Tag,
} from 'antd';
import { t } from 'i18next';
import { useContext, useEffect, useMemo, useState } from 'react';
import { FaBook, FaTools, FaTrash, FaTrashAlt } from 'react-icons/fa';
import { GlobalContext } from '@/renderer/context/GlobalContext';
import { FaRegMessage } from 'react-icons/fa6';
import { Prompt } from '@/entity/Prompt';
import { KnowledgeBase } from '@/entity/KnowledgeBase';

export interface ChatOptionsDrawerProps extends DrawerProps {
  value?: ChatOptions;
  onChange?: (value: Record<string, any>) => void;
}

export default function ChatOptionsDrawer(props: ChatOptionsDrawerProps) {
  const { agents, tools, prompts, knowledgeBase } = useContext(GlobalContext);
  const [currentTab, setCurrentTab] = useState<string>('base');
  const [knowledgeBases, setKnowledgeBases] = useState<KnowledgeBase[]>([]);
  const [insideValue, setInsideValue] = useState<ChatOptions>(props?.value);

  const items: TabsProps['items'] = useMemo(
    () => [
      {
        key: 'base',
        label: t('chat.chat_options.base_setting'),
      },
      {
        key: 'pre_prompt',
        label: t('chat.chat_options.pre_prompt_setting'),
      },
    ],
    [],
  );

  const openToolModal = () => {
    tools.open(props?.value?.toolNames || []);
    tools.onSelect = (tools) => {
      onChange({ toolNames: tools.map((x) => x.name) });
    };
  };
  const openAgentModal = () => {
    agents.open(props?.value?.agentNames || []);
  };
  const openKnowledgeBaseModal = () => {
    knowledgeBase.open(props?.value?.kbList || []);
    knowledgeBase.onSelect = (kbs) => {
      onChange({ kbList: kbs.map((kb) => kb.id) });
    };
  };

  const onChange = (value: Record<string, any>) => {
    props?.onChange?.(value);
  };

  prompts.onSelect = (prompt: Prompt) => {
    setInsideValue({ ...insideValue, system: prompt.content });
    onChange({ system: prompt.content });
  };

  useEffect(() => {
    onChange({
      //toolNames: tools.selectedTools.map((t) => t.id),
      agentNames: agents.selectedAgents.map((a) => a.name),
    });
  }, [tools, agents]);

  useEffect(() => {
    setInsideValue(props?.value);
    console.log(props?.value);
  }, [props?.value]);

  useEffect(() => {
    const res = window.electron.db.getMany<KnowledgeBase>('knowledgebase', {});
    setKnowledgeBases(res);
  }, []);

  return (
    <ConfigProvider
      drawer={{
        classNames: {
          wrapper: 'p-4 !shadow-none',
        },
      }}
    >
      <Drawer
        title={t('chat.chat_options.config')}
        className="rounded-2xl shadow-lg"
        {...props}
        styles={{ body: { padding: 0 } }}
      >
        <div className="flex flex-col h-full">
          <div className="px-4">
            <Tabs
              items={items}
              onChange={setCurrentTab}
              activeKey={currentTab}
            />
          </div>
          <ScrollArea className="flex-1 p-4 h-full">
            {currentTab == 'base' && (
              <div className="flex flex-col gap-2">
                <div className="flex flex-col p-4 bg-gray-100 rounded-2xl">
                  <div className="flex flex-row justify-between">
                    <div className="flex flex-row gap-2 items-center">
                      <FaBook></FaBook>
                      <strong>{t('chat.chat_options.system_prompt')}</strong>
                    </div>
                    <div>
                      <Button
                        size="small"
                        type="text"
                        icon={<FaRegMessage />}
                        onClick={() => {
                          prompts.open('system');
                          prompts.onSelect = (prompt: Prompt) => {
                            setInsideValue({
                              ...insideValue,
                              system: prompt.content,
                            });
                            onChange({ system: prompt.content });
                          };
                        }}
                      >
                        {t('chat.prompts')}
                      </Button>
                      <Button
                        size="small"
                        type="text"
                        onClick={() => {
                          setInsideValue({ ...insideValue, system: undefined });
                          onChange({ system: undefined });
                        }}
                      >
                        {t('chat.chat_options.reset')}
                      </Button>
                    </div>
                  </div>

                  <Input.TextArea
                    className="text-gray-500 rounded-2xl"
                    autoSize
                    placeholder="message"
                    value={insideValue?.system}
                    onChange={(e) =>
                      setInsideValue({ ...insideValue, system: e.target.value })
                    }
                    onBlur={() => onChange({ system: insideValue?.system })}
                    variant="borderless"
                  ></Input.TextArea>
                </div>
                <div className="flex flex-col gap-2 p-4 bg-gray-100 rounded-2xl">
                  <div className="flex flex-row justify-between">
                    <div className="flex flex-row gap-2 items-center">
                      <FaTools></FaTools>
                      <strong>{t('chat.chat_options.tools')}</strong>
                    </div>
                    <div>
                      {props?.value?.toolNames?.length > 0 && (
                        <Button
                          size="small"
                          type="text"
                          danger
                          icon={<FaTrashAlt />}
                          onClick={() => {
                            onChange({ toolNames: [] });
                          }}
                        ></Button>
                      )}
                      <Divider type="vertical"></Divider>

                      <Button size="small" type="text" onClick={openToolModal}>
                        + {t('add')}
                      </Button>
                    </div>
                  </div>

                  <div className="flex flex-row flex-wrap gap-2">
                    {props?.value?.toolNames?.map((toolName) => (
                      <Tag
                        key={toolName}
                        closable
                        color="processing"
                        rootClassName="p-2 text-base rounded-xl gap-2 cursor-pointer items-center"
                        onClose={() => {
                          const _selectToolNames =
                            props?.value?.toolNames.filter(
                              (t) => t !== toolName,
                            );
                          onChange({
                            toolNames: _selectToolNames,
                          });
                        }}
                        onClick={() => {}}
                        className="flex flex-row justify-between items-center"
                      >
                        {toolName}
                      </Tag>
                    ))}
                  </div>
                </div>
                {/* <div className="flex flex-col gap-2 p-4 bg-gray-100 rounded-2xl">
                  <div className="flex flex-row justify-between">
                    <div className="flex flex-row gap-2 items-center">
                      <FaTools></FaTools>
                      <strong>{t('chat.chat_options.agents')}</strong>
                    </div>
                    <div>
                      {props?.value?.agentNames?.length > 0 && (
                        <Button
                          size="small"
                          type="text"
                          danger
                          icon={<FaTrashAlt />}
                          onClick={() => {
                            onChange({ agentNames: [] });
                          }}
                        ></Button>
                      )}
                      <Divider type="vertical"></Divider>

                      <Button size="small" type="text" onClick={openAgentModal}>
                        + {t('add')}
                      </Button>
                    </div>
                  </div>

                  <div className="flex flex-row flex-wrap gap-2">
                    {props?.value?.agentNames?.map((agentName) => (
                      <Tag
                        key={agentName}
                        closable
                        color="processing"
                        rootClassName="p-2 text-base rounded-xl gap-2 cursor-pointer items-center"
                        onClose={() => {
                          const _selectAgentlNames =
                            props?.value?.agentNames.filter(
                              (t) => t !== agentName,
                            );
                          onChange({
                            agentNames: _selectAgentlNames,
                          });
                        }}
                        className="flex flex-row justify-between items-center"
                      >
                        {agentName}
                      </Tag>
                    ))}
                  </div>
                </div> */}

                <div className="flex flex-col gap-2 p-4 bg-gray-100 rounded-2xl">
                  <div className="flex flex-row justify-between">
                    <div className="flex flex-row gap-2 items-center">
                      <FaBook></FaBook>
                      <strong>{t('chat.chat_options.knowledge_base')}</strong>
                    </div>
                    <div>
                      <Button
                        size="small"
                        type="text"
                        onClick={openKnowledgeBaseModal}
                      >
                        + {t('add')}
                      </Button>
                    </div>
                  </div>
                  <div className="flex flex-row flex-wrap gap-2">
                    {knowledgeBases
                      .filter((x) => props?.value?.kbList?.includes(x.id))
                      .map((kb) => {
                        return (
                          <Tag
                            key={kb.id}
                            closable
                            color="processing"
                            rootClassName="p-2 text-base rounded-xl gap-2 cursor-pointer items-center"
                            onClose={() => {
                              const _selectKbIds = props?.value?.kbList.filter(
                                (t) => t !== kb.id,
                              );
                              onChange({
                                kbList: _selectKbIds,
                              });
                            }}
                            className="flex flex-row justify-between items-center"
                          >
                            <div className="flex flex-col min-w-40 max-w-60">
                              <div className="flex flex-row gap-2 items-center">
                                <FaBook></FaBook>
                                {kb.name}
                              </div>
                              <div className="overflow-hidden text-xs text-gray-500 whitespace-nowrap text-ellipsis">
                                {kb.description}
                              </div>
                            </div>
                          </Tag>
                        );
                      })}
                  </div>
                </div>
                <div className="bg-gray-100 rounded-2xl">
                  <div className="flex flex-row justify-between p-4">
                    <div className="flex flex-row gap-2 items-center">
                      <FaTools></FaTools>
                      <strong>{t('chat.chat_options.config')}</strong>
                    </div>
                    <div>
                      <Button size="small" type="text">
                        {t('chat.chat_options.reset')}
                      </Button>
                    </div>
                  </div>
                  <div className="flex flex-col gap-4 p-4">
                    <div className="flex flex-row gap-2 items-center">
                      <Switch
                        checked={insideValue?.allwaysClear}
                        onChange={(v) => onChange({ allwaysClear: v })}
                      ></Switch>
                      总是清空
                    </div>
                    <div className="flex flex-row gap-2 items-center">
                      {insideValue?.streaming}
                      <Switch
                        defaultChecked
                        checked={props?.value?.streaming}
                        onChange={(v) => onChange({ streaming: v })}
                      ></Switch>
                      {t('chat.chat_options.streaming')}
                    </div>

                    <div className="flex flex-row gap-2 items-center">
                      <Switch
                        checked={insideValue?.temperature != undefined}
                        onChange={(v) =>
                          onChange({ temperature: v ? 0.5 : undefined })
                        }
                      ></Switch>
                      <div className="w-20">
                        {t('chat.chat_options.temperature')}
                      </div>
                      {insideValue?.temperature !== undefined && (
                        <Slider
                          value={insideValue?.temperature}
                          disabled={insideValue?.temperature === undefined}
                          className="w-60"
                          min={0}
                          max={1}
                          step={0.1}
                          onChange={(v) => {
                            setInsideValue({ ...insideValue, temperature: v });
                          }}
                          onChangeComplete={(v) => {
                            onChange({ temperature: v });
                          }}
                        />
                      )}
                    </div>
                    <div className="flex flex-row gap-2 items-center">
                      <Switch
                        checked={insideValue?.top_k != undefined}
                        onChange={(v) =>
                          onChange({ top_k: v ? 0.5 : undefined })
                        }
                      ></Switch>
                      <div className="w-20">Top K</div>
                      {insideValue?.top_k !== undefined && (
                        <Slider
                          value={insideValue?.top_k}
                          disabled={insideValue?.top_k === undefined}
                          className="w-60"
                          min={0}
                          max={1}
                          step={0.1}
                          onChange={(v) => {
                            setInsideValue({ ...insideValue, top_k: v });
                          }}
                          onChangeComplete={(v) => onChange({ top_k: v })}
                        />
                      )}
                    </div>
                    <div className="flex flex-row gap-2 items-center">
                      <Switch
                        checked={insideValue?.top_p != undefined}
                        onChange={(v) =>
                          onChange({ top_p: v ? 0.5 : undefined })
                        }
                      ></Switch>
                      <div className="w-20">Top P</div>
                      {insideValue?.top_p !== undefined && (
                        <Slider
                          value={insideValue?.top_p}
                          disabled={insideValue?.top_p === undefined}
                          className="w-60"
                          min={0}
                          max={1}
                          step={0.1}
                          onChange={(v) => {
                            setInsideValue({ ...insideValue, top_p: v });
                          }}
                          onChangeComplete={(v) => onChange({ top_p: v })}
                        />
                      )}
                    </div>
                    <div className="flex flex-row gap-2 items-center">
                      <Switch
                        checked={insideValue?.maxTokens != undefined}
                        onChange={(v) =>
                          onChange({ maxTokens: v ? 4096 : undefined })
                        }
                      ></Switch>
                      <div className="w-20">Max Tokens</div>
                      {insideValue?.maxTokens !== undefined && (
                        <Slider
                          value={insideValue?.maxTokens}
                          disabled={insideValue?.maxTokens === undefined}
                          className="w-60"
                          min={1}
                          max={128000}
                          step={1}
                          onChange={(v) => {
                            setInsideValue({ ...insideValue, maxTokens: v });
                          }}
                          onChangeComplete={(v) => onChange({ maxTokens: v })}
                        />
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )}
            {currentTab == 'pre_prompt' && <div></div>}
          </ScrollArea>
        </div>
      </Drawer>
    </ConfigProvider>
  );
}

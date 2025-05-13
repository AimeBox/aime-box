import {
  Button,
  Card,
  Collapse,
  Divider,
  Input,
  Menu,
  message,
  Modal,
  ModalProps,
  Skeleton,
  Space,
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
import { FaCheck, FaInfoCircle, FaSearch } from 'react-icons/fa';
import { Link } from 'react-router-dom';
import { t } from 'i18next';

interface ToolsModalProps extends ModalProps {
  //tools: ToolInfo[];
  selectedTools: ToolInfo[];
  setSelectedTools: (tools: ToolInfo[]) => void;
  //onChange?: (tools: ToolInfo[]) => void;
  onSelect?: (tools: ToolInfo[]) => void;
}

interface ToolsModalPropsRef {}

export const ToolsModal = React.forwardRef(
  (props: ToolsModalProps, ref: ForwardedRef<ToolsModalPropsRef>) => {
    const [loading, setLoading] = useState(false);
    const [tools, setTools] = useState<ToolInfo[]>([]);
    const [searchValue, setSearchValue] = useState<string>('');
    const [toolsInGroup, setToolsInGroup] = useState<
      Record<string, ToolInfo[]>
    >({});
    const {
      //tools,
      selectedTools = [],
      setSelectedTools = (tools: ToolInfo[]) => {},
      // onChange = (tools: ToolInfo[]) => {},
      //onSelect: onSelectProp = (tools: ToolInfo[]) => {},
    } = props;

    const getTools = async () => {
      setLoading(true);
      try {
        const tools = await window.electron.tools.getList();
        setTools(tools);
      } catch (e) {
        console.error(e);
        message.error(e.message);
      } finally {
        setLoading(false);
      }
    };

    useEffect(() => {
      let _tools = tools;
      if (searchValue) {
        _tools = tools.filter(
          (x) =>
            x.name
              .toLocaleLowerCase()
              .includes(searchValue.toLocaleLowerCase()) ||
            (x.description &&
              x.description
                .toLocaleLowerCase()
                .includes(searchValue.toLocaleLowerCase())),
        );
      }
      const _toolsInGroup = _tools.reduce((acc, obj) => {
        const key = obj.toolkit_name;
        if (!acc[key]) {
          acc[key] = [];
        }
        acc[key].push(obj);
        return acc;
      }, {});
      setToolsInGroup(_toolsInGroup);
    }, [tools, searchValue]);

    const [selectedKey, setSelectedKey] = useState<string>('built-in');
    const onSearch = (value: string) => {
      setSearchValue(value);
    };

    const onSelect = (tool: ToolInfo) => {
      let _selectedTools;
      if (selectedTools.map((x) => x.name).includes(tool.name)) {
        _selectedTools = selectedTools.filter((t) => t.name !== tool.name);
      } else {
        _selectedTools = [...selectedTools, tool];
      }

      setSelectedTools(_selectedTools);
      props.onSelect?.(_selectedTools);
      //onChange(_selectedTools);
    };

    return (
      <Modal
        title={t('tool.add_tool')}
        {...props}
        width={800}
        afterClose={() => {
          setTools([]);
        }}
        afterOpenChange={async (open) => {
          if (open) {
            await getTools();
          }
        }}
      >
        <Space direction="vertical" className="w-full">
          <Input.Search
            placeholder="input search"
            enterButton
            onSearch={onSearch}
          />
          <div className="flex flex-row h-[60vh] overflow-y-scroll">
            <div className="min-w-[200px] pr-2 border-r border-gray-300 border-solid">
              <Menu
                style={{ border: 'none' }}
                className="bg-transparent"
                defaultSelectedKeys={[selectedKey]}
                selectedKeys={[selectedKey]}
                onSelect={(e) => {
                  setSelectedKey(e.key);
                }}
                items={[
                  {
                    key: 'built-in',
                    label: <span>{t('tools.show_all')}</span>,
                  },
                  {
                    key: 'mcp',
                    label: <span>{t('tools.mcp')}</span>,
                  },
                ]}
              />
            </div>
            <ScrollArea className="flex-1 pl-2 my-1 w-full">
              <div className="flex flex-col gap-1">
                {Object.keys(toolsInGroup).map((key) => {
                  if (toolsInGroup[key].length == 1) {
                    const tool = toolsInGroup[key][0];
                    if (tool.type != selectedKey) {
                      return null;
                    }
                    return (
                      <Button
                        key={tool.id}
                        type="text"
                        className="flex flex-row justify-between items-center h-16"
                        onClick={() => {
                          onSelect(tool);
                        }}
                      >
                        <div className="flex overflow-hidden flex-col flex-1 justify-start items-start whitespace-nowrap text-ellipsis">
                          <strong>{tool.name}</strong>
                          <small className="text-left text-gray-500 whitespace-pre-line line-clamp-1">
                            {tool.description}
                          </small>
                        </div>
                        <FaCheck
                          color="green"
                          className={`${selectedTools.some((x) => x.id === tool.id) ? 'opacity-100' : 'opacity-0'}`}
                        />
                      </Button>
                    );
                  } else {
                    return (
                      <>
                        {toolsInGroup[key].filter((x) => x.type == selectedKey)
                          .length > 0 && (
                          <Card
                            className="w-full"
                            key={key}
                            title={key.toLocaleUpperCase()}
                            classNames={{ body: '!p-2' }}
                          >
                            <div className="flex flex-col gap-1">
                              {toolsInGroup[key].map((tool, index) => {
                                return (
                                  <Button
                                    key={tool.id}
                                    type="text"
                                    className="flex flex-row justify-between items-center h-16"
                                    onClick={() => {
                                      onSelect(tool);
                                    }}
                                  >
                                    <div className="flex overflow-hidden flex-col flex-1 justify-start items-start whitespace-nowrap text-ellipsis">
                                      <strong>{tool.name.split('@')[0]}</strong>

                                      <small className="text-left text-gray-500 whitespace-pre-line line-clamp-1">
                                        {tool.description}
                                      </small>
                                    </div>
                                    <FaCheck
                                      color="green"
                                      className={`${selectedTools.some((x) => x.id === tool.id) ? 'opacity-100' : 'opacity-0'}`}
                                    />
                                  </Button>
                                );
                              })}
                            </div>
                          </Card>
                        )}

                        {/* {grouped[key].map((tool) => {
                          if (tool.type != selectedKey) {
                            return null;
                          }
                          return (
                            <Button
                              key={tool.id}
                              type="text"
                              className="flex flex-row justify-between items-center h-16"
                              onClick={() => {
                                onSelect(tool);
                              }}
                            >
                              <div className="flex overflow-hidden flex-col flex-1 justify-start items-start whitespace-nowrap text-ellipsis">
                                <strong>{tool.name.split('@')[0]}</strong>

                                <small className="text-left text-gray-500 whitespace-pre-line line-clamp-1">
                                  {tool.description}
                                </small>
                              </div>
                              <FaCheck
                                color="green"
                                className={`${selectedTools.some((x) => x.id === tool.id) ? 'opacity-100' : 'opacity-0'}`}
                              />
                            </Button>
                          );
                        })} */}
                      </>
                    );
                  }
                })}
              </div>
            </ScrollArea>
          </div>
        </Space>
      </Modal>
    );
  },
);

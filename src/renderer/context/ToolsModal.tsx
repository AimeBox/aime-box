import {
  Button,
  Card,
  Collapse,
  Divider,
  Input,
  Menu,
  Modal,
  ModalProps,
  Skeleton,
  Space,
} from 'antd';
import React, { createContext, ForwardedRef, useState, useMemo } from 'react';
import { ScrollArea } from '../components/ui/scroll-area';
import InfiniteScroll from 'react-infinite-scroll-component';
import { ToolInfo } from '@/main/tools';
import { FaCheck, FaInfoCircle, FaSearch } from 'react-icons/fa';
import { Link } from 'react-router-dom';
import { t } from 'i18next';

interface ToolsModalProps extends ModalProps {
  tools: ToolInfo[];
  selectedTools: ToolInfo[];
  setSelectedTools: (tools: ToolInfo[]) => void;
  onChange?: (tools: ToolInfo[]) => void;
}

interface ToolsModalPropsRef {}

export const ToolsModal = React.forwardRef(
  (props: ToolsModalProps, ref: ForwardedRef<ToolsModalPropsRef>) => {
    const {
      tools,
      selectedTools = [],
      setSelectedTools = (tools: ToolInfo[]) => {},
      onChange = (tools: ToolInfo[]) => {},
    } = props;

    const grouped = tools.reduce((acc, obj) => {
      const key = obj.toolkit_name;
      if (!acc[key]) {
        acc[key] = [];
      }
      acc[key].push(obj);
      return acc;
    }, {});
    console.log(grouped);
    const [selectedKey, setSelectedKey] = useState<string>('built-in');
    const onSearch = (v) => {};

    const onSelect = (tool: ToolInfo) => {
      let _selectedTools;
      if (selectedTools.includes(tool)) {
        _selectedTools = selectedTools.filter((t) => t.name !== tool.name);
      } else {
        _selectedTools = [...selectedTools, tool];
      }

      setSelectedTools(_selectedTools);
      onChange(_selectedTools);
    };

    return (
      <Modal title={t('tool.add_tool')} {...props} width={800}>
        <Space direction="vertical" className="w-full">
          <Input.Search
            placeholder="input search"
            enterButton
            onSearch={onSearch}
          />
          <div className="flex flex-row">
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
                {Object.keys(grouped).map((key) => {
                  if (grouped[key].length == 1) {
                    const tool = grouped[key][0];
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
                        {grouped[key].filter((x) => x.type == selectedKey)
                          .length > 0 && (
                          <Card
                            className="w-full"
                            key={key}
                            title={key.toLocaleUpperCase()}
                            classNames={{ body: '!p-2' }}
                          >
                            <div className="flex flex-col gap-1">
                              {grouped[key].map((tool, index) => {
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
                          // <strong className="text-lg text-gray-500">
                          //   {key.toLocaleUpperCase()}
                          // </strong>
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
                {/* {tools
                  .filter((x) => x.type == selectedKey)
                  .map((tool) => {
                    return (
                      <Button
                        key={tool.name}
                        type="text"
                        className="flex flex-row justify-between items-center h-16"
                        onClick={() => {
                          onSelect(tool);
                        }}
                      >
                        <div className="flex overflow-hidden flex-col flex-1 justify-start items-start whitespace-nowrap text-ellipsis">
                          <strong>{tool.name}</strong>
                          {tool.id}
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
              </div>
            </ScrollArea>
          </div>
        </Space>
      </Modal>
    );
  },
);

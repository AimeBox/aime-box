import { memo, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import {
  Button,
  Card,
  Collapse,
  Form,
  Input,
  message,
  Popconfirm,
  Popover,
  Select,
  Space,
  Splitter,
  Tag,
} from 'antd';
import {
  FaCheck,
  FaEdit,
  FaPlus,
  FaSpinner,
  FaToggleOff,
  FaToggleOn,
  FaToolbox,
  FaTrash,
} from 'react-icons/fa';
import { McpServerInfo, ToolInfo } from '../../main/tools';
import List from '../components/common/List';
import FormModal, { FormModalRef } from '../components/modals/FormModal';
import {
  isArray,
  isBoolean,
  isNumber,
  isObject,
  isString,
} from '../../main/utils/is';
import { FormSchema } from '../../types/form';

import BasicForm from '../components/form/BasicForm';
import { Markdown } from '../components/common/Markdown';
// import { Popover, PopoverButton, PopoverPanel } from '@headlessui/react';
import { ResponseCard } from '@/renderer/components/common/ResponseCard';
import { ScrollArea } from '../components/ui/scroll-area';
import Content from '../components/layout/Content';
import { FaArrowRotateLeft, FaRegMessage } from 'react-icons/fa6';
import { t } from 'i18next';
import { ListItem } from '../components/common/ListItem';

export default function Tools() {
  const [open, setOpen] = useState(false);
  const [tools, setTools] = useState<ToolInfo[]>([]);
  const [invoking, isInvoking] = useState<boolean>(false);
  const toolSettingModalRef = useRef(null);
  const toolTestFormRef = useRef(null);
  const navigate = useNavigate();
  const location = useLocation();
  const [currentTool, setCurrentTool] = useState<ToolInfo | undefined>(
    undefined,
  );
  const [toolSettinSchemas, setToolSettinSchemas] = useState([]);
  const [toolInvokeSchemas, setToolInvokeSchemas] = useState<FormSchema[]>();
  const [invokeOutput, setInvokeOutput] = useState<string | string[]>();
  const [addButtonOpen, setAddButtonOpen] = useState(false);
  const [selectedFilterTag, setSelectedFilterTag] =
    useState<string>('built-in');
  const [mcpList, setMcpList] = useState<McpServerInfo[]>([]);
  const [currentMcp, setCurrentMcp] = useState<McpServerInfo | undefined>(
    undefined,
  );
  const addMcpModalRef = useRef<FormModalRef>(null);
  const mcpSchemas = [
    {
      label: 'Name',
      field: 'name',
      required: true,
      component: 'Input',
    },
    {
      label: 'Command',
      field: 'command',
      required: true,
      component: 'Input',
      helpMessage: (
        <div className="flex flex-col">
          <small>cmd /c npx ...</small>
          {/* <small>python -m</small> */}
        </div>
      ),
    },
    {
      label: 'Type',
      field: 'type',
      component: 'Select',
      required: true,
      defaultValue: 'stdio',
      componentProps: {
        options: [
          { value: 'stdio', label: 'stdio' },
          { value: 'sse', label: 'sse' },
          { value: 'ws', label: 'websocket' },
        ],
      },
    },
    {
      label: 'Config',
      field: 'config',
      required: false,
      component: 'InputTextArea',
    },
    {
      label: 'Env',
      field: 'env',
      required: false,
      component: 'InputTextArea',
    },
    {
      label: 'Enabled',
      field: 'enabled',
      component: 'Switch',
    },
  ] as FormSchema[];
  const [mcpLoading, setMcpLoading] = useState<boolean>(false);
  const onToolSettingSubmit = (values) => {
    console.log(values);
    const res = window.electron.tools.update(currentTool.name, values);
    getTools();

    toolSettingModalRef.current.openModal(false);
  };
  const onSearch = async (text: string) => {
    const res = await window.electron.tools.getList(text);
    setTools(res);
  };
  const onShowToolSetting = (tool: ToolInfo) => {
    console.log(tool);
    const toolSettinSchemas = [] as FormSchema[];
    if (tool.configSchema) {
      for (const schema of tool.configSchema) {
        if (Object.keys(tool.config ?? {}).includes(schema.field)) {
          schema.defaultValue = tool.config[schema.field];
        }

        toolSettinSchemas.push(schema);
      }
    }
    //  else {
    //   Object.keys(tool.parameters).forEach((p) => {
    //     if (isString(tool.parameters[p])) {
    //       toolSettinSchemas.push({
    //         label: p,
    //         field: p,
    //         component: 'Input',
    //       });
    //     }
    //     if (isNumber(tool.parameters[p])) {
    //       toolSettinSchemas.push({
    //         label: p,
    //         field: p,
    //         component: 'InputNumber',
    //       });
    //     }
    //     if (isBoolean(tool.parameters[p])) {
    //       toolSettinSchemas.push({
    //         label: p,
    //         field: p,
    //         component: 'Switch',
    //       });
    //     }
    //   });
    // }

    setToolSettinSchemas(toolSettinSchemas);
    setTimeout(() => {
      setCurrentTool(tool);
      toolSettingModalRef.current.openModal(true, tool.parameters);
    });
  };

  const invoke = async (toolName, value) => {
    console.log(toolName, value);

    // const _value = {};
    // Object.keys(value.value).forEach((key) => {
    //   if (isString(value.value[key])) {
    //     _value[key] = value.value[key].trim();
    //   } else if (isObject(value.value[key])) {
    //     _value[key] = JSON.stringify(value.value[key]);
    //   }
    // });
    // console.log(_value);
    let output: string | string[] = '';
    if (selectedFilterTag == 'built-in') {
      if (currentTool) {
        isInvoking(true);
        const res = await window.electron.tools.invoke(
          toolName,
          value,
          'markdown',
        );

        console.log(res);
        if (isString(res)) {
          output = res;
        } else if (isArray(res)) {
          output = res;
        } else {
          output = res?.toString() || '';
        }
      }
    } else if (selectedFilterTag == 'mcp') {
      if (currentMcp) {
        isInvoking(true);
        const res = await window.electron.tools.invoke(
          `${toolName}`,
          value,
          'markdown',
        );
        console.log(res);
        if (isString(res)) {
          output = res;
        } else if (isArray(res)) {
          output = res;
        }
      }
    }
    setInvokeOutput(output);
    isInvoking(false);
  };
  const toolInvokeHandle = (res: any) => {
    let output: string | string[] = '';
    console.log(res);
    if (isString(res)) {
      output = res;
    } else if (isArray(res)) {
      output = res;
    } else {
      output = res?.toString() || '';
    }
    setInvokeOutput(output);
    isInvoking(false);
  };

  const getTools = async () => {
    const res = await window.electron.tools.getList(undefined, 'built-in');
    console.log(res);
    setTools(res);
  };

  const getMcps = async () => {
    const res = await window.electron.tools.getMcpList();
    console.log(res);
    setMcpList(res);
  };

  useEffect(() => {
    getTools();
    window.electron.ipcRenderer.on('tools:invokeAsync', toolInvokeHandle);
    window.electron.ipcRenderer.on('tools:mcp-updated', (data) => {
      getMcps();
    });
    return () => {
      window.electron.ipcRenderer.removeAllListeners('tools:mcp-updated');
      window.electron.ipcRenderer.removeListener(
        'tools:invokeAsync',
        toolInvokeHandle,
      );
    };
  }, []);

  useEffect(() => {
    const searchParams = new URLSearchParams(location.search);
    const toolsId = searchParams.get('id');
    if (toolsId) {
      if (currentTool?.id == toolsId) {
        return;
      }
      const tool = tools.find((x) => x.name == toolsId);
      console.log(tool);
      if (!tool.is_toolkit) {
        setCurrentTool(tool);
        setToolInvokeSchemas(converFormSchemas(tool));
      } else {
        setCurrentTool(tool);
      }
    } else {
      setCurrentTool(undefined);
      setToolInvokeSchemas(undefined);
    }
    setInvokeOutput(undefined);
  }, [location]);

  const converFormSchemas = (tool: ToolInfo): FormSchema[] => {
    let c = [] as FormSchema[];
    let required = [];
    if (tool.schema.required) required = tool.schema.required;

    Object.keys(tool.schema.properties).forEach((x) => {
      if (tool.schema.properties[x].type) {
        if (
          tool.schema.properties[x].type == 'string' ||
          tool.schema.properties[x].type.includes('string')
        ) {
          if (Object.keys(tool.schema.properties[x]).includes('enum')) {
            c.push({
              field: x,
              label: x,
              required: required.includes(x),
              component: 'Select',
              subLabel: tool.schema.properties[x].description,
              defaultValue: tool.schema.properties[x].default,
              componentProps: {
                options: tool.schema.properties[x].enum.map((e) => {
                  return { label: e, value: e };
                }),
              },
            } as FormSchema);
          } else {
            c.push({
              field: x,
              label: x,
              required: required.includes(x),
              subLabel: tool.schema.properties[x].description,
              defaultValue: tool.schema.properties[x].default,
              component: 'InputTextArea',
            } as FormSchema);
          }
        } else if (tool.schema.properties[x].type == 'boolean') {
          c.push({
            field: x,
            label: x,
            required: required.includes(x),
            subLabel: tool.schema.properties[x].description,
            component: 'Switch',
            defaultValue: false,
          } as FormSchema);
        } else if (
          tool.schema.properties[x].type == 'array' &&
          tool.schema.properties[x].items.type == 'string'
        ) {
          c.push({
            field: x,
            label: x,
            required: required.includes(x),
            subLabel: tool.schema.properties[x].description,
            component: 'Select',
            defaultValue: false,
            componentProps: {
              mode: 'tags',
            },
          } as FormSchema);
        } else if (
          tool.schema.properties[x].type == 'number' ||
          tool.schema.properties[x].type == 'integer'
        ) {
          c.push({
            field: x,
            label: x,
            required: required.includes(x),
            subLabel: tool.schema.properties[x].description,
            component: 'InputNumber',
            defaultValue: tool.schema.properties[x].default,
            componentProps: {},
          } as FormSchema);
        } else if (tool.schema.properties[x].type == 'object') {
          c.push({
            field: x,
            label: x,
            required: required.includes(x),
            subLabel: tool.schema.properties[x].description,
            component: 'JsonEditor',
          } as FormSchema);
        }
      } else if (
        !tool.schema.properties[x].type &&
        tool.schema.properties[x].anyOf
      ) {
      }

      // c.properties[x] = {
      //   type: tool.schema[x].type,
      //   title: x,
      // };
    });
    return c;
  };

  const onOk = (data) => {
    debugger;
  };

  const onOpenAddMcp = (data: any = undefined) => {
    console.log(data);

    setAddButtonOpen(false);
    let _data;
    if (data) {
      _data = { ...data };
      setCurrentMcp(data);
      _data.config = Object.keys(data.config)
        .map((key) => {
          return `${key}=${data.config[key]}`;
        })
        .join('\n');
      if (data.env) {
        _data.env = Object.keys(data.env)
          .map((key) => {
            return `${key}=${data.env[key]}`;
          })
          .join('\n');
      }
    } else {
      setCurrentMcp(undefined);
    }
    addMcpModalRef.current.openModal(true, _data);
  };
  const onAddMcpSubmit = async (values) => {
    const config = {};
    const env = {};
    setMcpLoading(true);
    if (values.config) {
      values.config.split('\n').forEach((line) => {
        const [key, value] = line.split('=');
        config[key.trim()] = value.trim();
      });
    }
    if (values.env) {
      values.env.split('\n').forEach((line) => {
        const [key, value] = line.split('=');
        env[key.trim()] = value.trim();
      });
    }
    try {
      await window.electron.tools.addMcp({
        id: currentMcp?.id,
        ...values,
        config: { ...config },
        env: { ...env },
      });
      await getMcps();
      setCurrentMcp(undefined);
      addMcpModalRef.current.openModal(false);
    } catch (err) {
      message.error(err.message);
    } finally {
      setMcpLoading(false);
    }
  };
  const onRefreshMcp = async (item: McpServerInfo) => {
    try {
      const res = await window.electron.tools.refreshMcp(currentMcp?.id);
      if (res.status == 'activated') {
        await getMcps();
        message.success('Refresh MCP server success');
      }
    } catch (err) {
      message.error(err.message);
    }
  };

  const onDeleteMcp = async (item: McpServerInfo) => {
    try {
      await window.electron.tools.deleteMcp(item.id);
      await getMcps();
      setCurrentMcp(undefined);
      message.success('Delete MCP server success');
    } catch (err) {
      message.error(err.message);
    }
  };

  const renderMcpToolForm = useMemo(() => {
    return currentMcp?.tools.map((item, index) => {
      return {
        key: item.name,
        label: (
          <div className="flex flex-col">
            <strong>{item.name.split('@')[0]}</strong>
            <small>{item.description}</small>
          </div>
        ),

        children: (
          <BasicForm
            loading={invoking}
            ref={toolTestFormRef[item.name]}
            schemas={converFormSchemas(item)}
            layout="vertical"
            onFinish={async (value) => {
              await invoke(item.name, value);
            }}
          />
        ),
      };
    });
  }, [currentMcp?.tools]);

  const renderToolForm = useMemo(() => {
    if (!currentTool?.is_toolkit) return [];
    return currentTool?.tools.map((item, index) => {
      return {
        key: item.name,
        label: (
          <div className="flex flex-col">
            <strong>{item.name}</strong>
            <small>{item.description}</small>
          </div>
        ),

        children: (
          <BasicForm
            loading={invoking}
            ref={toolTestFormRef[item.name]}
            schemas={converFormSchemas(item)}
            layout="vertical"
            onFinish={async (value) => {
              await invoke(item.name, value);
            }}
          />
        ),
      };
    });
  }, [currentTool]);

  return (
    <Content>
      <FormModal
        title={t('tools.tool_config')}
        ref={toolSettingModalRef}
        schemas={toolSettinSchemas}
        formProps={{ layout: 'horizontal' }}
        onFinish={(values) => onToolSettingSubmit(values)}
        onCancel={() => {
          toolSettingModalRef.current.openModal(false);
        }}
      />
      <FormModal
        title={t('tools.addMcp')}
        ref={addMcpModalRef}
        schemas={mcpSchemas}
        maskClosable={false}
        confirmLoading={mcpLoading}
        formProps={{ layout: 'vertical' }}
        onFinish={(values) => onAddMcpSubmit(values)}
        onCancel={() => {
          addMcpModalRef.current.openModal(false);
        }}
      />
      <div className="flex flex-row w-full h-full">
        <List
          onSearch={onSearch}
          width={300}
          dataLength={tools.length}
          hasMore={false}
          filterTags={['built-in', 'mcp', 'custom']}
          selectedFilterTags={[selectedFilterTag]}
          onFilterTagsChange={(tags) => {
            setSelectedFilterTag(tags[0]);
            if (tags[0] == 'mcp') {
              getMcps();
            } else if (tags[0] == 'built-in') {
              getTools();
            } else {
              getTools();
            }
          }}
          addButton={
            <Popover
              placement="rightTop"
              trigger="click"
              open={addButtonOpen}
              onOpenChange={setAddButtonOpen}
              content={
                <div className="flex flex-col">
                  <Button
                    type="text"
                    block
                    onClick={() => {
                      onOpenAddMcp();
                    }}
                  >
                    {t('tools.addMcp')}
                  </Button>
                </div>
              }
            >
              <Button icon={<FaPlus />} className=""></Button>
            </Popover>
          }
        >
          {selectedFilterTag == 'built-in' && (
            <div className="flex flex-col gap-1">
              {tools.map((item, index) => {
                return (
                  <ListItem
                    active={currentTool?.name == item.name}
                    key={item.name}
                    title={
                      <div className="flex flex-row gap-1 items-center">
                        {item.is_toolkit ? <FaToolbox /> : null}
                        {item.name}
                      </div>
                    }
                    subTitle={<small>{item.description}</small>}
                    href={`/tools?id=${item.name}`}
                    // onClick={() => {
                    //   navigate(`/tools?id=${item.name}`);
                    // }}
                    button={
                      ((item.parameters &&
                        Object.keys(item.parameters).length > 0) ||
                        item?.configSchema?.length > 0) && (
                        <Button
                          type="text"
                          icon={<FaEdit />}
                          onClick={() => {
                            navigate(`/tools?id=${item.name}`);
                            onShowToolSetting(item);
                          }}
                        />
                      )
                    }
                  ></ListItem>
                );
              })}
            </div>
          )}
          {selectedFilterTag == 'mcp' && (
            <div className="flex flex-col gap-1">
              {mcpList.map((item, index) => {
                return (
                  <ListItem
                    active={currentMcp?.id == item.id}
                    key={item.name}
                    title={item.name}
                    subTitle={<small>{item.command}</small>}
                    onClick={() => {
                      setCurrentMcp(item);
                    }}
                    icon={
                      <>
                        {item.status == 'activated' && <FaToggleOn />}
                        {item.status == 'deactivated' && <FaToggleOff />}
                        {item.status == 'pending' && (
                          <FaSpinner className="animate-spin" />
                        )}
                      </>
                    }
                  ></ListItem>
                );
              })}
            </div>
          )}
        </List>
        <Splitter className="flex flex-row h-full">
          <Splitter.Panel min={360}>
            <div className="flex flex-row flex-1 p-4 w-full min-w-0 h-full">
              {selectedFilterTag == 'built-in' && (
                <ScrollArea className="flex-1">
                  {currentTool && (
                    <div className="flex flex-col flex-1 w-full">
                      <div className="flex justify-between items-start py-4 border-b border-gray-200">
                        <div className="ml-3 grow">
                          <div className="space-x-1 h-6 text-xl font-semibold">
                            {currentTool?.name}
                          </div>
                          <div className="mt-2 text-sm font-normal text-gray-500 whitespace-pre-wrap">
                            {currentTool?.description}
                          </div>
                          {currentTool?.officialLink && (
                            <div className="text-sm">
                              <a href={currentTool?.officialLink}>
                                {currentTool?.officialLink}
                              </a>
                            </div>
                          )}
                        </div>
                      </div>
                      <div className="flex flex-col p-4">
                        {currentTool.is_toolkit == false && (
                          <BasicForm
                            loading={invoking}
                            ref={toolTestFormRef}
                            schemas={toolInvokeSchemas}
                            layout="vertical"
                            onFinish={async (value) => {
                              invoke(value);
                            }}
                          />
                        )}
                        {currentTool.is_toolkit &&
                          currentTool.tools.length > 0 && (
                            <Collapse items={renderToolForm}></Collapse>
                          )}
                      </div>
                    </div>
                  )}
                </ScrollArea>
              )}
              {selectedFilterTag == 'mcp' && (
                <ScrollArea className="flex-1">
                  {currentMcp && (
                    <div className="flex flex-col flex-1 w-full">
                      <div className="flex justify-between items-start py-4 border-b border-gray-200">
                        <div className="ml-3 grow">
                          <div className="flex flex-row justify-between space-x-1 h-6 text-xl font-semibold">
                            <div className="flex flex-row gap-2 items-center">
                              {currentMcp?.name}
                              <Tag>{currentMcp?.version}</Tag>
                            </div>

                            <div className="flex flex-row flex-1 gap-2 justify-end mr-4">
                              <Button
                                type="text"
                                icon={<FaArrowRotateLeft />}
                                onClick={() => {
                                  onRefreshMcp(currentMcp);
                                }}
                              ></Button>
                              <Button
                                type="text"
                                icon={<FaEdit />}
                                onClick={() => {
                                  onOpenAddMcp(currentMcp);
                                }}
                              ></Button>
                              <Popconfirm
                                title="Are you sure to delete this tool?"
                                onConfirm={() => {
                                  onDeleteMcp(currentMcp);
                                }}
                              >
                                <Button
                                  type="text"
                                  icon={<FaTrash />}
                                  danger
                                ></Button>
                              </Popconfirm>
                            </div>
                          </div>
                          {currentMcp?.description && (
                            <small>{currentMcp?.description}</small>
                          )}
                          <div className="mt-2 text-sm font-normal text-gray-500 whitespace-pre-wrap">
                            {currentMcp?.command}
                          </div>
                        </div>
                      </div>
                      <div className="flex flex-col gap-2 p-4">
                        {currentMcp.tools.length > 0 && (
                          <Collapse items={renderMcpToolForm}></Collapse>
                        )}
                      </div>
                    </div>
                  )}
                </ScrollArea>
              )}
            </div>
          </Splitter.Panel>
          <Splitter.Panel min={360}>
            <ScrollArea className="w-full h-full" dir="ltr">
              <div
                className="flex flex-col h-full"
                style={{ wordBreak: 'break-all' }}
              >
                <div className="px-4 mt-4 w-full">
                  {isArray(invokeOutput) && (
                    <div>
                      {invokeOutput.map((item, index) => {
                        return <ResponseCard key={item} value={item} />;
                      })}
                    </div>
                  )}
                  {isString(invokeOutput) && (
                    <>
                      {/* <pre>{invokeOutput}</pre> */}
                      <ResponseCard value={invokeOutput} />
                    </>
                  )}
                </div>
              </div>
            </ScrollArea>
          </Splitter.Panel>
        </Splitter>
      </div>
    </Content>
  );
}

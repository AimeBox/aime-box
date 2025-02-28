import { useEffect, useRef, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Button, message } from 'antd';
import { FaEdit, FaPlus } from 'react-icons/fa';
import { ToolInfo } from '../../main/tools';
import List from '../components/common/List';
import FormModal from '../components/modals/FormModal';
import { isArray, isBoolean, isNumber, isString } from '../../main/utils/is';
import { FormSchema } from '../../types/form';

import BasicForm from '../components/form/BasicForm';
import { Markdown } from '../components/common/Markdown';
// import { Popover, PopoverButton, PopoverPanel } from '@headlessui/react';
import { ResponseCard } from '@/renderer/components/common/ResponseCard';
import { ScrollArea } from '../components/ui/scroll-area';
import Content from '../components/layout/Content';

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
  const onToolSettingSubmit = (values) => {
    const res = window.electron.tools.update({
      toolName: currentTool.name,
      arg: values,
    });
    setTools(window.electron.tools.getInfo());

    toolSettingModalRef.current.openModal(false);
  };
  const onSearch = (text: string) => {
    const res = window.electron.tools.getInfo(text);
    setTools(res);
  };
  const onShowToolSetting = (tool: ToolInfo) => {
    const toolSettinSchemas = [] as FormSchema[];
    Object.keys(tool.parameters).forEach((p) => {
      if (isString(tool.parameters[p])) {
        toolSettinSchemas.push({
          label: p,
          field: p,
          component: 'Input',
        });
      }
      if (isNumber(tool.parameters[p])) {
        toolSettinSchemas.push({
          label: p,
          field: p,
          component: 'InputNumber',
        });
      }
      if (isBoolean(tool.parameters[p])) {
        toolSettinSchemas.push({
          label: p,
          field: p,
          component: 'Switch',
        });
      }
    });
    setToolSettinSchemas(toolSettinSchemas);
    setTimeout(() => {
      setCurrentTool(tool);
      toolSettingModalRef.current.openModal(true, tool.parameters);
    });
  };

  const invoke = async (value) => {
    console.log(value);
    if (currentTool) {
      isInvoking(true);
      const res = await window.electron.tools.invoke(
        currentTool.name,
        value,
        'markdown',
      );
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
    }
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

  useEffect(() => {
    const res = window.electron.tools.getInfo();
    setTools(res);
    window.electron.ipcRenderer.on('tools:invokeAsync', toolInvokeHandle);
    return () => {
      window.electron.ipcRenderer.removeListener(
        'tools:invokeAsync',
        toolInvokeHandle,
      );
    };
    // toolTestFormRef.current?.updateSchema({
    //   field: 'filed',
    //   componentProps: { disabled: true },
    // });
  }, []);

  useEffect(() => {
    const searchParams = new URLSearchParams(location.search);
    const toolsId = searchParams.get('id');
    if (toolsId) {
      const tool = tools.find((x) => x.name == toolsId);
      console.log(tool);
      setCurrentTool(tool);
      let c = [] as FormSchema[];
      let required = [];
      if (tool.schema.required) required = tool.schema.required;
      console.log(tool.schema.properties);
      Object.keys(tool.schema.properties).forEach((x) => {
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
        } else if (tool.schema.properties[x].type == 'number') {
          c.push({
            field: x,
            label: x,
            required: required.includes(x),
            subLabel: tool.schema.properties[x].description,
            component: 'InputNumber',
            defaultValue: tool.schema.properties[x].default,
            componentProps: {},
          } as FormSchema);
        }
        // c.properties[x] = {
        //   type: tool.schema[x].type,
        //   title: x,
        // };
      });
      setToolInvokeSchemas(c);
    } else {
      setCurrentTool(undefined);
      setToolInvokeSchemas(undefined);
    }
    setInvokeOutput(undefined);
  }, [location]);

  const onOk = (data) => {
    debugger;
  };
  const onNewTool = () => {};
  return (
    <Content>
      <FormModal
        title={'Tool Setting'}
        ref={toolSettingModalRef}
        schemas={toolSettinSchemas}
        formProps={{ layout: 'horizontal' }}
        onFinish={(values) => onToolSettingSubmit(values)}
        onCancel={() => {
          toolSettingModalRef.current.openModal(false);
        }}
      />
      <div className="flex flex-row w-full h-full">
        <List
          onSearch={onSearch}
          width={250}
          dataLength={tools.length}
          hasMore={false}
        >
          <div className="flex flex-col gap-1">
            {tools.map((item, index) => {
              return (
                <div className="relative pr-4" key={item.name}>
                  <Link
                    className={`flex flex-row justify-between px-3 py-2 transition rounded-xl dark:hover:bg-gray-900 hover:bg-gray-200   whitespace-nowrap text-ellipsis ${
                      currentTool && currentTool.name === item.name
                        ? 'dark:bg-gray-900 bg-blue-100 text-blue-600'
                        : ''
                    }`}
                    to={`/tools?id=${item.name}`}
                  >
                    <div className="flex flex-1 justify-between self-center w-full">
                      <div className={`overflow-hidden self-center text-left`}>
                        <div className="flex flex-col">
                          <div className="font-bold whitespace-normal line-clamp-1">
                            {item.name}
                          </div>
                          <small className="text-gray-400 whitespace-normal line-clamp-1">
                            {item.description}
                          </small>
                        </div>
                      </div>
                      {item.parameters && (
                        <div className="">
                          <div className="flex self-center space-x-1.5">
                            <button
                              className="self-center transition dark:hover:text-white"
                              type="button"
                              onClick={(e) => {
                                navigate(`/tools?id=${item.name}`);
                                onShowToolSetting(item);
                              }}
                            >
                              <FaEdit className="w-4 h-4" />{' '}
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  </Link>
                </div>
              );
            })}
          </div>
        </List>
        <div className="flex flex-row flex-1 p-4 w-full min-w-0 h-full">
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
                  <BasicForm
                    loading={invoking}
                    ref={toolTestFormRef}
                    schemas={toolInvokeSchemas}
                    layout="vertical"
                    onFinish={async (value) => {
                      invoke(value);
                    }}
                  />

                  {/* <Form
                  schema={toolInvokeSchemas}
                  validator={validator}
                  onSubmit={onOk}
                  className="dark:text-gray-200"
                  // style={{ color: 'rgb(229 231 235 / var(--tw-text-opacity))' }}
                /> */}
                  {/* <Button onClick={invoke}>invoke</Button> */}
                </div>
              </div>
            )}
          </ScrollArea>
          <ScrollArea
            className="w-[400px] ml-2 border border-gray-200 rounded-2xl"
            dir="ltr"
          >
            <div className="flex flex-col h-full">
              <div className="px-4 mt-4 w-full">
                {isArray(invokeOutput) && (
                  <div>
                    {invokeOutput.map((item, index) => {
                      return <ResponseCard value={item} />;
                    })}
                  </div>
                )}
                {isString(invokeOutput) && (
                  <>
                    <pre>{invokeOutput}</pre>
                    {/* <ResponseCard value={invokeOutput} /> */}
                  </>
                )}
              </div>
            </div>
          </ScrollArea>
        </div>
      </div>
    </Content>
  );
}

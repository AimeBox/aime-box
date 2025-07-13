import {
  FaClipboard,
  FaCross,
  FaEdit,
  FaRedo,
  FaReply,
  FaSave,
  FaTrashAlt,
  FaUser,
} from 'react-icons/fa';
import {
  message,
  Button,
  Alert,
  Modal,
  Form,
  Input,
  InputNumber,
  Select,
  Slider,
  Space,
  Radio,
  Checkbox,
} from 'antd';
import React, { useEffect, useState } from 'react';
import { FaGear } from 'react-icons/fa6';
import TextArea from 'antd/es/input/TextArea';
import { Chat, ChatOptions } from '../../../entity/Chat';

// interface ChatOptionConfig {
//   system: string | undefined;
//   temperature: number | undefined;
//   top_k: number | undefined;
//   top_p: number | undefined;
//   history: Array<{ role: string; content: string }> | undefined;
// }

interface ChatOptionProps {
  chatId?: string | undefined;
  open?: boolean;
  onCancel?: (e: React.MouseEvent<HTMLButtonElement>) => void;
  onOk?: (value: ChatOptions) => void;
  value: ChatOptions | undefined;
  onChange: (value: ChatOptions | undefined) => void;
}

const ChatOption = React.forwardRef(
  (
    { chatId, value, onChange, open = false, onCancel, onOk }: ChatOptionProps,
    ref: React.ForwardedRef,
  ) => {
    const [form] = Form.useForm<ChatOptions>();
    const [kbList, setKbList] = useState([]);
    const [toolList, setToolList] = useState([]);

    async function onSumbit() {
      try {
        const values = await form.validateFields();
        if (onOk) onOk(values);
      } catch (error) {
        // message.error(error.errorFields[0].errors[0]);
      }
    }
    const onOpenChange = async (_open: Boolean) => {
      if (_open) {
        if (chatId) {
          const res = window.electron.db.get<Chat>('chat', chatId);
          if (res.options) {
            form.setFieldsValue(res.options);
          } else {
            form.resetFields();
          }
        }
        const kbList = window.electron.db.getMany('knowledgebase', {});
        setKbList(kbList);
        const toolList = await window.electron.tools.getList();
        setToolList(toolList);
      } else {
        if (chatId) {
          form.resetFields();
        }
      }
    };
    useEffect(() => {}, []);
    return (
      <Modal
        title="ChatOption"
        open={open}
        onCancel={onCancel}
        onOk={() => onSumbit()}
        maskClosable={false}
        afterOpenChange={(_open) => {
          onOpenChange(_open);
        }}
      >
        <div className="flex flex-row">
          <Form form={form} layout="vertical" className="w-full">
            <Form.Item label="System Prompt" name="system">
              <TextArea />
            </Form.Item>
            <Form.Item label="History">
              <Form.List name="history">
                {(fields, { add, remove }) => (
                  <div className="flex flex-col gap-2">
                    {fields.map((field, index) => (
                      <div
                        className="flex flex-row gap-2 align-start"
                        key={field.key}
                      >
                        <Form.Item
                          name={[field.name, 'role']}
                          rules={[{ required: true, message: 'Role is null' }]}
                        >
                          <Select
                            allowClear
                            className="!w-[100px]"
                            options={[
                              { value: 'user', label: <span>User</span> },
                              {
                                value: 'assistant',
                                label: <span>Assistant</span>,
                              },
                            ]}
                          />
                        </Form.Item>
                        <div className="w-full">
                          <Form.Item
                            name={[field.name, 'content']}
                            rules={[
                              {
                                required: true,
                                message: 'Content is null',
                              },
                            ]}
                          >
                            <TextArea
                              className="w-full"
                              autoSize={{ minRows: 1, maxRows: 6 }}
                            />
                          </Form.Item>
                        </div>
                        <button
                          className="h-fit"
                          type="button"
                          onClick={() => {
                            remove(index);
                          }}
                        >
                          <FaTrashAlt />
                        </button>
                      </div>
                    ))}
                    <Button
                      className="mt-3"
                      type="dashed"
                      onClick={() => add()}
                      block
                    >
                      + Add Item
                    </Button>
                  </div>
                )}
              </Form.List>
            </Form.Item>
            <Form.Item label="Temperature" name="temperature">
              <Slider defaultValue={0.8} min={0.0} max={1.0} step={0.05} />
            </Form.Item>
            <Form.Item label="Top K" name="top_k">
              <Slider defaultValue={40} min={0} max={100} step={1} />
            </Form.Item>
            <Form.Item label="Top P" name="top_p">
              <Slider defaultValue={0.9} min={0} max={1} step={0.05} />
            </Form.Item>
            <Form.Item label="Max Tokens" name="maxTokens">
              <Slider defaultValue={4096} min={1} max={128000} step={1} />
            </Form.Item>
            <Form.Item name="allwaysClear" valuePropName="checked">
              <Checkbox>Allways Clear History</Checkbox>
            </Form.Item>
            <Form.Item name="stop" label="Stop">
              <Select mode="tags" style={{ width: '100%' }} allowClear />
            </Form.Item>
            <Form.Item name="agentName" label="Agent">
              <Select
                style={{ width: '100%' }}
                allowClear
                options={[
                  { value: 'react', label: 'ReAct' },
                  { value: 'rag', label: 'Rag' },
                  { value: 'rewoo', label: 'ReWOO' },
                  { value: 'plan_execute', label: 'PlanExecute' },
                  { value: 'storm', label: 'Storm' },
                  { value: 'extract', label: 'Extract' },
                  { value: 'tool_calling', label: 'ToolCalling' },
                ]}
              ></Select>
            </Form.Item>
            <Form.Item name="kbList" label="Knowledge Base">
              <Select
                style={{ width: '100%' }}
                mode="tags"
                allowClear
                options={kbList.map((x) => {
                  return { value: x.id, label: x.name };
                })}
              ></Select>
            </Form.Item>
            <Form.Item name="toolNames" label="Tools">
              <Select
                style={{ width: '100%' }}
                mode="tags"
                allowClear
                options={toolList.map((x) => {
                  return { value: x.name, label: x.name };
                })}
              ></Select>
            </Form.Item>
          </Form>
        </div>
      </Modal>
    );
  },
);
export default ChatOption;

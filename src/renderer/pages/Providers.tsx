import {
  Form,
  FormProps,
  Input,
  Modal,
  Popconfirm,
  Switch,
  Tag,
  message,
  Spin,
  Select,
  Typography,
  Radio,
  Space,
  Button,
  Divider,
  InputNumber,
} from 'antd';
import { useEffect, useState } from 'react';
import {
  FaPlus,
  FaEdit,
  FaTrashAlt,
  FaServer,
  FaDatabase,
  FaMoneyBill,
  FaMoneyCheck,
  FaAngleUp,
  FaAngleDown,
} from 'react-icons/fa';
import { LineChartOutlined, LoadingOutlined } from '@ant-design/icons';

import { Providers, ProviderType } from '../../entity/Providers';
import { t } from 'i18next';
import ProviderIcon from '../components/common/ProviderIcon';
import { ScrollArea } from '../components/ui/scroll-area';
import Content from '../components/layout/Content';
import { ProviderInfo } from '@/main/providers';

export default function Connections() {
  const [open, setOpen] = useState(false);
  const [openModels, setOpenModels] = useState(false);
  const [currentData, setCurrentData] = useState<Providers>(null);
  const [loading, setLoading] = useState(false);
  // const { getAllModels } = useConnection();
  const [providers, setProviders] = useState<ProviderInfo[]>([]);
  const [providerTypes, setProviderTypes] = useState<
    { key: string; value: string; icon: string }[]
  >([]);
  const [models, setModels] = useState<[{ name: string; enable: boolean }]>([]);
  const [messageApi, contextHolder] = message.useMessage();
  const [form] = Form.useForm();
  const [formModels] = Form.useForm();
  const formModelsValue = Form.useWatch('models', formModels);
  const formTypeValue = Form.useWatch('type', form);
  const getData = async () => {
    try {
      setLoading(true);
      const providerTypes = await window.electron.providers.getProviderType();
      setProviderTypes(providerTypes);

      const res = await window.electron.providers.getList();
      console.log(res);
      setProviders(res);
    } catch {
    } finally {
      setLoading(false);
    }
  };

  const onCheck = async () => {
    try {
      const values = (await form.validateFields()) as Providers;
      if (currentData) values.id = currentData.id;
      await window.electron.providers.createOrUpdate(values);
      await getData();
      setOpen(false);
      messageApi.open({
        type: 'success',
        content: 'success',
      });
    } catch (errorInfo) {
      messageApi.open({
        type: 'error',
        content: errorInfo.message,
      });
    }
  };
  const onCreate = async () => {
    setCurrentData(null);
    form.resetFields();
    setOpen(true);
  };
  const onEdit = async (data: Providers) => {
    setCurrentData(data);
    form.resetFields();
    form.setFieldsValue(data);
    setOpen(true);
  };
  const onDelete = async (data: Providers) => {
    await window.electron.providers.delete(data.id);
    messageApi.open({
      type: 'success',
      content: 'success',
    });
    await getData();
  };
  const onChange = (changedFields, allFields) => {
    if (changedFields[0].name[0] === 'type') {
      if (changedFields[0].value === 'openai') {
        form.setFieldsValue({
          api_base: 'https://api.openai.com/v1',
          api_key: 'NULL',
        });
      } else if (changedFields[0].value === 'ollama') {
        form.setFieldsValue({
          api_base: 'http://127.0.0.1:11434',
          api_key: 'NULL',
        });
      } else if (changedFields[0].value === 'tongyi') {
        form.setFieldsValue({
          api_base: null,
          api_key: 'NULL',
        });
      } else if (changedFields[0].value === 'zhipu') {
        form.setFieldsValue({
          api_base: null,
          api_key: 'NULL',
        });
      } else if (changedFields[0].value === 'groq') {
        form.setFieldsValue({
          api_base: 'https://api.groq.com',
          api_key: 'NULL',
        });
      } else if (changedFields[0].value === 'anthropic') {
        form.setFieldsValue({
          api_base: 'https://api.anthropic.com',
          api_key: 'NULL',
        });
      } else if (changedFields[0].value === 'google') {
        form.setFieldsValue({
          api_base: 'https://generativelanguage.googleapis.com',
          api_key: 'NULL',
        });
      } else if (changedFields[0].value === 'openrouter') {
        form.setFieldsValue({
          api_base: 'https://openrouter.ai/api/v1',
          api_key: 'NULL',
        });
      } else if (changedFields[0].value === 'siliconflow') {
        form.setFieldsValue({
          api_base: 'https://api.siliconflow.cn/v1',
          api_key: 'NULL',
        });
      } else if (changedFields[0].value === 'deepseek') {
        form.setFieldsValue({
          api_base: 'https://api.deepseek.com',
          api_key: 'NULL',
        });
      } else if (changedFields[0].value === 'togetherai') {
        form.setFieldsValue({
          api_base: 'https://api.together.xyz/v1',
          api_key: 'NULL',
        });
      } else if (changedFields[0].value === 'baidu') {
        form.setFieldsValue({
          api_base: 'https://qianfan.baidubce.com/v2',
          api_key: 'NULL',
        });
      } else if (changedFields[0].value === 'lmstudio') {
        form.setFieldsValue({
          api_base: 'http://localhost:1234/v1',
          api_key: 'NULL',
        });
      } else if (changedFields[0].value === 'azure_openai') {
        form.setFieldsValue({
          api_base: 'https://<instance-name>.cognitiveservices.azure.com',
          api_key: 'NULL',
          config: {
            apiVersion: '2024-10-21',
          },
        });
      } else if (changedFields[0].value === 'minimax') {
        form.setFieldsValue({
          api_base: 'https://api.minimaxi.com/v1',
          api_key: 'NULL',
          config: {
            groupId: '',
          },
        });
      } else if (changedFields[0].value === 'replicate') {
        form.setFieldsValue({
          api_base: 'https://api.replicate.com/v1',
          api_key: 'NULL',
        });
      } else if (changedFields[0].value === 'volcanoengine') {
        form.setFieldsValue({
          api_base: 'https://ark.cn-beijing.volces.com/api/v3',
          api_key: 'NULL',
        });
      }
    }
  };
  const onManagerModel = async (data: Providers) => {
    messageApi.loading({
      type: 'loading',
      content: 'loading...',
      duration: 0,
    });
    try {
      const models = await window.electron.providers.getModels(data.id);
      setModels(models);
      console.log(models);
      setCurrentData(data);
      if (models.length > 0) {
        formModels.resetFields();
        formModels.setFieldsValue({ models: models });
        setOpenModels(true);
      }
    } finally {
      messageApi.destroy();
    }
  };
  const onSubmitModels = async (data: Providers) => {
    const models = formModels.getFieldValue('models');
    console.log(models);
    data.models = models;
    await window.electron.providers.createOrUpdate(data);
    setOpenModels(false);
  };

  const onSearch = (value: string) => {
    formModels.resetFields();
    if (!value) formModels.setFieldsValue({ models: models });
    else {
      const filteredModels = models.filter((model) =>
        model.name.toLowerCase().includes(value.toLowerCase()),
      );
      formModels.setFieldsValue({ models: filteredModels });
    }
  };

  useEffect(() => {
    getData();
  }, []);

  return (
    <>
      {contextHolder}
      <Content>
        <ScrollArea className="w-full h-full">
          <div className="flex flex-col justify-between w-full">
            <div className="px-3 mx-auto my-10 w-full max-w-2xl md:px-0">
              <div className="mb-6">
                <div className="flex justify-between items-center">
                  <div className="self-center text-2xl font-semibold">
                    {t('Providers')}
                  </div>
                  <Button onClick={() => onCreate()} shape="round">
                    {t('add')}
                  </Button>
                </div>
              </div>
              <hr className="dark:border-gray-700 my-2.5" />
              <div className="my-3 mb-5">
                {loading ? (
                  <Spin
                    indicator={
                      <LoadingOutlined style={{ fontSize: 24 }} spin />
                    }
                  />
                ) : (
                  <>
                    {providers.map((value, index) => {
                      return (
                        <li
                          className="flex items-center px-3 py-2 space-x-4 w-full text-left rounded-xl cursor-pointer dark:hover:bg-white/5 hover:bg-black/5"
                          key={value.id}
                        >
                          <div className="flex overflow-hidden justify-center items-center h-10 rounded-xl min-w-10">
                            <ProviderIcon
                              provider={value.type}
                              size={36}
                              className="h-full rounded-xl"
                            />
                          </div>
                          <div className="flex-1 self-center">
                            <span className="font-bold line-clamp-1">
                              {value.name}
                            </span>

                            <span className="overflow-hidden text-xs text-ellipsis line-clamp-1">
                              {value.api_base}
                            </span>
                            {value.credits && (
                              <span className="text-xs text-gray-500">
                                ${value.credits.remainingCredits.toFixed(2)}
                              </span>
                            )}
                          </div>
                          <div className="flex flex-row self-center space-x-1">
                            <Button
                              icon={<FaDatabase />}
                              shape="round"
                              type="text"
                              onClick={() => onManagerModel(value)}
                            >
                              {t('providers.manager_model')}
                            </Button>
                            <Button
                              icon={<FaEdit />}
                              shape="round"
                              type="text"
                              onClick={() => onEdit(value)}
                            ></Button>
                            <Popconfirm
                              title="Delete the item?"
                              onConfirm={() => onDelete(value)}
                              okText="Yes"
                              cancelText="No"
                            >
                              <Button
                                icon={<FaTrashAlt />}
                                shape="round"
                                type="text"
                              ></Button>
                            </Popconfirm>
                          </div>
                        </li>
                      );
                    })}
                  </>
                )}
              </div>
            </div>
          </div>
        </ScrollArea>
      </Content>

      <Modal
        title="Add Connection"
        open={open}
        maskClosable={false}
        onOk={() => onCheck()}
        onCancel={() => setOpen(false)}
      >
        <Form
          form={form}
          name="Add Connection"
          layout="vertical"
          // labelCol={{ span: 4 }}
          // wrapperCol={{ span: 20 }}
          style={{ maxWidth: 600 }}
          initialValues={{
            type: 'openai',
            api_base: 'https://api.openai.com/v1',
          }}
          autoComplete="off"
          onFieldsChange={(changedFields, allFields) => {
            onChange(changedFields, allFields);
          }}
        >
          <Form.Item<Providers>
            label="Name"
            name="name"
            rules={[{ required: true, message: 'Please input your Name!' }]}
          >
            <Input />
          </Form.Item>
          {!currentData && (
            <Form.Item<Providers> label="Type" name="type">
              <Radio.Group
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 8,
                }}
                // value={selected}
                // onChange={setSelected}
                aria-label="Server size"
                options={providerTypes.map((item) => {
                  return {
                    value: item.value,
                    label: (
                      <div className="flex gap-2 justify-center items-center">
                        <ProviderIcon
                          provider={item.value}
                          className="rounded-lg"
                        />
                        {item.key}
                      </div>
                    ),
                  };
                })}
              />
            </Form.Item>
          )}
          <Form.Item<Providers>
            label="API Base URL"
            name="api_base"
            rules={[{ message: 'Please input your API Base URL!' }]}
          >
            <Input />
          </Form.Item>
          <Form.Item<Providers> label="API Key">
            <Space.Compact style={{ width: '100%' }}>
              <Form.Item<Providers>
                name="api_key"
                style={{ width: '100%' }}
                rules={[
                  { required: true, message: 'Please input your API Key!' },
                ]}
              >
                <Input.Password />
              </Form.Item>
            </Space.Compact>
          </Form.Item>
          {(formTypeValue === 'azure_openai' ||
            form.getFieldValue('type') === 'azure_openai') && (
            <Form.Item<Providers>
              label="API Version"
              required
              name={['config', 'apiVersion']}
            >
              <Input />
            </Form.Item>
          )}
          {(formTypeValue === 'minimax' ||
            form.getFieldValue('type') === 'minimax') && (
            <Form.Item<Providers>
              label="Group ID"
              required
              name={['config', 'groupId']}
            >
              <Input />
            </Form.Item>
          )}
        </Form>
      </Modal>
      <Modal
        title="Models"
        open={openModels}
        maskClosable={false}
        onOk={() => onSubmitModels(currentData)}
        onCancel={() => setOpenModels(false)}
      >
        <div className="flex gap-2 justify-start items-center mb-3">
          <ProviderIcon provider={currentData?.type} size={48} />
          <div>
            <div className="text-lg font-semibold">{currentData?.name}</div>
            <small>{currentData?.api_base}</small>
          </div>
        </div>
        <Input
          placeholder="Search"
          onChange={(e) => {
            onSearch(e.target.value);
          }}
          allowClear
        />
        <div className="mt-2"></div>
        <Form
          form={formModels}
          layout="vertical"
          // labelCol={{ span: 4 }}
          // wrapperCol={{ span: 20 }}
          style={{ maxWidth: 600 }}
          initialValues={{
            models: [],
          }}
          autoComplete="off"
          onFieldsChange={(changedFields, allFields) => {
            onChange(changedFields, allFields);
          }}
        >
          {currentData && (
            <Form.Item<Providers>>
              <Form.List name="models">
                {(fields, { add, remove }, { errors }) => (
                  <>
                    {fields.map((field, index) => (
                      <div className="flex flex-col mb-2" key={field.key}>
                        <div className="flex flex-row justify-between group">
                          <Form.Item
                            noStyle
                            //name={[field.name, 'name']}
                            shouldUpdate
                          >
                            <div>
                              <div className="font-bold">
                                {
                                  formModels.getFieldValue('models')[field.name]
                                    .name
                                }
                              </div>
                            </div>
                          </Form.Item>

                          <Form.Item
                            noStyle
                            name={[field.name, 'enable']}
                            valuePropName="checked"
                          >
                            <Switch />
                          </Form.Item>
                        </div>
                      </div>
                    ))}
                  </>
                )}
              </Form.List>
            </Form.Item>
          )}
        </Form>
      </Modal>
    </>
  );
}

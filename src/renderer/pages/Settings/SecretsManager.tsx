import FormModal, {
  FormModalRef,
} from '@/renderer/components/modals/FormModal';
import { FormSchema } from '@/types/form';
import {
  Button,
  Form,
  FormInstance,
  Input,
  InputRef,
  message,
  Popconfirm,
  Switch,
  Table,
  TableProps,
  Tag,
  Typography,
} from 'antd';
import { t } from 'i18next';
import React, { useRef, useState, useEffect, useContext } from 'react';
import {
  FaDatabase,
  FaTrashAlt,
  FaSync,
  FaEdit,
  FaPlay,
  FaStop,
  FaSave,
  FaTimes,
} from 'react-icons/fa';
import { InstanceInfo } from '@/main/instances';
import { transformFlatObjectToNested } from '@/renderer/utils/common';
import { FaEdge } from 'react-icons/fa6';
import { Secrets } from '@/entity/Secrets';
import { v4 as uuidv4 } from 'uuid';
import { ScrollArea } from '@/renderer/components/ui/scroll-area';
import './SecretsManager.css';
import { set } from 'zod/v4';

const EditableContext = React.createContext<FormInstance<Secrets> | null>(null);

interface EditableRowProps {
  index: number;
}

interface EditableCellProps {
  title: React.ReactNode;
  editing: boolean;
  dataIndex: keyof Secrets;
  record: Secrets;
  handleSave?: (record: Secrets) => void;
  handleClick?: (record: Secrets) => void;
}

// eslint-disable-next-line react/function-component-definition
const EditableRow: React.FC<EditableRowProps> = ({ index, ...props }) => {
  const [form] = Form.useForm();
  return (
    <Form form={form} component={false}>
      <EditableContext.Provider value={form}>
        <tr {...props} />
      </EditableContext.Provider>
    </Form>
  );
};

// eslint-disable-next-line react/function-component-definition
const EditableCell: React.FC<React.PropsWithChildren<EditableCellProps>> = ({
  title,
  editing,
  children,
  dataIndex,
  record,
  handleSave,
  handleClick,
  ...restProps
}) => {
  // const [editing, setEditing] = useState(false);
  // const inputRef = useRef<InputRef>(null);
  // const form = useContext(EditableContext)!;

  // useEffect(() => {
  //   // if (editing && dataIndex == 'key') {
  //   //   inputRef.current?.focus();
  //   // }
  //   inputRef.current?.focus();
  // }, [editing]);

  // const toggleEdit = () => {
  //   setEditing(!editing);
  //   //inputRef.current?.focus();
  //   form.setFieldsValue({ [dataIndex]: record[dataIndex] });
  // };

  // const save = async () => {
  //   try {
  //     const values = await form.validateFields();

  //     toggleEdit();
  //     handleSave({ ...record, ...values });
  //   } catch (errInfo) {
  //     console.log('Save failed:', errInfo);
  //   }
  // };

  const getDisplayValue = () => {
    if (dataIndex == 'value') {
      if (!record[dataIndex]) {
        return undefined;
      } else if (record[dataIndex].length > 6) {
        return `${record[dataIndex].slice(0, 2)}****${record[dataIndex].slice(-2)}`;
      } else if (record[dataIndex].length <= 6) {
        return `****`;
      }
    }
    return record[dataIndex];
  };

  return (
    <td {...restProps}>
      {editing ? (
        <Form.Item
          style={{ margin: 0 }}
          name={dataIndex}
          rules={[
            {
              required: dataIndex == 'key' || dataIndex == 'value',
              message: `${title} is required.`,
            },
          ]}
        >
          {dataIndex == 'value' && (
            <Input.Password
              //ref={inputRef}
              onPressEnter={() => handleSave?.(record)}
              onBlur={() => handleSave?.(record)}
            />
          )}
          {dataIndex != 'value' && (
            <Input
              //ref={inputRef}
              onPressEnter={() => handleSave?.(record)}
              onBlur={() => handleSave?.(record)}
              autoFocus={dataIndex == 'key'}
            />
          )}
        </Form.Item>
      ) : (
        <div
          className={`${!dataIndex ? 'editable-cell-operation' : 'editable-cell-value-wrap'}  whitespace-nowrap overflow-hidden`}
          style={{ paddingInlineEnd: 24, height: 32, borderRadius: 6 }}
          onClick={() => handleClick?.(record)}
        >
          {dataIndex && dataIndex != 'value' && record[dataIndex]}
          {dataIndex && dataIndex == 'value' && getDisplayValue()}
          {!dataIndex && children}
        </div>
      )}
    </td>
  );
};

export default function SecretsManager() {
  const [messageApi, contextHolder] = message.useMessage();
  const [dataSource, setDataSource] = useState<Secrets[]>([]);
  const [editingKey, setEditingKey] = useState<string | null>(null);
  const [form] = Form.useForm();

  type ColumnTypes = Exclude<TableProps<Secrets>['columns'], undefined>;

  const getData = async () => {
    const data = await window.electron.db.getMany('secrets', {});
    console.log(data);
    setDataSource(data as Secrets[]);
  };

  useEffect(() => {
    getData();
  }, []);

  const components = {
    body: {
      //row: EditableRow,
      cell: EditableCell,
    },
  };
  const isEditing = (record: Secrets) => record.id === editingKey;

  const handleDelete = async (id: string) => {
    await window.electron.db.delete('secrets', { id: id });
    const newData = dataSource.filter((item) => item.id !== id);
    setDataSource(newData);
  };

  const handleSave = async (row: Secrets) => {
    console.log(row);

    try {
      const values = await form.validateFields();
      console.log(values);
      const data = await window.electron.db.get('secrets', editingKey);
      if (data) {
        await window.electron.db.update('secrets', values, {
          id: editingKey,
        });
      } else {
        await window.electron.db.insert('secrets', {
          ...values,
          id: editingKey,
        });
      }

      await getData();
    } catch (error) {
      console.error(error);
      return;
    }
    setEditingKey(null);
  };

  const handleAdd = () => {
    const newData: Secrets = {
      id: uuidv4(),
      key: '',
      value: '',
      description: '',
    };
    form.setFieldsValue({ ...newData });

    setEditingKey(newData.id);
    setDataSource([...dataSource, newData]);
    // setCount(count + 1);
  };

  const handleEdit = (record: Partial<Secrets> & { key: React.Key }) => {
    form.setFieldsValue({ ...record });
    setEditingKey(record.id);
  };

  const handleCancel = async () => {
    form.resetFields();
    await getData();
    setEditingKey(null);
  };

  const handleClick = async (record: Partial<Secrets>) => {
    console.log('click', record);
    if (record.id != editingKey && editingKey) {
      return;
      try {
        const values = await form.validateFields();
        await handleSave({ id: editingKey, ...values });
        setEditingKey(null);
        return;
      } catch (error) {
        return;
      }
    }
    form.setFieldsValue({ ...record });
    setEditingKey(record.id);
  };

  const defaultColumns: (ColumnTypes[number] & {
    editable?: boolean;
    dataIndex: string;
  })[] = [
    {
      title: 'key',
      dataIndex: 'key',
      width: '200px',
      editable: true,
    },
    {
      title: 'value',
      dataIndex: 'value',
      width: '300px',
      editable: true,
    },
    {
      title: 'description',
      dataIndex: 'description',
      editable: true,
    },
    {
      width: '150px',
      dataIndex: 'operation',
      align: 'center',
      fixed: 'right',
      render: (_: any, record: Secrets) => {
        const editable = isEditing(record);
        return editable ? (
          <div className="flex flex-row gap-2 w-full items-center justify-center">
            <Button
              size="small"
              shape="round"
              type="text"
              onClick={() => handleSave(record)}
              icon={<FaSave />}
            ></Button>
            <Popconfirm title="Sure to cancel?" onConfirm={handleCancel}>
              <Button
                size="small"
                icon={<FaTimes />}
                shape="round"
                type="text"
              ></Button>
            </Popconfirm>
          </div>
        ) : (
          <div className="flex flex-row gap-2 w-full items-center justify-center">
            {/* <Button
              size="small"
              shape="round"
              type="text"
              disabled={editingKey !== null}
              onClick={() => handleEdit(record)}
              icon={<FaEdit />}
            ></Button> */}
            <Popconfirm
              title="Sure to delete?"
              onConfirm={() => handleDelete(record.id)}
              okText="Delete"
              okButtonProps={{
                danger: true,
              }}
              cancelText="Cancel"
            >
              <Button
                size="small"
                shape="round"
                type="text"
                danger
                disabled={editingKey !== null}
                icon={<FaTrashAlt />}
              ></Button>
            </Popconfirm>
          </div>
        );
      },
    },
  ];

  const columns = defaultColumns.map((col) => {
    if (!col.editable) {
      return col;
    }
    return {
      ...col,
      onCell: (record: Secrets) => ({
        record,
        editing: isEditing(record),
        dataIndex: col.dataIndex,
        title: col.title,
        //handleSave,
        handleClick,
      }),
    };
  });

  const onCreate = async (instance) => {
    await window.electron.instances.create(instance);
    await getData();
    modalRef.current.openModal(false);
  };
  const onUpdate = async (instance) => {
    await window.electron.instances.update(currentInstance.id, instance);
    await getData();
    modalRef.current.openModal(false);
  };

  const onDelete = async (instance) => {
    await window.electron.instances.delete(instance.id);
    await getData();
  };

  const modalRef = useRef<FormModalRef>(null);

  return (
    <>
      {contextHolder}
      <div className="flex flex-col h-full">
        <div className="p-4 shadow flex flex-row justify-between z-10">
          <h2 className="text-lg font-semibold">{t('settings.secrets')}</h2>
          <Button
            //type="primary"
            variant="outlined"
            shape="round"
            disabled={editingKey !== null}
            onClick={() => {
              handleAdd();
            }}
          >
            {t('settings.secrets_create')}
          </Button>
        </div>
        <ScrollArea className="flex-1 h-full">
          <div className="p-4">
            <Form form={form} component={false}>
              <Table<Secrets>
                rowKey="id"
                //className="h-full"
                components={components}
                rowClassName={() => 'editable-row'}
                dataSource={dataSource}
                columns={columns as ColumnTypes}
                pagination={false}
              />
            </Form>
          </div>
        </ScrollArea>
      </div>
    </>
  );
}

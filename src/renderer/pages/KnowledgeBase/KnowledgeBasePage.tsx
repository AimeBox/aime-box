import { useEffect, useRef, useState } from 'react';

import {
  Link,
  Route,
  Routes,
  useLocation,
  useNavigate,
} from 'react-router-dom';

import { FormSchema } from '../../../types/form';
import {
  Button,
  Form,
  Input,
  Popconfirm,
  Popover,
  Radio,
  Select,
  Slider,
  Space,
  Switch,
  Table,
  Tag,
  message,
} from 'antd';
import { FaEdit, FaPlus, FaTrashAlt } from 'react-icons/fa';
import TextArea from 'antd/es/input/TextArea';
import List from '@/renderer/components/common/List';
import FormModal from '@/renderer/components/modals/FormModal';
import { ScrollArea } from '@/renderer/components/ui/scroll-area';
import ProviderSelect from '@/renderer/components/providers/ProviderSelect';
import Content from '@/renderer/components/layout/Content';
import { KnowledgeBase } from '@/entity/KnowledgeBase';
import { ListItem } from '@/renderer/components/common/ListItem';
import { t } from 'i18next';
import KnowledgeBaseContent from './KnowledgeBaseContent';

export default function KnowledgeBasePage() {
  const location = useLocation();
  // const [open, setOpen] = useState(false);
  // const [currentMode, setCurrentMode] = useState(undefined);
  const [list, setList] = useState<KnowledgeBase[]>([]);
  const [currentKB, setCurrentKB] = useState<KnowledgeBase | undefined>(
    undefined,
  );
  const navigate = useNavigate();
  const [addButtonOpen, setAddButtonOpen] = useState(false);
  // const [currentEditKbId, setCurrentEditKbId] = useState(undefined);
  const kbModalRef = useRef(null);
  const kbDifyModalRef = useRef(null);
  const schemas = [
    {
      label: t('knowledge.name'),
      field: 'name',
      required: true,
      component: 'Input',
    },
    {
      label: t('knowledge.description'),
      field: 'description',
      required: true,
      component: 'InputTextArea',
    },
    {
      label: t('knowledge.tags'),
      field: 'tags',
      component: 'Select',
      required: false,
      componentProps: {
        mode: 'tags',
      },
    },
    {
      label: 'VectorStore',
      field: 'vectorStoreType',
      required: true,
      component: 'Select',
      defaultValue: 'lancedb',
      componentProps: {
        options: [
          { value: 'lancedb', label: 'lancedb' },
          // { value: 'pgvector', label: 'PGVector' },
          // { value: 'milvus', label: 'Milvus' },
        ],
      },
      ifShow({ values }) {
        return !values.id;
      },
    },
    {
      label: 'Embedding',
      field: 'embedding',
      required: true,

      subLabel: '设置后将无法更改',

      component: <ProviderSelect type="embedding" />,
      ifShow({ values }) {
        return !values.id;
      },
    },
    {
      label: 'Reranker',
      field: 'reranker',
      required: false,
      component: <ProviderSelect type="reranker" allowClear />,
    },
  ] as FormSchema[];

  const schemas_dify = [
    {
      label: t('knowledge.name'),
      field: 'name',
      required: true,
      component: 'Input',
    },
    {
      label: t('knowledge.dify_api_key'),
      field: 'apiKey',
      required: true,
      component: 'InputPassword',
    },
    {
      label: t('knowledge.dify_api_url'),
      field: 'apiUrl',
      required: true,
      component: 'Input',
    },
  ] as FormSchema[];

  const getData = async () => {
    const res = window.electron.db.getMany<KnowledgeBase>('knowledgebase', {});
    console.log(res);
    setList(res);
  };

  const onKBSubmit = async (values) => {
    values.tags = values.tags;
    values.vectorStoreConfig = {};
    values.reranker = values.reranker || null;
    if (currentKB) {
      await window.electron.kb.update(currentKB.id, values);
    } else {
      await window.electron.kb.create(values);
    }
    await getData();
    kbModalRef.current.openModal(false);
    message.success('success');
  };
  const onSearch = () => {};

  const onDelete = async (item) => {
    try {
      await window.electron.kb.delete(item.id);
      await getData();
      navigate(`/knowledge-base`);
      message.success('success');
    } catch (err) {
      message.error(err);
    }
  };

  const openAddLocalKnowledgeBase = () => {
    setAddButtonOpen(false);
    setCurrentKB(undefined);
    navigate(`/knowledge-base`);
    kbModalRef.current.openModal(true);
  };

  const openAddDifyKnowledgeBase = () => {
    setAddButtonOpen(false);
    setCurrentKB(undefined);
    navigate(`/knowledge-base`);
    kbDifyModalRef.current.openModal(true);
  };

  useEffect(() => {
    getData();
  }, []);

  useEffect(() => {
    const kbId = location.pathname.split('/')[2];

    if (kbId) {
      setCurrentKB(list.find((x) => x.id == kbId));
      // setCurrentMode('dataset');
    } else {
      setCurrentKB(undefined);
    }
  }, [location.pathname]);

  return (
    <Content>
      <div className="flex flex-row w-full h-full">
        <List
          width={250}
          onSearch={onSearch}
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
                      openAddLocalKnowledgeBase();
                    }}
                  >
                    {t('knowledge.localKB')}
                  </Button>
                  <Button
                    type="text"
                    block
                    onClick={() => {
                      openAddDifyKnowledgeBase();
                    }}
                  >
                    {t('knowledge.difyKB')}
                  </Button>
                </div>
              }
            >
              <Button icon={<FaPlus />} className=""></Button>
            </Popover>
          }
        >
          <div className="flex flex-col gap-1">
            {list.map((item, index) => {
              return (
                <ListItem
                  title={item.name}
                  subTitle={
                    <div className="flex flex-col gap-1">
                      <span className="line-clamp-2">{item.description}</span>
                      <div>
                        <Tag className="max-w-[120px] text-ellipsis whitespace-nowrap overflow-hidden">
                          {item.embedding}
                        </Tag>
                      </div>
                    </div>
                  }
                  active={item.id === currentKB?.id}
                  href={`/knowledge-base/${item.id}`}
                  menu={
                    <div className="flex flex-col">
                      <Button
                        type="text"
                        icon={<FaEdit />}
                        onClick={(e) => {
                          setCurrentKB(item);
                          kbModalRef.current.openModal(true, item);
                        }}
                      >
                        {t('edit')}
                      </Button>
                      <Popconfirm
                        title="Delete the item?"
                        onConfirm={() => onDelete(item)}
                        okText="Yes"
                        cancelText="No"
                      >
                        <Button type="text" danger icon={<FaTrashAlt />}>
                          {t('delete')}
                        </Button>
                      </Popconfirm>
                    </div>
                  }
                ></ListItem>
              );
            })}
          </div>
        </List>
        <div className="flex flex-col flex-1 w-full min-w-0 h-full min-h-full">
          <Routes>
            <Route
              path="/:id"
              element={<KnowledgeBaseContent knowledgeBaseId={currentKB?.id} />}
            />
          </Routes>
        </div>
      </div>

      <FormModal
        title={
          currentKB?.id
            ? t('knowledgebase.edit_knowledgebase')
            : t('knowledgebase.create_knowledgebase')
        }
        ref={kbModalRef}
        schemas={schemas}
        formProps={{ layout: 'vertical' }}
        onFinish={(values) => onKBSubmit(values)}
        onCancel={() => {
          kbModalRef.current.openModal(false);
        }}
      />
      <FormModal
        title={
          currentKB?.id
            ? t('knowledgebase.edit_knowledgebase')
            : t('knowledgebase.create_knowledgebase')
        }
        ref={kbDifyModalRef}
        schemas={schemas_dify}
        formProps={{ layout: 'vertical' }}
        onFinish={(values) => onKBSubmit(values)}
        onCancel={() => {
          kbDifyModalRef.current.openModal(false);
        }}
      />
    </Content>
  );
}

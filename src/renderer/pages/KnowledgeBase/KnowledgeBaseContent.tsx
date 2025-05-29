import {
  Button,
  Drawer,
  Empty,
  Input,
  Modal,
  Popconfirm,
  Space,
  Switch,
  Table,
  Tag,
  Upload,
  UploadFile,
  message,
} from 'antd';

import React, { useEffect, useRef, useState } from 'react';
import { FormSchema } from '../../../types/form';
import Link from 'antd/es/typography/Link';
import dayjs from 'dayjs';
import {
  KnowledgeBaseDocument,
  KnowledgeBaseItemChunk,
} from '../../../main/knowledgebase';
import { Markdown } from '@/renderer/components/common/Markdown';
import {
  FaCheckCircle,
  FaPlus,
  FaSearch,
  FaSpinner,
  FaTimes,
  FaTrashAlt,
} from 'react-icons/fa';
import FormModal, {
  FormModalRef,
} from '@/renderer/components/modals/FormModal';
import Search from 'antd/es/input/Search';
import { isArray, isString } from '@/main/utils/is';
import { ResponseCard } from '@/renderer/components/common/ResponseCard';
import { t } from 'i18next';
import { KnowledgeBaseItem } from '@/entity/KnowledgeBase';

export interface KnowledgeBaseContentProps {
  knowledgeBaseId: string;
  selectionType?: 'checkbox' | 'radio' | 'none';
  onSelect?: (kbItems: any[], knowledgeBaseId: string) => void;
}

export default function KnowledgeBaseContent(props: KnowledgeBaseContentProps) {
  const {
    onSelect = (id, knowledgeBaseId) => {},
    selectionType = 'checkbox',
    knowledgeBaseId = null,
  } = props;
  const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([]);
  const modalRef = useRef<FormModalRef>(undefined);
  const [data, setData] = useState<KnowledgeBaseItem[]>([]);
  const [openItem, setOpenItem] = useState(false);
  const [currentItem, setCurrentItem] = useState(undefined);
  const [searchText, setSearchText] = useState(undefined);
  const [currentMetadata, setCurrentMetadata] = useState(undefined);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [loading, setLoading] = useState<boolean>(false);
  const [knowledgeBaseSearchList, setKnowledgeBaseSearchList] = useState<
    KnowledgeBaseDocument[]
  >([]);
  const [pagination, setPagination] = useState({
    current: 1,
    pageSize: 20,
    total: 0,
    pageSizeOptions: [20],
  });
  const [currentItemChunks, setCurrentItemChunks] = useState<
    KnowledgeBaseItemChunk[]
  >([]);
  const [currentContent, setCurrentContent] = useState<string>('');
  const [fileList, setFileList] = useState<{
    files: UploadFile[];
  }>({
    files: [],
  });
  const schemas = [
    {
      field: 'sourceType',
      component: 'RadioButtonGroup',
      componentProps: {
        options: [
          {
            label: t('knowledgebase.web'),
            value: 'web',
          },
          {
            label: t('knowledgebase.files'),
            value: 'file',
          },
          {
            label: t('knowledgebase.folders'),
            value: 'folder',
          },
          {
            label: t('knowledgebase.text'),
            value: 'text',
          },
          {
            label: t('knowledgebase.sitemap'),
            value: 'sitemap',
          },
        ],
      },
    },
    {
      //label: 'Url',
      field: 'url',
      component: 'Input',
      componentProps: {},
      ifShow({ values }) {
        return values['sourceType'] == 'web';
      },
    },
    {
      label: t('knowledgebase.text'),
      field: 'text',
      component: 'InputTextArea',
      componentProps: {},
      ifShow({ values }) {
        return values['sourceType'] == 'text';
      },
    },
    {
      field: 'files',
      component: 'File',
      helpMessage: '.txt, .pdf, .docx, .doc, .png, .jpg, .jpeg',
      componentProps: {
        accept: '.txt,.pdf,.docx,.doc,.png,.jpg,.jpeg',
      },
      ifShow({ values }) {
        return values['sourceType'] == 'file';
      },
    },
    {
      field: 'folders',
      component: 'Folder',
      helpMessage: '.txt, .pdf, .docx, .doc, .png, .jpg, .jpeg',

      ifShow({ values }) {
        return values['sourceType'] == 'folder';
      },
    },
    {
      //label: t('knowledgebase.sitemap'),
      field: 'sitemap',
      component: 'Input',
      componentProps: {
        placeholder: 'https://example.com/',
      },
      ifShow({ values }) {
        return values['sourceType'] == 'sitemap';
      },
    },
    {
      label: t('knowledgebase.chunkSize'),
      field: 'chunkSize',
      component: 'Slider',
      defaultValue: 500,
      componentProps: {
        min: 1,
        max: 2048,
      },
    },
    {
      label: t('knowledgebase.chunkOverlap'),
      field: 'chunkOverlap',
      component: 'Slider',
      defaultValue: 50,
      componentProps: {
        min: 1,
        max: 1024,
      },
    },
    {
      label: t('knowledgebase.recursive'),
      field: 'recursive',
      component: 'Switch',
      componentProps: {},
      defaultValue: true,
      ifShow({ values }) {
        return values['sourceType'] == 'folder';
      },
    },
    // {
    //   label: 'Crawler',
    //   field: 'crawler',
    //   component: 'Switch',
    //   componentProps: {},
    //   ifShow({ values }) {
    //     return values['sourceType'] == 'web';
    //   },
    // },
    // {
    //   label: 'Exclude',
    //   field: 'exclude',
    //   component: 'InputTextArea',
    //   componentProps: {},
    //   ifShow({ values }) {
    //     return values['sourceType'] == 'web';
    //   },
    // },
  ] as FormSchema[];

  const updateEnable = async (record, value) => {
    await window.electron.kb.updateItem({
      kbItemId: record.id,
      data: { isEnable: value },
    });
    await onChange(pagination, undefined, undefined);
  };

  const dataset_columns = [
    {
      title: t('knowledge.name'),
      dataIndex: 'name',
      key: 'name',
      ellipsis: { showTitle: true },
      render: (text, record, index) => {
        return (
          <div className="flex flex-col">
            <div
              className="mb-1 text-[18px] font-bold cursor-pointer w-fit"
              onClick={() => onOpenItem(record)}
            >
              {text}
            </div>
            <Link
              className="w-fit"
              href={record.source}
              target="_blank"
              onClick={(e) => {
                e.stopPropagation();
                window.electron.app.openPath(record.source);
              }}
            >
              <div className="text-xs">{record.source}</div>
            </Link>
            <div className="flex flex-row gap-2 mb-1 text-gray-500">
              <div>{dayjs(record.timestamp).format('YYYY-MM-DD HH:mm:ss')}</div>
              <Tag color="default">chunk: {record.chunkCount}</Tag>
            </div>
          </div>
        );
      },
    },

    {
      title: t('knowledge.enable'),
      dataIndex: 'isEnable',
      key: 'isEnable',
      width: '80px',
      align: 'center',
      render: (text, record, index) => {
        return (
          <Switch
            value={text}
            onChange={(v) => {
              updateEnable(record, v);
            }}
          ></Switch>
        );
      },
    },
    {
      title: t('knowledge.state'),
      dataIndex: 'state',
      key: 'state',
      width: '80px',
      align: 'center',
      render: (text, record, index) => {
        if (record.state == 'pending') {
          return <FaSpinner className="w-full animate-spin"></FaSpinner>;
        } else if (record.state == 'fail') {
          return <FaTimes color="red"></FaTimes>;
        } else {
          return (
            <FaCheckCircle color="green" className="w-full"></FaCheckCircle>
          );
        }
      },
    },
    {
      title: t('knowledge.action'),
      width: 100,
      align: 'center',
      render: (_, record) => (
        <Space size="middle">
          <Popconfirm
            title="Delete the item?"
            onConfirm={() => onDelete(record)}
            okText="Yes"
            cancelText="No"
          >
            <Button type="text" icon={<FaTrashAlt />}></Button>
          </Popconfirm>
        </Space>
      ),
    },
  ];
  const onAddSource = () => {};
  const onImport = async (values) => {
    window.electron.kb.queue({
      kbId: props?.knowledgeBaseId,
      config: { ...values },
    });
    window.electron.ipcRenderer.once('kb:queue', async () => {
      // await getData();
    });
    modalRef.current.openModal(false);
  };
  const onChange = async (pagination, filter, sorter) => {
    if (!pagination.current) {
      pagination.current = 1;
    }
    const res = window.electron.kb.get({
      knowledgeBaseId: props.knowledgeBaseId,
      filter: searchText,
      skip: (pagination.current - 1) * pagination.pageSize,
      pageSize: pagination.pageSize,
      sort: 'timestamp desc',
    });
    setData(res.items);
    pagination.totalCount = res.totalCount;
    setPagination(pagination);
  };
  const getData = async () => {
    const res = window.electron.kb.get({
      knowledgeBaseId: knowledgeBaseId,
      filter: searchText,
      skip: 0,
      pageSize: 20,
      sort: 'timestamp desc',
    });
    setData(res.items);
    setPagination({
      current: 1,
      pageSize: 20,
      total: res.totalCount,
      pageSizeOptions: [20],
    });
  };
  const onDelete = async (record: KnowledgeBaseItem | string[]) => {
    if (isArray(record)) {
      await window.electron.kb.deleteItem(record);
    } else {
      await window.electron.kb.deleteItem(record.id);
    }
    await getData();
    message.success('success');
    setSelectedRowKeys([]);
  };
  const onOpenItem = async (record) => {
    const res = window.electron.kb.getItem(record.id);
    setCurrentItem(record);
    setCurrentItemChunks(res.chunks);
    setCurrentContent(res.pageContent);
    setCurrentMetadata(res.metadata);
    setOpenItem(true);
  };
  const getTableScroll = ({ extraHeight, id }) => {
    if (typeof extraHeight == 'undefined') {
      //  默认底部分页64 + 边距10
      extraHeight = 74;
    }
    let tHeader = null;
    if (id) {
      tHeader = document.getElementById(id)
        ? document
            .getElementById(id)
            .getElementsByClassName('ant-table-thead')[0]
        : null;
    } else {
      tHeader = document.getElementsByClassName('ant-table-thead')[0];
    }
    //表格内容距离顶部的距离
    let tHeaderBottom = 0;
    if (tHeader) {
      tHeaderBottom = tHeader.getBoundingClientRect().bottom;
    }
    //窗体高度-表格内容顶部的高度-表格内容底部的高度
    // let height = document.body.clientHeight - tHeaderBottom - extraHeight
    let height = `calc(100vh - ${tHeaderBottom + extraHeight}px - 12px)`;
    return height;
  };
  const onSearch = async (text: string) => {
    setLoading(true);
    setKnowledgeBaseSearchList([]);
    const res = await window.electron.kb.query(knowledgeBaseId, text, {
      k: 10,
    });
    setKnowledgeBaseSearchList(res);
    setLoading(false);
  };
  const [scrollY, setScrollY] = useState('');
  //页面加载完成后才能获取到对应的元素及其位置
  useEffect(() => {
    setScrollY(getTableScroll({ extraHeight: undefined, id: undefined }));
  }, []);

  useEffect(() => {
    getData();
  }, [props.knowledgeBaseId, searchText]);

  const rowSelection = {
    onChange: (selectedRowKeys: string[], selectedRows: any[]) => {
      onSelect(selectedRows, knowledgeBaseId);
      setSelectedRowKeys(selectedRowKeys);
    },
    // getCheckboxProps: (record: DataType) => ({
    //   disabled: record.name === 'Disabled User', // Column configuration not to be checked
    //   name: record.name,
    // }),
  };
  return (
    <div className="flex flex-col p-3 h-full">
      <FormModal
        maskClosable={false}
        formProps={{ layout: 'vertical' }}
        title={t('knowledge.import')}
        ref={modalRef}
        schemas={schemas}
        onFinish={(values) => onImport(values)}
        onCancel={() => {
          modalRef.current.openModal(false);
        }}
      />
      <div
        className="flex flex-row justify-between"
        style={{ marginBottom: 16 }}
      >
        <div className="flex flex-row gap-2">
          <Button
            shape="round"
            onClick={() =>
              modalRef.current.openModal(true, { sourceType: 'web' })
            }
          >
            {t('knowledge.add_source')}
          </Button>

          <Button
            shape="round"
            onClick={() => {
              setIsModalOpen(true);
            }}
          >
            {t('knowledge.search')}
          </Button>
          <Button
            shape="round"
            onClick={() => window.electron.kb.restart(knowledgeBaseId)}
          >
            {t('knowledge.restart')}
          </Button>
          {selectedRowKeys.length > 0 && (
            <Button
              shape="round"
              onClick={() => onDelete(selectedRowKeys)}
              danger
            >
              {`${t('knowledge.delete')} (${selectedRowKeys.length})`}
            </Button>
          )}
        </div>
        <div>
          <Input
            width={200}
            value={searchText}
            prefix={<FaSearch></FaSearch>}
            placeholder={t('common.search')}
            onChange={(e) => {
              setSearchText(e.target.value);
              // onChange(pagination, { filter: e.target.value }, undefined);
            }}
          />
        </div>
      </div>
      <Table
        className="flex-1"
        scroll={{ y: scrollY }}
        columns={dataset_columns}
        dataSource={data}
        pagination={pagination}
        onChange={onChange}
        rowKey="id"
        size="small"
        rowSelection={
          selectionType != 'none'
            ? {
                type: selectionType,
                ...rowSelection,
              }
            : null
        }
      />
      <Drawer
        title={
          <div className="text-gray-800 dark:text-gray-200">
            <div className="flex flex-col">
              <div className="text-lg font-bold">{currentItem?.name}</div>
              <Link
                className="w-fit"
                href={currentMetadata?.source}
                target="_blank"
              >
                {currentMetadata?.source}
              </Link>
            </div>
          </div>
        }
        closeIcon={false}
        width={scrollY}
        onClose={() => {
          setOpenItem(false);
        }}
        open={openItem}
        classNames={{ content: '!dark:bg-gray-800 !bg-gray-100' }}
      >
        <div className="mb-4 w-full prose whitespace-pre-linechat-assistant dark:prose-invert">
          {currentContent && <Markdown value={currentContent}></Markdown>}
        </div>
      </Drawer>

      <Modal
        title={t('knowledge.search')}
        open={isModalOpen}
        width={800}
        footer={null}
        onCancel={() => setIsModalOpen(false)}
      >
        <Space direction="vertical" className="w-full">
          <Search
            placeholder="input search"
            loading={loading}
            enterButton
            onSearch={onSearch}
          />
          {!loading && (
            <div className="flex flex-col gap-2 mt-4 w-full max-w-full">
              {knowledgeBaseSearchList.map((item) => {
                return (
                  <div className="flex flex-col gap-2">
                    <div className="flex flex-row gap-2">
                      <div className="px-2 bg-gray-200 rounded-2xl">
                        {t('knowledge:rerank_score')}:
                        {item?.reranker_score?.toFixed(4)}
                      </div>
                      <div className="px-2 bg-gray-200 rounded-2xl">
                        {t('knowledge:score')}:{item.score.toFixed(4)}
                      </div>
                    </div>
                    <Link href={item.document.metadata.source} target="_blank">
                      {item.document.metadata.source}
                    </Link>
                    <ResponseCard value={item.document.pageContent} />
                  </div>
                );
              })}
            </div>
          )}
          {(loading || knowledgeBaseSearchList.length == 0) && <Empty />}
        </Space>
      </Modal>
    </div>
  );
}

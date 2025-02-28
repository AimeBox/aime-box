import { Prompt, PromptGroup } from '@/entity/Prompt';
import List from '@/renderer/components/common/List';
import { ListItem } from '@/renderer/components/common/ListItem';
import Content from '@/renderer/components/layout/Content';
import FormModal, {
  FormModalRef,
} from '@/renderer/components/modals/FormModal';
import { ScrollArea } from '@/renderer/components/ui/scroll-area';
import { FormSchema } from '@/types/form';
import {
  Button,
  Card,
  Form,
  Input,
  message,
  Modal,
  Popconfirm,
  Select,
  Tag,
} from 'antd';
import FormItem from 'antd/es/form/FormItem';
import { t } from 'i18next';
import { useEffect, useRef, useState } from 'react';
import { FaEdit, FaCopy, FaTrash, FaTrashAlt, FaRegCopy } from 'react-icons/fa';
import { Route, Routes } from 'react-router-dom';

export default function PromptsPage() {
  const [promptGroups, setPromptGroups] = useState<PromptGroup[]>([]);
  const [selectedGroup, setSelectedGroup] = useState<PromptGroup>(undefined);
  const [prompts, setPrompts] = useState<Prompt[]>([]);
  const [selectedPrompt, setSelectedPrompt] = useState<Prompt>(undefined);
  const modalGroupRef = useRef<FormModalRef>(null);
  const modalPromptRef = useRef<FormModalRef>(null);
  const [openContentModal, setOpenContentModal] = useState(false);
  const schemas = [
    {
      label: 'Name',
      field: 'name',
      required: true,
      component: 'Input',
    },
  ] as FormSchema[];
  const schemasPrompt = [
    {
      label: 'Role',
      field: 'role',
      required: true,
      component: 'Select',
      defaultValue: 'user',
      componentProps: {
        options: [
          { label: 'User', value: 'user' },
          { label: 'Assistant', value: 'assistant' },
          { label: 'System', value: 'system' },
        ],
      },
    },
    {
      label: 'Content',
      field: 'content',
      required: true,
      component: 'InputTextArea',
    },
    {
      label: 'Description',
      field: 'description',
      required: false,
      component: 'InputTextArea',
    },
    {
      label: 'Tags',
      field: 'tags',
      required: false,
      component: 'Select',
      componentProps: {
        mode: 'tags',
      },
    },
  ] as FormSchema[];
  const getData = async () => {
    const promptGroups = await window.electron.prompts.getGroups();
    setPromptGroups(promptGroups);
  };

  const onSubmit = async (values) => {
    if (selectedGroup) {
      await window.electron.prompts.updateGroup({
        ...selectedGroup,
        ...values,
      });
    } else {
      await window.electron.prompts.createGroup(values);
    }
    await getData();
    modalGroupRef.current.openModal(false);
  };

  const onDelete = async (promptGroup: PromptGroup) => {
    await window.electron.prompts.deleteGroup(promptGroup.id);
    await getData();
    setSelectedGroup(undefined);
  };

  const getPrompts = async (gorupId: string | undefined) => {
    const prompts = await window.electron.prompts.getPrompts(gorupId);
    setPrompts(prompts);
  };

  const onCreatePrompt = async (values) => {
    modalPromptRef.current.openModal(false);
    if (!selectedPrompt) {
      await window.electron.prompts.createPrompt(values, selectedGroup.id);
    } else {
      await window.electron.prompts.updatePrompt({
        id: selectedPrompt.id,
        ...values,
      });
    }

    await getPrompts(selectedGroup.id);
  };

  const onDeletePrompt = async (prompt: Prompt) => {
    await window.electron.prompts.deletePrompt(prompt.id);
    await getPrompts(selectedGroup.id);
  };

  const onCopyPrompt = async (prompt: Prompt) => {
    await window.electron.app.clipboard(prompt.content);
    message.success('Prompt copied to clipboard');
  };

  useEffect(() => {
    getData();
  }, []);

  useEffect(() => {
    if (selectedGroup) {
      getPrompts(selectedGroup.id);
    }
  }, [selectedGroup]);

  return (
    <Content>
      <div className="flex flex-row w-full h-full">
        <List
          dataLength={10}
          hasMore={false}
          showSearch
          onAdd={() => {
            modalGroupRef.current.openModal(true);
          }}
        >
          <div className="flex flex-col gap-1">
            {promptGroups.map((promptGroup) => (
              <ListItem
                key={promptGroup.id}
                title={promptGroup.name}
                active={selectedGroup?.id === promptGroup.id}
                onClick={() => setSelectedGroup(promptGroup)}
                menu={
                  <div className="flex flex-col">
                    <Button
                      type="text"
                      icon={<FaEdit />}
                      onClick={() => {
                        modalGroupRef.current.openModal(true, promptGroup);
                        setSelectedGroup(promptGroup);
                      }}
                    >
                      {t('edit')}
                    </Button>
                    <Button
                      type="text"
                      icon={<FaTrash />}
                      danger
                      onClick={() => {
                        onDelete(promptGroup);
                      }}
                    >
                      {t('delete')}
                    </Button>
                  </div>
                }
              />
            ))}
          </div>
        </List>

        <div className="flex flex-1 flex-grow gap-4 p-4 w-full min-w-0 h-full min-h-full">
          <ScrollArea className="w-full">
            {selectedGroup && (
              <div className="flex flex-row flex-wrap gap-4 w-full">
                <Card
                  className="flex justify-center items-center w-64 cursor-pointer !min-h-72 p-2 hover:bg-gray-100 transition-all duration-300"
                  onClick={() => {
                    setSelectedPrompt(undefined);
                    modalPromptRef.current.openModal(true);
                  }}
                >
                  <strong className="text-lg">
                    + {t('prompts.create_prompt')}
                  </strong>
                </Card>
                {prompts.map((prompt) => (
                  <Card
                    styles={{ body: { padding: 6 } }}
                    key={prompt.id}
                    className="group"
                  >
                    <div className="flex flex-col justify-between h-72 cursor-pointer text-ellipsis min-w-80 max-w-80">
                      <ScrollArea
                        className="flex flex-col flex-1 p-2 text-sm whitespace-pre-line bg-gray-50 rounded-xl"
                        onClick={() => {
                          setSelectedPrompt(prompt);
                          setOpenContentModal(true);
                        }}
                      >
                        <div>{prompt.content}</div>
                      </ScrollArea>
                      <div className="flex flex-row justify-between items-center mt-1 w-full">
                        <strong className="flex-1 line-clamp-1">
                          {prompt.description}
                        </strong>
                        <div className="opacity-0 transition-opacity duration-300 group-hover:opacity-100">
                          <Button
                            type="text"
                            icon={<FaRegCopy />}
                            onClick={() => {
                              onCopyPrompt(prompt);
                            }}
                          ></Button>
                          <Button
                            type="text"
                            icon={<FaEdit />}
                            onClick={() => {
                              setSelectedPrompt(prompt);
                              modalPromptRef.current.openModal(true, prompt);
                            }}
                          ></Button>
                          <Popconfirm
                            title="Are you sure to delete this prompt?"
                            onConfirm={() => {
                              onDeletePrompt(prompt);
                            }}
                          >
                            <Button
                              type="text"
                              danger
                              icon={<FaTrashAlt />}
                            ></Button>
                          </Popconfirm>
                        </div>
                      </div>
                      <div className="flex flex-row">
                        {prompt.role == 'user' && (
                          <Tag color="blue">{prompt.role}</Tag>
                        )}
                        {prompt.role == 'assistant' && (
                          <Tag color="green">{prompt.role}</Tag>
                        )}
                        {prompt.role == 'system' && (
                          <Tag color="purple">{prompt.role}</Tag>
                        )}

                        {prompt?.tags
                          ?.slice(0, 2)
                          ?.map((tag) => <Tag key={tag}>{tag}</Tag>)}
                      </div>
                    </div>
                  </Card>
                ))}
              </div>
            )}
          </ScrollArea>
        </div>
      </div>
      <FormModal
        title={t('prompts.group')}
        ref={modalGroupRef}
        schemas={schemas}
        formProps={{ layout: 'vertical' }}
        onFinish={(values) => onSubmit(values)}
        onCancel={() => {
          modalGroupRef.current.openModal(false);
        }}
      />
      <FormModal
        title={t('prompts.prompt')}
        ref={modalPromptRef}
        schemas={schemasPrompt}
        width={800}
        formProps={{ layout: 'vertical' }}
        onFinish={(values) => {
          onCreatePrompt(values);
        }}
        onCancel={() => {
          modalPromptRef.current.openModal(false);
        }}
      />
      <Modal
        width={800}
        open={openContentModal}
        title={
          <>
            {selectedPrompt && (
              <div className="flex flex-row gap-2">
                {selectedPrompt.role == 'user' && (
                  <Tag color="blue">{selectedPrompt.role}</Tag>
                )}
                {selectedPrompt.role == 'assistant' && (
                  <Tag color="green">{selectedPrompt.role}</Tag>
                )}
                {selectedPrompt?.role == 'system' && (
                  <Tag color="purple">{selectedPrompt?.role}</Tag>
                )}
                {selectedPrompt?.description}
              </div>
            )}
          </>
        }
        footer={null}
        onCancel={() => {
          setOpenContentModal(false);
        }}
      >
        <div className="whitespace-pre-line">{selectedPrompt?.content}</div>
      </Modal>
    </Content>
  );
}

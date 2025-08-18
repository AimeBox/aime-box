import React, { useState } from 'react';
import ShowcaseLayout from '../components/layout/ShowcaseLayout';
import { ScrollArea } from '../components/ui/scroll-area';
import Content from '../components/layout/Content';
// import { Document, Page, pdfjs } from 'react-pdf';
import FileDropZone from '../components/common/FileDropZone';
import ChatInput from '../components/chat/ChatInput';
import { useNavigate } from 'react-router-dom';
import { ChatInputAttachment } from '@/types/chat';
import ProviderSelect from '../components/providers/ProviderSelect';
import { Button, message, Popconfirm, Tag, Tooltip } from 'antd';
import { t } from 'i18next';
import { FaPaperclip, FaTrashAlt } from 'react-icons/fa';
import { FaGear } from 'react-icons/fa6';
import { useSelector } from 'react-redux';
import { State } from '../store';

interface Props {}

function Home(props: Props): React.ReactElement {
  const navigate = useNavigate();
  const settings = useSelector((state: State) => state.settings.settings);
  const [attachments, setAttachments] = useState<ChatInputAttachment[]>([]);
  const [currentModel, setCurrentModel] = useState<string | undefined>(
    settings.defaultLLM,
  );
  const [messageApi, messageContextHolder] = message.useMessage();

  const onNewChat = async (
    text?: string,
    attachments?: ChatInputAttachment[],
  ) => {
    if (!text?.trim()) {
      return;
    }
    const mode = 'default';
    if (!currentModel) {
      messageApi.error(t('chat.model_not_selected'));
      return;
    }
    const chat = await window.electron.chat.create(mode, currentModel);
    if (chat) {
      navigate(`/chat/${chat.id}?mode=${mode}`, {
        state: { message: { text, attachments } },
      });
    }
  };

  const onSelectFile = async (files: string[] = []) => {
    try {
      const res = await window.electron.app.getPathInfo(files);
      if (res && res.length > 0) {
        const _attachments = [];
        for (const item of res) {
          if (attachments.find((x) => x.path == item.path)) {
            continue;
          }
          _attachments.push({
            path: item.path,
            name: item.name,
            type: item.type,
            ext: item.ext,
          });
        }
        setAttachments([...attachments, ..._attachments]);
      }
    } catch (err) {
      // message.error(err);
    }
  };

  return (
    <Content>
      {messageContextHolder}
      <FileDropZone onSelectedFiles={onSelectFile}>
        <div className="w-full flex flex-col items-center justify-center h-full">
          <div className="max-w-[600px] min-w-[350px] w-full h-[200px]">
            <ChatInput
              attachments={attachments}
              onAttachmentsChanged={setAttachments}
              onChat={(text, attachments) => {
                onNewChat(text, attachments);
              }}
              footer={
                <div className="flex flex-row items-center justify-between w-full pr-2">
                  <div className="flex flex-row items-center gap-2">
                    <ProviderSelect
                      type="llm"
                      value={currentModel}
                      onChange={(value) => {
                        setCurrentModel(value);
                      }}
                      style={{ width: '200px' }}
                    />
                    {/* <Tooltip
                      placement="top"
                      title={
                        <div className="flex flex-col">
                          <strong>{t('chat.tool')}</strong>
                          {currentChat?.options?.toolNames?.join(',')}
                        </div>
                      }
                    >
                      <Button
                        className="flex flex-row items-center rounded-full"
                        color={
                          currentChat?.options?.toolNames?.length > 0
                            ? 'primary'
                            : 'default'
                        }
                        variant={
                          currentChat?.options?.toolNames?.length > 0
                            ? 'filled'
                            : 'outlined'
                        }
                        onClick={() => {
                          tools.open(currentChat?.options?.toolNames || []);
                          tools.onSelect = (_tools) => {
                            onChatOptionsChanged({
                              toolNames: _tools.map((x) => x.name),
                            });
                          };
                        }}
                      >
                        {t('chat.tool')}
                        <Tag className="mr-0 rounded-full">
                          +{' '}
                          {currentChat?.options?.toolNames?.length > 0
                            ? currentChat?.options?.toolNames?.length
                            : 'add'}
                        </Tag>
                      </Button>
                    </Tooltip>
                    <Tooltip
                      placement="top"
                      title={
                        <div className="flex flex-col">
                          <strong>{t('chat.knowledgebase')}</strong>
                          {currentChat?.options?.toolNames?.join(',')}
                        </div>
                      }
                    >
                      <Button
                        className="flex flex-row items-center rounded-full"
                        color={
                          currentChat?.options?.kbList?.length > 0
                            ? 'primary'
                            : 'default'
                        }
                        variant={
                          currentChat?.options?.kbList?.length > 0
                            ? 'filled'
                            : 'outlined'
                        }
                        onClick={() => {
                          knowledgeBase.open(
                            currentChat?.options?.kbList || [],
                          );

                          knowledgeBase.onSelect = (kbs) => {
                            onChatOptionsChanged({
                              kbList: kbs.map((kb) => kb.id),
                            });
                          };
                        }}
                      >
                        {t('chat.knowledgebase')}
                        <Tag className="mr-0 rounded-full">
                          +{' '}
                          {currentChat?.options?.kbList?.length > 0
                            ? currentChat?.options?.kbList?.length
                            : 'add'}
                        </Tag>
                      </Button>
                    </Tooltip>
                    */}
                  </div>
                </div>
              }
            ></ChatInput>
          </div>
        </div>
      </FileDropZone>
    </Content>
  );
}

export default Home;

import ChatQuickInput from '@/renderer/components/chat/ChatQuickInput';
import { Chat, ChatFile, ChatMessage } from '@/entity/Chat';
import ChatMessageBox from '@/renderer/components/chat/ChatMessageBox';
import ProviderSelect from '@/renderer/components/providers/ProviderSelect';
import { ScrollArea } from '@/renderer/components/ui/scroll-area';
import {
  Alert,
  Button,
  Divider,
  Input,
  Popconfirm,
  Space,
  Splitter,
  Tabs,
  Tag,
  Tooltip,
} from 'antd';
import {
  FaArrowLeft,
  FaArrowRight,
  FaPaperclip,
  FaPaperPlane,
  FaStop,
  FaTrashAlt,
} from 'react-icons/fa';
import { FaGear } from 'react-icons/fa6';
// import { Editor, EditorRef } from '@/renderer/components/common/Editor';
import { useEffect, useRef, useState } from 'react';
import { t } from 'i18next';
// import DocumentView, {
//   DocumentViewRef,
// } from '@/renderer/components/common/DocumentView';
import { isUrl } from '@/main/utils/is';
import Link from 'antd/es/typography/Link';
import { useLocation } from 'react-router-dom';
import { ChatInputAttachment } from '@/types/chat';

export default function ChatFileContent() {
  const location = useLocation();
  const [currentChat, setCurrentChat] = useState<
    (Chat & { status: string }) | undefined
  >(undefined);
  const [chatInputMessage, setChatInputMessage] = useState<string | undefined>(
    undefined,
  );
  const [currentModel, setCurrentModel] = useState<string | undefined>(
    undefined,
  );
  const [files, setFiles] = useState<ChatFile[]>([]);
  const [currentFile, setCurrentFile] = useState<ChatFile | undefined>(
    undefined,
  );

  const [currentFileSummary, setCurrentFileSummary] = useState<
    string | undefined
  >(undefined);
  const [currentFileUrl, setCurrentFileUrl] = useState<string | undefined>(
    undefined,
  );
  // const documentRef = useRef<DocumentViewRef>(null);

  // const editorRef = useRef<EditorRef>(null);
  const onDelete = async (chatMessage: ChatMessage) => {};
  const onChangeCurrentModel = async (currentModel: string) => {};
  const onClearChatMessages = async () => {};
  const onChat = async () => {};
  const onCancel = async (chatId: string) => {
    window.electron.chat.cancel(chatId);
  };

  const registerEvent = (id: string) => {
    // const list = {
    //   [`chat:message-finish:${id}`]: handleChatFinish,
    //   [`chat:message-stream:${id}`]: handleChatStream,
    //   [`chat:message-changed:${id}`]: handleChatChanged,
    // };
    // Object.keys(list).forEach((eventId) => {
    //   if (window.electron.ipcRenderer.listenerCount(eventId) != 1) {
    //     window.electron.ipcRenderer.removeAllListeners(eventId);
    //     console.log(`已注册监听${eventId}`);
    //     window.electron.ipcRenderer.on(eventId, list[eventId]);
    //   }
    // });
  };
  const getChat = async (id: string) => {
    let res = (await window.electron.chat.getChat(id)) as Chat & {
      status: string;
    };
    console.log(res);
    if (!res.model) {
      const defaultLLM = await window.electron.providers.getDefaultLLM();
      if (defaultLLM) {
        await window.electron.db.update('chat', { model: defaultLLM } as any, {
          id: res.id,
        });

        res = await window.electron.chat.getChat(id);
      }
    }
    setCurrentModel(res.model);

    setCurrentChat((chat) => {
      registerEvent(res.id);
      if (res.chatFiles && res.chatFiles.length > 0) {
        setFiles(res.chatFiles);
        setCurrentFile(res.chatFiles[0]);
      } else {
        setCurrentFile(undefined);
      }
      return res;
    });
  };

  useEffect(() => {
    const id = location.pathname.split('/')[2];
    if (id) {
      getChat(id);
    } else {
      setCurrentChat(undefined);
      return () => {};
    }

    return () => {
      window.electron.ipcRenderer.removeAllListeners(
        `chat:message-changed:${id}`,
      );
      window.electron.ipcRenderer.removeAllListeners(
        `chat:message-finish:${id}`,
      );
      window.electron.ipcRenderer.removeAllListeners(
        `chat:message-stream:${id}`,
      );
      console.log('已删除监听');
    };
  }, [location.pathname]);
  const onSelectFile = async (exts: string[]) => {
    const res = await window.electron.app.showOpenDialog({
      properties: ['openFile', 'multiSelections'],
      filters: [{ name: 'Files', extensions: exts }],
    });
    if (res && res.length > 0) {
      //setCurrentFileExt(res[0].ext);
      const options = { files: res };

      await window.electron.chat.update(
        currentChat?.id,
        res[0].name,
        currentModel,
        currentChat.options,
      );
      await window.electron.chat.chatFileCreate({
        chatId: currentChat?.id,
        files: res,
      });
      await getChat(currentChat?.id);
    }
  };

  const onTranscript = async (fileOrUrl: string) => {
    const result = await window.electron.tools.invoke('speech-to-text', {
      fileOrUrl: fileOrUrl,
    });
    return result;
  };

  const onFileLoaded = async () => {
    if (currentFile?.file?.ext == '.pdf') {
      if (!currentFile?.additional_kwargs?.docLayout) {
        const images = await documentRef.current?.getImages();
        console.log(images);
      }
    } else if (
      currentFile?.file?.ext == '.mp4' ||
      currentFile?.file?.ext == '.wav' ||
      currentFile?.file?.ext == '.mp3'
    ) {
      if (!currentFile?.additional_kwargs?.transcript) {
        const transcript = await onTranscript(currentFile?.file?.path);
        await window.electron.chat.chatFileUpdate({
          chatFileId: currentFile?.id,
          data: {
            additional_kwargs: {
              transcript: transcript,
            },
          },
        });
        await getChat(currentChat?.id);
        const _currentFile = {
          ...currentFile,
          additional_kwargs: {
            transcript: transcript,
          },
        };
        setCurrentFile(_currentFile);
      }
    }
  };

  return (
    <Splitter className="flex flex-row h-full">
      <Splitter.Panel min={360}>
        {currentFile && currentFile.file?.ext == '.pdf' && (
          // <DocumentView
          //   ref={documentRef}
          //   files={files.map((file) => file.file)}
          //   className="flex justify-center items-center w-full h-full"
          //   onLoadSuccess={onFileLoaded}
          // />
          <></>
        )}
        {currentFile &&
          (currentFile.file?.ext == '.mp4' ||
            currentFile.file?.ext == '.wav' ||
            currentFile.file?.ext == '.mp3') && (
            <Splitter
              className="flex flex-col p-4 w-full h-full"
              layout="vertical"
            >
              <Splitter.Panel
                min={100}
                defaultSize={currentFile.file?.ext == '.mp4' ? undefined : 100}
              >
                <div className="flex relative flex-col p-2 h-full group">
                  <Button
                    type="text"
                    shape="circle"
                    className="z-10 absolute top-[calc(50%_-_16px)] left-0 opacity-0 group-hover:opacity-100"
                    icon={<FaArrowLeft />}
                    disabled={
                      files.findIndex((file) => file.id == currentFile?.id) == 0
                    }
                    onClick={() => {
                      setCurrentFile(
                        files[
                          files.findIndex(
                            (file) => file.id == currentFile?.id,
                          ) - 1
                        ],
                      );
                    }}
                  />
                  {currentFile.file?.ext == '.mp4' && (
                    <video
                      onLoadedData={onFileLoaded}
                      src={currentFile.file.path}
                      className="w-full h-full"
                      controls
                    >
                      <track kind="captions" />
                    </video>
                  )}
                  {(currentFile.file?.ext == '.wav' ||
                    currentFile.file?.ext == '.mp3') && (
                    <>
                      <audio
                        onLoadedData={onFileLoaded}
                        src={currentFile.file.path}
                        controls
                        className="w-full"
                      >
                        <track kind="captions" />
                      </audio>
                      <Link
                        href={currentFile.file.path}
                        target="_blank"
                        className="w-fit"
                      >
                        {currentFile.file.path}
                      </Link>
                    </>
                  )}
                  <Button
                    type="text"
                    shape="circle"
                    className="z-10 absolute top-[calc(50%_-_16px)] right-0 opacity-0 group-hover:opacity-100"
                    icon={<FaArrowRight />}
                    disabled={
                      files.findIndex((file) => file.id == currentFile?.id) ==
                      files.length - 1
                    }
                    onClick={() => {
                      setCurrentFile(
                        files[
                          files.findIndex(
                            (file) => file.id == currentFile?.id,
                          ) + 1
                        ],
                      );
                    }}
                  />
                </div>
              </Splitter.Panel>

              <Splitter.Panel className="flex flex-col">
                <Tabs>
                  <Tabs.TabPane
                    tab="Transcript"
                    key="transcript"
                  ></Tabs.TabPane>
                  <Tabs.TabPane tab="Summary" key="summary">
                    {currentFileSummary}
                  </Tabs.TabPane>
                </Tabs>
                <div className="overflow-y-scroll flex-1">
                  <div className="whitespace-pre-line">
                    {currentFile?.additional_kwargs?.transcript}
                  </div>
                </div>
              </Splitter.Panel>
            </Splitter>
          )}

        {!currentFile && (
          <div className="flex flex-col flex-1 gap-2 justify-center items-center w-full h-full bg-gray-100">
            <div className="flex flex-col gap-2 w-[300px]">
              <Alert
                rootClassName="cursor-pointer"
                onClick={() => onSelectFile(['pdf'])}
                message={
                  <div className="flex flex-col gap-2 items-center">
                    <strong>Select a PDF file</strong>
                  </div>
                }
                type="info"
                className="w-full"
              />
              <Divider className="!my-2">Or</Divider>
              <Alert
                rootClassName="cursor-pointer"
                onClick={() => onSelectFile(['mp4', 'mp3', 'wav'])}
                message={
                  <div className="flex flex-col gap-2 items-center">
                    <strong>Select a file</strong>
                    <small className="text-gray-500">
                      (Support MP4, MP3, WAV)
                    </small>
                  </div>
                }
                type="info"
                className="w-full"
              />
              <Divider className="!my-2">Or</Divider>
              <Alert
                message={
                  <>
                    Input Url
                    <Space.Compact style={{ width: '100%' }}>
                      <Input
                        value={currentFileUrl}
                        onChange={(e) => setCurrentFileUrl(e.target.value)}
                      />
                      <Button
                        type="primary"
                        onClick={() => {
                          if (isUrl(currentFileUrl)) {
                            setCurrentFile(currentFileUrl);
                            setCurrentFileUrl(undefined);
                          }
                        }}
                      >
                        Submit
                      </Button>
                    </Space.Compact>
                  </>
                }
                type="info"
              />
            </div>
          </div>
        )}
      </Splitter.Panel>
      <Splitter.Panel min={220}>
        <Splitter
          layout="vertical"
          className="h-full"
          style={{
            height: '100%',
          }}
        >
          <Splitter.Panel min={400}>
            <div className="flex flex-col w-full h-full">
              <ScrollArea className="flex-1 h-full">
                <div className="">
                  {currentChat && (
                    <div className="flex flex-col py-8 w-full h-full">
                      <div className="pb-10">
                        {currentChat?.chatMessages?.map(
                          (chatMessage: ChatMessage) => {
                            return (
                              <ChatMessageBox
                                key={chatMessage.id}
                                onDeleted={() => onDelete(chatMessage)}
                                onChange={async (text, content) => {
                                  const res =
                                    await window.electron.chat.getChat(
                                      chatMessage.chatId,
                                    );
                                  setCurrentChat(res);
                                }}
                                value={chatMessage}
                              />
                            );
                          },
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </ScrollArea>
            </div>
          </Splitter.Panel>
          <Splitter.Panel min={220} defaultSize={220}>
            <div className="flex flex-col gap-2 p-2 h-full">
              <div className="flex flex-row justify-between">
                <div>
                  <ProviderSelect
                    type="llm"
                    value={currentModel}
                    onChange={onChangeCurrentModel}
                    style={{ width: '200px' }}
                    className="mr-2"
                  />
                </div>
              </div>

              <div className="flex overflow-hidden flex-col flex-1 gap-2 p-2 h-full bg-gray-100 rounded-2xl dark:bg-gray-800">
                <div className="flex flex-col flex-1 h-full">
                  <ChatQuickInput
                    onClick={(text) => {
                      // editorRef.current?.insertText(text);
                      setChatInputMessage(text);
                    }}
                    className="mb-1"
                  />
                  <ScrollArea className="flex-1 h-full rounded-xl border border-gray-300 border-solid dark:border-gray-700">
                    {/* <Editor
                      ref={editorRef}
                      className={`flex-1 w-full h-full text-sm bg-transparent outline-none resize-none`}
                      value={chatInputMessage}
                      onChange={setChatInputMessage}
                    /> */}
                  </ScrollArea>
                </div>
              </div>
              <div className="flex flex-row justify-between items-center w-full">
                <div className="flex gap-2 items-center">
                  <Tooltip placement="top" title={'Clear All Message'}>
                    <Popconfirm
                      title="Delete All Message?"
                      onConfirm={onClearChatMessages}
                      okText="Yes"
                      cancelText={t('cancel')}
                    >
                      <Button icon={<FaTrashAlt />} type="text" />
                    </Popconfirm>
                  </Tooltip>
                </div>
                {currentChat?.status == 'running' && (
                  <Button
                    type="primary"
                    icon={<FaStop />}
                    onClick={() => {
                      onCancel(currentChat.id);
                    }}
                  />
                )}
                {currentChat?.status != 'running' && (
                  <Button
                    type="primary"
                    disabled={!chatInputMessage?.trim()}
                    icon={<FaPaperPlane />}
                    onClick={onChat}
                  />
                )}
              </div>
            </div>
          </Splitter.Panel>
        </Splitter>
      </Splitter.Panel>
    </Splitter>
  );
}

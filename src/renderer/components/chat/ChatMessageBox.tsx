import {
  FaAngleDown,
  FaAngleUp,
  FaCheckCircle,
  FaClipboard,
  FaClock,
  FaEdit,
  FaExclamationCircle,
  FaHistory,
  FaLightbulb,
  FaMedapps,
  FaPlay,
  FaRedo,
  FaReply,
  FaSave,
  FaTimes,
  FaToolbox,
  FaTrashAlt,
  FaUser,
} from 'react-icons/fa';
import dayjs from 'dayjs';
import { Markdown } from '@/renderer/components/common/Markdown';
import hljs from 'highlight.js';
import 'highlight.js/styles/atom-one-dark.css';
import { LoadingOutlined } from '@ant-design/icons';
import ReactJsonView from '@microlink/react-json-view';
import { motion } from 'motion/react';

// import MarkdownIt from 'markdown-it';
import {
  message,
  Button,
  Alert,
  Collapse,
  Tooltip,
  Space,
  Spin,
  Divider,
  Input,
  Image,
  Tag,
  Popover,
  Radio,
} from 'antd';
import React, { Fragment, createElement, useEffect, useState } from 'react';
import { ChatMessage } from '../../../entity/Chat';
import {
  FaArrowRightFromBracket,
  FaArrowRightToBracket,
  FaTrashCan,
  FaXmarksLines,
} from 'react-icons/fa6';
import { isArray, isString } from '../../../main/utils/is';
import { useSelector } from 'react-redux';
import { State } from '@/renderer/store';
import { Providers } from '@/entity/Providers';
import ProviderIcon from '../common/ProviderIcon';
import { ResponseCard } from '../common/ResponseCard';
import { ScrollArea } from '../ui/scroll-area';
import JSONPretty from 'react-json-pretty';
import './ChatMessageBox.css';
import ChatAttachment from './ChatAttachment';
import { t } from 'i18next';
import { ChatInputAttachment } from '@/types/chat';
import { splitContextAndFiles } from '@/renderer/utils/ContentUtils';
import AskHumanMessage from './tool-messages/AskHumanMessage';
// import 'katex/dist/katex.min.css';
// import * as prod from 'react/jsx-runtime';
// import { ProviderIcon } from '../common/ProviderIcon';

export interface ChatMessageProps {
  value: ChatMessage;
  onRedo?: () => {};
  onDeleted?: () => {};
  onChange?: (text: string | undefined, content: any[]) => void;
  onEdit?: (text: string) => void;
  onSetDivider?: (value: boolean) => void;
  toolMessages?: ChatMessage[];
  editEnabled?: boolean;
  hideHead?: boolean;
  hideIcon?: boolean;
  hideActionBar?: boolean;
  size?: 'small' | 'medium';
  onToolClick?: (
    toolCall: any,
    toolMessageContent: any,
    toolMessage: ChatMessage,
  ) => void;
  onOpenHistory?: (messages: any) => void;
  onAskHumanSubmit?: (value: any, toolMessage: ChatMessage) => void;
}

const ChatMessageBox = React.forwardRef(
  (
    {
      value,
      editEnabled = true,
      onRedo,
      onDeleted,
      onChange,
      onEdit,
      onSetDivider,
      toolMessages,
      hideHead = true,
      hideIcon = value.role == 'user',
      hideActionBar = false,
      size = 'small',
      onToolClick,
      onOpenHistory,
      onAskHumanSubmit,
    }: ChatMessageProps,
    ref: React.ForwardedRef<any>,
  ) => {
    const [edit, setEdit] = useState(false);
    const [height, setHeight] = useState('auto');
    const [toolCallInputView, setToolCallInputView] = useState<'json' | 'text'>(
      'json',
    );

    const [content, setContent] = useState<[{ type: string; text: string }]>(
      value.content || [],
    );
    const [textContent, setTextContent] = useState<string>();

    // const [textContent, setTextContent] = useState<string>(
    //   value?.content?.find((x) => x.type == 'text')?.text,
    // );
    const [actions, setActions] = useState<[]>(value.actions || []);
    const [documents, setDocuments] = useState<[]>(value.documents || []);

    const copyToClipboard = () => {
      const textContent = getTextContent();
      if (textContent) {
        window.electron.app.clipboard(textContent);
        message.success('Copying to clipboard was successful!');
      }
    };
    const onDelete = async () => {
      await window.electron.chat.deleteChatMessage(value.id);
      onDeleted?.();
    };
    const openEdit = () => {
      setEdit(true);
    };
    const onPlay = () => {
      window.electron.app.tts(getTextContent());
    };
    const openHistory = () => {
      onOpenHistory?.(value.additional_kwargs.history);
    };

    const updateTextContent = async () => {
      const index = content.findIndex((x) => x.type == 'text');
      if (index !== -1) {
        content[index].text = textContent;
      } else {
        content.unshift({ type: 'text', text: textContent });
      }
      await window.electron.chat.updateChatMessage(value.id, textContent);
      setContent(content);
      onChange?.(textContent, content);
      //setTextContent(input);
      //content.find((x) => x.type == 'text').text = input;
    };

    useEffect(() => {
      const text = getTextContent();

      setTextContent(text);
      setContent(value?.content || []);
    }, [value]);

    // useEffect(() => {
    //   console.log('toolMessages', toolMessages);
    // }, [toolMessages]);

    const toUrl = (video_path) => {
      const src = window.URL.createObjectURL(video_path);
      return src;
    };
    const getTextContent = () => {
      return (
        isArray(value?.content)
          ? value?.content
          : [{ type: 'text', text: value?.content }]
      )
        ?.filter((x) => Object.keys(x).includes('text'))
        .map((x) => x.text)
        .join('\n');
    };

    const getToolCallContent = () => {
      return value?.content
        ?.filter((x) => x.type == 'tool_call')
        .map((x) => x.text)
        .join('\n');
    };

    const renderToolContent = (value: ChatMessage) => {
      const toolContent = (
        isArray(value?.content)
          ? value?.content
          : [{ type: 'text', text: value?.content }]
      )?.filter((x) => x.type == 'tool_call');
      return (
        <div className="w-full">
          {toolContent.map((x) => {
            try {
              if (isArray(JSON.parse(x.text))) {
                return JSON.parse(x.text).map((item, index) => {
                  return <ResponseCard value={item} key={item} />;
                });
              } else {
                return <ResponseCard value={x.text} key={x.tool_call_id} />;
              }
            } catch (error) {
              return <ResponseCard value={x.text} key={x} />;
            }
          })}
        </div>
      );
    };

    const renderToolMessage = (
      inputArgs: any,
      toolCall: any,
      toolMessageContent: any,
      toolMessage: ChatMessage,
    ) => {
      if (toolCall.name == 'ask-human') {
        return (
          <AskHumanMessage
            toolMessage={toolMessage}
            toolCall={toolCall}
            onSubmit={(value) => onAskHumanSubmit(value, toolMessage)}
          />
        );
      }
      return (
        <motion.div
          className="flex flex-row gap-2 items-center p-0 px-2 bg-gray-100 rounded-2xl cursor-pointer w-fit"
          onClick={() =>
            onToolClick?.(toolCall, toolMessageContent, toolMessage)
          }
        >
          <div>
            {toolMessage?.status == 'success' && (
              <FaCheckCircle color="green" />
            )}
            {toolMessage?.status == 'error' && (
              <FaExclamationCircle color="red" />
            )}
            {toolMessage?.status == 'running' && (
              <Spin
                indicator={
                  <LoadingOutlined
                    style={{ fontSize: 10 }}
                    spin
                  ></LoadingOutlined>
                }
              />
            )}
          </div>
          {toolCall.name}{' '}
          <small className="text-xs text-gray-500 max-w-[200px] line-clamp-1 break-all">
            {inputArgs}
          </small>
        </motion.div>
      );
    };

    const getTimeCost = () => {
      let toolTimeCost = 0;
      if (value.role == 'assistant') {
        if (toolMessages?.length > 0) {
          toolTimeCost = toolMessages.reduce(
            (acc, curr) => acc + curr.time_cost,
            0,
          );
        }
      }
      const totalTimeCost = (value.time_cost + toolTimeCost) / 1000;
      if (totalTimeCost <= 60) {
        return `${totalTimeCost.toFixed(2)}s`;
      }
      return `${(totalTimeCost / 60).toFixed(2)}m`;
    };
    return (
      <div className="w-full mb-2">
        <div className="flex flex-col justify-between px-5 mx-auto max-w-5xl rounded-lg group">
          <div className="flex w-full">
            {!hideIcon && value.role == 'assistant' && value.provider_type && (
              <ProviderIcon
                size="2.0rem"
                provider={value.provider_type}
                className="flex justify-center items-center mr-4 w-10 h-10 bg-gray-100 rounded-2xl"
              />
            )}
            {!hideIcon && value.role == 'user' && (
              <div className="flex justify-center items-center mr-4 w-10 h-10 bg-gray-100 rounded-2xl">
                <FaUser />
              </div>
            )}

            <div className="overflow-hidden flex-1 w-full">
              {hideHead === false && (
                <div className="user-message">
                  <div className="self-center font-bold mb-0.5 capitalize line-clamp-1 h-10 flex items-center text-gray-700 dark:text-gray-300">
                    {value.role != 'tool' && (
                      <span className="mr-2 text-lg line-clamp-1 ">
                        {value.role === 'user'
                          ? 'You'
                          : value.name || value.model}{' '}
                      </span>
                    )}
                    {/* {value.role == 'tool' && (
                    <span className="flex flex-row items-center mr-2 text-lg">
                      {value?.content?.find((x) => x.type == 'tool_call')
                        ?.tool_call_name ?? value.model}
                    </span>
                  )} */}
                    <span className="invisible text-xs font-medium text-gray-400 group-hover:visible">
                      {dayjs(value.timestamp).format(
                        'YYYY-MM-DD HH:mm:ss dddd',
                      )}
                    </span>
                  </div>
                </div>
              )}

              <div className="w-full max-w-full">
                {' '}
                <div className="w-full">
                  {!edit && (
                    <>
                      {/* <ReactMarkdown>{textContent}</ReactMarkdown> */}
                      <div
                        className={`flex flex-col flex-wrap gap-2 ${
                          value.role == 'user' ? 'items-end' : ''
                        } w-full mb-1`}
                      >
                        {isArray(value?.content) &&
                          value?.content
                            ?.filter((x) => x.type == 'text')
                            .map((x) => {
                              return (
                                <div
                                  className={`${
                                    value.role == 'user'
                                      ? 'bg-gray-100 dark:bg-gray-800 p-4 rounded-se-2xl rounded-ss-2xl rounded-es-2xl ml-[64px] '
                                      : 'w-full'
                                  }`}
                                >
                                  <Markdown value={x.text} key={x} />
                                </div>
                              );
                            })}
                      </div>

                      {/* {value?.additional_kwargs?.files && (
                        <div className="flex flex-wrap gap-2 p-1">
                          {value?.additional_kwargs?.files.map((file) => {
                            return (
                              <ChatAttachment key={file.path} value={file} />
                            );
                          })}
                        </div>
                      )} */}

                      {/* <div className="p-1">
                        {value?.content
                          ?.filter((x) => x.type == 'text')
                          .map((x) => {
                            return <Markdown value={x.text} key={x} />;
                          })}
                      </div> */}

                      {value.status != 'running' &&
                        (isArray(value?.content)
                          ? value?.content
                          : [{ type: 'text', text: value?.content }]
                        )
                          ?.filter((x) => x.type == 'tool_call')
                          .map((x) => {
                            try {
                              if (isArray(JSON.parse(x.text))) {
                                return JSON.parse(x.text).map((item, index) => {
                                  return (
                                    <ResponseCard value={item} key={item} />
                                  );
                                });
                              } else {
                                return (
                                  <ResponseCard
                                    value={x.text}
                                    key={x.tool_call_id}
                                  />
                                );
                              }
                            } catch (error) {
                              return <ResponseCard value={x.text} key={x} />;
                            }
                          })}
                      {value.status == 'running' && (
                        <div className="mt-2">
                          <Spin
                            indicator={
                              <LoadingOutlined style={{ fontSize: 24 }} spin />
                            }
                          />
                        </div>
                      )}
                      {/* <Markdown2 content={textContent}></Markdown2> */}
                      {/* <MarkdownIt content={textContent}></MarkdownIt> */}
                    </>
                  )}
                  {value.status == 'success' && edit && (
                    <Input.TextArea
                      className="mb-4 text-base"
                      value={textContent}
                      variant="filled"
                      onChange={(e) => {
                        setTextContent(e.target.value);
                      }}
                      autoSize
                    ></Input.TextArea>
                    // <textarea
                    //   value={textContent}
                    //   onChange={(e) => {
                    //     setTextContent(e.target.value);
                    //   }}
                    //   className="w-full bg-transparent bg-gray-200 outline-none resize-none custom-scrollbar"
                    //   style={{ height }}
                    // />
                  )}

                  {value.tool_calls && value.tool_calls.length > 0 && (
                    <div className="mb-1">
                      {size == 'medium' && (
                        <div className="flex flex-row flex-wrap gap-2">
                          <Collapse
                            className="w-full dark:border-gray-700"
                            items={value.tool_calls.map((toolCall, index) => {
                              let toolMessageContent;

                              const toolMessage = toolMessages?.find((t) =>
                                t.content?.some(
                                  (c) =>
                                    c.type == 'tool_call' &&
                                    c.tool_call_id == toolCall.id,
                                ),
                              );
                              if (toolMessage) {
                                toolMessageContent = toolMessage.content?.find(
                                  (c) =>
                                    c.type == 'tool_call' &&
                                    c.tool_call_id == toolCall.id,
                                );
                              }

                              return {
                                key: toolCall.id,
                                label: (
                                  <div className="flex flex-row gap-3 items-center text-gray-700 dark:text-gray-300">
                                    {' '}
                                    <strong>{toolCall.name}</strong>
                                    {toolMessage &&
                                      toolMessage.status == 'success' && (
                                        <Tag color="green">
                                          {toolMessage.status}
                                        </Tag>
                                      )}
                                    {toolMessage &&
                                      toolMessage.status == 'error' && (
                                        <Tag color="red">
                                          {toolMessage.status}
                                        </Tag>
                                      )}
                                    {toolMessage &&
                                      toolMessage.status == 'running' && (
                                        <Spin
                                          indicator={
                                            <LoadingOutlined
                                              style={{ fontSize: 16 }}
                                              spin
                                            />
                                          }
                                        />
                                      )}
                                  </div>
                                ),
                                children: (
                                  <>
                                    <div className="mb-2">
                                      {t('common.parameters')} :{' '}
                                      <Radio.Group
                                        size="small"
                                        value={toolCallInputView}
                                        onChange={(e) =>
                                          setToolCallInputView(e.target.value)
                                        }
                                      >
                                        <Radio.Button value="json">
                                          JSON
                                        </Radio.Button>
                                        <Radio.Button value="text">
                                          Text
                                        </Radio.Button>
                                      </Radio.Group>
                                    </div>
                                    {toolCallInputView == 'text' && (
                                      <ResponseCard value={toolCall.args} />
                                    )}
                                    {toolCallInputView == 'json' && (
                                      <ReactJsonView src={toolCall.args} />
                                    )}

                                    {toolMessageContent && (
                                      <>
                                        <div className="mb-2">Output :</div>
                                        {renderToolContent(toolMessage)}
                                      </>
                                    )}
                                  </>

                                  // <pre className="overflow-x-scroll w-full whitespace-pre-wrap">
                                  //   {JSON.stringify(toolCall.args, null, 2)}
                                  // </pre>
                                ),
                              };
                            })}
                          />
                        </div>
                      )}
                      {size == 'small' && (
                        <div className="flex flex-col flex-wrap gap-2 mt-2">
                          {value?.tool_calls
                            ?.filter((x) => x)
                            .map((toolCall) => {
                              let toolMessageContent;
                              const toolMessage = toolMessages?.find((t) =>
                                t.content?.some(
                                  (c) =>
                                    c.type == 'tool_call' &&
                                    c.tool_call_id == toolCall.id,
                                ),
                              );
                              if (toolMessage) {
                                toolMessageContent = toolMessage.content?.find(
                                  (c) =>
                                    c.type == 'tool_call' &&
                                    c.tool_call_id == toolCall.id,
                                );
                              }
                              let inputArgs = '';
                              if (toolCall?.args) {
                                if (
                                  Object.keys(toolCall.args).length > 0 &&
                                  isString(
                                    toolCall.args[
                                      Object.keys(toolCall.args)[0]
                                    ],
                                  )
                                ) {
                                  inputArgs =
                                    toolCall.args[
                                      Object.keys(toolCall.args)[0]
                                    ];
                                }
                              }

                              let attachments;
                              if (toolMessageContent?.text) {
                                const { attachments: _attachments } =
                                  splitContextAndFiles(
                                    toolMessageContent?.text,
                                  );
                                attachments = _attachments;
                              }

                              return (
                                <>
                                  {renderToolMessage(
                                    inputArgs,
                                    toolCall,
                                    toolMessageContent,
                                    toolMessage,
                                  )}

                                  {attachments && (
                                    <div className="flex flex-wrap gap-2 p-1">
                                      {attachments.map((file) => {
                                        return (
                                          <ChatAttachment
                                            showPreview
                                            value={file}
                                            key={file.path}
                                          ></ChatAttachment>
                                        );
                                      })}
                                    </div>
                                  )}
                                </>
                              );
                            })}
                        </div>
                      )}
                    </div>
                  )}

                  {value.status == 'error' && (
                    <div className="mt-1 mb-1">
                      <Alert
                        message={
                          value.error_msg || value.additional_kwargs.error
                        }
                        type="error"
                      />
                    </div>
                  )}

                  {!hideActionBar && !edit && value.status != 'running' && (
                    <div
                      className={`flex overflow-x-auto gap-2 ${value.role == 'user' ? 'justify-end' : 'justify-start'} items-center  text-gray-700 opacity-0 transition-opacity duration-300 buttons dark:text-gray-500 group-hover:opacity-100`}
                    >
                      <div className="flex flex-row space-x-1">
                        {getTextContent() && (
                          <>
                            <Button
                              type="text"
                              icon={<FaPlay></FaPlay>}
                              onClick={onPlay}
                            ></Button>
                            {editEnabled && (
                              <Button
                                type="text"
                                icon={<FaEdit></FaEdit>}
                                onClick={openEdit}
                              ></Button>
                            )}

                            <Button
                              type="text"
                              icon={<FaClipboard></FaClipboard>}
                              onClick={copyToClipboard}
                            ></Button>
                          </>
                        )}
                        <Tooltip title="断开上下文">
                          <Button
                            type="text"
                            icon={<FaXmarksLines />}
                            onClick={() => {
                              onSetDivider?.(true);
                            }}
                          ></Button>
                        </Tooltip>
                        {value?.additional_kwargs?.history && (
                          <Button
                            type="text"
                            icon={<FaHistory></FaHistory>}
                            onClick={() => openHistory()}
                          ></Button>
                        )}
                        <Button
                          type="text"
                          icon={<FaTrashAlt></FaTrashAlt>}
                          onClick={onDelete}
                        ></Button>
                      </div>

                      {value.role == 'assistant' && (
                        <div className="flex flex-row gap-2 items-center text-xs font-medium text-gray-400">
                          <span className="flex flex-row gap-1 whitespace-nowrap">
                            tokens: {value.total_tokens}{' '}
                            <div className="flex flex-row items-center">
                              <FaAngleUp />
                              {value.input_tokens}
                            </div>{' '}
                            <div className="flex flex-row items-center">
                              <FaAngleDown />
                              {value.output_tokens}
                            </div>
                          </span>
                          {value.time_cost && (
                            <div className="flex flex-row gap-1 items-center">
                              <FaClock />
                              {getTimeCost()}
                            </div>
                          )}
                          {value.time_cost && (
                            <div className="flex flex-row gap-1 items-center">
                              {(
                                value.total_tokens /
                                (value.time_cost / 1000)
                              ).toFixed(0)}{' '}
                              token/s
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  )}

                  {edit && (
                    <div className="flex flex-row">
                      <Button
                        icon={<FaSave />}
                        onClick={() => {
                          updateTextContent();
                          setEdit(false);
                        }}
                      ></Button>
                      <Button
                        className="ml-3"
                        icon={<FaTimes />}
                        onClick={() => {
                          setTextContent(getTextContent());
                          setEdit(false);
                        }}
                      ></Button>
                    </div>
                  )}
                </div>
                {/* <div className="my-2.5 w-full flex overflow-x-auto gap-2 flex-wrap">
                  {documents.map((document, index) => {
                    return (
                      <div className="text-sm" key={index}>
                        {document.metadata.source}
                      </div>
                    );
                  })}
                </div> */}
              </div>
              {value.divider && (
                <Divider
                  variant="dashed"
                  style={{
                    borderColor: 'rgb(37 99 235 / var(--tw-text-opacity))',
                  }}
                  dashed
                >
                  <Button
                    icon={<FaTrashCan />}
                    onClick={() => {
                      onSetDivider?.(false);
                    }}
                  >
                    忽略以上消息
                  </Button>
                </Divider>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  },
);
export default ChatMessageBox;

import {
  FaAngleDown,
  FaClipboard,
  FaClock,
  FaEdit,
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
import ReactMarkdown from 'react-markdown';
import dayjs from 'dayjs';
import { Markdown } from '@/renderer/components/common/Markdown';
import rehypeHighlight from 'rehype-highlight';
import rehypeGfm from 'remark-gfm';
import hljs from 'highlight.js';
import 'highlight.js/styles/atom-one-dark.css';
import { LoadingOutlined } from '@ant-design/icons';
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
import { JSONTree } from 'react-json-tree';
import './ChatMessageBox.css';
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
}

const ChatMessageBox = React.forwardRef(
  (
    {
      value,
      onRedo,
      onDeleted,
      onChange,
      onEdit,
      onSetDivider,
    }: ChatMessageProps,
    ref: React.ForwardedRef<any>,
  ) => {
    const [edit, setEdit] = useState(false);
    const [height, setHeight] = useState('auto');

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

    const toUrl = (video_path) => {
      const src = window.URL.createObjectURL(video_path);
      return src;
    };
    const getTextContent = () => {
      return value?.content
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

    return (
      <div className="w-full">
        <div className="flex flex-col justify-between px-5 mx-auto mb-3 max-w-5xl rounded-lg group">
          <div className="flex w-full">
            <div className="flex justify-center items-center mr-4 w-10 h-10 bg-gray-100 rounded-2xl">
              {value.provider_type && (
                <ProviderIcon provider={value.provider_type} />
              )}
              {value.role == 'user' && <FaUser />}
              {value.role == 'tool' && <FaToolbox />}
            </div>{' '}
            <div className="overflow-hidden flex-1 w-full">
              <div className="user-message">
                <div className="self-center font-bold mb-0.5 capitalize line-clamp-1 h-10 flex items-center">
                  {value.role != 'tool' && (
                    <span className="mr-2 text-lg">
                      {value.role === 'user' ? 'You' : value.model}{' '}
                    </span>
                  )}
                  {value.role == 'tool' && (
                    <span className="flex flex-row items-center mr-2 text-lg">
                      {value?.content?.find((x) => x.type == 'tool_call')
                        ?.tool_call_name ?? value.model}
                    </span>
                  )}
                  <span className="invisible text-xs font-medium text-gray-400 group-hover:visible">
                    {dayjs(value.timestamp).format('YYYY-MM-DD HH:mm:ss dddd')}
                  </span>
                </div>
              </div>{' '}
              <div className="w-full max-w-full">
                {' '}
                <div className="w-full">
                  {!edit && (
                    <>
                      {/* <ReactMarkdown>{textContent}</ReactMarkdown> */}
                      <div className="flex flex-row flex-wrap gap-2">
                        {value?.content.map((x) => {
                          return (
                            <>
                              {x.type == 'text' && (
                                <div className="p-1 w-full">
                                  <Markdown value={x.text} key={x} />
                                </div>
                              )}
                              {x.type == 'image_url' && (
                                <div
                                  className="overflow-hidden rounded-2xl shadow max-h-[200px]"
                                  key={x}
                                >
                                  <Image
                                    src={x.image_url.url}
                                    className="max-h-[200px] object-contain"
                                    alt=""
                                  />
                                </div>
                              )}
                              {x.type == 'file' && (
                                <a href={x.file_url} key={x}>
                                  {x.file_name}
                                </a>
                              )}
                            </>
                          );
                        })}
                      </div>
                      {/* <div className="p-1">
                        {value?.content
                          ?.filter((x) => x.type == 'text')
                          .map((x) => {
                            return <Markdown value={x.text} key={x} />;
                          })}
                      </div> */}

                      {value.status != 'running' &&
                        value?.content
                          ?.filter((x) => x.type == 'tool_call')
                          .map((x) => {
                            try {
                              if (isArray(JSON.parse(x.text))) {
                                return JSON.parse(x.text).map((item, index) => {
                                  return (
                                    <ResponseCard value={item} key={index} />
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
                  {value.status == 'error' && (
                    <div className="mt-2">
                      <Alert message={value.error_msg} type="error" />
                    </div>
                  )}
                  {value.tool_calls && value.tool_calls.length > 0 && (
                    <>
                      <div className="mb-2 text-sm font-medium">工具调用</div>
                      <div className="flex flex-row flex-wrap gap-2">
                        <Collapse
                          ghost
                          className="min-w-0"
                          items={value.tool_calls.map((toolCall, index) => {
                            return {
                              key: toolCall.id,
                              label: toolCall.name,
                              children: (
                                <JSONTree
                                  data={toolCall.args}
                                  hideRoot
                                  valueRenderer={(valueAsString, raw) => (
                                    <span className="whitespace-pre-wrap">
                                      {raw}
                                    </span>
                                  )}
                                />

                                // <pre className="overflow-x-scroll w-full whitespace-pre-wrap">
                                //   {JSON.stringify(toolCall.args, null, 2)}
                                // </pre>
                              ),
                            };
                          })}
                        />
                      </div>
                    </>
                  )}

                  {!edit && value.status != 'running' && (
                    <div className="flex overflow-x-auto gap-2 justify-start items-center mt-5 text-gray-700 opacity-0 transition-opacity duration-300 buttons dark:text-gray-500 group-hover:opacity-100">
                      <div className="flex flex-row space-x-1">
                        {getTextContent() && (
                          <>
                            <Button
                              type="text"
                              icon={<FaPlay></FaPlay>}
                              onClick={onPlay}
                            ></Button>
                            <Button
                              type="text"
                              icon={<FaEdit></FaEdit>}
                              onClick={openEdit}
                            ></Button>
                            <Button
                              type="text"
                              icon={<FaClipboard></FaClipboard>}
                              onClick={copyToClipboard}
                            ></Button>
                          </>
                        )}

                        {/* <button
                          type="button"
                          className="invisible p-1 rounded transition group-hover:visible dark:hover:text-white hover:text-black edit-user-message-button"
                          onClick={onRedo}
                        >
                          <FaRedo className="w-4 h-4" />{' '}
                        </button>{' '} */}
                        <Tooltip title="断开上下文">
                          <Button
                            type="text"
                            icon={<FaXmarksLines />}
                            onClick={() => {
                              onSetDivider?.(true);
                            }}
                          ></Button>
                        </Tooltip>

                        <Button
                          type="text"
                          icon={<FaTrashAlt></FaTrashAlt>}
                          onClick={onDelete}
                        ></Button>
                      </div>

                      {value.role == 'assistant' && (
                        <div className="flex flex-row gap-2 items-center text-xs font-medium text-gray-400">
                          <span>tokens: {value.total_tokens} </span>
                          {value.time_cost && (
                            <div className="flex flex-row gap-1 items-center">
                              <FaClock />
                              {(value.time_cost / 1000).toFixed(2)}s
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
                <div className="my-2.5 w-full flex overflow-x-auto gap-2 flex-wrap">
                  {documents.map((document, index) => {
                    return (
                      <div className="text-sm" key={index}>
                        {document.metadata.source}
                      </div>
                    );
                  })}
                </div>
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

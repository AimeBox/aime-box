/* eslint-disable jsx-a11y/no-static-element-interactions */
/* eslint-disable jsx-a11y/click-events-have-key-events */
import { cn } from '@/lib/utils';
import BasicForm from '../../form/BasicForm';
import { Form, FormInstance, Spin, Tag, Timeline } from 'antd';
import { useEffect, useRef, useState } from 'react';
import { ChatMessage } from '@/entity/Chat';
import e from 'express';
import { Markdown } from '../../common/Markdown';
import { FaCheckCircle, FaExclamationCircle } from 'react-icons/fa';
import { LoadingOutlined } from '@ant-design/icons';
import { ResponseCard } from '../../common/ResponseCard';

export interface TaskMessageProps {
  className?: string;
  toolMessage?: ChatMessage;
  toolCall?: any;
}

export default function TaskMessage(props: TaskMessageProps) {
  const { className, toolMessage, toolCall } = props;

  return (
    <div className="flex flex-col gap-2 max-w-full">
      <div
        className="flex flex-row gap-2 items-center p-0 px-4 py-2 bg-gray-100 rounded-2xl cursor-pointer w-fit"
        onClick={() => {
          console.log(toolMessage);
          console.log(toolCall);
        }}
      >
        <div>
          {toolMessage?.status == 'success' && <FaCheckCircle color="green" />}
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
          <Tag className="rounded-full" color="blue">
            @{toolCall?.args?.subagent_type}
          </Tag>{' '}
          {toolCall?.args?.description}
        </small>
      </div>
      <div className="mt-2">
        <Timeline
          rootClassName="w-full overflow-x-auto"
          items={[
            ...(toolMessage?.additional_kwargs?.history || [])
              .filter(
                (x) =>
                  x.id[x.id.length - 1] == 'HumanMessage' ||
                  x.id[x.id.length - 1] == 'ToolMessage' ||
                  x.id[x.id.length - 1] == 'AIMessageChunk',
              )
              .map((msg) => {
                const role = msg.id[msg.id.length - 1];
                if (role == 'HumanMessage') {
                  return {
                    children: (
                      <div className="bg-blue-50 p-4 rounded-lg w-full mt-4">
                        <Markdown
                          className="text-sm "
                          value={msg.kwargs.content}
                        ></Markdown>
                      </div>
                    ),
                  };
                } else if (role == 'ToolMessage') {
                  return {
                    children: (
                      <div className="bg-blue-50  p-4 rounded-lg w-full mt-4">
                        <strong>{msg.kwargs.name} :</strong>
                        <Markdown
                          className="text-sm "
                          value={msg.kwargs.content}
                        ></Markdown>
                      </div>
                    ),
                  };
                } else if (role == 'AIMessageChunk') {
                  return {
                    children: (
                      <div className="bg-blue-50  p-4 rounded-lg w-full mt-4 flex flex-col gap-2">
                        <strong>{toolCall?.args?.subagent_type} :</strong>
                        <Markdown
                          className="text-sm"
                          value={msg.kwargs.content}
                        ></Markdown>
                        {msg.kwargs.tool_calls &&
                          msg.kwargs.tool_calls.length > 0 && (
                            <div className="flex flex-row gap-2 items-center p-0 px-2 bg-blue-100 rounded-2xl cursor-pointer w-fit border border-blue-300">
                              {msg.kwargs.tool_calls?.map((tool_call) => {
                                return <div> {tool_call.name}</div>;
                              })}
                            </div>
                          )}
                      </div>
                    ),
                  };
                }

                return {
                  children: null,
                };
              }),
            // {
            //   children: (
            //     <div className="bg-gray-100 p-4 rounded-lg w-full mt-4">
            //       <Markdown
            //         className="text-sm "
            //         value={toolMessage?.content[0]?.text}
            //       ></Markdown>
            //     </div>
            //   ),
            // },
          ]}
        />
      </div>
      {/*
      <pre>{JSON.stringify(toolMessage, null, 2)}</pre> */}
    </div>
  );
}

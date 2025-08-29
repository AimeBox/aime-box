import { cn } from '@/lib/utils';
import BasicForm from '../../form/BasicForm';
import { Collapse, Form, FormInstance, Spin, Tag, Timeline } from 'antd';
import { useEffect, useRef, useState } from 'react';
import { ChatMessage } from '@/entity/Chat';
import e from 'express';
import { Markdown } from '../../common/Markdown';
import { FaCheckCircle, FaExclamationCircle } from 'react-icons/fa';
import { LoadingOutlined } from '@ant-design/icons';
import { ResponseCard } from '../../common/ResponseCard';
import { isString } from 'antd/es/button';

export interface TaskMessageProps {
  className?: string;
  toolMessage?: ChatMessage;
  toolCall?: any;
}

export default function TaskMessage(props: TaskMessageProps) {
  const { className, toolMessage, toolCall } = props;
  const [history, setHistory] = useState<any[]>(
    toolMessage?.additional_kwargs?.history || [],
  );
  useEffect(() => {
    const history = toolMessage?.additional_kwargs?.history;
    const h =
      history?.filter(
        (x) => !x.id || (x.id && x.id[x.id.length - 1] != 'SystemMessage'),
      ) || [];
    setHistory(h);
  }, [toolMessage?.additional_kwargs?.history]);

  const getIcon = () => {
    if (toolMessage?.status == 'success') {
      return <FaCheckCircle color="green" />;
    } else if (toolMessage?.status == 'error') {
      return <FaExclamationCircle color="red" />;
    } else if (toolMessage?.status == 'running') {
      return (
        <Spin
          indicator={
            <LoadingOutlined style={{ fontSize: 10 }} spin></LoadingOutlined>
          }
        />
      );
    }
    return <></>;
  };
  return (
    <div className="flex flex-col gap-2 max-w-full">
      <Collapse
        bordered={false}
        items={[
          {
            key: '1',
            label: (
              <div className="flex flex-row gap-2 items-center">
                {getIcon()} {toolCall.name}{' '}
                <small className="text-xs text-gray-500 line-clamp-1 break-all ">
                  {toolCall?.args?.description}
                </small>
                <Tag className="rounded-full" color="blue">
                  @{toolCall?.args?.subagent_type}
                </Tag>
              </div>
            ),

            children: (
              <Timeline
                rootClassName="w-full overflow-x-auto"
                items={[
                  ...(history || []).map((msg) => {
                    const kwargs = msg?.kwargs || msg?.lc_kwargs;
                    if (kwargs?.tool_calls || !kwargs?.name) {
                      return {
                        children: (
                          <div className="bg-blue-50 p-4 rounded-lg w-full mt-4 flex flex-col gap-2">
                            {/* {JSON.stringify(msg, null, 2)} */}
                            <Markdown
                              className="text-sm "
                              value={kwargs?.content || ''}
                            ></Markdown>
                            {kwargs?.tool_calls &&
                              kwargs?.tool_calls.length > 0 && (
                                <div className="flex flex-row gap-2 items-center p-0 px-2  bg-blue-100 rounded-2xl cursor-pointer w-fit border border-blue-300">
                                  {kwargs.tool_calls?.map((tool_call) => {
                                    const v = Object.values(tool_call.args);
                                    let desc = '';
                                    if (v.length > 0) {
                                      desc = v.find((x) => isString(x));
                                    }
                                    return (
                                      <div className="flex flex-row gap-2 items-center max-w-[300px] line-clamp-1 break-all">
                                        {' '}
                                        {tool_call.name}
                                        <small className="text-xs text-gray-500">
                                          {desc}
                                        </small>{' '}
                                      </div>
                                    );
                                  })}
                                </div>
                              )}
                          </div>
                        ),
                      };
                    } else {
                      return {
                        children: (
                          <div className="bg-blue-50  p-4 rounded-lg w-full mt-4">
                            <strong>{kwargs.name} :</strong>
                            <Markdown
                              className="text-sm "
                              value={kwargs.content}
                            ></Markdown>
                          </div>
                        ),
                      };
                    }
                  }),
                ]}
              />
            ),
          },
        ]}
      />

      {/* <div
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
      <div className="mt-2"></div> */}
    </div>
  );
}

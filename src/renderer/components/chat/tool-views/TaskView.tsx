import {
  SandpackCodeEditor,
  SandpackFileExplorer,
  SandpackLayout,
  SandpackPreview,
  SandpackProvider,
} from '@codesandbox/sandpack-react';
import { Button, Divider, List, Tag } from 'antd';
import { useMemo } from 'react';
import {
  FaCheck,
  FaDotCircle,
  FaDownload,
  FaList,
  FaSpinner,
  FaTimes,
} from 'react-icons/fa';
import { Markdown } from '../../common/Markdown';
import { ChatMessage } from '@/entity/Chat';
import { CopyOutlined } from '@ant-design/icons';

export interface TaskViewProps {
  className?: string;
  toolName?: string;
  toolCall?: any;
  content?: any;
  toolMessage?: ChatMessage;
}

export default function TaskView(props: TaskViewProps) {
  const { className, toolName, toolCall, content, toolMessage } = props;

  return (
    <div className="flex flex-col gap-2 items-start w-full">
      <div className="flex flex-col gap-2 w-full">
        <div className="flex flex-col gap-2 items-start justify-between w-full mb-2">
          <div className="flex flex-row gap-2 items-center w-full mb-2">
            <Tag className="rounded-full" color="blue">
              @{toolCall.args.subagent_type}{' '}
            </Tag>
            <span className="text-gray-500">{toolCall.args.description}</span>
          </div>

          <pre className="whitespace-pre-wrap break-all w-full">
            {toolCall.args.prompt}
          </pre>
        </div>
        <Divider />

        <List
          dataSource={toolMessage?.additional_kwargs['history']}
          renderItem={(item, index) => (
            <List.Item className="flex flex-col items-start " key={index}>
              <div className="flex flex-row gap-2 items-center justify-between w-full mb-2">
                <Tag>{item['id'][item['id'].length - 1]}</Tag>
                <Button
                  size="small"
                  icon={<CopyOutlined />}
                  onClick={() => {
                    navigator.clipboard.writeText(item['kwargs'].content);
                  }}
                ></Button>
              </div>
              <div className="whitespace-pre-wrap break-all w-full">
                {item['kwargs'].content}
              </div>

              {item['kwargs'].tool_calls &&
                item['kwargs'].tool_calls.length > 0 && (
                  <div className="whitespace-pre-wrap break-all w-full">
                    {JSON.stringify(item['kwargs'].tool_calls, null, 2)}
                  </div>
                )}
            </List.Item>
          )}
        ></List>
      </div>
    </div>
  );
}

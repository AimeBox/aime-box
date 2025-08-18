import {
  SandpackCodeEditor,
  SandpackFileExplorer,
  SandpackLayout,
  SandpackPreview,
  SandpackProvider,
} from '@codesandbox/sandpack-react';
import { Button, Tag } from 'antd';
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

export interface TodoViewProps {
  className?: string;
  toolName?: string;
  toolCall?: any;
  content?: any;
}

export default function TodoView(props: TodoViewProps) {
  const { className, toolName, toolCall, content } = props;

  return (
    <div className="flex flex-col gap-2 items-start w-full">
      <div className="flex flex-col gap-2 w-full">
        {toolCall?.args?.todos &&
          toolCall.args.todos.map((x) => {
            return (
              <Tag className="flex flex-row gap-2 items-center text-wrap w-full">
                {' '}
                <div className="flex flex-row gap-2 items-center flex-1">
                  {x.status == 'pending' && <FaList />}
                  {x.status == 'in_progress' && (
                    <FaSpinner className="animate-spin" />
                  )}
                  {x.status == 'completed' && <FaCheck />}
                  {x.priority == 'high' && (
                    <FaDotCircle className="text-red-500" />
                  )}
                  {x.priority == 'medium' && (
                    <FaDotCircle className="text-yellow-500" />
                  )}
                  {x.priority == 'low' && (
                    <FaDotCircle className="text-green-500" />
                  )}
                </div>
                <div className="w-full">{x.content}</div>
              </Tag>
            );
          })}
      </div>
    </div>
  );
}

import { cn } from '@/lib/utils';
import { isArray } from '@/main/utils/is';
import { ResponseCard } from '@/renderer/components/common/ResponseCard';
import {
  ScrollArea,
  ScrollAreaProps,
  ScrollAreaRef,
} from '@/renderer/components/ui/scroll-area';
import { Button, Radio } from 'antd';
import { FaClock, FaTimes } from 'react-icons/fa';
import { Sandpack } from '@codesandbox/sandpack-react';
import { useState } from 'react';
import ReactJsonView from '@microlink/react-json-view';
import { t } from 'i18next';
import CodeSandboxView from './tool-views/CodeSandboxView';
import FileView from './tool-views/FileView';
import WebSearchView from './tool-views/WebSearchView';
import CodeView from './tool-views/CodeView';
import KnowledgebaseQueryView from './tool-views/KnowledgebaseQueryView';

export interface ChatToolViewProps {
  open: boolean;
  onClose?: () => void;
  className?: string;
  toolName?: string;
  //toolCall: string;
  value?: { title: string; content?: any; toolCall?: any; timeCost?: number };
  chatId?: string;
}

export default function ChatToolView(props: ChatToolViewProps) {
  const { className, open, onClose, value, toolName, chatId } = props;
  const [toolCallInputView, setToolCallInputView] = useState<'json' | 'text'>(
    'json',
  );
  const getToolView = () => {
    switch (toolName) {
      case 'code_sandbox':
        return <CodeSandboxView toolCall={value?.toolCall} chatId={chatId} />;
      case 'file_write':
        return <FileView toolCall={value?.toolCall} content={value?.content} />;
      case 'web_search':
        return (
          <WebSearchView toolCall={value?.toolCall} content={value?.content} />
        );
      case 'python_interpreter':
        return <CodeView toolCall={value?.toolCall} content={value?.content} />;
      case 'knowledgebase-query':
        return (
          <KnowledgebaseQueryView
            toolCall={value?.toolCall}
            content={value?.content}
          />
        );
      default:
        return (
          <>
            <div className="flex flex-col gap-2 p-2 mb-2 bg-gray-100 rounded-md">
              {t('common.parameters')} :{' '}
              <Radio.Group
                size="small"
                value={toolCallInputView}
                onChange={(e) => setToolCallInputView(e.target.value)}
              >
                <Radio.Button value="json">JSON</Radio.Button>
                <Radio.Button value="text">Text</Radio.Button>
              </Radio.Group>
              {toolCallInputView == 'text' && (
                <ResponseCard value={value?.toolCall?.args} />
              )}
              {toolCallInputView == 'json' && (
                <ReactJsonView src={value?.toolCall?.args} />
              )}
            </div>
            <div className="h-auto">{renderToolContent()}</div>
            {value?.timeCost && (
              <div className="flex flex-row gap-1 items-center text-xs text-gray-500">
                <FaClock />
                {value?.timeCost}ms
              </div>
            )}
          </>
        );
    }
  };
  const renderToolContent = () => {
    const toolContent = value?.content;
    if (!toolContent) {
      return <div></div>;
    }
    try {
      if (isArray(JSON.parse(toolContent.text))) {
        return JSON.parse(toolContent.text).map((item, index) => {
          return <ResponseCard value={item} key={item} />;
        });
      } else {
        return (
          <ResponseCard
            value={toolContent.text}
            key={toolContent.tool_call_id}
          />
        );
      }
    } catch (error) {
      return (
        <ResponseCard value={toolContent.text} key={toolContent.tool_call_id} />
      );
    }
  };
  return (
    open && (
      <div className={cn('p-2 h-full', className)}>
        <div className="flex flex-col p-4 h-full bg-gray-50 rounded-2xl">
          <div className="flex flex-row justify-between items-center">
            <div className="flex flex-col gap-1">
              <div className="text-sm font-medium">{toolName}</div>
              <small className="text-xs text-gray-500">
                {value?.toolCall?.id}
              </small>
            </div>
            {onClose && (
              <div className="text-sm font-medium">
                <Button
                  icon={<FaTimes />}
                  onClick={() => {
                    onClose();
                  }}
                  type="text"
                />
              </div>
            )}
          </div>
          <ScrollArea className="flex-1 mt-2 h-full">
            <div className="mr-3 h-full">{getToolView()}</div>
          </ScrollArea>
        </div>
      </div>
    )
  );
}

import { cn } from '@/lib/utils';
import { isArray } from '@/main/utils/is';
import { ResponseCard } from '@/renderer/components/common/ResponseCard';
import {
  ScrollArea,
  ScrollAreaProps,
  ScrollAreaRef,
} from '@/renderer/components/ui/scroll-area';
import { Button, Radio } from 'antd';
import { FaTimes } from 'react-icons/fa';
import { Sandpack } from '@codesandbox/sandpack-react';
import { useState } from 'react';
import ReactJsonView from '@microlink/react-json-view';
import { t } from 'i18next';

export interface ChatCanvasViewProps {
  open: boolean;
  onClose: () => void;
  className?: string;
  value?: { title: string; content?: any; toolCall?: any };
}

export default function ChatCanvasView(props: ChatCanvasViewProps) {
  const { className, open, onClose, value } = props;
  const [toolCallInputView, setToolCallInputView] = useState<'json' | 'text'>(
    'json',
  );
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
      <div className={cn('h-full w-[400px] p-2', className)}>
        <div className="bg-gray-50 rounded-2xl p-4 h-full flex flex-col">
          <div className="flex flex-row items-center justify-between">
            <div className="flex flex-col gap-1">
              <div className="text-sm font-medium">{value?.title}</div>
              <small className="text-xs text-gray-500">
                {value?.toolCall?.id}
              </small>
            </div>

            <div className="text-sm font-medium">
              <Button
                icon={<FaTimes />}
                onClick={() => {
                  onClose();
                }}
                type="text"
              />
            </div>
          </div>
          <ScrollArea className="flex-1 h-full mt-2" showScrollBottom>
            <div className="mr-3">
              <div className="mb-2 bg-gray-100 p-2 rounded-md flex flex-col gap-2">
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
                  <ResponseCard value={value.toolCall.args} />
                )}
                {toolCallInputView == 'json' && (
                  <ReactJsonView src={value.toolCall.args} />
                )}
              </div>

              {renderToolContent()}
              {/* <Sandpack template="react" /> */}
            </div>
          </ScrollArea>
          {/* <div className="flex flex-col gap-2 mt-2 h-full overflow-y-auto">

          </div> */}
        </div>
      </div>
    )
  );
}

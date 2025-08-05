import { Alert, Button, Tag } from 'antd';
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
import ChatAttachment from '../ChatAttachment';

export interface EditViewProps {
  className?: string;
  toolName?: string;
  toolCall?: any;
  content?: any;
}

export default function EditView(props: EditViewProps) {
  const { className, toolName, toolCall, content } = props;

  return (
    <div className="flex flex-col gap-2 items-start w-full">
      <div className="flex flex-col gap-2 w-full">
        <div>
          <ChatAttachment
            value={{
              path: toolCall.args.file_path,
              name: toolCall.args.file_path.split('/').pop(),
              type: 'file',
              ext: toolCall.args.file_path.split('.').pop(),
            }}
          />
        </div>

        <pre className="">
          <Markdown value={`\`\`\`\n${toolCall.args.new_string}\n\`\`\``} />
        </pre>
        <pre className="">
          <Markdown value={`\`\`\`\n${toolCall.args.old_string}\n\`\`\``} />
        </pre>
        <div className="">
          {content.status == 'error' && (
            <Alert message={content.text} type="error" showIcon />
          )}
          {content.status == 'success' && (
            <pre>
              <Markdown value={content.text} />
            </pre>
          )}
        </div>
      </div>
    </div>
  );
}

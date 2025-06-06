import {
  SandpackCodeEditor,
  SandpackFileExplorer,
  SandpackLayout,
  SandpackPreview,
  SandpackProvider,
} from '@codesandbox/sandpack-react';
import { Button, Tag } from 'antd';
import { useMemo } from 'react';
import { FaDownload } from 'react-icons/fa';
import { Markdown } from '../../common/Markdown';

export interface CodeViewProps {
  className?: string;
  toolName?: string;
  toolCall?: any;
  content?: any;
}

export default function CodeView(props: CodeViewProps) {
  const { className, toolName, toolCall, content } = props;

  return (
    <div className="flex flex-col gap-2 items-start">
      {/* <a href={toolCall.args.path} target="_blank" rel="noreferrer">
        {tcontent}
      </a> */}
      <div className="flex flex-row gap-2">
        {toolCall?.args?.dependencies &&
          toolCall.args.dependencies.map((x) => {
            return <Tag>{x}</Tag>;
          })}
      </div>

      <Markdown value={`\`\`\`python\n${toolCall.args.script}\n\`\`\``} />
      {content && <Markdown value={content.text} />}
    </div>
  );
}

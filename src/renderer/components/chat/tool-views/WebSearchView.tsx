import { Button } from 'antd';
import { useMemo } from 'react';
import { FaDownload, FaSearch } from 'react-icons/fa';

export interface WebSearchViewProps {
  className?: string;
  toolName?: string;
  toolCall?: any;
  content?: any;
}

export default function WebSearchView(props: WebSearchViewProps) {
  const { className, toolName, toolCall, content } = props;

  return (
    <div>
      <div className="flex items-center gap-2">
        <FaSearch />
        {toolCall.args.query}
      </div>
      <div className="text-xs break-all whitespace-pre-wrap mt-2 flex flex-col gap-2">
        {JSON.parse(content?.text)?.map((item: any) => (
          <div
            key={item.url}
            className="bg-gray-100 rounded-xl p-2 flex flex-col "
          >
            <div className="text-sm font-bold line-clamp-1">{item.title}</div>
            <a className="text-xs text-gray-500 line-clamp-1" href={item.url}>
              {item.url}
            </a>
          </div>
        ))}
      </div>
    </div>
  );
}

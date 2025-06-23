import { Button } from 'antd';
import { useMemo } from 'react';
import { FaDownload, FaSearch } from 'react-icons/fa';

export interface KnowledgebaseQueryViewProps {
  className?: string;
  toolName?: string;
  toolCall?: any;
  content?: any;
}

export default function KnowledgebaseQueryView(
  props: KnowledgebaseQueryViewProps,
) {
  const { className, toolName, toolCall, content } = props;
  const items = useMemo(() => {
    if (!content?.text) return [];

    // 1. 给多段 <content> 包一层根标签
    const xmlString = `<root>${content.text}</root>`;

    // 2. 解析成 Document
    const parser = new DOMParser();
    const xmlDoc = parser.parseFromString(xmlString, 'application/xml');

    // 3. 把所有 <content> 节点映射成需要的对象
    return Array.from(xmlDoc.getElementsByTagName('content')).map((el) => ({
      title: el.getAttribute('title') ?? '',
      src: el.getAttribute('src') ?? '',
      content: el.textContent ?? '',
    }));
  }, [content]);
  return (
    <div>
      <div className="flex items-center gap-2">
        <FaSearch />
        {toolCall?.args?.question}
      </div>
      <div className="text-xs break-all whitespace-pre-wrap mt-2 flex flex-col gap-2">
        {items?.map((item, index) => (
          <div
            key={index}
            className="bg-gray-100 rounded-xl p-2 flex flex-col "
          >
            {/* <div className="text-sm font-bold line-clamp-1">{item.title}</div> */}
            <a
              className="text-xs text-gray-500 line-clamp-1"
              href={`file://${item.src}`}
            >
              {item.title}
            </a>
            <div>{item.content}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

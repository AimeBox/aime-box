import { ReactNode, useEffect, useState } from 'react';
import { Markdown } from './Markdown';
import { cn } from '@/lib/utils';

export interface ResponseCardProps {
  value: string;
  className?: string;
}

export function ResponseCard({ value, className }: ResponseCardProps) {
  function convertToMarkdown(obj: any, parentKey: string = ''): string {
    let markdown = '';
    if (!obj) return '';
    if (typeof obj == 'object') {
      for (const [key, value] of Object.entries(obj)) {
        const fullKey = parentKey ? `${parentKey}.${key}` : key;

        if (typeof value === 'object' && value !== null) {
          markdown += convertToMarkdown(value, fullKey);
        } else {
          if (typeof value === 'string' && value.startsWith('data:image/')) {
            markdown += `![image](${value})\n`;
          }

          markdown += `**${fullKey}**\n${value}\n`;
        }
      }
      return markdown;
    } else {
      return obj.toString();
    }
  }
  const canParseJson = (value) => {
    try {
      if (typeof value == 'object') return true;
      const _ = JSON.parse(value);
      return true;
    } catch {
      return false;
    }
  };
  const toMarkdown = (value: object | string) => {
    if (typeof value == 'object') {
      return convertToMarkdown(value);
    } else if (typeof value == 'string' && canParseJson(value)) {
      const s = JSON.parse(value);
      return convertToMarkdown(s);
    } else if (typeof value == 'string' && !canParseJson(value)) {
      if (value.startsWith('data:image/')) {
        return `![image](${value})\n`;
      }
    }

    return value;
  };

  const [markdown, setMarkdown] = useState(toMarkdown(value));

  useEffect(() => {
    setMarkdown(toMarkdown(value));
  }, [value]);
  return (
    <div
      className={cn(
        'flex justify-start p-4 mb-4 w-full h-full bg-gray-200 rounded-2xl align-center',
        className,
      )}
    >
      <Markdown value={markdown} />
    </div>
  );
}

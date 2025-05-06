import React, { useCallback, useMemo } from 'react';
import type { ChatInputAttachment } from '../../../types/chat';
import {
  FaFile,
  FaFileExcel,
  FaFilePdf,
  FaFilePowerpoint,
  FaFileWord,
  FaFolder,
  FaImage,
  FaReadme,
  FaTrashAlt,
} from 'react-icons/fa';

export interface ChatAttachmentProps {
  value: ChatInputAttachment;
  onDelete?: () => void;
}

export default function ChatAttachment({
  value,
  onDelete,
}: ChatAttachmentProps) {
  const handleDragStart = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    window.electron.app.startDrag(value.path);
  };

  const renderIcon = useCallback(() => {
    if (value.type == 'folder') {
      return <FaFolder />;
    }
    if (value.ext == '.doc' || value.ext == '.docx') {
      return <FaFileWord />;
    } else if (value.ext == '.xlsx' || value.ext == '.xls') {
      return <FaFileExcel />;
    } else if (value.ext == '.ppt' || value.ext == '.pptx') {
      return <FaFilePowerpoint />;
    } else if (value.ext == '.pdf') {
      return <FaFilePdf />;
    } else if (
      value.ext == '.jpg' ||
      value.ext == '.jpeg' ||
      value.ext == '.png' ||
      value.ext == '.gif' ||
      value.ext == '.bmp' ||
      value.ext == '.webp'
    ) {
      return <FaImage />;
    }

    return <FaFile />;
  }, [value]);

  return (
    <div
      className="h-8 max-w-[15rem] min-w-[10rem] items-center justify-between cursor-pointer group flex flex-row border gap-1 border-gray-200 dark:border-none rounded-xl px-2 hover:bg-gray-200 bg-gray-100 dark:bg-gray-800 dark:hover:bg-gray-700 transition-all duration-300"
      draggable
      onDragStart={handleDragStart}
    >
      <div className="flex flex-row flex-1 gap-1 items-center min-w-0">
        <div
          className="flex overflow-hidden flex-row flex-1 gap-1 items-center text-sm font-medium dark:text-gray-100"
          onClick={() => {
            window.electron.app.openPath(value.path);
          }}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              window.electron.app.openPath(value.path);
            }
          }}
        >
          <div>{renderIcon()}</div>
          <div className="line-clamp-1">{value.name}</div>
        </div>
      </div>

      {onDelete && (
        <div className="w-4 h-4">
          {/* <button className="border border-white" type="button"></button> */}
          <FaTrashAlt
            className="opacity-0 transition-all duration-300 group-hover:opacity-100"
            onClick={() => onDelete()}
          />
        </div>
      )}
    </div>
  );
}

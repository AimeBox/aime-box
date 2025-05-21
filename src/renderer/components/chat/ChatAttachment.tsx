import React, { useCallback, useMemo, useState } from 'react';
import type { ChatInputAttachment } from '../../../types/chat';
import {
  FaEllipsisH,
  FaEllipsisV,
  FaFile,
  FaFileExcel,
  FaFilePdf,
  FaFilePowerpoint,
  FaFileWord,
  FaFolder,
  FaFolderOpen,
  FaImage,
  FaReadme,
  FaTrashAlt,
} from 'react-icons/fa';
import { Button, Popover } from 'antd';

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

  const [openMenu, setOpenMenu] = useState(false);

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
      className="h-8 max-w-[15rem] min-w-[10rem] items-center justify-between cursor-pointer group flex flex-row border gap-1 border-gray-200 dark:border-none rounded-xl px-2 hover:bg-gray-300 bg-gray-200 dark:bg-gray-800 dark:hover:bg-gray-700 transition-all duration-300"
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

      <div>
        <Popover
          placement="bottomLeft"
          trigger="click"
          open={openMenu}
          onOpenChange={setOpenMenu}
          content={
            <div
              className="flex flex-col items-start"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                setOpenMenu(false);
              }}
            >
              <Button
                type="text"
                className="w-full"
                icon={<FaFolderOpen />}
                onClick={() => {
                  window.electron.app.showItemInFolder(value.path);
                }}
              >
                Open Folder
              </Button>
              {onDelete && (
                <Button
                  type="text"
                  className="w-full"
                  icon={<FaTrashAlt />}
                  onClick={() => onDelete()}
                >
                  Delete
                </Button>
              )}
            </div>
          }
        >
          <FaEllipsisH />
        </Popover>
      </div>
    </div>
  );
}

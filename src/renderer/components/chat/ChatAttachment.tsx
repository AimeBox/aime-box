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
  onDelete: () => void;
}

export default function ChatAttachment({
  value,
  onDelete,
}: ChatAttachmentProps) {
  return (
    <div className="h-8 max-w-[15rem] min-w-[10rem] items-center justify-between cursor-pointer group flex flex-row border gap-1 border-gray-200 dark:border-none rounded-xl px-2 hover:bg-gray-200 dark:hover:bg-gray-700 transition-all duration-300">
      <div className="flex flex-row flex-1 gap-1 items-center min-w-0">
        <div
          className="flex overflow-hidden flex-row flex-1 gap-1 items-center text-sm font-medium dark:text-gray-100"
          onClick={() => {
            window.electron.ipcRenderer.sendSync('app:openPath', value.path);
          }}
        >
          <div>
            {(value.ext == '.doc' || value.ext == '.docx') && <FaFileWord />}
            {(value.ext == '.xlsx' || value.ext == '.xls') && <FaFileExcel />}
            {(value.ext == '.ppt' || value.ext == '.pptx') && (
              <FaFilePowerpoint />
            )}
            {value.ext == '.pdf' && <FaFilePdf />}
            {value.ext == '.jpg' && <FaImage />}
            {value.ext == undefined && value.type == 'folder' && <FaFolder />}
          </div>
          <div className="line-clamp-1">{value.name}</div>
        </div>
      </div>

      <div className="w-4 h-4">
        {/* <button className="border border-white" type="button"></button> */}
        <FaTrashAlt
          className="opacity-0 transition-all duration-300 group-hover:opacity-100"
          onClick={() => onDelete()}
        />
      </div>
    </div>
  );
}

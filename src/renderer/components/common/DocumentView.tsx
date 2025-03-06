import { cn } from '@/lib/utils';
import { ScrollArea } from '@radix-ui/react-scroll-area';
import { Button } from 'antd';
import { useState } from 'react';
import {
  FaAngleLeft,
  FaAngleRight,
  FaArrowLeft,
  FaArrowRight,
  FaExpand,
  FaSearchMinus,
  FaSearchPlus,
} from 'react-icons/fa';
import { Document, Page, pdfjs } from 'react-pdf';
import 'react-pdf/dist/Page/AnnotationLayer.css';
import 'react-pdf/dist/Page/TextLayer.css';

pdfjs.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;

interface DocumentViewProps {
  file: string;
  className?: string;
  onLoadSuccess?: (numPages: number) => void;
}

export default function DocumentView(props: DocumentViewProps) {
  const { file, className, onLoadSuccess } = props;
  const [pageNumber, setPageNumber] = useState(1);
  const [numPages, setNumPages] = useState(1);
  const [scale, setScale] = useState(1);
  // 当 PDF 加载成功时，设置页面数量
  const onDocumentLoadSuccess = ({ numPages }: { numPages: number }) => {
    setNumPages(numPages);
    onLoadSuccess?.(numPages);
  };
  return (
    <div className="flex flex-col h-full">
      <div className="flex flex-row justify-between items-center p-2 w-full">
        <Button>{file}</Button>
        <div className="flex flex-row gap-2 items-center">
          <Button
            type="text"
            icon={<FaSearchMinus></FaSearchMinus>}
            onClick={() => setScale(scale - 0.25)}
          ></Button>
          <Button
            type="text"
            icon={<FaSearchPlus></FaSearchPlus>}
            onClick={() => setScale(scale + 0.25)}
          ></Button>
          <Button
            type="text"
            icon={<FaAngleLeft></FaAngleLeft>}
            onClick={() => setPageNumber(pageNumber - 1)}
            disabled={pageNumber === 1}
          ></Button>
          {pageNumber} / {numPages}
          <Button
            type="text"
            icon={<FaAngleRight></FaAngleRight>}
            onClick={() => setPageNumber(pageNumber + 1)}
            disabled={pageNumber === numPages}
          ></Button>
        </div>
      </div>
      <div className="overflow-y-scroll flex-1 bg-gray-100">
        <Document
          className={cn(className, 'items-start')}
          file={file}
          onLoadSuccess={onDocumentLoadSuccess}
        >
          <div className="flex flex-col gap-2">
            {Array.from({ length: numPages }, (_, index) => (
              <Page key={index} pageNumber={index + 1} scale={scale} />
            ))}
          </div>
        </Document>
      </div>
    </div>
  );
}

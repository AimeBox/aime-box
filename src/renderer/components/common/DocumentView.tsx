import { cn } from '@/lib/utils';
import { ScrollArea } from '@radix-ui/react-scroll-area';
import { Button, Spin } from 'antd';
import {
  useState,
  useCallback,
  useRef,
  useEffect,
  forwardRef,
  useImperativeHandle,
} from 'react';
import {
  FaAngleLeft,
  FaAngleRight,
  FaArrowLeft,
  FaArrowRight,
  FaExpand,
  FaSearchMinus,
  FaSearchPlus,
  FaHighlighter,
  FaRegObjectGroup,
} from 'react-icons/fa';
import { Document, Page, pdfjs } from 'react-pdf';
import 'react-pdf/dist/Page/AnnotationLayer.css';
import 'react-pdf/dist/Page/TextLayer.css';
import { ChatInputAttachment } from '@/types/chat';
// import {
//   PdfLoader,
//   PdfHighlighter,
//   Tip,
//   Highlight,
//   AreaHighlight,
//   IHighlight,
// } from 'react-pdf-highlighter';

import { PdfViewer } from 'react-pdf-selection';
//import { TextLayerBuilder } from 'pdfjs-dist/web/pdf_viewer.mjs';

pdfjs.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;

// 定义选择类型
interface Selection {
  content: {
    text?: string;
    image?: string;
  };
  position: {
    boundingRect: {
      x1: number;
      y1: number;
      x2: number;
      y2: number;
      width: number;
      height: number;
    };
    rects: Array<{
      x1: number;
      y1: number;
      x2: number;
      y2: number;
      width: number;
      height: number;
    }>;
    pageNumber: number;
  };
  comment?: string;
  id?: string;
}

interface DocumentViewProps {
  files?: ChatInputAttachment[];
  className?: string;
  onLoadSuccess?: (numPages: number) => void;
}

export interface DocumentViewRef {
  getImages: () => Promise<string[]>;
}

const DocumentView = forwardRef<DocumentViewRef, DocumentViewProps>(
  (props, ref) => {
    const { files, className, onLoadSuccess } = props;
    const [pageNumber, setPageNumber] = useState(1);
    const [numPages, setNumPages] = useState(1);
    const [scale, setScale] = useState(1);
    const pdfViewerRef = useRef(null);
    const [currentFile, setCurrentFile] = useState<
      ChatInputAttachment | undefined
    >(files[0]);
    const [pageDimensions, setPageDimensions] = useState<any>();
    // 滚动到指定页面的函数
    const scrollToPage = useCallback((pageNum: number) => {
      const pageElement = document.querySelector(
        `.pdfViewer__page-container:nth-of-type(${pageNum})`,
      );
      if (pageElement) {
        pageElement.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    }, []);

    async function pdfToBase64(pdfUrl) {
      const loadingTask = pdfjs.getDocument(pdfUrl);
      const pdf = await loadingTask.promise;
      const base64Images = [];
      for (let i = 1; i <= pdf.numPages; i++) {
        const page = await pdf.getPage(i);

        // 设置渲染比例（提高清晰度）
        const scale = 2;
        const viewport = page.getViewport({ scale });

        // 创建 Canvas
        const canvas = document.createElement('canvas');
        const context = canvas.getContext('2d');
        canvas.width = viewport.width;
        canvas.height = viewport.height;

        // 渲染 PDF 页面到 Canvas
        const renderContext = {
          canvasContext: context,
          viewport: viewport,
        };
        await page.render(renderContext).promise;

        // 将 Canvas 转换为 Base64 图片
        const base64Image = canvas.toDataURL('image/jpeg'); // 你也可以改成 "image/jpeg"
        base64Images.push(base64Image);
      }
      return base64Images;
    }

    const extractAllContent = async () => {
      if (!currentFile.path) return;
      try {
        // 加载PDF文档
        const loadingTask = pdfjs.getDocument(currentFile.path);

        const pdf = await loadingTask.promise;

        const paragraphs: any[] = [];
        const imageBlocks: any[] = [];

        // 遍历所有页面
        for (let i = 1; i <= pdf.numPages; i++) {
          const page = await pdf.getPage(i);
          const viewport = page.getViewport({ scale: 1.0 });
          const textContent = await page.getTextContent();

          console.log(textContent);
        }
      } catch (error) {
        console.error('提取PDF内容时出错:', error);
      }

      // try {
      //   // 加载PDF文档
      //   const loadingTask = pdfjs.getDocument(file.path);
      //   const pdf = await loadingTask.promise;

      //   const textBlocks: any[] = [];
      //   const imageBlocks: any[] = [];

      //   // 遍历所有页面
      //   for (let i = 1; i <= pdf.numPages; i++) {
      //     const page = await pdf.getPage(i);
      //     const viewport = page.getViewport({ scale: 1.0 });
      //     // 获取文本内容
      //     const textContent = await page.getTextContent();
      //     textContent.items.forEach((item: any) => {
      //       if (item.str && item.str.trim()) {
      //         textBlocks.push({
      //           text: item.str,
      //           position: item.transform,
      //           pageNumber: i,
      //         });
      //       }
      //     });

      //     // 获取操作符列表（包含图片信息）
      //     const operatorList = await page.getOperatorList();
      //     let currentTransform: number[] | null = null;

      //     for (let j = 0; j < operatorList.fnArray.length; j++) {
      //       const fn = operatorList.fnArray[j];
      //       const args = operatorList.argsArray[j];

      //       // 保存当前变换矩阵
      //       if (fn === pdfjs.OPS.save) {
      //         // 保存状态
      //       } else if (fn === pdfjs.OPS.restore) {
      //         // 恢复状态
      //       } else if (fn === pdfjs.OPS.transform) {
      //         // 保存变换矩阵
      //         currentTransform = args;
      //       } else if (fn === pdfjs.OPS.paintImageXObject) {
      //         const imgData = args[0];

      //         // 查找图像对象
      //         try {
      //           const imgObj = await page.objs.get(imgData);

      //           if (imgObj && currentTransform) {
      //             // 从变换矩阵中提取坐标和尺寸
      //             // 变换矩阵格式: [a, b, c, d, e, f]
      //             // 其中 e, f 是 x, y 坐标
      //             const [a, b, c, d, x, y] = currentTransform;

      //             // 计算宽度和高度 (近似值)
      //             const width = Math.abs(a) * imgObj.width;
      //             const height = Math.abs(d) * imgObj.height;

      //             imageBlocks.push({
      //               imageId: imgData,
      //               pageNumber: i,
      //               position: {
      //                 x: x,
      //                 y: viewport.height - y - height, // PDF坐标系从底部开始，需要转换
      //                 width: width,
      //                 height: height,
      //               },
      //               transform: [...currentTransform],
      //             });
      //           }
      //         } catch (error) {
      //           console.error('获取图像对象时出错:', error);
      //         }
      //       }
      //     }
      //   }

      //   // setAllTextBlocks(textBlocks);
      //   // setAllImageBlocks(imageBlocks);
      //   console.log('提取的文本块:', textBlocks);
      //   console.log('提取的图片块:', imageBlocks);
      // } catch (error) {
      //   console.error('提取PDF内容时出错:', error);
      // }
    };
    const onLoad = async (originalPageDimensions) => {
      setNumPages(originalPageDimensions.size);
      onLoadSuccess?.(originalPageDimensions.size);
    };
    const setPage = async (pageNumber: number) => {
      setPageNumber(pageNumber);
      scrollToPage(pageNumber);
    };
    const onPrevFile = async () => {
      setCurrentFile(
        files[files.findIndex((file) => file.path === currentFile?.path) - 1],
      );
      setPage(1);
    };
    const onNextFile = async () => {
      setCurrentFile(
        files[files.findIndex((file) => file.path === currentFile?.path) + 1],
      );
      setPage(1);
    };

    const onSetScale = async (scale: number) => {
      let _scale = scale;
      if (_scale < 0.75) {
        _scale = 0.75;
      }
      if (_scale > 4) {
        _scale = 4;
      }
      setScale(_scale);
    };

    useImperativeHandle(ref, () => ({
      getImages: async () => {
        return await pdfToBase64(currentFile.path);
      },
    }));

    useEffect(() => {
      setCurrentFile(files[0]);
      setPage(1);
    }, [files]);

    return (
      <div className="flex flex-col h-full">
        <div className="flex flex-row justify-between items-center p-2 w-full">
          <div className="flex overflow-hidden flex-row flex-1 gap-2 items-center w-full whitespace-nowrap line-clamp-1 text-ellipsis">
            {files.length > 1 && (
              <Button
                type="text"
                icon={<FaAngleLeft></FaAngleLeft>}
                onClick={onPrevFile}
                disabled={
                  files.findIndex((file) => file.path === currentFile?.path) ===
                  0
                }
              ></Button>
            )}

            <strong>{currentFile && currentFile.name}</strong>
            {files.length > 1 && (
              <Button
                type="text"
                icon={<FaAngleRight></FaAngleRight>}
                onClick={onNextFile}
                disabled={
                  files.findIndex((file) => file.path === currentFile?.path) ===
                  files.length - 1
                }
              ></Button>
            )}
          </div>
          <div className="flex flex-row gap-2 items-center">
            <Button
              type="text"
              icon={<FaSearchMinus></FaSearchMinus>}
              onClick={() => onSetScale(scale - 0.25)}
            ></Button>
            <div>{scale * 100}%</div>
            <Button
              type="text"
              icon={<FaSearchPlus></FaSearchPlus>}
              onClick={() => onSetScale(scale + 0.25)}
            ></Button>
            <Button
              type="text"
              icon={<FaAngleLeft></FaAngleLeft>}
              onClick={() => setPage(pageNumber - 1)}
              disabled={pageNumber === 1}
            ></Button>
            {pageNumber} / {numPages}
            <Button
              type="text"
              icon={<FaAngleRight></FaAngleRight>}
              onClick={() => setPage(pageNumber + 1)}
              disabled={pageNumber === numPages}
            ></Button>
          </div>
        </div>
        <div className="overflow-y-scroll flex-1 min-h-0 bg-gray-100">
          {/* <PdfLoader url={file.path} beforeLoad={<Spin />}>
          {(pdfDocument) => (
            <div className="relative w-full h-full">
              <PdfHighlighter
                onLoad={() => {
                  extractAllContent();
                }}
                pdfDocument={pdfDocument}
                enableAreaSelection={(event) => event.altKey}
                highlights={[]}
                onScrollChange={() => {
                  document.location.hash = '';
                }}
                scrollRef={(scrollTo) => {
                  scrollViewerTo.current = scrollTo;
                  scrollToHighlightFromHash();
                }}
                onSelectionFinished={(
                  position,
                  content,
                  hideTipAndSelection,
                  transformSelection,
                ) => {
                  <Tip
                    onOpen={transformSelection}
                    onConfirm={(comment) => {
                      //addHighlight({ content, position, comment });
                      hideTipAndSelection();
                    }}
                  />;
                }}
                highlightTransform={(
                  highlight,
                  index,
                  setTip,
                  hideTip,
                  viewportToScaled,
                  screenshot,
                  isScrolledTo,
                ) => {
                  const isTextHighlight = !highlight.content?.image;

                  const component = isTextHighlight ? (
                    <Highlight
                      isScrolledTo={isScrolledTo}
                      position={highlight.position}
                      comment={highlight.comment}
                    />
                  ) : (
                    <AreaHighlight
                      isScrolledTo={isScrolledTo}
                      highlight={highlight}
                      onChange={(boundingRect) => {
                        // updateHighlight(
                        //   highlight.id,
                        //   { boundingRect: viewportToScaled(boundingRect) },
                        //   { image: screenshot(boundingRect) },
                        // );
                      }}
                    />
                  );
                  return component;
                }}
              ></PdfHighlighter>
            </div>
          )}
        </PdfLoader> */}
          <PdfViewer
            ref={pdfViewerRef}
            url={currentFile.path}
            scale={scale}
            onPageDimensions={(pageDimensions) => {
              setPageDimensions(pageDimensions);
              console.log(pageDimensions);

              let offsets = 0;
              const pageYOffsets = [];
              Array.from(pageDimensions.pageDimensions).map(([_, value]) => {
                pageYOffsets.push((value.height + 10) / 2 + offsets);
                offsets += value.height + 10;
                return offsets;
              });
              console.log(pageYOffsets);
              setTimeout(() => {
                const ss = pdfViewerRef.current;
                const el = ss.scrollingElement;
                el.onscrollend = () => {
                  const page = pageYOffsets.findIndex(
                    (offset) => offset > el.scrollTop + 10,
                  );
                  setPageNumber(page + 1);
                };
              }, 1000);
            }}
            onLoad={onLoad}
          >
            {({ document }) => (
              <div>
                {/* <div style={{ width: '100%', height: '200px' }} /> */}
                <div style={{ display: 'flex', flexDirection: 'row' }}>
                  <div style={{ width: '100%' }}>{document}</div>
                  {/* <div style={{ width: '40%' }}>Sidebar</div> */}
                </div>
              </div>
            )}
          </PdfViewer>
          {/* <Document
          className={cn(className, 'items-start')}
          file={file.path}
          onLoadSuccess={onDocumentLoadSuccess}
        >
          <div className="flex flex-col gap-2">
            {Array.from({ length: numPages }, (_, index) => (
              <Page key={index} pageNumber={index + 1} scale={scale} />
            ))}
          </div>
        </Document> */}
        </div>
      </div>
    );
  },
);
export default DocumentView;

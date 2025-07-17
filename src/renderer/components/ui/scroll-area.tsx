'use client';

import * as React from 'react';
import * as ScrollAreaPrimitive from '@radix-ui/react-scroll-area';

import { cn } from '@/lib/utils';
import { ForwardedRef, useEffect, useRef, useState } from 'react';
import { Button } from 'antd';
import {
  FaArrowAltCircleDown,
  FaArrowCircleDown,
  FaArrowDown,
} from 'react-icons/fa';

const ScrollBar = React.forwardRef<
  React.ElementRef<typeof ScrollAreaPrimitive.ScrollAreaScrollbar>,
  React.ComponentPropsWithoutRef<typeof ScrollAreaPrimitive.ScrollAreaScrollbar>
>(({ className, orientation = 'vertical', ...props }, ref) => (
  <ScrollAreaPrimitive.ScrollAreaScrollbar
    ref={ref}
    orientation={orientation}
    className={cn(
      'flex touch-none select-none transition-colors ',
      orientation === 'vertical' &&
        'h-full w-2.5 border-l border-l-transparent p-[1px]',
      orientation === 'horizontal' &&
        'h-2.5 flex-col border-t border-t-transparent p-[1px] ',
      className,
    )}
    {...props}
  >
    <ScrollAreaPrimitive.ScrollAreaThumb className="relative flex-1 rounded-full bg-border" />
  </ScrollAreaPrimitive.ScrollAreaScrollbar>
));

interface ScrollAreaProps
  extends React.ComponentPropsWithoutRef<typeof ScrollAreaPrimitive.Root> {
  viewPortid?: string;
  showScrollBottom?: boolean;
}

export interface ScrollAreaRef
  extends React.ElementRef<typeof ScrollAreaPrimitive.Root> {
  scrollBottom: (onlyIsBottom?: boolean) => void;
}

const ScrollArea = React.forwardRef<ScrollAreaRef, ScrollAreaProps>(
  ({ className, viewPortid, showScrollBottom, children, ...props }, ref) => {
    const [isBottom, setIsBottom] = useState(false);
    const [scrollHeight, setScrollHeight] = useState(0);
    const internalScrollRef = useRef<HTMLDivElement | null>(null);
    const internalViewportRef = useRef<HTMLDivElement | null>(null);
    const [isScrolling, setIsScrolling] = useState(false);

    const scrollBottom = (onlyIsBottom = false) => {
      const viewportElement = internalViewportRef.current;
      const rootElement = internalScrollRef.current;

      if (!viewportElement || !rootElement) return;
      if (isScrolling) return;

      if (onlyIsBottom) {
        if (isBottom) {
          viewportElement.scrollTo({
            top: viewportElement.scrollHeight,
            behavior: 'smooth',
          });
        }
      } else {
        viewportElement.scrollTo({
          top: viewportElement.scrollHeight,
          behavior: 'smooth',
        });
      }
    };

    React.useImperativeHandle(ref, () => {
      // 获取当前 DOM 元素
      const element = internalScrollRef.current;
      // 创建并返回符合 ScrollAreaRef 接口的对象
      return Object.assign({} as ScrollAreaRef, element || {}, {
        scrollBottom,
      });
    });

    // 监听滚动高度变化和滚动事件
    useEffect(() => {
      // 获取正确的滚动元素 - 在Radix UI中，实际滚动的是Viewport元素
      const viewportElement = internalViewportRef.current;
      const rootElement = internalScrollRef.current;
      viewportElement.children[0].style.display = 'block';
      viewportElement.children[0].style.height = '100%';
      if (!viewportElement || !rootElement) return undefined;
      let timeoutId: NodeJS.Timeout | null = null;

      // 初始设置滚动高度
      setScrollHeight(viewportElement.scrollHeight);

      // 检查是否滚动到底部的函数
      const checkIfBottom = (element: HTMLDivElement) => {
        const isAtBottom =
          Math.abs(
            element.scrollHeight - element.scrollTop - element.clientHeight,
          ) < 256;

        setIsBottom(isAtBottom);
      };

      // 初始检查是否在底部
      checkIfBottom(viewportElement);

      // 监听滚动事件
      const handleScroll = () => {
        // 更新滚动高度
        setScrollHeight(viewportElement.scrollHeight);
        // 检查是否滚动到底部
        checkIfBottom(viewportElement);

        if (timeoutId) clearTimeout(timeoutId);
        timeoutId = setTimeout(() => {
          setIsScrolling(false);
        }, 300);
      };

      // 创建ResizeObserver来监听元素大小变化
      const resizeObserver = new ResizeObserver(() => {
        setScrollHeight(viewportElement.scrollHeight);
        checkIfBottom(viewportElement);
      });

      // 添加监听 - 关键是监听viewport元素而不是root元素
      resizeObserver.observe(viewportElement);
      viewportElement.addEventListener('scroll', handleScroll);

      // 清理函数
      return () => {
        resizeObserver.disconnect();
        viewportElement.removeEventListener('scroll', handleScroll);
        if (timeoutId) clearTimeout(timeoutId);
      };
    }, []);

    return (
      <ScrollAreaPrimitive.Root
        ref={internalScrollRef}
        className={cn('overflow-hidden relative', className)}
        {...props}
      >
        {showScrollBottom && (
          <div
            className={`absolute bottom-6 right-6 z-10 text-xs p-8 ${!isBottom ? 'opacity-30 hover:opacity-50' : 'hidden opacity-0'} transition-opacity duration-300`}
          >
            <FaArrowCircleDown
              onClick={() => scrollBottom(false)}
              className="w-8 h-8 cursor-pointer"
            />
          </div>
        )}

        <ScrollAreaPrimitive.Viewport
          className="h-full w-full rounded-[inherit]"
          id={viewPortid}
          ref={internalViewportRef}
        >
          {children}
        </ScrollAreaPrimitive.Viewport>
        <ScrollBar />
        <ScrollAreaPrimitive.Corner />
      </ScrollAreaPrimitive.Root>
    );
  },
);
ScrollArea.displayName = ScrollAreaPrimitive.Root.displayName;

ScrollBar.displayName = ScrollAreaPrimitive.ScrollAreaScrollbar.displayName;

export { ScrollArea, ScrollBar, ScrollAreaProps };

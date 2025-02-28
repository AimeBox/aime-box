import { Button, Divider, Input, Popconfirm, Skeleton } from 'antd';
import { ForwardedRef, ReactNode, forwardRef, useRef, useState } from 'react';
import { FaEdit, FaPlus, FaSearch, FaTrashAlt } from 'react-icons/fa';
import { Link } from 'react-router-dom';
import { ScrollArea } from '@/renderer/components/ui/scroll-area';
import InfiniteScroll from 'react-infinite-scroll-component';

export interface ListProps {
  width?: number | null;
  height?: number | string | null;
  showSearch?: boolean;
  shadow?: boolean;
  onAdd?: () => void | null;
  onSearch?: (text: string) => void;
  children: ReactNode;
  addButton?: ReactNode;
  dataLength?: number | null;
  hasMore?: boolean | null;
  loadMoreData?: () => void | null;
}

const List = forwardRef((props: ListProps) => {
  const {
    showSearch = true,
    width = 250,
    height = '100%',
    onAdd = () => {},
    shadow = true,
    dataLength = 0,
    hasMore = false,
    loadMoreData,
  } = props;

  const scrollAreaRef = useRef();

  const onSearch = (text: string) => {
    if (props.onSearch) props.onSearch(text);
  };

  const next = () => {
    loadMoreData();
  };

  return (
    <div
      className={`max-h-[${height}] h-[${height}] lg:relative  dark:bg-gray-800 dark:text-gray-200 text-gray-700 ${shadow ? 'shadow-2xl' : 'text-sm transition'}`}
      style={{ width: `${width}px` }}
    >
      <ul
        className={`flex flex-col my-auto max-h-[${height}] h-[${height}]`}
        style={{ height: height }}
      >
        {(showSearch || props.addButton) && (
          <li className="flex justify-center p-2 mt-3">
            <div className="flex flex-row gap-2 w-full">
              {showSearch && (
                <Input
                  className="flex-1"
                  placeholder="Search"
                  prefix={<FaSearch />}
                  onChange={(e) => onSearch(e.target.value)}
                />
              )}

              {props.addButton ?? (
                <Button icon={<FaPlus />} onClick={onAdd}></Button>
              )}
            </div>
          </li>
        )}
        <ScrollArea
          className="pl-2 my-2"
          viewPortid="scrollableDiv"
          ref={scrollAreaRef}
        >
          <InfiniteScroll
            dataLength={dataLength}
            next={next}
            hasMore={hasMore}
            loader={
              <div className="pr-3 mt-1">
                <Skeleton.Button active block shape="round" />
              </div>
            }
            endMessage={<Divider plain>no more 🤐</Divider>}
            scrollableTarget="scrollableDiv"
          >
            <div>{props.children}</div>
          </InfiniteScroll>
        </ScrollArea>
      </ul>
    </div>
  );
});

export default List;

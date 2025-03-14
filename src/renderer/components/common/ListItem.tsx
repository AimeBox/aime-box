import { Button, Popover } from 'antd';
import { forwardRef, Key, ReactNode, useState } from 'react';
import { FaEllipsisH, FaTrashAlt } from 'react-icons/fa';
import { Link, useLocation, useNavigate } from 'react-router-dom';

export interface ListItemProps {
  children?: ReactNode;
  title?: ReactNode | string;
  subTitle?: string | ReactNode;
  href?: string;
  active?: boolean;
  menu?: ReactNode;
  onClick?: () => void;
  icon?: ReactNode;
  // openMenu?: boolean;
  // setOpenMenu?: (open: boolean) => void;
}

export const ListItem = forwardRef((props: ListItemProps) => {
  const {
    children,
    href,
    title,
    subTitle,
    active = false,
    menu,
    onClick,
    icon,
    // openMenu,
    // setOpenMenu,
  } = props;
  const [openMenu, setOpenMenu] = useState(false);
  return (
    <div className="relative pr-2 mr-2 group">
      <Link
        className={`flex flex-row items-center justify-between px-3 py-2 transition rounded-xl dark:hover:bg-gray-900 hover:bg-gray-200 gap-2  ${
          active ? 'text-blue-600 bg-blue-100 dark:bg-gray-900' : ''}`}
        to={href}
        onClick={onClick}
      >
        <div className="flex overflow-hidden self-center w-full whitespace-nowrap text-ellipsis">
          <div className="self-center text-left">
            <div className="flex flex-col">
              <div className="flex flex-row items-center">
                {icon && <div className="mr-1">{icon}</div>}
                <div
                  className="font-bold whitespace-normal line-clamp-1"
                  style={{
                    wordBreak: 'break-all',
                  }}
                >
                  {title}
                </div>
              </div>
              <small className="text-gray-500 whitespace-normal line-clamp-1">
                {subTitle}
              </small>
              {children}
            </div>
          </div>
        </div>
        {menu && (
          <div className="flex-1 w-14">
            <Popover
              placement="rightTop"
              trigger="click"
              open={openMenu}
              onOpenChange={setOpenMenu}
              content={
                <div
                  className="flex flex-col"
                  onClick={(e) => {
                    setOpenMenu(false);
                  }}
                >
                  {menu}
                </div>
              }
            >
              <Button
                type="text"
                icon={<FaEllipsisH />}
                className={`flex-1 text-gray-600  hover:text-gray-800 ${active ? 'opacity-100' : 'opacity-0'} group-hover:opacity-100`}
              />
            </Popover>
          </div>
        )}
      </Link>
    </div>
  );
});

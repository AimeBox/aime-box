import { useContext, useEffect, useMemo, useState } from 'react';
import {
  Link,
  Route,
  Switch,
  useLocation,
  useNavigate,
} from 'react-router-dom';
import {
  FaHome,
  FaCloud,
  FaUserCircle,
  FaSignOutAlt,
  FaMessage,
  FaTools,
  FaBook,
  FaGithub,
  FaInfo,
  FaInfoCircle,
  FaAtom,
  FaPlug,
  FaHubspot,
  FaRegKeyboard,
} from 'react-icons/fa';
import { FaGear, FaRegMessage } from 'react-icons/fa6';
import { Menu, Image } from 'antd';
import {
  MenuDividerType,
  MenuItemType,
  SubMenuType,
} from 'antd/es/menu/interface';
import { useTheme } from '../theme/ThemeProvider';
import ThemeToggle from '../theme/ThemeToggle';
import { t } from 'i18next';
import i18n from '@/i18n';
import Login from '../Login';

export default function Sidebar() {
  const { theme, setTheme } = useTheme();
  const navigate = useNavigate();
  const location = useLocation();
  const [show, setShow] = useState(true);
  const [showSettingModel, setShowSettingModel] = useState(false);
  const [showAboutModel, setShowAboutModel] = useState(false);
  const appInfo = window.electron.app.info();
  const [showLoginModal, setShowLoginModal] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const [defaultSelectedKeys, setDefaultSelectedKeys] = useState([]);
  const [openKeys, setOpenKeys] = useState([]);

  const meunList = useMemo(
    () => [
      {
        key: 'home',
        icon: <FaHome />,
        label: t('sidebar.home'),
        href: '/home',
      },
      {
        key: 'chat',
        icon: <FaRegMessage />,
        label: t('sidebar.chat'),
        href: '/chat',
      },
      {
        key: 'agent',
        icon: <FaHubspot />,
        label: t('sidebar.agent'),
        href: '/agent',
      },
      {
        key: 'tool',
        icon: <FaTools />,
        label: t('sidebar.tools'),
        href: '/tools',
      },
      {
        key: 'providers',
        icon: <FaCloud />,
        label: t('sidebar.providers'),
        href: '/Providers',
      },
      {
        key: 'knowledge-base',
        icon: <FaBook />,
        label: t('sidebar.knowledgebase'),
        href: '/knowledge-base',
      },
      {
        key: 'prompts',
        icon: <FaRegKeyboard />,
        label: t('sidebar.prompts'),
        href: '/prompts',
      },

      // {
      //   key: 'explores',
      //   icon: <FaAtom />,
      //   label: 'Explores',
      //   href: '/explores',
      // },
      // {
      //   key: 'plugins',
      //   icon: <FaPlug />,
      //   label: 'Plugins',
      //   href: '/plugins',
      // },
      {
        key: 'settings',
        icon: <FaGear />,
        label: t('sidebar.settings'),
        href: '/settings',
      },
    ],
    [i18n.language],
  );

  const defaultMeunBottomList = [
    {
      key: 'github',
      icon: <FaGithub />,
      label: 'Github',
      href: 'https://github.com/AimeBox/aime-box',
    },
  ] as any[];
  const [meunBottomList, setMeunBottomList] = useState<MenuItemType[]>([
    ...defaultMeunBottomList,

    {
      key: 'theme',
      label: t('sidebar.theme'),
      icon: (
        <div className="flex justify-center items-center w-full text-sm">
          <ThemeToggle />
        </div>
      ),
    },

    {
      key: 'profile',
      icon: <FaUserCircle />,
      label: 'Profile',
    } as SubMenuType,
  ]);

  useEffect(() => {}, []);

  async function signOut() {
    // await supabase.auth.signOut();
    navigate('/chat');
  }
  useEffect(() => {
    const meun = meunList.find((x) => location.pathname.startsWith(x.href));
    if (meun) {
      setTimeout(() => {
        setDefaultSelectedKeys([meun.key]);
      });
    } else {
      setDefaultSelectedKeys([]);
    }
  }, [location]);
  return (
    <>
      {/* <SettingModel
        open={showSettingModel}
        onOk={() => setShowSettingModel(false)}
        onCancel={() => setShowSettingModel(false)}
      /> */}
      {/* <AboutModel open={showAboutModel} onOk={() => setShowAboutModel(false)} />
      <LoginModal open={showLoginModal} onOk={() => setShowLoginModal(false)} /> */}
      <Login open={showLoginModal} onClose={() => setShowLoginModal(false)} />
      <div className="">
        <div className="flex overflow-hidden flex-col h-full">
          <Menu
            className="flex-1 !px-2 bg-transparent pt-2"
            mode="inline"
            theme={theme}
            inlineCollapsed
            selectedKeys={defaultSelectedKeys}
            defaultSelectedKeys={defaultSelectedKeys}
            style={{ width: 80, border: 'none' }}
            items={meunList}
            onClick={({ item, key, keyPath, domEvent }) => {
              navigate(item.props.href);
            }}
          />
          <div className="" style={{}}>
            <hr className="border-gray-500" />
            <Menu
              className="!px-2 bg-transparent"
              mode="inline"
              theme={theme}
              inlineCollapsed
              selectable={false}
              triggerSubMenuAction="click"
              defaultSelectedKeys={defaultSelectedKeys}
              //openKeys={openKeys}
              style={{ width: 80, border: 'none' }}
              items={meunBottomList}
              onClick={(e) => {
                //setOpenKeys([]);

                if (e.key === 'profile') {
                  setShowLoginModal(true);
                } else if (e.item.props.href) {
                  console.log(e);
                  window.open(e.item.props.href, '_blank');
                }
              }}
              onSelect={({ item, key, keyPath, selectedKeys, domEvent }) => {}}
            />
            <div className="flex justify-center items-center py-2 w-full text-sm">
              {appInfo.version}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

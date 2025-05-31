import {
  HashRouter,
  MemoryRouter as Router,
  Routes,
  Route,
} from 'react-router-dom';
import 'tailwindcss/tailwind.css';
import icon from '../../assets/icon.png';
import './App.css';
import { Provider, useDispatch, useSelector } from 'react-redux';
import store from './store';
import Home from './pages/Home';
import Sidebar from './components/layout/Sidebar';
import { ConfigProvider, notification, Progress } from 'antd';
import { ThemeProvider, useTheme } from './components/theme/ThemeProvider';
import Providers from './pages/Providers';
import i18n from '@/i18n';
import Settings from './pages/Settings';
import Tools from './pages/Tools';
import ChatPage from './pages/Chat/ChatPage';
import React, { ReactNode, useEffect, useMemo } from 'react';
import { fetchProviders } from './store/providerSlice';
import AgentPage from './pages/Agent/AgentPage';
import { setSettings } from './store/settingsSlice';
import { ipcRenderer } from 'electron';
import { NotificationMessage } from '@/types/notification';
import Link from 'antd/es/typography/Link';
import PromptsPage from './pages/Prompts/PromptsPage';
import KnowledgeBasePage from './pages/KnowledgeBase/KnowledgeBasePage';
import { GlobalContextProvider } from './context/GlobalContext';
import { use } from 'i18next';

function TemplatePage(props: { children: ReactNode }) {
  const Context = React.createContext({ name: 'Default' });
  const { children } = props;
  const dispatch = useDispatch();
  useEffect(() => {
    dispatch(fetchProviders());
  }, [dispatch]);
  const settings = window.electron.setting.getSettings();
  dispatch(setSettings(settings));
  //const [api, contextHolder] = notification.useNotification();
  const contextValue = useMemo(() => ({ name: 'Ant Design' }), []);

  return (
    <Context.Provider value={contextValue}>
      <GlobalContextProvider>
        <div className="relative transition-all duration-300 app">
          <div className="flex overflow-auto flex-row min-h-screen max-h-full text-gray-700 bg-white dark:text-gray-100 dark:bg-gray-900">
            <Sidebar />
            <div className="flex-1 w-full min-w-0 h-screen">
              <div className="flex justify-center py-2 pr-2 w-full h-full">
                {children}
              </div>
            </div>
          </div>
        </div>
      </GlobalContextProvider>
    </Context.Provider>
  );
}

export default function App() {
  const { theme, setTheme } = useTheme();

  useEffect(() => {
    console.log(theme);
  }, [theme]);
  return (
    <Provider store={store}>
      <ConfigProvider
        theme={{
          token: {},

          components: {
            Modal: {},
            Input: {},
            Menu: {
              darkItemSelectedBg: '#363943',
              darkSubMenuItemBg: 'rgb(29, 32, 40) !important',
              // darkItemBg: 'rgb(29, 32, 40) !important',
            },
          },
        }}
      >
        <ThemeProvider defaultTheme="dark" storageKey="theme">
          <Router>
            <TemplatePage>
              <Routes>
                <Route path="/home" element={<Home />} />
                <Route path="/agent/*" element={<AgentPage />} />
                <Route path="/prompts/*" element={<PromptsPage />} />
                <Route path="/chat/*" element={<ChatPage />} />
                <Route path="/providers" element={<Providers />} />
                <Route path="/settings/*" element={<Settings />} />
                <Route path="/tools" element={<Tools />} />
                <Route
                  path="/knowledge-base/*"
                  element={<KnowledgeBasePage />}
                />
              </Routes>
            </TemplatePage>
          </Router>
        </ThemeProvider>
      </ConfigProvider>
    </Provider>
  );
}

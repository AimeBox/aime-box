import { Input, Menu, Select } from 'antd';
// import { useTranslation } from 'i18next';
import { useTranslation } from 'react-i18next';
import React, { useEffect, useState } from 'react';
import { FaInfoCircle, FaSearch } from 'react-icons/fa';
import { useTheme } from '../../components/theme/ThemeProvider';
import { GlobalSettings } from '@/main/settings';
import { isUrl } from '@/main/utils/is';
import i18n from '@/i18n';
import GeneralSettings from './GeneralSettings';
import DefaultModelSettings from './DefaultModelSettings';
import AboutPage from './AboutPage';
import DefaultWenSearchEnginSettings from './DefaultWenSearchEnginSettings';
import LocalModelManager from './LocalModelManager';
import { Route, Routes, useNavigate, Link } from 'react-router-dom';
import Content from '@/renderer/components/layout/Content';
import PluginsManager from './PluginsManager';
import InstancesManager from './InstancesManager';

// import { Container } from '@/components/Container';

export default function Settings() {
  const { theme, setTheme } = useTheme();
  const navigate = useNavigate();
  const { t } = useTranslation();
  const [currentPage, setCurrentPage] = useState<string>('general');
  return (
    <Content>
      <div className="flex flex-row h-full">
        <div className="p-4 w-60 text-gray-700 bg-gray-100 dark:bg-gray-800 dark:text-gray-200">
          <h1 className="mb-4 text-2xl font-bold">{t('settings.settings')}</h1>

          <Menu
            theme={theme}
            style={{ border: 'none' }}
            className="bg-transparent"
            // selectedKeys={[currentPage]}
            items={[
              {
                key: 'general',

                label: (
                  <Link to="/settings/general">
                    {t('settings.general_settings')}
                  </Link>
                ),
                // href: '/settings/general',
              },
              {
                key: 'defaultModel',

                label: (
                  <Link to="/settings/defaultModel">
                    {t('settings.defaultModel')}
                  </Link>
                ),
              },
              {
                key: 'defaultWebSearchEngine',

                label: (
                  <Link to="/settings/defaultWebSearchEngine">
                    {t('settings.defaultWebSearchEngine')}
                  </Link>
                ),
              },
              {
                key: 'localModelManager',

                label: (
                  <Link to="/settings/localModelManager">
                    {t('settings.localModelManager')}
                  </Link>
                ),
              },
              {
                key: 'plugins',
                label: (
                  <Link to="/settings/plugins-manager">
                    {t('settings.plugins')}
                  </Link>
                ),
              },
              {
                key: 'instances',
                label: (
                  <Link to="/settings/instances-manager">
                    {t('settings.instances')}
                  </Link>
                ),
              },
              {
                key: 'about',

                label: <Link to="/settings/about">{t('settings.about')}</Link>,
              },
            ]}
            // onClick={({ item, key, keyPath, domEvent }) => {
            //   navigate(item.props.href);
            //   setCurrentPage(key);
            // }}
          />
        </div>

        <div className="flex flex-col flex-1 w-full min-w-0">
          <Routes>
            <Route path="general" element={<GeneralSettings />} />
            <Route path="defaultModel" element={<DefaultModelSettings />} />
            <Route
              path="defaultWebSearchEngine"
              element={<DefaultWenSearchEnginSettings />}
            />
            <Route path="about" element={<AboutPage />} />
            <Route path="localModelManager" element={<LocalModelManager />} />
            <Route path="plugins-manager" element={<PluginsManager />} />
            <Route path="instances-manager" element={<InstancesManager />} />
          </Routes>

          {/* {currentPage == 'general' && <GeneralSettings />}
        {currentPage == 'defaultModel' && <DefaultModelSettings />}
        {currentPage == 'defaultWebSearchEngine' && (
          <DefaultWenSearchEnginSettings />
        )}
        {currentPage == 'about' && <AboutPage />}
        {currentPage == 'local' && <LocalModelManager />} */}
        </div>
      </div>
    </Content>
  );
}

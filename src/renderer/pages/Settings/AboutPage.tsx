import { Collapse, Input, Menu, Select } from 'antd';
import { t } from 'i18next';
import React, { useEffect, useState } from 'react';
import { FaInfoCircle } from 'react-icons/fa';
import { useTheme } from '../../components/theme/ThemeProvider';
import { GlobalSettings } from '@/main/settings';
import { isUrl } from '@/main/utils/is';
import i18n from '@/i18n';

export default function AboutPage() {
  const [appInfo, setAppInfo] = useState<any>({});
  useEffect(() => {
    setAppInfo(window.electron.app.info());
  }, []);
  return (
    <>
      <div className="p-4 shadow">
        <h2 className="text-lg font-semibold">{t('settings.about')}</h2>
      </div>
      <div className="flex flex-col gap-4 p-4">
        <div className="flex flex-col gap-2">
          <div className="font-semibold">Aime Box</div>
          <div className="text-sm text-gray-500">
            Aime Box is a tool agent box for producer.
          </div>
          <Collapse
            items={[
              {
                key: '1',
                label: 'App Info',
                children: (
                  <pre>
                    {Object.keys(appInfo).map((key) => (
                      <div key={key}>
                        <strong>{key}</strong>: {appInfo[key]?.toString()}
                      </div>
                    ))}
                  </pre>
                ),
              },
            ]}
          />
        </div>
      </div>
    </>
  );
}

import { Input, Menu, Select, Switch, InputNumber } from 'antd';
import { t } from 'i18next';
import React, { useEffect, useState } from 'react';
import { useTheme } from '../../components/theme/ThemeProvider';
import { GlobalSettings } from '@/main/settings';
import { isUrl } from '@/main/utils/is';
import i18n from '@/i18n';
import { useDispatch, useSelector } from 'react-redux';
import { State } from '@/renderer/store';
import { setSettings } from '@/renderer/store/settingsSlice';

export default function GeneralSettings() {
  const settings = useSelector<State, GlobalSettings>(
    (state) => state.settings.settings,
  );
  const dispatch = useDispatch();
  const { setTheme } = useTheme();
  const [proxy, setProxy] = useState<string | undefined>();
  const [proxyMode, setProxyMode] = useState<'system' | 'custom' | 'none'>();
  const [serverPort, setServerPort] = useState<number | undefined>();
  const getData = () => {
    const settings = window.electron.setting.getSettings();
    dispatch(setSettings(settings));
    if (settings.proxy == 'system' || settings.proxy == 'none')
      setProxyMode(settings.proxy);
    else {
      setProxyMode('custom');
      setProxy(settings.proxy);
    }
  };
  const onChangeLanguage = (language: string) => {
    window.electron.setting.set('language', language);
    i18n.changeLanguage(language || 'zh-CN');
    getData();
  };
  const onChangeProxy = (proxyMode) => {
    if (proxyMode == 'system' || proxyMode === 'none') {
      window.electron.setting.set('proxy', proxyMode);
      getData();
    } else if (isUrl(proxy) || proxyMode === 'custom') {
      window.electron.setting.set('proxy', proxy);
      getData();
    }
  };
  const onChangeTheme = (value: string) => {
    setTheme(value);
  };

  const onChangeServerEnable = (value: boolean) => {
    window.electron.setting.set('serverEnable', value);
    getData();
  };
  const onChangeShowMcpWindows = (value: boolean) => {
    window.electron.setting.set('showMcpWindows', value);
    getData();
  };
  const onChangeServerPort = () => {
    if (
      serverPort &&
      serverPort > 0 &&
      serverPort < 65535 &&
      serverPort != settings?.serverPort
    ) {
      window.electron.setting.set('serverPort', serverPort);
      getData();
    }
  };

  useEffect(() => {
    getData();
  }, []);
  return (
    <>
      <div className="p-4 shadow">
        <h2 className="text-lg font-semibold">
          {t('settings.general_settings')}
        </h2>
      </div>
      <div className="flex flex-col gap-4 p-4">
        <div className="flex flex-col gap-2">
          <div className="font-semibold">{t('settings.theme.theme')}</div>
          <Select
            value={settings?.theme.mode}
            style={{ width: 200 }}
            onChange={onChangeTheme}
            options={[
              { value: 'light', label: t('settings.theme.light') },
              { value: 'dark', label: t('settings.theme.dark') },
              { value: 'system', label: t('settings.theme.system') },
            ]}
          />
        </div>
        <div className="flex flex-col gap-2">
          <div className="font-semibold">{t('settings.language')}</div>
          <Select
            value={settings?.language}
            style={{ width: 200 }}
            onChange={onChangeLanguage}
            options={[
              { value: 'zh-CN', label: '中文' },
              { value: 'en-US', label: 'English' },
            ]}
          />
        </div>
        <div className="flex flex-col gap-2">
          <div className="font-semibold">{t('settings.proxy.proxy')}</div>
          <div className="flex flex-row gap-2">
            <Select
              value={proxyMode}
              style={{ width: 150 }}
              onChange={(v) => onChangeProxy(v)}
              options={[
                { value: 'system', label: t('settings.proxy.system') },
                { value: 'custom', label: t('settings.proxy.custom') },
                { value: 'none', label: t('settings.proxy.none') },
              ]}
            />
            {proxyMode === 'custom' && (
              <Input
                value={proxy}
                style={{ width: 200 }}
                placeholder="http://127.0.0.1:10809"
                onChange={(e) => setProxy(e.target.value)}
                onBlur={() => onChangeProxy('custom')}
              />
            )}
          </div>
        </div>
        <div className="flex flex-col gap-2">
          <div className="font-semibold">{t('settings.serverEnable')}</div>
          <div className="flex flex-col gap-2 items-start">
            <Switch
              checked={settings?.serverEnable}
              onChange={(v) => onChangeServerEnable(v)}
            />
            {settings?.serverEnable && (
              <InputNumber
                value={settings?.serverPort}
                style={{ width: 150 }}
                prefix={
                  <span className="mr-2 text-sm text-gray-500">端口:</span>
                }
                onChange={(e) => setServerPort(e)}
                onBlur={() => onChangeServerPort()}
                min={1}
                max={65535}
              />
            )}
            <small className="text-sm text-gray-500">
              {t('settings.serverPort.description')}
            </small>
          </div>
        </div>
        <div className="flex flex-col gap-2">
          <div className="font-semibold">{t('settings.showMcpWindows')}</div>
          <div className="flex flex-col gap-2 items-start">
            <Switch
              checked={settings?.showMcpWindows}
              onChange={(v) => onChangeShowMcpWindows(v)}
            />
          </div>
        </div>
      </div>
    </>
  );
}

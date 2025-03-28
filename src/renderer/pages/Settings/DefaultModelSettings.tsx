import { Input, Menu, Select } from 'antd';
import { t } from 'i18next';
import React, { useEffect, useState } from 'react';
import { FaInfoCircle } from 'react-icons/fa';
import { useTheme } from '../../components/theme/ThemeProvider';
import { GlobalSettings } from '@/main/settings';
import { isUrl } from '@/main/utils/is';
import i18n from '@/i18n';
import ProviderSelect from '@/renderer/components/providers/ProviderSelect';

export default function DefaultModelSettings() {
  const [settings, setSetings] = useState<GlobalSettings>();

  const getData = () => {
    const settings = window.electron.setting.getSettings();
    setSetings(settings);
  };
  const onChangeDefaultModel = async (
    key: string,
    value: string | undefined,
  ) => {
    window.electron.setting.set(key, value);
    getData();
    if (key === 'defaultTTS') {
      await window.electron.app.resetTTS();
    }
  };

  useEffect(() => {
    getData();
  }, []);
  return (
    <>
      <div className="p-4 shadow">
        <h2 className="text-lg font-semibold">{t('settings.defaultModel')}</h2>
      </div>
      <div className="flex flex-col gap-4 p-4">
        <div className="flex flex-col gap-2">
          <div className="font-semibold">{t('settings.defaultLLM')}</div>
          <ProviderSelect
            type="llm"
            value={settings?.defaultLLM}
            allowClear
            style={{ width: 200 }}
            onChange={(v) => onChangeDefaultModel('defaultLLM', v)}
          />
        </div>
        <div className="flex flex-col gap-2">
          <div className="font-semibold">{t('settings.defaultTitleLLM')}</div>
          <ProviderSelect
            type="llm"
            value={settings?.defaultTitleLLM}
            allowClear
            style={{ width: 200 }}
            onChange={(v) => onChangeDefaultModel('defaultTitleLLM', v)}
          />
        </div>
        <div className="flex flex-col gap-2">
          <div className="font-semibold">{t('settings.defaultVision')}</div>
          <ProviderSelect
            type="llm"
            value={settings?.defaultVision}
            allowClear
            style={{ width: 200 }}
            onChange={(v) => onChangeDefaultModel('defaultVision', v)}
          />
        </div>
        <div className="flex flex-col gap-2">
          <div className="font-semibold">{t('settings.defaultEmbedding')}</div>
          <ProviderSelect
            type="embedding"
            value={settings?.defaultEmbedding}
            allowClear
            style={{ width: 200 }}
            onChange={(v) => onChangeDefaultModel('defaultEmbedding', v)}
          />
        </div>
        <div className="flex flex-col gap-2">
          <div className="font-semibold">{t('settings.defaultTTS')}</div>
          <ProviderSelect
            type="tts"
            value={settings?.defaultTTS}
            allowClear
            style={{ width: 300 }}
            onChange={(v) => onChangeDefaultModel('defaultTTS', v)}
          />
        </div>
        <div className="flex flex-col gap-2">
          <div className="font-semibold">{t('settings.defaultReranker')}</div>
          <ProviderSelect
            type="reranker"
            value={settings?.defaultReranker}
            allowClear
            style={{ width: 300 }}
            onChange={(v) => onChangeDefaultModel('defaultReranker', v)}
          />
        </div>
        <div className="flex flex-col gap-2">
          <div className="font-semibold">{t('settings.defaultSTT')}</div>
          <ProviderSelect
            type="stt"
            value={settings?.defaultSTT}
            allowClear
            style={{ width: 300 }}
            onChange={(v) => onChangeDefaultModel('defaultSTT', v)}
          />
        </div>
      </div>
    </>
  );
}

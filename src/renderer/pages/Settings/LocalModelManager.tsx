import { Button, Input, Menu, message, Select, Tag } from 'antd';
import { t } from 'i18next';
import React, { useEffect, useState } from 'react';
import { FaInfoCircle } from 'react-icons/fa';
import { useTheme } from '../../components/theme/ThemeProvider';
import { GlobalSettings } from '@/main/settings';
import { isUrl } from '@/main/utils/is';
import i18n from '@/i18n';
import Link from 'antd/es/typography/Link';
import { ScrollArea } from '@/renderer/components/ui/scroll-area';

export default function LocalModelManager() {
  const { theme, setTheme } = useTheme();
  const [settings, setSetings] = useState<GlobalSettings>();
  const [localModels, setLocalModels] = useState<Record<string, any>>({});
  const [proxy, setProxy] = useState<string | undefined>();
  const [proxyMode, setProxyMode] = useState<'system' | 'custom' | 'none'>();

  const getData = () => {
    const settings = window.electron.setting.getSettings();
    const localModels = window.electron.setting.getLocalModels();
    setSetings(settings);
    setLocalModels(localModels);
  };

  const onSelectPath = async () => {
    const res = await window.electron.app.showOpenDialog({
      properties: ['openDirectory'],
    });
    if (res) {
      window.electron.setting.set('localModelPath', res[0].path);
      getData();
    }
  };

  const onDownload = (task, model) => {
    window.electron.setting.downloadModel(task, model);
  };
  const onDelete = (task, model) => {
    window.electron.setting.deleteLocalModel(task, model);
    message.success('delete success');
    const localModels = window.electron.setting.getLocalModels();
    setLocalModels(localModels);
  };
  useEffect(() => {
    getData();
  }, []);
  return (
    <>
      <div className="p-4 shadow">
        <h2 className="text-lg font-semibold">
          {t('settings.localModelManager')}
        </h2>
      </div>
      <ScrollArea className="flex-1 h-full">
        <div className="flex flex-col gap-4 p-4">
          <div className="flex flex-col gap-2">
            <div className="font-semibold">{t('settings.localModelPath')}</div>
            <div className="flex flex-row gap-2 justify-between items-center">
              <Link href={`file:///${settings?.localModelPath}`}>
                {settings?.localModelPath}
              </Link>

              <Button onClick={onSelectPath}>更改目录</Button>
            </div>
          </div>
          <div className="flex flex-col gap-2">
            <div className="font-semibold">{t('settings.huggingfaceUrl')}</div>
            <div className="flex flex-row gap-2 justify-between items-center">
              <Select
                value={settings?.huggingfaceUrl}
                defaultValue="https://huggingface.co"
                onChange={(value) => {
                  window.electron.setting.set('huggingfaceUrl', value);
                  getData();
                }}
              >
                <Select.Option value="https://huggingface.co">
                  https://huggingface.co
                </Select.Option>
                <Select.Option value="https://hf-mirror.com">
                  https://hf-mirror.com
                </Select.Option>
              </Select>
            </div>
          </div>
          {Object.keys(localModels).map((group) => {
            return (
              <div className="flex flex-col gap-2" key={group}>
                <div className="font-semibold">{group}</div>
                <div className="flex flex-col justify-between items-center">
                  <div>{t(localModels[group].id)}</div>
                  <div className="flex flex-col gap-2 w-full">
                    {localModels[group].map((model) => {
                      return (
                        <div
                          className="flex flex-row justify-between items-center"
                          key={model.id}
                        >
                          <div className="flex flex-col">
                            <div>
                              {model.id} <Tag>{model.type}</Tag>
                            </div>
                            <Link className="text-xs" href={model.download}>
                              {model.download}
                            </Link>
                          </div>

                          <Button
                            onClick={() => {
                              if (model.exists) onDelete(group, model);
                              else onDownload(group, model);
                            }}
                            type={!model.exists ? 'default' : 'primary'}
                            danger={model.exists}
                          >
                            {model.exists ? '删除' : '下载'}
                          </Button>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </ScrollArea>
    </>
  );
}

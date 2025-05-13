import { Button, Empty, Input, Menu, Modal, Select, Space } from 'antd';
import { t } from 'i18next';
import React, { useEffect, useState } from 'react';
import { FaInfoCircle } from 'react-icons/fa';
import { useTheme } from '../../components/theme/ThemeProvider';
import { GlobalSettings } from '@/main/settings';
import { is, isArray, isString, isUrl } from '@/main/utils/is';
import i18n from '@/i18n';
import LLMProviders from '@/renderer/components/providers/LLMProviders';
// import EmbeddingProviders from '@/renderer/components/providers/EmbeddingProviders';
// import RerankerProviders from '@/renderer/components/providers/RerankerProviders';
// import TTSProviders from '@/renderer/components/providers/TTSProviders';
import ProviderSelect from '@/renderer/components/providers/ProviderSelect';
import Link from 'antd/es/typography/Link';
import { ResponseCard } from '@/renderer/components/common/ResponseCard';

const { Search } = Input;

export default function DefaultWenSearchEnginSettings() {
  const [settings, setSetings] = useState<GlobalSettings>();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [currentProvider, setCurrentProvider] = useState(null);
  const [invokeOutput, setInvokeOutput] = useState<string | string[]>();
  const getData = () => {
    const settings = window.electron.setting.getSettings();
    setSetings(settings);
  };
  const onChange = (key: string, value: string | undefined) => {
    window.electron.setting.set(key, value);
    getData();
  };
  const onSearchTest = (key: string) => {
    setIsModalOpen(true);
    setInvokeOutput(null);
    setCurrentProvider(key);
  };
  const onSearch = async (value: string) => {
    if (!value) return;
    setLoading(true);
    const res = await window.electron.tools.webSearch(
      currentProvider,
      value,
      10,
      'markdown',
    );

    setInvokeOutput(res);
    setLoading(false);
  };
  useEffect(() => {
    getData();
  }, []);
  return (
    <>
      <div className="p-4 shadow">
        <h2 className="text-lg font-semibold">
          {t('settings.websearch_settings')}
        </h2>
      </div>
      <div className="flex flex-col gap-4 p-4">
        <div className="flex flex-col gap-2">
          <div className="font-semibold">
            {t('settings.defaultWebSearchEngine')}
          </div>
          <ProviderSelect
            type="websearch"
            value={settings?.defaultWebSearchEngine}
            allowClear
            style={{ width: 200 }}
            onChange={(v) => onChange('defaultWebSearchEngine', v)}
          />
        </div>
        <div className="flex flex-col gap-2">
          <div className="font-semibold">{t('settings.duckduckgo')}</div>
          <div>
            <Button type="primary" onClick={() => onSearchTest('duckduckgo')}>
              Check
            </Button>
          </div>
        </div>
        <div className="flex flex-col gap-2">
          <div className="font-semibold">
            {t('settings.zhipuWebSearchProApiKey')}
          </div>
          <div className="flex flex-col">
            <Space.Compact>
              <Input.Password
                value={settings?.webSearchEngine?.zhipu?.apiKey}
                style={{ width: 400 }}
                placeholder="api key"
                onChange={(e) =>
                  onChange('webSearchEngine.zhipu.apiKey', e.target.value)
                }
              />
              <Button type="primary" onClick={() => onSearchTest('zhipu')}>
                Check
              </Button>
            </Space.Compact>

            <Link href="https://bigmodel.cn/usercenter/proj-mgmt/apikeys">
              https://bigmodel.cn/usercenter/proj-mgmt/apikeys
            </Link>
          </div>
        </div>
        <div className="flex flex-col gap-2">
          <div className="font-semibold">{t('settings.searxngApiBase')}</div>
          <div>
            <Space.Compact>
              <Input.Password
                value={settings?.webSearchEngine?.searxng?.apiBase}
                style={{ width: 400 }}
                placeholder="https://searxng.com:8010"
                onChange={(e) =>
                  onChange('webSearchEngine.searxng.apiBase', e.target.value)
                }
              />
              <Button type="primary" onClick={() => onSearchTest('searxng')}>
                Check
              </Button>
            </Space.Compact>
          </div>
        </div>
        <div className="flex flex-col gap-2">
          <div className="font-semibold">{t('settings.tavilyApiKey')}</div>
          <div className="flex flex-col">
            <Space.Compact>
              <Input.Password
                value={settings?.webSearchEngine?.tavily?.apiKey}
                style={{ width: 400 }}
                placeholder="tvly-xxxxx"
                onChange={(e) =>
                  onChange('webSearchEngine.tavily.apiKey', e.target.value)
                }
              />
              <Button type="primary" onClick={() => onSearchTest('tavily')}>
                Check
              </Button>
            </Space.Compact>
            <Link href="https://app.tavily.com">https://app.tavily.com</Link>
          </div>
        </div>
        <div className="flex flex-col gap-2">
          <div className="font-semibold">{t('settings.serpapiApiKey')}</div>
          <div className="flex flex-col">
            <Space.Compact>
              <Input.Password
                value={settings?.webSearchEngine?.serpapi?.apiKey}
                style={{ width: 400 }}
                placeholder="tvly-xxxxx"
                onChange={(e) =>
                  onChange('webSearchEngine.serpapi.apiKey', e.target.value)
                }
              />
              <Button type="primary" onClick={() => onSearchTest('serpapi')}>
                Check
              </Button>
            </Space.Compact>
            <Link href="https://www.serpapi.com">https://www.serpapi.com</Link>
          </div>
        </div>
        <div className="flex flex-col gap-2">
          <div className="font-semibold">{t('settings.braveApiKey')}</div>
          <div className="flex flex-col">
            <Space.Compact>
              <Input.Password
                value={settings?.webSearchEngine?.brave?.apiKey}
                style={{ width: 400 }}
                placeholder="xxxxx"
                onChange={(e) =>
                  onChange('webSearchEngine.brave.apiKey', e.target.value)
                }
              />
              <Button type="primary" onClick={() => onSearchTest('brave')}>
                Check
              </Button>
            </Space.Compact>
            <Link href="https://api-dashboard.search.brave.com/">
              https://api-dashboard.search.brave.com/
            </Link>
          </div>
        </div>
      </div>
      <Modal
        title="Search Test"
        open={isModalOpen}
        footer={null}
        onCancel={() => setIsModalOpen(false)}
      >
        <Space direction="vertical" className="w-full">
          <Search
            placeholder="input search"
            loading={loading}
            enterButton
            onSearch={onSearch}
          />
          {invokeOutput && (
            <div className="mt-4 w-full max-w-full">
              {isArray(invokeOutput) && (
                <div>
                  {invokeOutput.map((item) => {
                    return <ResponseCard value={item} />;
                  })}
                </div>
              )}
              {isString(invokeOutput) && <ResponseCard value={invokeOutput} />}
            </div>
          )}
          {!invokeOutput && <Empty />}
        </Space>
      </Modal>
    </>
  );
}

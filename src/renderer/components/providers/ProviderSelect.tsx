import React, { ForwardedRef, useEffect, useState } from 'react';
import { Select } from 'antd';
import { SelectProps } from 'antd/lib/select';
import { Providers } from '@/entity/Providers';

const { Option } = Select;

interface ProviderSelectProps extends SelectProps<any> {
  type?: 'llm' | 'reranker' | 'stt' | 'tts' | 'embedding' | 'websearch';
}

interface ProviderSelectRef {
  setProviders: () => void;
}
const ProviderSelect = React.forwardRef(
  (props: ProviderSelectProps, ref: ForwardedRef<ProviderSelectRef>) => {
    const [providers, setProviders] = useState<any[]>([]);
    const getProviders = async () => {
      let res;
      if (props.type == 'llm')
        res = await window.electron.providers.getLLMModels();
      else if (props.type == 'reranker')
        res = await window.electron.providers.getRerankerModels();
      else if (props.type == 'tts')
        res = await window.electron.providers.getTTSModels();
      else if (props.type == 'stt')
        res = await window.electron.providers.getSTTModels();
      else if (props.type == 'embedding')
        res = await window.electron.providers.getEmbeddingModels();
      else if (props.type == 'websearch')
        res = await window.electron.providers.getWebSearchProviders();

      const options = res.map((x) => {
        const options = x.models.map((o) => {
          return {
            label: <span>{o}</span>,
            value: `${o}@${x.name}`,
          };
        });
        return {
          label: <span>{x.name}</span>,
          title: x.name,
          options,
        };
      });

      setProviders(options);
    };
    useEffect(() => {
      getProviders();
    }, []);

    return (
      <Select
        {...props}
        showSearch
        labelRender={(props) => {
          return <div>{props?.value}</div>;
        }}
        onSearch={(v) => {
          return providers.map((x) => {
            const options = x.options
              .filter((m) => m.value.toLowerCase().includes(v.toLowerCase()))
              .map((o) => {
                return {
                  label: <span>{o.label}</span>,
                  value: o.value,
                };
              });
            return {
              label: <span>{x.name}</span>,
              title: x.name,
              options,
            };
          });
        }}
        options={providers}
      >
        {props.children}
      </Select>
    );
  },
);

export default ProviderSelect;

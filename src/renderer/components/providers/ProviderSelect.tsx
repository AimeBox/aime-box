import React, { ForwardedRef, useEffect, useState } from 'react';
import { Select } from 'antd';
import { SelectProps } from 'antd/lib/select';
import { Providers } from '@/entity/Providers';

const { Option } = Select;

interface ProviderSelectProps extends SelectProps<any> {
  type?:
    | 'llm'
    | 'reranker'
    | 'stt'
    | 'tts'
    | 'embedding'
    | 'websearch'
    | 'image_generation';
  selectMode?: 'models' | 'providers';
  providerType?: string;
}

interface ProviderSelectRef {
  setProviders: () => void;
}
const ProviderSelect = React.forwardRef(
  (props: ProviderSelectProps, ref: ForwardedRef<ProviderSelectRef>) => {
    const [providers, setProviders] = useState<any[]>([]);
    const selectMode = props.selectMode || 'models';
    let options = [];
    const getData = async () => {
      if (selectMode == 'models') {
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
        else if (props.type == 'image_generation')
          res = await window.electron.providers.getImageGenerationProviders();

        options = res.map((x) => {
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
      } else if (selectMode == 'providers') {
        let res = await window.electron.providers.getList();
        if (props.providerType) {
          res = res.filter((x) => x.type == props.providerType);
        }
        options = res.map((x) => {
          return {
            label: <span>{x.name}</span>,
            title: x.name,
            value: x.id,
          };
        });
      }

      setProviders(options);
    };
    useEffect(() => {
      getData();
    }, []);

    return (
      <Select
        {...props}
        showSearch
        labelRender={(item) => {
          if (selectMode == 'models') return <div>{item?.value}</div>;
          else if (selectMode == 'providers') {
            return <div>{item?.label}</div>;
          }
          return '';
        }}
        onSearch={(v) => {
          return providers.map((x) => {
            const options = x?.options
              ?.filter((m) => m.value.toLowerCase().includes(v.toLowerCase()))
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

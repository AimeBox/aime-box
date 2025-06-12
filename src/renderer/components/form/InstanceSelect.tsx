import React, { ForwardedRef, useEffect, useState } from 'react';
import { Select } from 'antd';
import { SelectProps } from 'antd/lib/select';
import { Instances } from '@/entity/Instances';

const { Option } = Select;

interface InstanceSelectProps extends SelectProps<any> {}

interface InstanceSelectRef {
  // setAgents: () => void;
}
const InstanceSelect = React.forwardRef(
  (props: InstanceSelectProps, ref: ForwardedRef<InstanceSelectRef>) => {
    const [instances, setInstances] = useState<Instances[]>([]);
    const getData = async () => {
      const instances = await window.electron.instances.getList();
      // debugger;
      setInstances(instances);
    };
    useEffect(() => {
      getData();
    }, []);

    return (
      <Select
        {...props}
        showSearch
        fieldNames={{ label: 'name', value: 'id', options: 'tools' }}
        onSearch={(v) => {
          return instances
            .filter((x) => x.name.toLowerCase().includes(v.toLowerCase()))
            .map((x) => {
              return {
                label: <span>{x.name}</span>,
                title: x.name,
              };
            });
        }}
        options={instances}
        optionRender={(option) => {
          return (
            <div className="flex flex-col">
              {/* <span>{'option.data.emoji'}</span> */}
              <strong>{option.label}</strong>
              <small className="text-xs text-gray-500">
                {option.data.description}
              </small>
            </div>
          );
        }}
      >
        {props.children}
      </Select>
    );
  },
);

export default InstanceSelect;

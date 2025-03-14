import React, { ForwardedRef, useEffect, useState } from 'react';
import { Select, Space } from 'antd';
import { SelectProps } from 'antd/lib/select';
import { Providers } from '@/entity/Providers';

const { Option } = Select;

interface AgentSelectProps extends SelectProps<any> {
  excludes?: string[];
}

interface AgentSelectRef {
  setAgents: () => void;
}
const AgentSelect = React.forwardRef(
  (props: AgentSelectProps, ref: ForwardedRef<AgentSelectRef>) => {
    const [agents, setAgents] = useState<any[]>([]);
    const getAgents = async () => {
      let agents = await window.electron.agents.getList();
      agents = agents.filter((x) => !props.excludes?.includes(x.id));
      setAgents(agents);
    };
    useEffect(() => {
      getAgents();
    }, []);

    return (
      <Select
        {...props}
        showSearch
        fieldNames={{ label: 'name', value: 'id' }}
        mode="multiple"
        // onSearch={(v) => {
        //   const filteredAgents = agents.filter((m) =>
        //     m.name.toLowerCase().includes(v.toLowerCase()),
        //   );
        //   setAgents(filteredAgents);
        // }}
        optionFilterProp="name"
        options={agents}
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

export default AgentSelect;

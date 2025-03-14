import React, { ForwardedRef, useEffect, useState } from 'react';
import { Select } from 'antd';
import { SelectProps } from 'antd/lib/select';
import { Providers } from '@/entity/Providers';

const { Option } = Select;

interface ToolSelectProps extends SelectProps<any> {}

interface ToolSelectRef {
  setAgents: () => void;
}
const ToolSelect = React.forwardRef(
  (props: ToolSelectProps, ref: ForwardedRef<ToolSelectRef>) => {
    const [tools, setTools] = useState<any[]>([]);
    const getTools = async () => {
      const tools = await window.electron.tools.getList();

      const list = [];
      const builtInTools = tools.filter((x) => x.type == 'built-in');
      list.push(...builtInTools);
      const mcpTools = tools.filter((x) => x.type == 'mcp');

      const toolkitNames = [
        ...new Set(mcpTools.map((tool) => tool.toolkit_name)),
      ];
      toolkitNames.forEach((toolkitName) => {
        const mcpToolsByToolkit = mcpTools.filter(
          (x) => x.toolkit_name == toolkitName,
        );
        list.push({
          name: toolkitName,
          tools: mcpToolsByToolkit,
        });
      });
      console.log(list);
      setTools(list);
    };
    useEffect(() => {
      getTools();
    }, []);

    return (
      <Select
        {...props}
        showSearch
        fieldNames={{ label: 'name', value: 'id', options: 'tools' }}
        mode="tags"
        onSearch={(v) => {
          return tools
            .filter((x) => x.name.toLowerCase().includes(v.toLowerCase()))
            .map((x) => {
              return {
                label: <span>{x.name}</span>,
                title: x.name,
              };
            });
        }}
        options={tools}
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

export default ToolSelect;

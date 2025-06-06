import { Button, Popconfirm, Switch } from "antd";
import { t } from "i18next";
import { useState } from "react";
import { useEffect } from "react";
import { FaDatabase, FaTrashAlt, FaSync } from "react-icons/fa";

export default function PluginsManager() {
  const [plugins, setPlugins] = useState([]);

  const getData = async ()=>{
    const plugins = await window.electron.plugins.getList();
    console.log(plugins);
    setPlugins(plugins);
  }

  useEffect(() => {
    getData();
  }, []);

  const onImport = async () => {
    const res = await window.electron.app.showOpenDialog({
      properties: ['openDirectory'],
    });
    if (res && res.length ==1) {
        await window.electron.plugins.import(res[0].path);
        await getData();
    }
  }

  const onDelete = async (plugin)=>{
    await window.electron.plugins.delete(plugin.id);
    await getData();
  }

  const onSetEnable = async (plugin, isEnable)=>{
    await window.electron.plugins.setEnable(plugin.id, isEnable);
    await getData();
  }
  return (
    <>
      <div className="p-4 shadow flex flex-row justify-between">
        <h2 className="text-lg font-semibold">
          {t('settings.plugins')}
        </h2>
        <Button type="primary" onClick={()=>{
          onImport();
        }}>
          {t('settings.plugins_import')}
        </Button>
      </div>
      <div className="p-4">
        {plugins.map((plugin) => (
          <li
            className="flex items-center px-3 py-2 space-x-4 w-full text-left rounded-xl cursor-pointer dark:hover:bg-white/5 hover:bg-black/5"
            key={plugin.id}
          >
            {/* <div className="flex overflow-hidden justify-center items-center h-10 rounded-xl min-w-10">
              
            </div> */}
            <div className="flex-1 self-center">
              <span className="font-bold line-clamp-1">
                {plugin.name} {plugin.version}
              </span>

                <span className="overflow-hidden text-xs text-ellipsis line-clamp-1">
                  {plugin.description}
                </span>
            </div>
            <div className="flex flex-row self-center space-x-1 items-center">
              <Switch checked={plugin.isEnable} onChange={(checked)=>{
                //window.electron.plugins.(plugin.id,checked);
                onSetEnable(plugin, checked)
              }} />
              <Button
                  icon={<FaSync />}
                  shape="round"
                  type="text"
                  onClick={()=>{
                    window.electron.plugins.reload(plugin.id);
                  }}
                ></Button>
              <Popconfirm
                title="Delete the item?"
                onConfirm={() => onDelete(plugin)}
                okText="Yes"
                cancelText="No"
              >
                <Button
                  icon={<FaTrashAlt />}
                  shape="round"
                  type="text"
                ></Button>
              </Popconfirm>
            </div>
          </li>
        ))}
      </div>
    </>
  );
}
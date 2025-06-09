import FormModal, { FormModalRef } from '@/renderer/components/modals/FormModal';
import { transformFlatObjectToNested } from '@/renderer/utils/common';
import { FormSchema } from '@/types/form';
import { Button, Input, message, Popconfirm, Switch } from 'antd';
import { t } from 'i18next';
import { useRef, useState } from 'react';
import { useEffect } from 'react';
import { FaDatabase, FaTrashAlt, FaSync, FaEdit } from 'react-icons/fa';

export default function PluginsManager() {
  const [plugins, setPlugins] = useState([]);
  const modalCreateRef = useRef<FormModalRef>(null);
  const modalUpdateRef = useRef<FormModalRef>(null);
  const [currentData, setCurrentData] = useState(undefined);
  const [loading, setLoading] = useState(false);
  const schemasCreate = [
    {
      label: 'directoryPath',
      field: 'directoryPath',
      required: true,
      component: 'Folder',
      componentProps:{
        maxCount:1
      },
    },
    {
      label: 'config',
      field: 'config',
      component: 'InputTextArea',
      componentProps:{
        placeholder:'Key=Value'
      }
    },
  ] as FormSchema[];

  const schemasUpdate = [
    {
      label: 'config',
      field: 'config',
      component: 'InputTextArea',
      componentProps:{
        placeholder:'Key=Value'
      }
    },
  ] as FormSchema[];


  const getData = async () => {
    const plugins = await window.electron.plugins.getList();
    console.log(plugins);
    setPlugins(plugins);
  };

  useEffect(() => {
    getData();
  }, []);

  const onImport = async () => {
    const res = await window.electron.app.showOpenDialog({
      properties: ['openDirectory'],
    });
    if (res && res.length == 1) {
      await window.electron.plugins.import(res[0].path);
      await getData();
    }
  };

  const onDelete = async (plugin) => {
    await window.electron.plugins.delete(plugin.id);
    await getData();
  };

  const onSetEnable = async (plugin, isEnable) => {
    try{
      await window.electron.plugins.setEnable(plugin.id, isEnable);
    }catch(err){
      debugger;
      message.error(err);
    }
    
    await getData();
  };


  const onCreate = async (data) => {
    const config = {};
    const env = {};
    setLoading(true);
    if (data.config) {
      data.config.split('\n').forEach((line) => {
        if(line.includes('=')){
          const [key, value] = line.split('=');
          if(value.trim()){
            config[key.trim()] = value.trim();
          }
        }
      });
    }
    await window.electron.plugins.create({...data, config: { ...config },});
    await getData();
    modalCreateRef.current.openModal(false);
    setCurrentData(undefined);
    setLoading(false);
  };

  const onUpdate = async (data) => {
    setLoading(false);
    const config = {};
    if (data.config) {
      data.config.split('\n').forEach((line) => {
        if(line.includes('=')){
          const [key, value] = line.split('=');
          if(value.trim()){
            config[key.trim()] = value.trim();
          }
        }
      });
    }
    await window.electron.plugins.update(currentData.id, {...data, config: { ...config },});
    await getData();
    
    modalUpdateRef.current.openModal(false);
    setCurrentData(undefined);
    setLoading(false);
  }
  return (
    <>
    <FormModal
        title={t('settings.instances_manager')}
        ref={modalCreateRef}
        schemas={schemasCreate}
        formProps={{ layout: 'vertical' }}
        confirmLoading={loading}
        onFinish={(values: any) => {
          const data = transformFlatObjectToNested(values);
           onCreate(data);
        }}
        onCancel={() => {
          modalCreateRef.current.openModal(false);
          setCurrentData(undefined);
        }}
      />
      <FormModal
        title={t('settings.instances_manager')}
        ref={modalUpdateRef}
        schemas={schemasUpdate}
        formProps={{ layout: 'vertical' }}
        confirmLoading={loading}
        onFinish={(values: any) => {
          const data = transformFlatObjectToNested(values);
          onUpdate(data);
        }}
        onCancel={() => {
          modalUpdateRef.current.openModal(false);
          setCurrentData(undefined);
        }}
      />
      <div className="p-4 shadow flex flex-row justify-between">
        <h2 className="text-lg font-semibold">{t('settings.plugins')}</h2>
        
        <Button
          type="default"
          variant="outlined"
          shape="round"
          onClick={() => {
            setCurrentData(undefined);
            modalCreateRef.current.openModal(true);
          }}
        >
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
              <Switch
                checked={plugin.isEnable}
                onChange={(checked) => {
                  //window.electron.plugins.(plugin.id,checked);
                  onSetEnable(plugin, checked);
                }}
              />
              <Button
                icon={<FaSync />}
                shape="round"
                type="text"
                onClick={() => {
                  window.electron.plugins.reload(plugin.id);
                }}
              ></Button>
              <Button
                icon={<FaEdit />}
                shape="round"
                type="text"
                onClick={() => {
                  setCurrentData(plugin);
                  const config = Object.entries(plugin.config).map(x=>`${x[0]}=${x[1]}`).join('\n')
                  modalUpdateRef.current.openModal(true, {...plugin,config: config});
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

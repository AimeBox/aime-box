
import FormModal, { FormModalRef } from "@/renderer/components/modals/FormModal";
import { FormSchema } from "@/types/form";
import { Button, Popconfirm, Switch } from "antd";
import { t } from "i18next";
import { useRef, useState } from "react";
import { useEffect } from "react";
import { FaDatabase, FaTrashAlt, FaSync, FaEdit, FaPlay } from "react-icons/fa";

export default function InstancesManager() {
  const [instances, setInstances] = useState([]);
  const [currentInstance, setCurrentInstance] = useState<any>();

  const  getData = async()=>{
    const instances = await window.electron.instances.getList();
    console.log(instances);
    setInstances(instances);
  }

  useEffect(() => {
    getData();
  }, []);

  const onCreate = async (instance) => {
    await window.electron.instances.create(instance);
    await getData();
    modalRef.current.openModal(false);
  }
  const onUpdate = async (instance)=>{
    await window.electron.instances.update(currentInstance.id, instance);
    await getData();
    modalRef.current.openModal(false);
  }

  const onDelete = async (instance)=>{
    await window.electron.instances.delete(instance.id);
    await getData();
  }

  const onRun = async (instance)=>{
    await window.electron.instances.run(instance.id);
  }

  const modalRef = useRef<FormModalRef>(null);
  const schemas = [
    {
      label: 'Name',
      field: 'name',
      required: true,
      component: 'Input',
    },
    {
      label: 'Type',
      field: 'type',
      required: true,
      component: 'Select',
      componentProps: {
        options: [
          {
            label: 'Browser',
            value: 'browser',
          },
        ],
      },
    },
    {
      label: 'CDP URL',
      field: 'config.cdpUrl',
      component: 'Input',
    },
    {
      label: 'WSS URL',
      field: 'config.wssUrl',
      component: 'Input',
    },
    {
      label: 'Chrome Executable Path',
      field: 'config.executablePath',
      component: 'Input',
    },
    
    
  ] as FormSchema[];

  return (
    <>
      <FormModal
        title={t('settings.instances_manager')}
        ref={modalRef}
        schemas={schemas}
        formProps={{ layout: 'horizontal' }}
        onFinish={(values: any) => {
          console.log(values);
          if(currentInstance?.id){
            onUpdate(values);
          }else{
            onCreate(values);
          }
        }}
        onCancel={() => {
            modalRef.current.openModal(false);
            setCurrentInstance(null);
        }}
      />
      <div className="p-4 shadow flex flex-row justify-between">
        <h2 className="text-lg font-semibold">
          {t('settings.instances')}
        </h2>
        <Button type="primary" onClick={()=>{
          modalRef.current.openModal(true,null);
        }}>
          {t('settings.instances_create')}
        </Button>
      </div>
      <div className="p-4">
        {instances.map((instance) => (
          <li
            className="flex items-center px-3 py-2 space-x-4 w-full text-left rounded-xl cursor-pointer dark:hover:bg-white/5 hover:bg-black/5"
            key={instance.id}
          >
            {/* <div className="flex overflow-hidden justify-center items-center h-10 rounded-xl min-w-10">
              
            </div> */}
            <div className="flex-1 self-center">
              <span className="font-bold line-clamp-1">
                {instance.name}
              </span>

                {/* <span className="overflow-hidden text-xs text-ellipsis line-clamp-1">
                  {plugin.description}
                </span> */}
            </div>
            <div className="flex flex-row self-center space-x-1 items-center">
              <Switch checked={instance.isEnable} onChange={(checked)=>{
                //window.electron.plugins.(plugin.id,checked);
              }} />
              <Button
                  icon={<FaPlay />}
                  shape="round"
                  type="text"
                  onClick={()=>{
                    onRun(instance);
                  }}
                ></Button>
              <Button
                  icon={<FaEdit />}
                  shape="round"
                  type="text"
                  onClick={()=>{
                    modalRef.current.openModal(true, instance);
                    setCurrentInstance(instance);
                  }}
                ></Button>
              <Popconfirm
                title="Delete the item?"
                onConfirm={() => onDelete(instance)}
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
import List from '@/renderer/components/common/List';
import { Route, Routes } from 'react-router-dom';
import Content from '@/renderer/components/layout/Content';
import AgentContent from './AgentContent';
import { Button } from 'antd';
import { ListItem } from '@/renderer/components/common/ListItem';
import { useState } from 'react';
import { t } from 'i18next';

export default function AgentPage() {
  const [categories, setCategories] = useState<any[]>([
    // { key: 'custom', name: t('custom') },
    { key: 'all', name: t('common.all') },
  ]);

  const [selectedCategory, setSelectedCategory] = useState<string>('all');

  return (
    <Content>
      <div className="flex flex-row w-full h-full">
        <List
          dataLength={10}
          hasMore={false}
          showSearch={false}
          width={250}
          // addButton={<Button className="w-full">添加分类</Button>}
        >
          <div className="flex flex-col gap-1">
            {categories.map((category) => (
              <ListItem
                key={category.key}
                title={category.name}
                active={selectedCategory === category.key}
                onClick={() => setSelectedCategory(category.key)}
              />
            ))}
          </div>
        </List>

        <div className="flex flex-col flex-1 w-full min-w-0 h-full min-h-full">
          <Routes>
            <Route path="*" element={<AgentContent />} />
          </Routes>
        </div>
      </div>
    </Content>
  );
}

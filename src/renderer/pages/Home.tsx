import React from 'react';
import ShowcaseLayout from '../components/layout/ShowcaseLayout';
import { ScrollArea } from '../components/ui/scroll-area';
import Content from '../components/layout/Content';
import { Editor } from '../components/common/Editor';

interface Props {}

function Home(props: Props): React.ReactElement {
  return (
    <Content>
      <ScrollArea className="p-4 w-full h-full">
        <h1>Welcome to the Home Page</h1>
        {/* <Editor></Editor> */}
        {/* <ShowcaseLayout /> */}
      </ScrollArea>
    </Content>
  );
}

export default Home;

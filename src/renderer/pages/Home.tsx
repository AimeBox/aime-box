import React, { useState } from 'react';
import ShowcaseLayout from '../components/layout/ShowcaseLayout';
import { ScrollArea } from '../components/ui/scroll-area';
import Content from '../components/layout/Content';
import { Document, Page, pdfjs } from 'react-pdf';
import FileDropZone from '../components/common/FileDropZone';

interface Props {}

function Home(props: Props): React.ReactElement {
  return (
    <Content>
      <ScrollArea className="relative p-4 w-full h-full">
        {/* <Editor></Editor> */}
        {/* <ShowcaseLayout /> */}
        <FileDropZone>
          <h1>Welcome to the Home Page</h1>
        </FileDropZone>
      </ScrollArea>
    </Content>
  );
}

export default Home;

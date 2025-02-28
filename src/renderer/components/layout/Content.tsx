import React from 'react';

export interface ContentProps {
  children?: React.ReactNode;
}

export default function Content({ children }: ContentProps) {
  return (
    <div className="w-full h-full overflow-hidden border border-gray-300 border-solid dark:border-gray-600 rounded-2xl">
      {children}
    </div>
  );
}

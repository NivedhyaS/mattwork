'use client';

import { Suspense } from 'react';
import ProjectBoard from '@/components/board/ProjectBoard';

export default function EditorBoardPage() {
  return (
    <Suspense>
      <ProjectBoard role="EDITOR" />
    </Suspense>
  );
}

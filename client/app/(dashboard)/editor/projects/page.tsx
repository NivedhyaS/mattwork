'use client';

import { Suspense } from 'react';
import ProjectBoard from '@/components/board/ProjectBoard';

export default function EditorProjectsPage() {
  return (
    <Suspense>
      <ProjectBoard role="EDITOR" />
    </Suspense>
  );
}

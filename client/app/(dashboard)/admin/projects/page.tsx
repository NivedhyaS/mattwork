'use client';

import { Suspense } from 'react';
import ProjectBoard from '@/components/board/ProjectBoard';

export default function ProjectsPage() {
  return (
    <Suspense>
      <ProjectBoard role="ADMIN" />
    </Suspense>
  );
}

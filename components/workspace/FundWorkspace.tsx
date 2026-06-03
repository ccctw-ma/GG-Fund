'use client';

import App from '../../frontend/src/App';
import type { AppInitialData } from '../../frontend/src/App';

export function FundWorkspace({ initialData }: { initialData?: AppInitialData }) {
  return <App initialData={initialData} />;
}

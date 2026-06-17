import Dashboard from './Dashboard';
import Builder from './Builder';
import type { Gallery } from './types';

interface Props { view: 'dashboard' | 'builder'; initial?: Gallery; }

export default function AdminApp({ view, initial }: Props) {
  if (view === 'builder') return <Builder initial={initial} />;
  return <Dashboard />;
}

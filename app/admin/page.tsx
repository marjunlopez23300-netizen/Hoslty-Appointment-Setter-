'use client';

import { useRouter } from 'next/navigation';
import Admin from '../../components/Admin';

export default function AdminPage() {
  const router = useRouter();
  return <Admin onExit={() => router.push('/')} />;
}

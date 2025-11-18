'use client';

import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import Splash from './splash/page';

export default function HomePage() {
  const router = useRouter();

  useEffect(() => {
    const timer = setTimeout(() => {
      router.push('/login');
    }, 3000);

    return () => clearTimeout(timer);
  }, [router]);

  return <Splash />;
}

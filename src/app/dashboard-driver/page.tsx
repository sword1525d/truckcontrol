'use client';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

// This page is deprecated and redirects to the admin dashboard.
export default function DashboardDriverPage() {
    const router = useRouter();

    useEffect(() => {
        router.replace('/dashboard-admin');
    }, [router]);

  return (
    <div className="flex items-center justify-center min-h-screen">
      <p>Redirecionando...</p>
    </div>
  );
}

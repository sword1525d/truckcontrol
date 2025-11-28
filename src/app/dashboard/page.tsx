
// src/app/dashboard/page.tsx
'use client';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function DashboardPage() {
    const router = useRouter();

    useEffect(() => {
        // This page is likely not needed, redirect to a more specific dashboard.
        // Or implement logic to choose based on user role from localStorage.
        const user = localStorage.getItem('user');
        if(user) {
            const userData = JSON.parse(user);
            if (userData.isAdmin) {
                router.replace('/dashboard-admin');
                return;
            }
             if (userData.truck) {
                router.replace('/dashboard-truck');
                return;
            }
        }
        // Fallback if no specific role is found or user is not logged in.
        router.replace('/login');
    }, [router]);

  return (
    <div className="flex items-center justify-center min-h-screen">
      <h1 className="text-4xl font-bold">Redirecionando...</h1>
    </div>
  );
}

'use client';

import { Truck } from 'lucide-react';

export default function Splash() {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-background splash-container">
      <div className="splash-animation">
        <Truck className="h-24 w-24 text-primary truck-icon" />
        <h1 className="text-5xl font-bold font-headline text-primary mt-4 app-name">
          Frotacontrol
        </h1>
      </div>
    </div>
  );
}

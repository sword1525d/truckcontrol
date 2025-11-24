'use client';
import { cn } from '@/lib/utils';
import { PlayCircle } from 'lucide-react';

interface TruckButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  children: React.ReactNode;
}

export const TruckButton = ({ children, className, ...props }: TruckButtonProps) => {
  return (
    <button
      className={cn(
        'relative w-full h-28 group transition-transform duration-200 ease-in-out active:scale-[0.98]',
        className
      )}
      {...props}
    >
      <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 300 120"
        className="w-full h-full drop-shadow-lg"
        aria-hidden="true"
      >
        {/* Main silhouette */}
        <path
          d="M288,105H270V55c0-5.52-4.48-10-10-10H230c-5.52,0-10,4.48-10,10V70H10V105H5c-2.76,0-5-2.24-5-5V60c0-2.76,2.24-5,5-5H215c2.76,0,5,2.24,5,5v35h50v5h8c2.76,0,5,2.24,5,5v5h-3Z"
          className="fill-primary group-hover:fill-primary/90 transition-colors"
        />
        {/* Wheels */}
        <circle cx="35" cy="105" r="12" className="fill-gray-700 dark:fill-gray-900" />
        <circle cx="185" cy="105" r="12" className="fill-gray-700 dark:fill-gray-900" />
        <circle cx="35" cy="105" r="5" className="fill-gray-500 dark:fill-gray-600" />
        <circle cx="185" cy="105" r="5" className="fill-gray-500 dark:fill-gray-600" />
        {/* Window */}
         <path
          d="M260,55h-25c-2.76,0-5,2.24-5,5v20h30V55Z"
          className="fill-blue-200 dark:fill-blue-800 opacity-70 group-hover:fill-blue-300 transition-colors"
        />
      </svg>
      <div className="absolute inset-0 flex items-center pr-[6rem] sm:pr-[7rem] pl-4">
        <div className="flex w-full items-center justify-center gap-2 text-primary-foreground text-xl font-bold">
            <PlayCircle className="h-7 w-7"/>
            <span>{children}</span>
        </div>
      </div>
    </button>
  );
};

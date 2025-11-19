'use client';
import { useState, useEffect } from 'react';
import { cn } from '@/lib/utils';

interface OccupancySelectorProps {
  initialValue?: number;
  onValueChange: (value: number) => void;
  disabled?: boolean;
}

const TruckSVG = ({
  occupancy,
  onSegmentClick,
  disabled,
}: {
  occupancy: number;
  onSegmentClick: (segment: number) => void;
  disabled?: boolean;
}) => {
  const segments = Array.from({ length: 10 }, (_, i) => i + 1); // 1 to 10
  const segmentWidth = 18;
  const spacing = 2;
  const cargoAreaWidth = segments.length * (segmentWidth + spacing) - spacing;

  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 300 120"
      className="w-full h-auto"
    >
      {/* Truck Body */}
      <path
        d="M288,105H270V90H220V70H10V105H5c-2.76,0-5-2.24-5-5V60c0-2.76,2.24-5,5-5H215c2.76,0,5,2.24,5,5v15h50v20h8c2.76,0,5,2.24,5,5v5h-3Z"
        className="fill-gray-300 dark:fill-gray-700"
      />
      {/* Wheels */}
      <circle cx="35" cy="105" r="12" className="fill-gray-800 dark:fill-gray-900" />
      <circle cx="185" cy="105" r="12" className="fill-gray-800 dark:fill-gray-900" />
      <circle cx="35" cy="105" r="5" className="fill-gray-500 dark:fill-gray-600" />
      <circle cx="185" cy="105" r="5" className="fill-gray-500 dark:fill-gray-600" />
      {/* Cab */}
      <path
        d="M220,90H270V55c0-5.52-4.48-10-10-10H230c-5.52,0-10,4.48-10,10V90Z"
        className="fill-gray-400 dark:fill-gray-600"
      />
      {/* Window */}
      <path
        d="M260,55h-25c-2.76,0-5,2.24-5,5v20h30V55Z"
        className="fill-blue-300 dark:fill-blue-800 opacity-70"
      />

      {/* Cargo Area (Segments) - desenhado da esquerda para a direita (de 0 a 9) */}
      <g transform="translate(15, 73)">
        {segments.map((segment) => {
          // segment vai de 1 a 10.
          // Visualmente, o primeiro espaço (perto da cabine) é o mais à direita.
          // O último espaço (perto da porta) é o mais à esquerda.
          // Ocupação 10% deve preencher o espaço da direita.
          // Ocupação 100% deve preencher todos os espaços.
          
          // `segment` 1 é a porta traseira (esquerda)
          // `segment` 10 é a cabine (direita)
          const isFilled = segment * 10 <= occupancy;
          
          return (
            <rect
              key={segment}
              // A posição X vai de 0 (esquerda) a 9 * (width+spacing) (direita)
              // `segment` 1 -> x = 0
              // `segment` 10 -> x = 9 * (width+spacing)
              x={(segment - 1) * (segmentWidth + spacing)}
              y="0"
              width={segmentWidth}
              height="15"
              className={cn(
                'transition-colors duration-200',
                isFilled
                  ? 'fill-primary'
                  : 'fill-gray-200 dark:fill-gray-800',
                !disabled &&
                  'cursor-pointer hover:fill-primary/80 dark:hover:fill-primary/50'
              )}
              // Ao clicar, passamos o valor do segmento (1 a 10)
              onClick={() => !disabled && onSegmentClick(segment)}
            />
          );
        })}
      </g>
    </svg>
  );
};

export const OccupancySelector = ({
  initialValue = 0,
  onValueChange,
  disabled = false,
}: OccupancySelectorProps) => {
  const [occupancy, setOccupancy] = useState(initialValue);

  useEffect(() => {
    setOccupancy(initialValue);
  }, [initialValue]);

  const handleSegmentClick = (segment: number) => {
    // O valor do segmento (1 a 10) vira a porcentagem (10 a 100)
    const newOccupancy = segment * 10;
    setOccupancy(newOccupancy);
    onValueChange(newOccupancy);
  };

  return (
    <div className="space-y-2">
      <div className="flex justify-between items-center px-1">
        <span className="text-sm text-muted-foreground">Ocupação do Caminhão</span>
        <span className="text-lg font-bold text-primary">{occupancy}%</span>
      </div>
      <div
        className={cn(
          'rounded-lg border bg-card p-2 transform -scale-x-100', // Inverte o SVG visualmente
          disabled && 'opacity-50'
        )}
      >
        {/*
          Como o SVG está invertido com -scale-x-100, a cabine fica à direita e a porta à esquerda.
          A lógica de desenho e clique dentro do SVG pode ser 'normal' (esquerda para direita),
          e a transformação visual cuida da apresentação correta.
        */}
        <TruckSVG
          occupancy={occupancy}
          onSegmentClick={handleSegmentClick}
          disabled={disabled}
        />
      </div>
    </div>
  );
};

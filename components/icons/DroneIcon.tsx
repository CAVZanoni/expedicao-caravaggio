import React from 'react';

interface DroneIconProps extends React.SVGProps<SVGSVGElement> {
  size?: number | string;
  className?: string;
}

/**
 * Ícone vetorial autêntico de Drone (Quadricóptero) no estilo visual Lucide.
 * Traço de 2px, cantos arredondados, viewBox 0 0 24 24.
 */
export default function DroneIcon({
  size = 24,
  className = 'w-4 h-4',
  ...props
}: DroneIconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      {...props}
    >
      {/* Fuselagem / Corpo Central do Drone */}
      <rect x="9" y="9" width="6" height="6" rx="1.5" />
      {/* Lente da Câmera Gimbal 4K */}
      <circle cx="12" cy="12" r="1.2" fill="currentColor" />

      {/* 4 Braços Diagonais */}
      <path d="M9 9 5.5 5.5" />
      <path d="M15 9l3.5-3.5" />
      <path d="M9 15l-3.5 3.5" />
      <path d="M15 15l3.5 3.5" />

      {/* 4 Rotores / Hélices Horizontais */}
      <line x1="2.5" y1="5.5" x2="8.5" y2="5.5" />
      <circle cx="5.5" cy="5.5" r="0.75" fill="currentColor" />

      <line x1="15.5" y1="5.5" x2="21.5" y2="5.5" />
      <circle cx="18.5" cy="5.5" r="0.75" fill="currentColor" />

      <line x1="2.5" y1="18.5" x2="8.5" y2="18.5" />
      <circle cx="5.5" cy="18.5" r="0.75" fill="currentColor" />

      <line x1="15.5" y1="18.5" x2="21.5" y2="18.5" />
      <circle cx="18.5" cy="18.5" r="0.75" fill="currentColor" />
    </svg>
  );
}

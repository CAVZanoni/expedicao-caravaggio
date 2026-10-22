import React from 'react';

interface DroneIconProps extends React.SVGProps<SVGSVGElement> {
  size?: number | string;
  className?: string;
}

/**
 * Ícone vetorial de Drone (Quadricóptero) em vista frontal autêntica
 * com fuselagem aerodinâmica, hélices horizontais, trens de pouso arqueados
 * e módulo de câmera gimbal central 4K.
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
      fill="currentColor"
      className={className}
      {...props}
    >
      {/* Hélices horizontais aerodinâmicas (Esquerda e Direita) */}
      <path d="M 1 6 C 1 5.6 1.4 5.3 1.8 5.3 L 8.2 5.3 C 8.6 5.3 9 5.6 9 6 C 9 6.4 8.6 6.7 8.2 6.7 L 1.8 6.7 C 1.4 6.7 1 6.4 1 6 Z" />
      <path d="M 15 6 C 15 5.6 15.4 5.3 15.8 5.3 L 22.2 5.3 C 22.6 5.3 23 5.6 23 6 C 23 6.4 22.6 6.7 22.2 6.7 L 15.8 6.7 C 15.4 6.7 15 6.4 15 6 Z" />

      {/* Suportes e Rotores dos Motores */}
      <rect x="4.3" y="6.7" width="1.4" height="2" rx="0.5" />
      <rect x="18.3" y="6.7" width="1.4" height="2" rx="0.5" />

      {/* Fuselagem / Corpo Central Aerodinâmico Curvo */}
      <path d="M 4.2 8.7 C 7.5 8.2, 9.6 7.2, 12 7.2 C 14.4 7.2, 16.5 8.2, 19.8 8.7 C 20.6 9.8, 18.8 10.6, 17 10.3 C 14.5 9.8, 13.5 10.7, 12 10.7 C 10.5 10.7, 9.5 9.8, 7 10.3 C 5.2 10.6, 3.4 9.8, 4.2 8.7 Z" />

      {/* Trens de Pouso / Skids (Pernas Arqueadas Estilizadas) */}
      <path d="M 7.2 10.3 C 5.8 12, 5.2 14.8, 5.8 18 C 6.2 18.2, 6.6 18, 6.8 17.6 C 6.4 15, 6.9 12.6, 8 11 Z" />
      <path d="M 16.8 10.3 C 18.2 12, 18.8 14.8, 18.2 18 C 17.8 18.2, 17.4 18, 17.2 17.6 C 17.6 15, 17.1 12.6, 16 11 Z" />

      {/* Módulo de Câmera Central (Gimbal) com lente vazada */}
      <path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M 9.5 11.2 H 14.5 C 15 11.2 15.4 11.6 15.4 12.1 V 15.5 C 15.4 16 15 16.4 14.5 16.4 H 9.5 C 9 16.4 8.6 16 8.6 15.5 V 12.1 C 8.6 11.6 9 11.2 9.5 11.2 Z M 12 15.3 C 12.9 15.3 13.6 14.6 13.6 13.7 C 13.6 12.8 12.9 12.1 12 12.1 C 11.1 12.1 10.4 12.8 10.4 13.7 C 10.4 14.6 11.1 15.3 12 15.3 Z"
      />
      {/* Reflexo / Centro da Lente */}
      <circle cx="12" cy="13.7" r="0.6" />
    </svg>
  );
}

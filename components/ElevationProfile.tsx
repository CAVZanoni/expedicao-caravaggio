'use client';

import React from 'react';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import { Etapa } from '@/lib/supabase';
import { Mountain, ArrowUpRight, ArrowDownRight } from 'lucide-react';

interface ElevationProfileProps {
  etapa?: Etapa;
  onHoverPoint?: (coord: [number, number] | null) => void;
}

export default function ElevationProfile({
  etapa,
  onHoverPoint,
}: ElevationProfileProps) {
  if (!etapa || !etapa.perfil_altimetria || etapa.perfil_altimetria.length === 0) {
    if (etapa) {
      const dataFormatada = etapa.data
        ? new Date(etapa.data + 'T00:00:00').toLocaleDateString('pt-BR')
        : '';
      return (
        <div className="bg-slate-900/90 backdrop-blur-md border border-slate-800 rounded-xl p-4 text-center">
          <div className="flex items-center justify-center gap-2 text-purple-400 mb-1 font-semibold text-xs md:text-sm">
            <Mountain className="w-4 h-4" />
            <span>Dia {etapa.numero_dia} • {etapa.titulo} {dataFormatada ? `(${dataFormatada})` : ''}</span>
          </div>
          <p className="text-xs text-slate-400">
            Track GPX desta etapa pendente de carregamento. Veja as fotos e vídeos desta etapa disponíveis abaixo.
          </p>
        </div>
      );
    }
    return (
      <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-4 text-center text-xs text-slate-400">
        Selecione uma etapa para visualizar o perfil altimétrico detalhado.
      </div>
    );
  }

  const data = etapa.perfil_altimetria;
  const cor = etapa.cor_trajeto || '#fc4c02';

  return (
    <div className="bg-slate-900/90 backdrop-blur-md border border-slate-800 rounded-xl p-3 shadow-xl">
      {/* Cabeçalho do Gráfico */}
      <div className="flex items-center justify-between mb-2 px-1">
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full shadow-sm" style={{ backgroundColor: cor }} />
          <Mountain className="w-4 h-4" style={{ color: cor }} />
          <span className="text-xs font-semibold text-slate-200">
            Perfil de Altimetria • Dia {etapa.numero_dia} ({etapa.distancia_km} km)
          </span>
        </div>

        <div className="flex items-center gap-4 text-xs">
          <span className="flex items-center gap-1 text-emerald-400">
            <ArrowUpRight className="w-3.5 h-3.5" />
            Max: {etapa.alt_max}m
          </span>
          <span className="flex items-center gap-1 text-sky-400">
            <ArrowDownRight className="w-3.5 h-3.5" />
            Min: {etapa.alt_min}m
          </span>
          <span className="text-slate-400">
            Ganho: +{etapa.altimetria_ganho}m
          </span>
        </div>
      </div>

      {/* Gráfico Recharts */}
      <div className="w-full h-28">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart
            data={data}
            margin={{ top: 5, right: 10, left: -20, bottom: 0 }}
            onMouseMove={(state: any) => {
              if (state && state.activePayload && state.activePayload.length > 0) {
                const pt = state.activePayload[0].payload;
                if (pt && onHoverPoint) {
                  onHoverPoint([pt.lon, pt.lat]);
                }
              }
            }}
            onMouseLeave={() => {
              if (onHoverPoint) onHoverPoint(null);
            }}
          >
            <defs>
              <linearGradient id="eleGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor={cor} stopOpacity={0.8} />
                <stop offset="95%" stopColor={cor} stopOpacity={0.05} />
              </linearGradient>
            </defs>
            <XAxis
              dataKey="km"
              stroke="#64748b"
              fontSize={10}
              tickFormatter={(v) => `${v} km`}
              tickLine={false}
              axisLine={false}
            />
            <YAxis
              dataKey="altitude"
              stroke="#64748b"
              fontSize={10}
              domain={['auto', 'auto']}
              tickFormatter={(v) => `${v}m`}
              tickLine={false}
              axisLine={false}
            />
            <Tooltip
              content={({ active, payload }) => {
                if (active && payload && payload.length) {
                  const p = payload[0].payload;
                  return (
                    <div className="bg-slate-950/95 border border-slate-700/80 rounded-lg p-2 text-xs shadow-xl">
                      <p className="font-bold text-orange-400">
                        {p.km.toFixed(1)} km
                      </p>
                      <p className="text-slate-200">
                        Altitude: <span className="font-semibold text-white">{p.altitude} m</span>
                      </p>
                    </div>
                  );
                }
                return null;
              }}
            />
            <Area
              type="monotone"
              dataKey="altitude"
              stroke={cor}
              strokeWidth={2}
              fillOpacity={1}
              fill="url(#eleGrad)"
              isAnimationActive={false}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

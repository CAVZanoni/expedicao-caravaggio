'use client';

import React, { useState } from 'react';
import { Etapa, ExpedicaoConfig } from '@/lib/supabase';
import {
  Mountain,
  Navigation,
  Compass,
  Lock,
  Unlock,
  FolderOpen,
  Palette,
  Shuffle,
  Check,
  Images,
} from 'lucide-react';

interface HeaderProps {
  etapas: Etapa[];
  diaSelecionado: number | null; // null = Visão Geral
  onSelectDia: (dia: number | null) => void;
  tipoMapa: 'satellite' | 'streets' | 'topo';
  onChangeTipoMapa: (tipo: 'satellite' | 'streets' | 'topo') => void;
  isAdmin: boolean;
  onOpenAdminDrawer: () => void;
  config?: ExpedicaoConfig | null;
  onUpdateCorTrajeto?: (numeroDia: number, novaCor: string) => Promise<void>;
  onRandomizeAllColors?: () => Promise<void>;
  onToggleGallery?: () => void;
  isGalleryOpen?: boolean;
  totalMidias?: number;
  isEditMode?: boolean;
  onToggleEditMode?: () => void;
}

const PALETA_CORES = [
  { nome: 'Laranja', hex: '#f97316' },
  { nome: 'Ciano', hex: '#06b6d4' },
  { nome: 'Verde Esmeralda', hex: '#10b981' },
  { nome: 'Amarelo Ouro', hex: '#eab308' },
  { nome: 'Roxo Violeta', hex: '#8b5cf6' },
  { nome: 'Rosa Choque', hex: '#ec4899' },
  { nome: 'Azul Real', hex: '#3b82f6' },
  { nome: 'Vermelho Fogo', hex: '#ef4444' },
  { nome: 'Verde Lima', hex: '#84cc16' },
  { nome: 'Turquesa', hex: '#14b8a6' },
  { nome: 'Índigo', hex: '#6366f1' },
  { nome: 'Âmbar', hex: '#d97706' },
];

export default function Header({
  etapas,
  diaSelecionado,
  onSelectDia,
  tipoMapa,
  onChangeTipoMapa,
  isAdmin,
  onOpenAdminDrawer,
  config,
  onUpdateCorTrajeto,
  onRandomizeAllColors,
  onToggleGallery,
  isGalleryOpen,
  totalMidias,
  isEditMode,
  onToggleEditMode,
}: HeaderProps) {
  const [showColorPicker, setShowColorPicker] = useState(false);
  const etapaAtual = etapas.find((e) => e.numero_dia === diaSelecionado);

  const totalDistancia = diaSelecionado
    ? etapaAtual?.distancia_km || 0
    : etapas.reduce((acc, curr) => acc + Number(curr.distancia_km), 0);

  const totalAltimetria = diaSelecionado
    ? etapaAtual?.altimetria_ganho || 0
    : etapas.reduce((acc, curr) => acc + curr.altimetria_ganho, 0);

  const handleSelectCor = async (cor: string) => {
    if (diaSelecionado && onUpdateCorTrajeto) {
      await onUpdateCorTrajeto(diaSelecionado, cor);
    }
  };

  const handleRandomizeSingle = () => {
    const coresDisponiveis = PALETA_CORES.map((c) => c.hex);
    const corAleatoria = coresDisponiveis[Math.floor(Math.random() * coresDisponiveis.length)];
    handleSelectCor(corAleatoria);
  };

  return (
    <header className="bg-slate-900/90 backdrop-blur-md border-b border-slate-800 sticky top-0 z-40 transition-all">
      {/* Barra Superior Principal */}
      <div className="max-w-7xl mx-auto px-3 sm:px-4 py-2 sm:py-3 flex items-center justify-between gap-2 sm:gap-4">
        {/* Logotipo e Título */}
        <div className="flex items-center gap-2 sm:gap-3 min-w-0">
          <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-xl bg-gradient-to-tr from-orange-600 to-amber-500 flex items-center justify-center shadow-lg shadow-orange-500/20 text-white font-bold shrink-0">
            <Mountain className="w-4 h-4 sm:w-5 sm:h-5" />
          </div>
          <div className="min-w-0">
            <h1 className="text-sm sm:text-base md:text-xl font-bold bg-gradient-to-r from-white via-slate-100 to-slate-400 bg-clip-text text-transparent truncate">
              {config?.titulo || 'Expedição Cânions & Caminho de Caravaggio'}
            </h1>
            <p className="text-[11px] sm:text-xs text-slate-400 truncate">
              {diaSelecionado
                ? `Dia ${diaSelecionado} • ${etapaAtual?.titulo || ''} (${etapaAtual?.data ? new Date(etapaAtual.data + 'T00:00:00').toLocaleDateString('pt-BR') : ''})`
                : `${etapas.length > 0 ? etapas.length : 9} Dias nos Cânions e Serra Gaúcha • ${totalDistancia.toFixed(1)} km • +${totalAltimetria}m`}
            </p>
          </div>
        </div>

        {/* Métricas Rápidas (Estilo Strava) - Visível em telas médias e grandes */}
        <div className="hidden lg:flex items-center gap-6 bg-slate-950/60 border border-slate-800/80 rounded-xl px-4 py-2 shrink-0">
          <div className="flex items-center gap-2">
            <Navigation className="w-4 h-4 text-orange-400" />
            <div>
              <span className="text-xs text-slate-400 block leading-tight">Distância</span>
              <span className="text-sm font-bold text-white">{totalDistancia.toFixed(1)} km</span>
            </div>
          </div>
          <div className="w-[1px] h-6 bg-slate-800" />
          <div className="flex items-center gap-2">
            <Compass className="w-4 h-4 text-amber-400" />
            <div>
              <span className="text-xs text-slate-400 block leading-tight">Desnível +</span>
              <span className="text-sm font-bold text-white">+{totalAltimetria} m</span>
            </div>
          </div>
        </div>

        {/* Controles de Mapa, OneDrive e Acesso Admin */}
        <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
          {/* Link da Pasta OneDrive (Exclusivo para Vídeos de Drone) */}
          {config?.onedrive_pasta_url && (
            <a
              href={config.onedrive_pasta_url}
              target="_blank"
              rel="noopener noreferrer"
              className="p-1.5 sm:p-2 rounded-lg bg-slate-800/70 hover:bg-slate-700 text-slate-300 hover:text-white transition flex items-center gap-1.5 text-xs shrink-0"
              title="Abrir pasta de vídeos de drone no OneDrive"
            >
              <FolderOpen className="w-4 h-4 text-sky-400" />
              <span className="hidden md:inline">OneDrive</span>
            </a>
          )}

          {/* Seletor de Camadas do Mapa */}
          <div className="flex items-center bg-slate-950/80 border border-slate-800 rounded-lg p-0.5 shrink-0">
            <button
              onClick={() => onChangeTipoMapa('satellite')}
              className={`px-2 sm:px-2.5 py-1 text-xs font-medium rounded-md transition ${
                tipoMapa === 'satellite'
                  ? 'bg-orange-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              Satélite
            </button>
            <button
              onClick={() => onChangeTipoMapa('streets')}
              className={`px-2 sm:px-2.5 py-1 text-xs font-medium rounded-md transition ${
                tipoMapa === 'streets'
                  ? 'bg-orange-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              Mapa
            </button>
          </div>

          {/* Botão de Galeria Lateral (no mobile fica oculto pois já tem o botão flutuante sobre o mapa) */}
          {onToggleGallery && (
            <button
              onClick={onToggleGallery}
              className={`hidden sm:flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-lg text-xs font-semibold transition border shrink-0 ${
                isGalleryOpen
                  ? 'bg-orange-600 border-orange-500 text-white shadow-lg shadow-orange-600/30'
                  : 'bg-slate-800/80 border-slate-700 text-slate-200 hover:bg-slate-700 hover:text-white'
              }`}
              title="Abrir galeria de fotos e vídeos"
            >
              <Images className="w-3.5 h-3.5 text-orange-400" />
              <span>Fotos</span>
              {totalMidias !== undefined && totalMidias > 0 && (
                <span
                  className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold ${
                    isGalleryOpen ? 'bg-orange-800 text-white' : 'bg-slate-900 text-orange-400'
                  }`}
                >
                  {totalMidias}
                </span>
              )}
            </button>
          )}

          {/* Botão de Trava de Edição de Pins (ao lado do Admin) */}
          {isAdmin && onToggleEditMode && (
            <button
              onClick={onToggleEditMode}
              className={`flex items-center gap-1.5 px-2 sm:px-3 py-1.5 rounded-lg text-xs font-semibold transition border shrink-0 ${
                isEditMode
                  ? 'bg-amber-500 border-amber-400 text-slate-950 font-bold shadow-md shadow-amber-500/20 animate-pulse'
                  : 'bg-slate-800/80 border-slate-700 text-slate-300 hover:bg-slate-700 hover:text-white'
              }`}
              title={
                isEditMode
                  ? 'Pins destravados: clique para travar a movimentação dos marcadores'
                  : 'Pins travados: clique para destravar e reposicionar marcadores na rota'
              }
            >
              {isEditMode ? (
                <>
                  <Unlock className="w-3.5 h-3.5 stroke-[2.5]" />
                  <span className="hidden xl:inline">Pins Destravados</span>
                  <span className="hidden sm:inline xl:hidden">Destravado</span>
                </>
              ) : (
                <>
                  <Lock className="w-3.5 h-3.5 text-slate-400" />
                  <span className="hidden xl:inline">Pins Travados</span>
                  <span className="hidden sm:inline xl:hidden">Travado</span>
                </>
              )}
            </button>
          )}

          {/* Botão de Admin */}
          <button
            onClick={onOpenAdminDrawer}
            className={`flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-lg text-xs font-medium transition border shrink-0 ${
              isAdmin
                ? 'bg-amber-500/10 border-amber-500/30 text-amber-400 hover:bg-amber-500/20'
                : 'bg-slate-800/80 border-slate-700 text-slate-300 hover:bg-slate-700 hover:text-white'
            }`}
          >
            {isAdmin ? (
              <>
                <Unlock className="w-3.5 h-3.5" />
                <span>Admin</span>
              </>
            ) : (
              <>
                <Lock className="w-3.5 h-3.5" />
                <span>Entrar</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Barra de Seleção de Etapas e Personalização de Cor */}
      <div className="bg-slate-950/40 border-t border-slate-800/60 overflow-x-auto relative">
        <div className="max-w-7xl mx-auto px-4 flex items-center justify-between gap-2 py-1.5 min-w-max">
          <div className="flex items-center gap-1">
            <button
              onClick={() => {
                onSelectDia(null);
                setShowColorPicker(false);
              }}
              className={`px-3 py-1 rounded-md text-xs font-medium transition ${
                diaSelecionado === null
                  ? 'bg-slate-800 text-white ring-1 ring-slate-600 font-semibold'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
              }`}
            >
              Toda a Expedição ({etapas.length > 0 ? `${etapas.length} Dias` : '9 Dias'})
            </button>

            {etapas.map((e) => {
              const cor = e.cor_trajeto || '#f97316';
              const isSelected = diaSelecionado === e.numero_dia;

              return (
                <button
                  key={e.numero_dia}
                  onClick={() => onSelectDia(e.numero_dia)}
                  className={`px-3 py-1 rounded-md text-xs font-medium transition flex items-center gap-2 ${
                    isSelected
                      ? 'text-white shadow-md font-semibold ring-1'
                      : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
                  }`}
                  style={{
                    backgroundColor: isSelected ? `${cor}25` : undefined,
                    borderColor: isSelected ? cor : undefined,
                  }}
                >
                  <span
                    className="w-2.5 h-2.5 rounded-full shadow-sm shrink-0 transition-transform"
                    style={{
                      backgroundColor: cor,
                      boxShadow: isSelected ? `0 0 8px ${cor}` : undefined,
                    }}
                  />
                  <span>Dia {e.numero_dia}: {e.cidade_destino || e.titulo}</span>
                </button>
              );
            })}
          </div>

          {/* Ferramenta de Personalização de Cores */}
          <div className="flex items-center gap-2 pl-3 border-l border-slate-800">
            {/* Se um dia estiver selecionado, permite mudar a cor daquele dia */}
            {diaSelecionado && etapaAtual && (
              <div className="relative">
                <button
                  onClick={() => setShowColorPicker(!showColorPicker)}
                  className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium bg-slate-900 border border-slate-700 hover:border-slate-500 text-slate-200 transition shadow-sm"
                  title="Alterar cor do trajeto deste dia"
                >
                  <Palette className="w-3.5 h-3.5" style={{ color: etapaAtual.cor_trajeto || '#f97316' }} />
                  <span>Cor do Dia {diaSelecionado}</span>
                  <span
                    className="w-3 h-3 rounded-full border border-white/40 ml-0.5"
                    style={{ backgroundColor: etapaAtual.cor_trajeto || '#f97316' }}
                  />
                </button>

                {/* Popover Seletor de Cores */}
                {showColorPicker && (
                  <div className="absolute right-0 top-9 z-50 bg-slate-900/95 backdrop-blur-md border border-slate-700 rounded-xl p-3 shadow-2xl w-64 animate-fadeIn">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs font-bold text-slate-200">
                        Cor do Trajeto (Dia {diaSelecionado})
                      </span>
                      <button
                        onClick={handleRandomizeSingle}
                        className="text-[11px] text-orange-400 hover:text-orange-300 flex items-center gap-1"
                        title="Sortear cor aleatória para este dia"
                      >
                        <Shuffle className="w-3 h-3" />
                        <span>Sortear</span>
                      </button>
                    </div>

                    {/* Grade de Cores Pré-definidas */}
                    <div className="grid grid-cols-6 gap-2 mb-3">
                      {PALETA_CORES.map((cor) => {
                        const isCurrent =
                          (etapaAtual.cor_trajeto || '#f97316').toLowerCase() === cor.hex.toLowerCase();
                        return (
                          <button
                            key={cor.hex}
                            onClick={() => handleSelectCor(cor.hex)}
                            title={cor.nome}
                            className="w-7 h-7 rounded-full transition-transform hover:scale-110 flex items-center justify-center relative shadow-md"
                            style={{ backgroundColor: cor.hex }}
                          >
                            {isCurrent && <Check className="w-3.5 h-3.5 text-white drop-shadow" />}
                          </button>
                        );
                      })}
                    </div>

                    {/* Seletor Customizado Livre */}
                    <div className="flex items-center justify-between pt-2 border-t border-slate-800 text-xs">
                      <span className="text-slate-400">Escolha livre:</span>
                      <div className="flex items-center gap-2">
                        <input
                          type="color"
                          value={etapaAtual.cor_trajeto || '#f97316'}
                          onChange={(e) => handleSelectCor(e.target.value)}
                          className="w-6 h-6 rounded cursor-pointer border-0 bg-transparent"
                        />
                        <span className="text-[11px] font-mono text-slate-300">
                          {etapaAtual.cor_trajeto || '#f97316'}
                        </span>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Botão para Colorir Todos os Dias Aleatoriamente */}
            {onRandomizeAllColors && (
              <button
                onClick={onRandomizeAllColors}
                className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium bg-slate-900 border border-slate-800 hover:border-slate-700 text-slate-400 hover:text-orange-400 transition"
                title="Sortear novas cores aleatórias para todos os 7 dias"
              >
                <Shuffle className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Cores Aleatórias</span>
              </button>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}

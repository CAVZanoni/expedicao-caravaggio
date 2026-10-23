'use client';

import React, { useState, useEffect } from 'react';
import { Midia, ExpedicaoConfig } from '@/lib/supabase';
import {
  X,
  Download,
  Trash2,
  Lock,
  Unlock,
  MapPin,
  Calendar,
  Compass,
  Edit2,
  ExternalLink,
  ChevronLeft,
  ChevronRight,
  Maximize2,
  Check,
  Cloud,
  FolderOpen,
} from 'lucide-react';
import DroneIcon from '@/components/icons/DroneIcon';

interface MediaModalProps {
  midia: Midia | null;
  onClose: () => void;
  isAdmin: boolean;
  onDeleteMidia: (id: string) => Promise<void>;
  onTogglePrivacy: (id: string, currentPrivate: boolean) => Promise<void>;
  onUpdateLinks?: (
    id: string,
    youtubeId: string,
    onedriveUrl: string,
    titulo: string
  ) => Promise<void>;
  config?: ExpedicaoConfig | null;
  onNavigatePrev?: () => void;
  onNavigateNext?: () => void;
  hasPrev?: boolean;
  hasNext?: boolean;
}

export default function MediaModal({
  midia,
  onClose,
  isAdmin,
  onDeleteMidia,
  onTogglePrivacy,
  onUpdateLinks,
  config,
  onNavigatePrev,
  onNavigateNext,
  hasPrev,
  hasNext,
}: MediaModalProps) {
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editYoutube, setEditYoutube] = useState('');
  const [editOneDrive, setEditOneDrive] = useState('');
  const [editTitulo, setEditTitulo] = useState('');
  const [saving, setSaving] = useState(false);

  // Navegação por Teclado (Setas e Esc)
  useEffect(() => {
    if (!midia) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      } else if (e.key === 'ArrowLeft' && hasPrev && onNavigatePrev) {
        onNavigatePrev();
      } else if (e.key === 'ArrowRight' && hasNext && onNavigateNext) {
        onNavigateNext();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [midia, hasPrev, hasNext, onNavigatePrev, onNavigateNext, onClose]);

  if (!midia) return null;

  // Extrair ID do YouTube caso o usuário tenha colado URL completa
  const getYouTubeId = (input?: string) => {
    if (!input) return null;
    const match = input.match(
      /(?:youtu\.be\/|youtube\.com\/(?:embed\/|v\/|watch\?v=|watch\?.+&v=))([\w-]{11})/
    );
    return match ? match[1] : input;
  };

  const ytId = midia.youtube_id ? getYouTubeId(midia.youtube_id) : null;

  // Link de download do OneDrive
  const downloadOneDriveUrl =
    midia.onedrive_download_url || config?.onedrive_pasta_url || '#';

  const handleStartEdit = () => {
    setEditYoutube(midia.youtube_id || '');
    setEditOneDrive(midia.onedrive_download_url || '');
    setEditTitulo(midia.titulo || '');
    setIsEditing(true);
  };

  const handleSaveEdit = async () => {
    if (!onUpdateLinks) return;
    setSaving(true);
    try {
      const cleanYt = getYouTubeId(editYoutube) || editYoutube;
      await onUpdateLinks(midia.id, cleanYt, editOneDrive, editTitulo);
      setIsEditing(false);
    } catch (err) {
      alert('Erro ao salvar alterações.');
    } finally {
      setSaving(false);
    }
  };

  // Ativar Tela Cheia nativa do navegador
  const handleToggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => {});
    } else {
      document.exitFullscreen().catch(() => {});
    }
  };

  // Priorizar URL em alta resolução (rota /api/media/ ou storage)
  const fullResUrl = midia.url_midia || (midia.arquivo_nome ? `/api/media/${midia.arquivo_nome}` : midia.url_thumbnail);

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-2 sm:p-4 bg-slate-950/90 backdrop-blur-xl animate-fadeIn">
      {/* Botão Anterior Flutuante */}
      {hasPrev && onNavigatePrev && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            onNavigatePrev();
          }}
          className="absolute left-2 sm:left-4 z-50 p-2.5 sm:p-3 rounded-full bg-slate-900/85 hover:bg-orange-600 text-white border border-slate-700/80 shadow-2xl transition hover:scale-110 active:scale-95"
          title="Foto anterior (Seta esquerda)"
          aria-label="Foto anterior"
        >
          <ChevronLeft className="w-5 h-5 sm:w-6 sm:h-6" />
        </button>
      )}

      {/* Botão Próximo Flutuante */}
      {hasNext && onNavigateNext && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            onNavigateNext();
          }}
          className="absolute right-2 sm:right-4 z-50 p-2.5 sm:p-3 rounded-full bg-slate-900/85 hover:bg-orange-600 text-white border border-slate-700/80 shadow-2xl transition hover:scale-110 active:scale-95"
          title="Próxima foto (Seta direita)"
          aria-label="Próxima foto"
        >
          <ChevronRight className="w-5 h-5 sm:w-6 sm:h-6" />
        </button>
      )}

      {/* Container Principal Expandido para Quase Toda a Tela */}
      <div className="relative w-[96vw] max-w-7xl h-[94vh] bg-slate-950/95 border border-slate-800 rounded-2xl shadow-2xl overflow-hidden flex flex-col justify-between">
        {/* Cabeçalho do Modal Responsivo */}
        <div className="flex items-center justify-between px-3 sm:px-6 py-2.5 sm:py-3 border-b border-slate-800/80 bg-slate-900/80 backdrop-blur-md shrink-0 gap-2">
          {/* Lado Esquerdo: Badge e Título (com proteção contra overflow) */}
          <div className="flex items-center gap-2 sm:gap-3 min-w-0 flex-1 overflow-hidden">
            <span
              className={`px-2.5 py-1 rounded-full text-[10px] sm:text-xs font-bold uppercase tracking-wider shrink-0 whitespace-nowrap flex items-center gap-1.5 ${
                midia.tipo === 'video_drone'
                  ? 'bg-red-500/20 text-red-400 border border-red-500/30'
                  : midia.tipo === 'video'
                  ? 'bg-sky-500/20 text-sky-400 border border-sky-500/30'
                  : 'bg-orange-500/20 text-orange-400 border border-orange-500/30'
              }`}
            >
              {midia.tipo === 'video_drone' ? (
                <>
                  <DroneIcon className="w-3.5 h-3.5 text-red-400" />
                  <span>Drone 4K</span>
                </>
              ) : midia.tipo === 'video' ? (
                'Vídeo'
              ) : (
                'Foto HD'
              )}
            </span>

            <h3 className="text-xs sm:text-base font-bold text-white truncate min-w-0 flex-1" title={midia.titulo || midia.arquivo_nome}>
              {midia.titulo || midia.arquivo_nome || 'Registro da Viagem'}
            </h3>

            {midia.km_no_trajeto !== undefined && midia.km_no_trajeto !== null ? (
              <span className="hidden md:inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-slate-800 text-orange-400 border border-orange-500/30 shrink-0">
                <MapPin className="w-3 h-3 text-orange-400" />
                <span>km {Number(midia.km_no_trajeto).toFixed(1)}</span>
              </span>
            ) : (
              <span className="hidden md:inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-slate-800 text-sky-400 border border-sky-500/30 shrink-0">
                <MapPin className="w-3 h-3 text-sky-400" />
                <span>Pré-viagem</span>
              </span>
            )}

            {midia.is_private && (
              <span className="hidden sm:flex items-center gap-1 text-xs px-2 py-0.5 rounded bg-amber-500/20 text-amber-400 border border-amber-500/30 shrink-0">
                <Lock className="w-3 h-3" /> Particular
              </span>
            )}
          </div>

          {/* Lado Direito: Botões de Expandir e Fechar Ampliados e Protegidos */}
          <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
            <button
              onClick={handleToggleFullscreen}
              className="w-9 h-9 sm:w-10 sm:h-10 flex items-center justify-center rounded-xl text-slate-300 hover:text-white bg-slate-800/80 hover:bg-slate-700 active:scale-95 transition shrink-0 border border-slate-700/60"
              title="Tela cheia"
              aria-label="Tela cheia"
            >
              <Maximize2 className="w-4 h-4 sm:w-4.5 sm:h-4.5" />
            </button>
            <button
              onClick={onClose}
              className="w-9 h-9 sm:w-10 sm:h-10 flex items-center justify-center rounded-xl text-white bg-slate-800/90 hover:bg-red-600 active:scale-95 transition shrink-0 border border-slate-700/60 shadow-lg"
              title="Fechar (Esc)"
              aria-label="Fechar"
            >
              <X className="w-4 h-4 sm:w-5 sm:h-5 stroke-[2.5]" />
            </button>
          </div>
        </div>

        {/* Área Central: Foto, Player do YouTube ou Vídeo Nativo de Celular */}
        <div className="flex-1 bg-black/80 flex items-center justify-center overflow-hidden relative p-1 sm:p-2">
          {midia.tipo === 'video_drone' && ytId ? (
            <div className="w-full h-full max-h-[82vh] aspect-video flex items-center justify-center">
              <iframe
                src={`https://www.youtube.com/embed/${ytId}?autoplay=1&rel=0`}
                title={midia.titulo || 'Vídeo de Drone'}
                className="w-full h-full max-w-5xl rounded-xl border border-slate-800 shadow-2xl"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
              />
            </div>
          ) : midia.tipo === 'video' ? (
            <div className="w-full h-full max-h-[82vh] flex items-center justify-center p-2">
              <video
                src={fullResUrl}
                controls
                autoPlay
                className="max-h-[82vh] w-auto max-w-full rounded-xl shadow-2xl bg-black"
              />
            </div>
          ) : (
            <img
              src={fullResUrl}
              alt={midia.titulo || 'Foto'}
              className="max-h-[82vh] w-auto max-w-full object-contain select-none drop-shadow-2xl rounded-lg animate-fadeIn transition-transform"
            />
          )}
        </div>

        {/* Barra de Edição para o Admin (quando ativada) */}
        {isEditing && (
          <div className="bg-slate-950 p-4 border-t border-slate-800 flex flex-col gap-3 shrink-0">
            <h4 className="text-xs font-semibold text-orange-400 uppercase tracking-wider">
              Editar Mídia e Links de Download
            </h4>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div>
                <label className="text-xs text-slate-400 block mb-1">Título</label>
                <input
                  type="text"
                  value={editTitulo}
                  onChange={(e) => setEditTitulo(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-white focus:outline-none focus:border-orange-500"
                />
              </div>

              {midia.tipo === 'video_drone' && (
                <div>
                  <label className="text-xs text-slate-400 block mb-1">
                    Link / ID do YouTube
                  </label>
                  <input
                    type="text"
                    value={editYoutube}
                    onChange={(e) => setEditYoutube(e.target.value)}
                    placeholder="https://youtu.be/..."
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-white focus:outline-none focus:border-orange-500"
                  />
                </div>
              )}
            </div>

            <div className="flex justify-end gap-2 mt-2">
              <button
                onClick={() => setIsEditing(false)}
                className="px-3 py-1.5 rounded-lg text-xs text-slate-300 hover:bg-slate-800 transition"
              >
                Cancelar
              </button>
              <button
                onClick={handleSaveEdit}
                disabled={saving}
                className="px-4 py-1.5 rounded-lg text-xs font-medium bg-orange-600 hover:bg-orange-500 text-white transition flex items-center gap-1.5"
              >
                <Check className="w-3.5 h-3.5" />
                {saving ? 'Salvando...' : 'Salvar Alterações'}
              </button>
            </div>
          </div>
        )}

        {/* Rodapé: Metadados e Ações */}
        <div className="px-3 sm:px-6 py-2 sm:py-3 bg-slate-900/80 backdrop-blur-md border-t border-slate-800 flex flex-wrap items-center justify-between gap-2 sm:gap-3 shrink-0">
          {/* Metadados Técnicos */}
          <div className="flex flex-wrap items-center gap-2.5 sm:gap-4 text-[11px] sm:text-xs text-slate-400">
            <span className="flex items-center gap-1">
              <MapPin className="w-3 h-3 text-orange-400" />
              {midia.latitude.toFixed(4)}, {midia.longitude.toFixed(4)}
            </span>

            {midia.altitude && (
              <span className="flex items-center gap-1">
                <Compass className="w-3 h-3 text-amber-400" />
                {midia.altitude.toFixed(0)}m
              </span>
            )}

            {midia.timestamp_captura && (
              <span className="hidden xs:flex items-center gap-1">
                <Calendar className="w-3 h-3 text-sky-400" />
                {new Date(midia.timestamp_captura).toLocaleDateString('pt-BR')}
              </span>
            )}
          </div>

          {/* Botões de Ação */}
          <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto justify-end">
            {/* Acesso à Pasta do OneDrive Exclusivo para Vídeos de Drone */}
            {midia.tipo === 'video_drone' && config?.onedrive_pasta_url && (
              <a
                href={config.onedrive_pasta_url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-center gap-1.5 px-3 py-1.5 sm:px-3.5 sm:py-2 rounded-xl text-xs font-semibold bg-gradient-to-r from-sky-600 to-blue-600 hover:from-sky-500 hover:to-blue-500 text-white shadow-lg shadow-sky-600/20 transition hover:scale-[1.02] active:scale-95"
                title="Abrir pasta de vídeos originais no OneDrive"
              >
                <FolderOpen className="w-3.5 h-3.5 text-white" />
                <span>Vídeos no OneDrive</span>
                <ExternalLink className="w-3 h-3 opacity-70" />
              </a>
            )}

            {/* Ações Administrativas */}
            {isAdmin && (
              <div className="flex items-center gap-2 pl-3 border-l border-slate-800">
                {/* Editar Links */}
                <button
                  onClick={handleStartEdit}
                  className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition"
                  title="Editar dados e links"
                >
                  <Edit2 className="w-4 h-4" />
                </button>

                {/* Alternar Privacidade */}
                <button
                  onClick={() => onTogglePrivacy(midia.id, midia.is_private)}
                  className={`p-2 rounded-lg transition ${
                    midia.is_private
                      ? 'bg-amber-500/20 text-amber-400 hover:bg-amber-500/30'
                      : 'bg-slate-800 text-slate-400 hover:text-white'
                  }`}
                  title={
                    midia.is_private
                      ? 'Marcar como Pública'
                      : 'Marcar como Particular'
                  }
                >
                  {midia.is_private ? (
                    <Lock className="w-4 h-4" />
                  ) : (
                    <Unlock className="w-4 h-4" />
                  )}
                </button>

                {/* Excluir Mídia */}
                {confirmDelete ? (
                  <div className="flex items-center gap-1 bg-red-950/80 border border-red-800 rounded-lg p-1">
                    <span className="text-[10px] text-red-200 px-1">Excluir?</span>
                    <button
                      onClick={async () => {
                        await onDeleteMidia(midia.id);
                        onClose();
                      }}
                      className="px-2 py-0.5 rounded bg-red-600 text-white text-[10px] font-bold hover:bg-red-500"
                    >
                      Sim
                    </button>
                    <button
                      onClick={() => setConfirmDelete(false)}
                      className="px-2 py-0.5 rounded bg-slate-800 text-slate-300 text-[10px]"
                    >
                      Não
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => setConfirmDelete(true)}
                    className="p-2 rounded-lg bg-slate-800 hover:bg-red-500/20 text-slate-400 hover:text-red-400 transition"
                    title="Excluir mídia"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

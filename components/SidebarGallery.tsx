'use client';

import React, { useState, useMemo } from 'react';
import JSZip from 'jszip';
import { Midia, Etapa, ExpedicaoConfig, MediaFilters } from '@/lib/supabase';
import {
  X,
  Download,
  CheckSquare,
  Square,
  Images,
  Film,
  Camera,
  Video,
  Loader2,
  ExternalLink,
  ChevronRight,
  Filter,
  Check,
  Lock,
  MapPin,
  Play,
} from 'lucide-react';
import DroneIcon from '@/components/icons/DroneIcon';

interface SidebarGalleryProps {
  isOpen: boolean;
  onClose: () => void;
  midias: Midia[];
  etapas: Etapa[];
  diaSelecionado: number | null;
  onSelectDia: (dia: number | null) => void;
  onSelectMidia: (midia: Midia) => void;
  onFocusOnMap?: (midia: Midia) => void;
  hoveredMidiaId: string | null;
  onHoverMidia: (id: string | null) => void;
  config?: ExpedicaoConfig | null;
  mediaFilters: MediaFilters;
  onToggleFilter: (tipo: keyof MediaFilters) => void;
  onToggleAllFilters: (active: boolean) => void;
}

export default function SidebarGallery({
  isOpen,
  onClose,
  midias,
  etapas,
  diaSelecionado,
  onSelectDia,
  onSelectMidia,
  onFocusOnMap,
  hoveredMidiaId,
  onHoverMidia,
  config,
  mediaFilters,
  onToggleFilter,
  onToggleAllFilters,
}: SidebarGalleryProps) {
  // Escopo de visualização: 'etapa' ou 'todas'
  const [escopo, setEscopo] = useState<'etapa' | 'todas'>('etapa');
  // IDs selecionados para download em lote
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // Estado do download em lote (ZIP)
  const [isZipping, setIsZipping] = useState(false);
  const [zipProgress, setZipProgress] = useState<{ current: number; total: number; percent: number }>({
    current: 0,
    total: 0,
    percent: 0,
  });

  const etapaAtual = etapas.find((e) => e.numero_dia === diaSelecionado);

  // Mídias no escopo atual (etapa selecionada ou toda a viagem)
  const midiasNoEscopo = useMemo(() => {
    return midias.filter((m) => {
      if (escopo === 'etapa' && diaSelecionado && etapaAtual) {
        return m.etapa_id === etapaAtual.id;
      }
      return true;
    });
  }, [midias, escopo, diaSelecionado, etapaAtual]);

  // Contagem dinâmica por tipo no escopo atual
  const contagem = useMemo(() => {
    let foto = 0;
    let video = 0;
    let video_drone = 0;
    for (const m of midiasNoEscopo) {
      if (m.tipo === 'foto') foto++;
      else if (m.tipo === 'video') video++;
      else if (m.tipo === 'video_drone') video_drone++;
    }
    return { foto, video, video_drone, total: midiasNoEscopo.length };
  }, [midiasNoEscopo]);

  // Mídias filtradas de acordo com os checks ativos, ordenadas estritamente do início ao fim do track
  const midiasFiltradas = useMemo(() => {
    const filtradas = midiasNoEscopo.filter((m) => {
      if (m.tipo === 'foto') return mediaFilters.foto;
      if (m.tipo === 'video') return mediaFilters.video;
      if (m.tipo === 'video_drone') return mediaFilters.video_drone;
      return true;
    });

    // Ordenação sequencial ao longo da rota (km 0.0 até o fim do percurso)
    return filtradas.sort((a, b) => {
      // Se estiver na visão geral de todas as etapas, agrupa por dia primeiro
      const diaA = etapas.find((e) => e.id === a.etapa_id)?.numero_dia || 0;
      const diaB = etapas.find((e) => e.id === b.etapa_id)?.numero_dia || 0;
      if (diaA !== diaB) return diaA - diaB;

      // Ordena pela distância acumulada do início do trajeto:
      // Fotos sem km_no_trajeto (fora da rota / pré-viagem / concentração) ficam no topo (-1)
      const kmA =
        a.km_no_trajeto !== undefined && a.km_no_trajeto !== null
          ? Number(a.km_no_trajeto)
          : -1;
      const kmB =
        b.km_no_trajeto !== undefined && b.km_no_trajeto !== null
          ? Number(b.km_no_trajeto)
          : -1;
      if (kmA !== kmB) return kmA - kmB;

      // Desempate por timestamp
      const timeA = a.timestamp_captura ? new Date(a.timestamp_captura).getTime() : 0;
      const timeB = b.timestamp_captura ? new Date(b.timestamp_captura).getTime() : 0;
      return timeA - timeB;
    });
  }, [midiasNoEscopo, mediaFilters, etapas]);

  // Alternar seleção de um item individual
  const toggleSelect = (id: string, ev?: React.MouseEvent) => {
    if (ev) ev.stopPropagation();
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  // Selecionar todas as visíveis
  const handleSelectAll = () => {
    const allIds = new Set(midiasFiltradas.map((m) => m.id));
    setSelectedIds(allIds);
  };

  // Desmarcar todas
  const handleClearSelection = () => {
    setSelectedIds(new Set());
  };

  // Obter a URL correta de download/visualização em alta resolução
  const getFullResUrl = (m: Midia) => {
    if (m.tipo === 'video_drone' && m.arquivo_nome) {
      return `/api/media/${m.arquivo_nome}?download=true`;
    }
    if (m.arquivo_nome) return `/api/media/${m.arquivo_nome}`;
    if (m.url_midia) return m.url_midia;
    return m.url_thumbnail || '';
  };

  // Download individual direto
  const handleDownloadSingle = async (m: Midia, ev: React.MouseEvent) => {
    ev.stopPropagation();
    try {
      // Para vídeos de drone (arquivos grandes de ~1GB), disparar download nativo direto pelo navegador
      if (m.tipo === 'video_drone' && m.arquivo_nome) {
        const link = document.createElement('a');
        link.href = `/api/media/${m.arquivo_nome}?download=true`;
        link.download = m.arquivo_nome;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        return;
      }

      const url = getFullResUrl(m);
      if (!url) return;
      const resp = await fetch(url);
      const blob = await resp.blob();
      const blobUrl = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = blobUrl;
      link.download = m.arquivo_nome || `foto_${m.id.slice(0, 8)}.jpg`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(blobUrl);
    } catch (err) {
      console.error('Erro ao baixar arquivo:', err);
      alert('Não foi possível realizar o download deste arquivo.');
    }
  };

  // Download em Lote (.ZIP) com JSZip (somente fotos)
  const handleDownloadBatchZip = async () => {
    // Se nenhum estiver marcado com checkbox, baixa todos da lista visível atual (apenas fotos)
    const baseItems =
      selectedIds.size > 0
        ? midiasFiltradas.filter((m) => selectedIds.has(m.id))
        : midiasFiltradas;

    const itemsToDownload = baseItems.filter((m) => m.tipo !== 'video_drone');

    if (itemsToDownload.length === 0) {
      alert('Nenhuma foto selecionada para download em lote (os vídeos de drone devem ser baixados individualmente pelo botão dedicado).');
      return;
    }

    setIsZipping(true);
    setZipProgress({ current: 0, total: itemsToDownload.length, percent: 0 });

    try {
      const zip = new JSZip();
      let completed = 0;

      // Baixar os arquivos e adicionar ao arquivo ZIP
      for (const m of itemsToDownload) {
        const url = getFullResUrl(m);
        const fileName = m.arquivo_nome || `midia_${m.id.slice(0, 8)}.jpg`;

        try {
          const resp = await fetch(url);
          if (resp.ok) {
            const blob = await resp.blob();
            zip.file(fileName, blob);
          }
        } catch (fetchErr) {
          console.warn(`Falha ao obter ${fileName}:`, fetchErr);
        }

        completed++;
        setZipProgress({
          current: completed,
          total: itemsToDownload.length,
          percent: Math.round((completed / itemsToDownload.length) * 80), // até 80% no fetch
        });
      }

      // Gerar o arquivo ZIP comprimido
      const zipBlob = await zip.generateAsync(
        { type: 'blob', compression: 'DEFLATE', compressionOptions: { level: 6 } },
        (metadata) => {
          setZipProgress({
            current: itemsToDownload.length,
            total: itemsToDownload.length,
            percent: 80 + Math.round(metadata.percent * 0.2), // 80% a 100%
          });
        }
      );

      // Disparar o download no navegador
      const zipUrl = URL.createObjectURL(zipBlob);
      const link = document.createElement('a');
      const nomeDia = diaSelecionado ? `Dia_${diaSelecionado}` : 'Expedicao_Completa';
      link.href = zipUrl;
      link.download = `Caravaggio_${nomeDia}_Fotos.zip`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(zipUrl);
    } catch (err: any) {
      console.error('Erro na geração do ZIP:', err);
      alert(`Erro ao criar arquivo ZIP: ${err.message || 'Erro desconhecido'}`);
    } finally {
      setIsZipping(false);
    }
  };

  const isAllSelected =
    midiasFiltradas.length > 0 &&
    midiasFiltradas.every((m) => selectedIds.has(m.id));

  return (
    <>
      {/* Drawer Lateral Deslizante à Direita */}
      <aside
        className={`fixed top-0 right-0 bottom-0 z-40 w-full sm:w-[420px] bg-slate-900/95 backdrop-blur-xl border-l border-slate-800 shadow-2xl flex flex-col transition-transform duration-300 ease-in-out ${
          isOpen ? 'translate-x-0' : 'translate-x-full'
        }`}
      >
        {/* Cabeçalho do Drawer */}
        <div className="p-4 border-b border-slate-800 flex items-center justify-between gap-3 bg-slate-950/60">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-orange-600/20 text-orange-400 flex items-center justify-center border border-orange-500/30">
              <Images className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-white flex items-center gap-1.5">
                <span>Galeria de Mídias</span>
                <span className="text-[11px] font-semibold bg-slate-800 text-slate-300 px-2 py-0.5 rounded-full border border-slate-700">
                  {midiasFiltradas.length}
                </span>
              </h2>
              <p className="text-xs text-slate-400 truncate max-w-[220px]">
                {escopo === 'etapa' && diaSelecionado && etapaAtual
                  ? `Dia ${diaSelecionado} • ${etapaAtual.titulo}`
                  : 'Toda a Expedição'}
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition"
            title="Fechar galeria"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Barra de Filtros e Escopo */}
        <div className="p-3 bg-slate-900/80 border-b border-slate-800 space-y-2.5">
          {/* Seletor de Escopo: Etapa Atual vs Toda a Viagem */}
          <div className="flex items-center bg-slate-950/80 rounded-lg p-1 border border-slate-800">
            <button
              onClick={() => setEscopo('etapa')}
              disabled={!diaSelecionado}
              className={`flex-1 py-1 px-2 text-xs font-semibold rounded-md transition ${
                escopo === 'etapa' && diaSelecionado
                  ? 'bg-orange-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-white disabled:opacity-40 disabled:hover:text-slate-400'
              }`}
            >
              {diaSelecionado ? `Dia ${diaSelecionado} (Este Trecho)` : 'Selecione um Trecho'}
            </button>
            <button
              onClick={() => setEscopo('todas')}
              className={`flex-1 py-1 px-2 text-xs font-semibold rounded-md transition ${
                escopo === 'todas'
                  ? 'bg-orange-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              Toda a Viagem
            </button>
          </div>

          {/* Check de Filtro por Tipo: Fotos / Vídeos / Vídeos do Drone */}
          <div className="flex flex-col gap-2 pt-2 border-t border-slate-800/80">
            <div className="flex items-center justify-between text-[11px]">
              <span className="font-semibold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                <Filter className="w-3 h-3 text-orange-400" />
                <span>Filtrar Mídias</span>
              </span>
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => {
                    const allActive =
                      mediaFilters.foto && mediaFilters.video && mediaFilters.video_drone;
                    onToggleAllFilters(!allActive);
                  }}
                  className="text-[10px] text-orange-400 hover:text-orange-300 font-medium hover:underline"
                >
                  {mediaFilters.foto && mediaFilters.video && mediaFilters.video_drone
                    ? 'Desmarcar todos'
                    : 'Marcar todos'}
                </button>

                {config?.onedrive_pasta_url && (
                  <a
                    href={config.onedrive_pasta_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sky-400 hover:text-sky-300 flex items-center gap-1 hover:underline text-[10px]"
                    title="Acessar pasta de arquivos originais no OneDrive"
                  >
                    <span>OneDrive</span>
                    <ExternalLink className="w-2.5 h-2.5" />
                  </a>
                )}
              </div>
            </div>

            <div className="grid grid-cols-3 gap-1.5 sm:gap-2">
              {/* 1. Checkbox Vídeos do Drone */}
              <button
                type="button"
                onClick={() => onToggleFilter('video_drone')}
                className={`flex items-center gap-1.5 px-2.5 py-2 sm:py-2.5 rounded-xl border text-xs font-semibold transition active:scale-95 ${
                  mediaFilters.video_drone
                    ? 'bg-red-500/15 border-red-500/50 text-red-300 shadow-sm'
                    : 'bg-slate-900/60 border-slate-800 text-slate-500 hover:text-slate-300'
                }`}
                title="Mostrar ou ocultar vídeos aéreos de drone"
              >
                <div
                  className={`w-4 h-4 rounded flex items-center justify-center border text-[9px] transition shrink-0 ${
                    mediaFilters.video_drone
                      ? 'bg-red-600 border-red-500 text-white'
                      : 'border-slate-600 bg-slate-800'
                  }`}
                >
                  {mediaFilters.video_drone && <Check className="w-2.5 h-2.5 stroke-[3]" />}
                </div>
                <DroneIcon className="w-4 h-4 text-red-400 shrink-0" />
                <span className="truncate">Drone</span>
                <span className="text-[10px] opacity-70 ml-auto">({contagem.video_drone})</span>
              </button>

              {/* 2. Checkbox Vídeos */}
              <button
                type="button"
                onClick={() => onToggleFilter('video')}
                className={`flex items-center gap-1.5 px-2.5 py-2 sm:py-2.5 rounded-xl border text-xs font-semibold transition active:scale-95 ${
                  mediaFilters.video
                    ? 'bg-sky-500/15 border-sky-500/50 text-sky-300 shadow-sm'
                    : 'bg-slate-900/60 border-slate-800 text-slate-500 hover:text-slate-300'
                }`}
                title="Mostrar ou ocultar vídeos comuns de celular"
              >
                <div
                  className={`w-4 h-4 rounded flex items-center justify-center border text-[9px] transition shrink-0 ${
                    mediaFilters.video
                      ? 'bg-sky-600 border-sky-500 text-white'
                      : 'border-slate-600 bg-slate-800'
                  }`}
                >
                  {mediaFilters.video && <Check className="w-2.5 h-2.5 stroke-[3]" />}
                </div>
                <Video className="w-4 h-4 text-sky-400 shrink-0" />
                <span className="truncate">Vídeos</span>
                <span className="text-[10px] opacity-70 ml-auto">({contagem.video})</span>
              </button>

              {/* 3. Checkbox Fotos */}
              <button
                type="button"
                onClick={() => onToggleFilter('foto')}
                className={`flex items-center gap-1.5 px-2.5 py-2 sm:py-2.5 rounded-xl border text-xs font-semibold transition active:scale-95 ${
                  mediaFilters.foto
                    ? 'bg-orange-500/15 border-orange-500/50 text-orange-300 shadow-sm'
                    : 'bg-slate-900/60 border-slate-800 text-slate-500 hover:text-slate-300'
                }`}
                title="Mostrar ou ocultar fotos"
              >
                <div
                  className={`w-4 h-4 rounded flex items-center justify-center border text-[9px] transition shrink-0 ${
                    mediaFilters.foto
                      ? 'bg-orange-600 border-orange-500 text-white'
                      : 'border-slate-600 bg-slate-800'
                  }`}
                >
                  {mediaFilters.foto && <Check className="w-2.5 h-2.5 stroke-[3]" />}
                </div>
                <Camera className="w-4 h-4 text-orange-400 shrink-0" />
                <span className="truncate">Fotos</span>
                <span className="text-[10px] opacity-70 ml-auto">({contagem.foto})</span>
              </button>
            </div>
          </div>

          {/* Barra de Seleção Rápida e Ação em Lote */}
          <div className="flex items-center justify-between pt-1 border-t border-slate-800/80 text-xs">
            <button
              onClick={isAllSelected ? handleClearSelection : handleSelectAll}
              className="flex items-center gap-1.5 text-slate-300 hover:text-orange-400 font-medium transition"
            >
              {isAllSelected ? (
                <>
                  <CheckSquare className="w-4 h-4 text-orange-400" />
                  <span>Desmarcar Todas</span>
                </>
              ) : (
                <>
                  <Square className="w-4 h-4 text-slate-400" />
                  <span>Selecionar Todas</span>
                </>
              )}
            </button>

            <span className="text-[11px] text-slate-400">
              {selectedIds.size > 0 ? (
                <span className="text-orange-400 font-semibold">
                  {selectedIds.size} de {midiasFiltradas.length} marcada(s)
                </span>
              ) : (
                'Nenhuma marcada (baixa todas)'
              )}
            </span>
          </div>
        </div>

        {/* Lista / Grade de Mídias */}
        <div className="flex-1 overflow-y-auto p-3 space-y-2 custom-scrollbar">
          {midiasFiltradas.length === 0 ? (
            <div className="h-64 flex flex-col items-center justify-center text-center p-4 text-slate-500">
              <Images className="w-10 h-10 mb-2 opacity-30" />
              <p className="text-sm font-medium text-slate-400">Nenhuma mídia encontrada</p>
              <p className="text-xs text-slate-500 mt-1">
                {escopo === 'etapa' && diaSelecionado
                  ? 'Não há fotos registradas para este dia ou tente alternar para "Toda a Viagem".'
                  : 'Nenhum item com os filtros selecionados.'}
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-2.5">
              {midiasFiltradas.map((m) => {
                const isSelected = selectedIds.has(m.id);
                const isHighlighted = m.id === hoveredMidiaId;
                const isDrone = m.tipo === 'video_drone';
                const isVideo = m.tipo === 'video';
                const isPrivate = !!m.is_private;
                const hasCoords = m.latitude !== null && m.longitude !== null && m.latitude !== 0 && m.longitude !== 0;
                const etapaMidia = etapas.find((e) => e.id === m.etapa_id);

                return (
                  <div
                    key={m.id}
                    onClick={() => {
                      if (hasCoords && onFocusOnMap) {
                        onFocusOnMap(m);
                      } else {
                        onSelectMidia(m);
                      }
                    }}
                    onMouseEnter={() => onHoverMidia(m.id)}
                    onMouseLeave={() => onHoverMidia(null)}
                    className={`group relative rounded-xl overflow-hidden border cursor-pointer transition-all duration-200 bg-slate-950/80 ${
                      isHighlighted
                        ? 'border-orange-500 ring-2 ring-orange-500/50 scale-[1.02] shadow-xl'
                        : isPrivate
                        ? 'border-amber-500/50 ring-1 ring-amber-500/30 hover:border-amber-400 bg-amber-950/10'
                        : isSelected
                        ? 'border-orange-400/80 ring-1 ring-orange-400/30'
                        : 'border-slate-800 hover:border-slate-600'
                    }`}
                  >
                    {/* Imagem / Thumbnail */}
                    <div className="relative aspect-video w-full bg-slate-900 overflow-hidden">
                      <img
                        src={m.url_thumbnail || m.url_midia}
                        alt={m.titulo || 'Foto da viagem'}
                        className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-110"
                        loading="lazy"
                      />

                      {/* Gradiente sutil inferior */}
                      <div className="absolute inset-0 bg-gradient-to-t from-slate-950/90 via-transparent to-transparent opacity-80" />

                      {/* Checkbox de Seleção no Canto Superior Esquerdo */}
                      <button
                        onClick={(ev) => toggleSelect(m.id, ev)}
                        className={`absolute top-1.5 left-1.5 p-1 rounded-md backdrop-blur-md transition z-10 ${
                          isSelected
                            ? 'bg-orange-600 text-white shadow-md'
                            : 'bg-slate-900/70 text-slate-300 hover:text-white border border-white/20'
                        }`}
                        title={isSelected ? 'Desmarcar' : 'Selecionar para download'}
                      >
                        {isSelected ? (
                          <Check className="w-3.5 h-3.5" />
                        ) : (
                          <div className="w-3.5 h-3.5" />
                        )}
                      </button>

                      {/* Badge de Privado */}
                      {isPrivate && (
                        <div
                          className="absolute top-1.5 left-8 bg-amber-500/90 text-slate-950 text-[10px] font-black px-1.5 py-0.5 rounded-md flex items-center gap-1 shadow-md border border-amber-300 backdrop-blur-md z-10"
                          title="Mídia Privada (Visível somente para Administrador)"
                        >
                          <Lock className="w-2.5 h-2.5 stroke-[3]" />
                          <span>Privado</span>
                        </div>
                      )}

                      {/* Badge de Drone / Vídeo */}
                      {isDrone ? (
                        <div className="absolute top-1.5 right-1.5 bg-red-600/95 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-md flex items-center gap-1 shadow-md z-10">
                          <DroneIcon className="w-3 h-3 text-white" />
                          <span>4K</span>
                        </div>
                      ) : isVideo ? (
                        <div className="absolute top-1.5 right-1.5 bg-sky-600/90 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-md flex items-center gap-1 shadow-md z-10">
                          <Video className="w-2.5 h-2.5" />
                          <span>Vídeo</span>
                        </div>
                      ) : null}

                      {/* Botão de Play Central para Vídeos (Abre Player Direto) */}
                      {(isDrone || isVideo) && (
                        <button
                          onClick={(ev) => {
                            ev.stopPropagation();
                            onSelectMidia(m);
                          }}
                          className="absolute inset-0 m-auto w-10 h-10 rounded-full bg-slate-900/75 hover:bg-orange-600 text-white flex items-center justify-center transition shadow-2xl backdrop-blur-sm border border-white/30 hover:scale-110 active:scale-95 z-10"
                          title="Assistir a este vídeo em tela cheia"
                        >
                          <Play className="w-4 h-4 fill-white ml-0.5" />
                        </button>
                      )}

                      {/* Badge de Km no Trajeto ou Etapa sobre a foto */}
                      {m.km_no_trajeto !== undefined && m.km_no_trajeto !== null ? (
                        <div className="absolute bottom-1.5 left-1.5 bg-slate-900/90 text-orange-400 text-[9px] font-extrabold px-1.5 py-0.5 rounded backdrop-blur-md border border-orange-500/40 shadow-md flex items-center gap-1 select-none z-10">
                          <span>km</span>
                          <span>{Number(m.km_no_trajeto).toFixed(1)}</span>
                        </div>
                      ) : etapaMidia ? (
                        <div className="absolute bottom-1.5 left-1.5 bg-slate-900/90 text-purple-300 text-[9px] font-bold px-1.5 py-0.5 rounded backdrop-blur-md border border-purple-500/40 shadow-md flex items-center gap-1 select-none z-10">
                          <span>📍</span>
                          <span>Dia {etapaMidia.numero_dia}</span>
                        </div>
                      ) : (
                        <div className="absolute bottom-1.5 left-1.5 bg-slate-900/90 text-sky-400 text-[9px] font-bold px-1.5 py-0.5 rounded backdrop-blur-md border border-sky-500/40 shadow-md flex items-center gap-1 select-none z-10">
                          <span>📍</span>
                          <span>Pré-viagem</span>
                        </div>
                      )}

                      {/* Botão de Foco no Mapa no Canto Inferior Direito */}
                      {hasCoords && onFocusOnMap && (
                        <button
                          onClick={(ev) => {
                            ev.stopPropagation();
                            onFocusOnMap(m);
                          }}
                          className="absolute bottom-1.5 right-8 p-1.5 rounded-md bg-slate-900/80 hover:bg-orange-600 text-slate-300 hover:text-white transition opacity-80 group-hover:opacity-100 shadow-md border border-white/10 z-10"
                          title="Focar este ponto no mapa com zoom"
                        >
                          <MapPin className="w-3.5 h-3.5 text-orange-400 group-hover:text-white" />
                        </button>
                      )}

                      {/* Botão de Download Individual no Canto Inferior Direito */}
                      <button
                        onClick={(ev) => handleDownloadSingle(m, ev)}
                        className="absolute bottom-1.5 right-1.5 p-1.5 rounded-md bg-slate-900/80 hover:bg-orange-600 text-slate-300 hover:text-white transition opacity-0 group-hover:opacity-100 shadow-md border border-white/10 z-10"
                        title="Baixar esta foto diretamente em HD"
                      >
                        <Download className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    {/* Rodapé com Título e Data */}
                    <div className="p-2">
                      <div className="flex items-center justify-between gap-1">
                        <p className="text-[11px] font-semibold text-slate-200 truncate leading-snug">
                          {m.titulo || m.arquivo_nome || 'Sem título'}
                        </p>
                        {m.km_no_trajeto !== undefined && m.km_no_trajeto !== null ? (
                          <span className="text-[9px] font-bold text-orange-400 shrink-0">
                            km {Number(m.km_no_trajeto).toFixed(1)}
                          </span>
                        ) : etapaMidia ? (
                          <span className="text-[9px] font-bold text-purple-300 shrink-0">
                            Dia {etapaMidia.numero_dia}
                          </span>
                        ) : (
                          <span className="text-[9px] font-bold text-sky-400 shrink-0">
                            Pré-viagem
                          </span>
                        )}
                      </div>
                      <p className="text-[10px] text-slate-400 mt-0.5 truncate flex items-center justify-between">
                        <span>
                          {m.timestamp_captura
                            ? new Date(m.timestamp_captura).toLocaleDateString('pt-BR', {
                                day: '2-digit',
                                month: '2-digit',
                                hour: '2-digit',
                                minute: '2-digit',
                              })
                            : 'Caravaggio'}
                        </span>
                        {hasCoords && (
                          <span className="text-[9px] text-orange-400/80 flex items-center gap-0.5">
                            <MapPin className="w-2.5 h-2.5" /> Ver no mapa
                          </span>
                        )}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Rodapé com Botão de Download em Lote (.ZIP) */}
        <div className="p-4 border-t border-slate-800 bg-slate-950/90 space-y-2">
          {/* Barra de Progresso quando estiver comprimindo */}
          {isZipping && (
            <div className="space-y-1.5">
              <div className="flex justify-between text-xs text-slate-300">
                <span className="flex items-center gap-1.5 text-orange-400 font-medium">
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Compactando arquivos...</span>
                </span>
                <span className="font-bold">{zipProgress.percent}%</span>
              </div>
              <div className="w-full bg-slate-800 rounded-full h-2 overflow-hidden border border-slate-700">
                <div
                  className="bg-gradient-to-r from-orange-500 to-amber-400 h-full rounded-full transition-all duration-200"
                  style={{ width: `${zipProgress.percent}%` }}
                />
              </div>
              <p className="text-[10px] text-slate-400 text-center">
                Processando {zipProgress.current} de {zipProgress.total} mídias
              </p>
            </div>
          )}

          {/* Botão de Download Principal */}
          <button
            onClick={handleDownloadBatchZip}
            disabled={isZipping || midiasFiltradas.length === 0}
            className={`w-full py-2.5 px-4 rounded-xl font-bold text-xs sm:text-sm flex items-center justify-center gap-2 shadow-lg transition duration-200 ${
              isZipping || midiasFiltradas.length === 0
                ? 'bg-slate-800 text-slate-500 cursor-not-allowed border border-slate-700'
                : 'bg-gradient-to-r from-orange-600 to-amber-500 hover:from-orange-500 hover:to-amber-400 text-white shadow-orange-600/20 active:scale-[0.98]'
            }`}
          >
            {isZipping ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Gerando .ZIP ({zipProgress.percent}%)...</span>
              </>
            ) : (
              <>
                <Download className="w-4 h-4" />
                <span>
                  {selectedIds.size > 0
                    ? `Baixar Selecionadas (${selectedIds.size}) em .ZIP`
                    : `Baixar Todas (${midiasFiltradas.length}) em .ZIP`}
                </span>
              </>
            )}
          </button>
        </div>
      </aside>

      {/* Backdrop transparente para telas menores quando a aba estiver aberta */}
      {isOpen && (
        <div
          onClick={onClose}
          className="fixed inset-0 z-30 bg-slate-950/40 backdrop-blur-[2px] sm:hidden transition-opacity"
        />
      )}
    </>
  );
}

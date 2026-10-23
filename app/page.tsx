'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { supabase, Etapa, Midia, ExpedicaoConfig, MediaFilters } from '@/lib/supabase';
import Header from '@/components/Header';
import Map from '@/components/Map';
import ElevationProfile from '@/components/ElevationProfile';
import MediaModal from '@/components/MediaModal';
import AdminDrawer from '@/components/AdminDrawer';
import SidebarGallery from '@/components/SidebarGallery';
import { Images } from 'lucide-react';

export default function Home() {
  const [etapas, setEtapas] = useState<Etapa[]>([]);
  const [midias, setMidias] = useState<Midia[]>([]);
  const [config, setConfig] = useState<ExpedicaoConfig | null>(null);
  const [diaSelecionado, setDiaSelecionado] = useState<number | null>(null);
  const [tipoMapa, setTipoMapa] = useState<'satellite' | 'streets' | 'topo'>('satellite');

  // Filtros de Mídia: Fotos / Vídeos / Vídeos do Drone
  const [mediaFilters, setMediaFilters] = useState<MediaFilters>(() => {
    if (typeof window !== 'undefined') {
      try {
        const saved = localStorage.getItem('caravaggio_media_filters');
        if (saved) return JSON.parse(saved);
      } catch (e) {}
    }
    return { foto: true, video: true, video_drone: true };
  });

  // Salvar preferência de filtros de mídia
  useEffect(() => {
    try {
      localStorage.setItem('caravaggio_media_filters', JSON.stringify(mediaFilters));
    } catch (e) {}
  }, [mediaFilters]);

  // Alternar um tipo de filtro individual
  const handleToggleFilter = (tipo: keyof MediaFilters) => {
    setMediaFilters((prev) => ({
      ...prev,
      [tipo]: !prev[tipo],
    }));
  };

  // Alternar todos os filtros (marcar/desmarcar todos)
  const handleToggleAllFilters = (active: boolean) => {
    setMediaFilters({
      foto: active,
      video: active,
      video_drone: active,
    });
  };

  // Estados de Interação
  const [selectedMidia, setSelectedMidia] = useState<Midia | null>(null);
  const [hoverCoord, setHoverCoord] = useState<[number, number] | null>(null);
  const [hoveredMidiaId, setHoveredMidiaId] = useState<string | null>(null);
  const [isGalleryOpen, setIsGalleryOpen] = useState<boolean>(false);
  const [mapFocus, setMapFocus] = useState<{ coord: [number, number]; id?: string; timestamp: number } | null>(null);

  // Estados Administrativos
  const [isAdmin, setIsAdmin] = useState<boolean>(false);
  const [isAdminDrawerOpen, setIsAdminDrawerOpen] = useState<boolean>(false);
  const [isPickingPin, setIsPickingPin] = useState<boolean>(false);
  const [pendingPinCoord, setPendingPinCoord] = useState<[number, number] | null>(null);
  const [isEditMode, setIsEditMode] = useState<boolean>(false);

  // Carregar dados iniciais
  const loadData = async () => {
    try {
      // 1. Carregar Config da Expedição
      const { data: configData } = await supabase
        .from('expedicao_config')
        .select('*')
        .limit(1)
        .single();
      if (configData) setConfig(configData);

      // 2. Carregar as 7 Etapas
      const { data: etapasData } = await supabase
        .from('etapas')
        .select('*')
        .order('numero_dia', { ascending: true });

      if (etapasData && etapasData.length > 0) {
        setEtapas(etapasData);
      } else {
        // Fallback local se banco estiver inicializando
        const localResp = await fetch('/data/expedicao.json');
        if (localResp.ok) {
          const localData = await localResp.json();
          setEtapas(localData.etapas || []);
        }
      }

      // 3. Carregar Mídias (Fotos e Vídeos)
      const { data: midiasData } = await supabase
        .from('midias')
        .select('*')
        .order('created_at', { ascending: false });

      if (midiasData) {
        setMidias(midiasData);
      }
    } catch (err) {
      console.error('Erro ao carregar dados:', err);
    }
  };

  useEffect(() => {
    loadData();

    // Checar se o usuário já está logado como Admin no Supabase
    supabase.auth.getSession().then(({ data: { session } }) => {
      setIsAdmin(!!session);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setIsAdmin(!!session);
      loadData(); // Recarregar mídias com RLS atualizado
    });

    return () => subscription.unsubscribe();
  }, []);

  // Excluir Mídia
  const handleDeleteMidia = async (id: string) => {
    try {
      const { error } = await supabase.from('midias').delete().eq('id', id);
      if (error) throw error;
      setMidias((prev) => prev.filter((m) => m.id !== id));
      alert('Mídia excluída com sucesso.');
    } catch (err: any) {
      alert(`Erro ao excluir: ${err.message}`);
    }
  };

  // Alternar Privacidade
  const handleTogglePrivacy = async (id: string, currentPrivate: boolean) => {
    try {
      const { error } = await supabase
        .from('midias')
        .update({ is_private: !currentPrivate })
        .eq('id', id);

      if (error) throw error;

      setMidias((prev) =>
        prev.map((m) => (m.id === id ? { ...m, is_private: !currentPrivate } : m))
      );

      if (selectedMidia && selectedMidia.id === id) {
        setSelectedMidia((prev) =>
          prev ? { ...prev, is_private: !currentPrivate } : null
        );
      }
    } catch (err: any) {
      alert(`Erro ao alterar privacidade: ${err.message}`);
    }
  };

  // Atualizar Links de Vídeo e Download
  const handleUpdateLinks = async (
    id: string,
    youtubeId: string,
    onedriveUrl: string,
    titulo: string
  ) => {
    try {
      const thumb = youtubeId
        ? `https://img.youtube.com/vi/${youtubeId}/hqdefault.jpg`
        : undefined;

      const payload: any = {
        youtube_id: youtubeId || null,
        onedrive_download_url: onedriveUrl || null,
        titulo: titulo || null,
      };
      if (thumb) payload.url_thumbnail = thumb;

      const { error } = await supabase.from('midias').update(payload).eq('id', id);
      if (error) throw error;

      setMidias((prev) =>
        prev.map((m) => (m.id === id ? { ...m, ...payload } : m))
      );

      if (selectedMidia && selectedMidia.id === id) {
        setSelectedMidia((prev) => (prev ? { ...prev, ...payload } : null));
      }

      alert('Links atualizados com sucesso!');
    } catch (err: any) {
      alert(`Erro ao atualizar: ${err.message}`);
    }
  };

  // Atualizar Coordenadas ao arrastar pin com Snap to Route e Km no Trajeto (suporta descolamento)
  const handleUpdateMidiaCoord = async (
    id: string,
    lat: number,
    lon: number,
    altitude?: number,
    kmNoTrajeto?: number | null
  ) => {
    try {
      const payload: any = {
        latitude: lat,
        longitude: lon,
        posicao: `POINT(${lon} ${lat})`,
        km_no_trajeto: kmNoTrajeto !== undefined ? kmNoTrajeto : null,
      };
      if (altitude !== undefined) {
        payload.altitude = Math.round(altitude);
      }

      const { error } = await supabase
        .from('midias')
        .update(payload)
        .eq('id', id);

      if (error) throw error;

      setMidias((prev) =>
        prev.map((m) =>
          m.id === id
            ? {
                ...m,
                latitude: lat,
                longitude: lon,
                altitude: altitude ?? m.altitude,
                km_no_trajeto: kmNoTrajeto !== undefined ? kmNoTrajeto : m.km_no_trajeto,
              }
            : m
        )
      );
    } catch (err: any) {
      console.error('Erro ao mover pin:', err);
    }
  };

  // Atualizar a Cor do Trajeto de uma Etapa
  const handleUpdateCorTrajeto = async (numeroDia: number, novaCor: string) => {
    try {
      setEtapas((prev) =>
        prev.map((e) => (e.numero_dia === numeroDia ? { ...e, cor_trajeto: novaCor } : e))
      );

      const { error } = await supabase
        .from('etapas')
        .update({ cor_trajeto: novaCor })
        .eq('numero_dia', numeroDia);

      if (error) throw error;
    } catch (err: any) {
      console.error('Erro ao salvar cor do trajeto:', err);
    }
  };

  // Sortear Cores Aleatórias para Todos os 7 Dias
  const handleRandomizeAllColors = async () => {
    try {
      const cores = [
        '#f97316', '#06b6d4', '#10b981', '#eab308',
        '#8b5cf6', '#ec4899', '#3b82f6', '#ef4444',
        '#84cc16', '#14b8a6', '#6366f1', '#d97706',
        '#f43f5e', '#a855f7', '#0ea5e9'
      ];
      const shuffled = [...cores].sort(() => 0.5 - Math.random());

      const novasEtapas = etapas.map((e, idx) => ({
        ...e,
        cor_trajeto: shuffled[idx % shuffled.length],
      }));

      setEtapas(novasEtapas);

      for (const e of novasEtapas) {
        await supabase
          .from('etapas')
          .update({ cor_trajeto: e.cor_trajeto })
          .eq('numero_dia', e.numero_dia);
      }
    } catch (err: any) {
      console.error('Erro ao sortear cores:', err);
    }
  };

  // Atualizar Link Geral da Pasta no OneDrive
  const handleUpdateGlobalOneDrive = async (novaUrl: string) => {
    if (!config?.id) return;
    const { error } = await supabase
      .from('expedicao_config')
      .update({ onedrive_pasta_url: novaUrl, updated_at: new Date().toISOString() })
      .eq('id', config.id);

    if (error) throw error;
    setConfig((prev) => (prev ? { ...prev, onedrive_pasta_url: novaUrl } : null));
  };

  // Iniciar modo de marcação de pin no mapa
  const handleStartMapPinPick = (_tipo: 'foto' | 'video_drone') => {
    setIsPickingPin(true);
    setIsAdminDrawerOpen(false); // Fecha a gaveta temporariamente para o usuário ver o mapa
  };

  // Ponto clicado no mapa
  const handlePickPinCoord = (coord: [number, number]) => {
    setPendingPinCoord(coord);
    setIsPickingPin(false);
    setIsAdminDrawerOpen(true); // Reabre a gaveta com a coordenada selecionada
  };

  // Focar mídia no mapa com zoom suave e destaque ao clicar na galeria
  const handleFocusMidiaOnMap = (m: Midia) => {
    const lat = Number(m.latitude);
    const lon = Number(m.longitude);
    if (!isNaN(lat) && !isNaN(lon) && (lat !== 0 || lon !== 0)) {
      if (m.etapa_id) {
        const etapa = etapas.find((e) => e.id === m.etapa_id);
        if (etapa && diaSelecionado !== null && diaSelecionado !== etapa.numero_dia) {
          setDiaSelecionado(etapa.numero_dia);
        }
      }

      setMapFocus({
        coord: [lon, lat],
        id: m.id,
        timestamp: Date.now(),
      });

      setHoveredMidiaId(m.id);

      // Em dispositivos móveis, recolhe a galeria para exibir o mapa em foco
      if (typeof window !== 'undefined' && window.innerWidth < 768) {
        setIsGalleryOpen(false);
      }
    }
  };

  const etapaAtual = etapas.find((e) => e.numero_dia === diaSelecionado);

  // Mídias ativas filtradas pelos checks de tipo (Fotos, Vídeos, Drone)
  const midiasFiltradasPorTipo = useMemo(() => {
    return midias.filter((m) => {
      if (m.tipo === 'foto') return mediaFilters.foto;
      if (m.tipo === 'video') return mediaFilters.video;
      if (m.tipo === 'video_drone') return mediaFilters.video_drone;
      return true;
    });
  }, [midias, mediaFilters]);

  // Mídias do contexto atual ordenadas do início ao fim do trajeto (para navegação no modal)
  const midiasContexto = useMemo(() => {
    const lista =
      diaSelecionado && etapaAtual
        ? midiasFiltradasPorTipo.filter((m) => m.etapa_id === etapaAtual.id)
        : [...midiasFiltradasPorTipo];

    return lista.sort((a, b) => {
      // Se for visão geral de todos os dias, ordena pelo dia primeiro
      const diaA = etapas.find((e) => e.id === a.etapa_id)?.numero_dia || 0;
      const diaB = etapas.find((e) => e.id === b.etapa_id)?.numero_dia || 0;
      if (diaA !== diaB) return diaA - diaB;

      // Dentro da mesma etapa, ordena pelo km no trajeto:
      // Fotos sem km_no_trajeto (fora da rota / pré-viagem / concentração) ficam no topo (-1)
      const kmA = a.km_no_trajeto !== undefined && a.km_no_trajeto !== null ? Number(a.km_no_trajeto) : -1;
      const kmB = b.km_no_trajeto !== undefined && b.km_no_trajeto !== null ? Number(b.km_no_trajeto) : -1;
      if (kmA !== kmB) return kmA - kmB;

      // Se ambos forem pré-viagem ou mesmo km, desempata pelo timestamp de captura
      const timeA = a.timestamp_captura ? new Date(a.timestamp_captura).getTime() : 0;
      const timeB = b.timestamp_captura ? new Date(b.timestamp_captura).getTime() : 0;
      return timeA - timeB;
    });
  }, [midiasFiltradasPorTipo, diaSelecionado, etapaAtual, etapas]);

  const currentIndex = selectedMidia
    ? midiasContexto.findIndex((m) => m.id === selectedMidia.id)
    : -1;

  const hasPrev = currentIndex > 0;
  const hasNext = currentIndex >= 0 && currentIndex < midiasContexto.length - 1;

  const handleNavigatePrev = () => {
    if (hasPrev) {
      setSelectedMidia(midiasContexto[currentIndex - 1]);
    }
  };

  const handleNavigateNext = () => {
    if (hasNext) {
      setSelectedMidia(midiasContexto[currentIndex + 1]);
    }
  };

  return (
    <div className="flex flex-col h-screen w-screen overflow-hidden bg-slate-950">
      {/* Header Superior com Seletor de Etapas e Estatísticas */}
      <Header
        etapas={etapas}
        diaSelecionado={diaSelecionado}
        onSelectDia={(dia) => setDiaSelecionado(dia)}
        tipoMapa={tipoMapa}
        onChangeTipoMapa={(t) => setTipoMapa(t)}
        isAdmin={isAdmin}
        onOpenAdminDrawer={() => setIsAdminDrawerOpen(true)}
        config={config}
        onUpdateCorTrajeto={handleUpdateCorTrajeto}
        onRandomizeAllColors={handleRandomizeAllColors}
        onToggleGallery={() => setIsGalleryOpen((prev) => !prev)}
        isGalleryOpen={isGalleryOpen}
        totalMidias={midiasFiltradasPorTipo.length}
        isEditMode={isEditMode}
        onToggleEditMode={() => setIsEditMode((prev) => !prev)}
      />

      {/* Área Central: Mapa com Trajeto e Marcadores */}
      <div className="flex-1 relative overflow-hidden">
        <Map
          etapas={etapas}
          diaSelecionado={diaSelecionado}
          midias={midiasFiltradasPorTipo}
          onSelectMidia={(m) => setSelectedMidia(m)}
          tipoMapa={tipoMapa}
          hoverCoord={hoverCoord}
          isAdmin={isAdmin}
          isPickingPin={isPickingPin}
          onPickPinCoord={handlePickPinCoord}
          onUpdateMidiaCoord={handleUpdateMidiaCoord}
          highlightedMidiaId={hoveredMidiaId}
          mediaFilters={mediaFilters}
          onToggleFilter={handleToggleFilter}
          focusMidia={mapFocus}
          pendingPinCoord={pendingPinCoord}
          isEditMode={isEditMode}
          onToggleEditMode={() => setIsEditMode((prev) => !prev)}
        />

        {/* Botão Flutuante de Abrir Galeria (quando a aba lateral estiver fechada) */}
        {!isGalleryOpen && (
          <button
            onClick={() => setIsGalleryOpen(true)}
            className="absolute top-[112px] right-2.5 sm:top-4 sm:right-16 z-20 bg-slate-900/95 hover:bg-orange-600 text-white border border-slate-700/80 shadow-2xl px-2.5 py-1.5 sm:px-3 sm:py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 sm:gap-2 backdrop-blur-md transition hover:scale-105 active:scale-95"
            title="Abrir Galeria de Fotos e Vídeos do trecho"
          >
            <Images className="w-4 h-4 text-orange-400" />
            <span className="hidden xs:inline sm:inline">Galeria</span>
            <span className="bg-orange-600 text-white px-1.5 py-0.5 rounded-full text-[10px]">
              {diaSelecionado && etapaAtual
                ? midiasFiltradasPorTipo.filter((m) => m.etapa_id === etapaAtual.id).length
                : midiasFiltradasPorTipo.length}
            </span>
          </button>
        )}

        {/* Gráfico de Altimetria Flutuante no Rodapé (Estilo Strava) */}
        {diaSelecionado && etapaAtual && (
          <div className="absolute bottom-4 left-4 right-4 md:left-6 md:right-auto md:w-[480px] z-30 transition-all">
            <ElevationProfile
              etapa={etapaAtual}
              onHoverPoint={(coord) => setHoverCoord(coord)}
            />
          </div>
        )}
      </div>

      {/* Galeria Lateral Retrátil com Download em Lote (.ZIP) */}
      <SidebarGallery
        isOpen={isGalleryOpen}
        onClose={() => setIsGalleryOpen(false)}
        midias={midias}
        etapas={etapas}
        diaSelecionado={diaSelecionado}
        onSelectDia={(dia) => setDiaSelecionado(dia)}
        onSelectMidia={(m) => setSelectedMidia(m)}
        onFocusOnMap={handleFocusMidiaOnMap}
        hoveredMidiaId={hoveredMidiaId}
        onHoverMidia={(id) => setHoveredMidiaId(id)}
        config={config}
        mediaFilters={mediaFilters}
        onToggleFilter={handleToggleFilter}
        onToggleAllFilters={handleToggleAllFilters}
      />

      {/* Modal Lightbox em Quase Tela Cheia com Navegação */}
      <MediaModal
        midia={selectedMidia}
        onClose={() => setSelectedMidia(null)}
        isAdmin={isAdmin}
        onDeleteMidia={handleDeleteMidia}
        onTogglePrivacy={handleTogglePrivacy}
        onUpdateLinks={handleUpdateLinks}
        config={config}
        onNavigatePrev={handleNavigatePrev}
        onNavigateNext={handleNavigateNext}
        hasPrev={hasPrev}
        hasNext={hasNext}
      />

      {/* Painel do Administrador (Gaveta Lateral) */}
      <AdminDrawer
        isOpen={isAdminDrawerOpen}
        onClose={() => setIsAdminDrawerOpen(false)}
        isAdmin={isAdmin}
        onLoginSuccess={() => {
          setIsAdmin(true);
          loadData();
        }}
        onLogout={async () => {
          await supabase.auth.signOut();
          setIsAdmin(false);
          loadData();
        }}
        etapas={etapas}
        config={config}
        onUpdateGlobalOneDrive={handleUpdateGlobalOneDrive}
        onStartMapPinPick={handleStartMapPinPick}
        pendingPinCoord={pendingPinCoord}
        onSetPendingPin={(coord) => {
          setPendingPinCoord(coord);
          setMapFocus({ coord, timestamp: Date.now() });
        }}
        onResetPendingPin={() => setPendingPinCoord(null)}
        onRefreshData={loadData}
      />
    </div>
  );
}

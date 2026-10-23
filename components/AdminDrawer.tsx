'use client';

import React, { useState, useMemo } from 'react';
import { supabase, Etapa, ExpedicaoConfig, Midia } from '@/lib/supabase';
import { findBestEtapaForCoord, snapToRouteWithThreshold } from '@/lib/geo';
import exifr from 'exifr';
import {
  X,
  Upload,
  Video,
  MapPin,
  Lock,
  Unlock,
  Check,
  AlertCircle,
  FolderOpen,
  LogOut,
  LogIn,
  Sparkles,
  Shield,
  Loader2,
} from 'lucide-react';

interface AdminDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  isAdmin: boolean;
  onLoginSuccess: () => void;
  onLogout: () => void;
  etapas: Etapa[];
  config?: ExpedicaoConfig | null;
  midias?: Midia[];
  onGlobalPrivacyByType?: (tipo: 'foto' | 'video' | 'video_drone', isPrivate: boolean) => Promise<void>;
  onUpdateGlobalOneDrive: (novaUrl: string) => Promise<void>;
  onStartMapPinPick: (tipo: 'foto' | 'video_drone', tempInfo?: { etapaId?: string }) => void;
  pendingPinCoord: [number, number] | null;
  pendingPinInfo?: {
    altitude?: number;
    kmNoTrajeto?: number | null;
    etapaId?: string;
    numeroDia?: number;
  } | null;
  onSetPendingPin?: (coord: [number, number], altitude?: number, kmNoTrajeto?: number) => void;
  onResetPendingPin: () => void;
  onRefreshData: () => Promise<void>;
}

export default function AdminDrawer({
  isOpen,
  onClose,
  isAdmin,
  onLoginSuccess,
  onLogout,
  etapas,
  config,
  midias = [],
  onGlobalPrivacyByType,
  onUpdateGlobalOneDrive,
  onStartMapPinPick,
  pendingPinCoord,
  pendingPinInfo,
  onSetPendingPin,
  onResetPendingPin,
  onRefreshData,
}: AdminDrawerProps) {
  // Estados de Login
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [authLoading, setAuthLoading] = useState(false);
  const [authError, setAuthError] = useState('');

  // Estados de Abas do Admin
  const [activeTab, setActiveTab] = useState<'foto' | 'drone' | 'config' | 'privacidade'>('foto');
  const [batchLoading, setBatchLoading] = useState(false);

  // Estatísticas de Privacidade
  const statsPrivacidade = useMemo(() => {
    let fotosTotal = 0;
    let fotosPublicas = 0;
    let fotosPrivadas = 0;

    let droneTotal = 0;
    let dronePublicos = 0;
    let dronePrivados = 0;

    for (const m of midias) {
      if (m.tipo === 'foto') {
        fotosTotal++;
        if (m.is_private) fotosPrivadas++;
        else fotosPublicas++;
      } else if (m.tipo === 'video_drone') {
        droneTotal++;
        if (m.is_private) dronePrivados++;
        else dronePublicos++;
      }
    }

    return {
      fotosTotal,
      fotosPublicas,
      fotosPrivadas,
      droneTotal,
      dronePublicos,
      dronePrivados,
    };
  }, [midias]);

  const handleApplyGlobalPrivacy = async (tipo: 'foto' | 'video_drone', isPrivate: boolean) => {
    if (!onGlobalPrivacyByType) return;
    setBatchLoading(true);
    try {
      await onGlobalPrivacyByType(tipo, isPrivate);
    } finally {
      setBatchLoading(false);
    }
  };

  // Estados de Adicionar Foto
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [photoTitulo, setPhotoTitulo] = useState('');
  const [photoEtapa, setPhotoEtapa] = useState<string>(etapas[0]?.id || '');
  const [photoPrivate, setPhotoPrivate] = useState(false);
  const [photoCoords, setPhotoCoords] = useState<{ lat: number; lon: number; alt?: number } | null>(null);
  const [gpsStatusInfo, setGpsStatusInfo] = useState<string | null>(null);
  const [photoUploading, setPhotoUploading] = useState(false);

  // Estados de Adicionar Vídeo do Drone
  const [ytUrl, setYtUrl] = useState('');
  const [ytOneDriveUrl, setYtOneDriveUrl] = useState('');
  const [ytTitulo, setYtTitulo] = useState('');
  const [ytEtapa, setYtEtapa] = useState<string>(etapas[0]?.id || '');
  const [ytPrivate, setYtPrivate] = useState(false);
  const [ytSaving, setYtSaving] = useState(false);

  // Estados da Config Global
  const [globalOneDrive, setGlobalOneDrive] = useState(config?.onedrive_pasta_url || '');
  const [savingConfig, setSavingConfig] = useState(false);

  if (!isOpen) return null;

  // Lógica de Autenticação Supabase
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthLoading(true);
    setAuthError('');
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      if (error) throw error;
      onLoginSuccess();
    } catch (err: any) {
      setAuthError(err.message || 'Falha ao autenticar.');
    } finally {
      setAuthLoading(false);
    }
  };

  // Processamento e Leitura EXIF da Foto Selecionada com alta compatibilidade mobile
  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setSelectedFile(file);
    setPhotoPreview(URL.createObjectURL(file));
    setPhotoTitulo(file.name.replace(/\.[^/.]+$/, ''));

    // Ler metadados EXIF/GPS via exifr
    try {
      let lat: number | undefined;
      let lon: number | undefined;
      let alt: number | undefined;

      // 1. Tentar ler diretamente coordenadas GPS usando exifr.gps (método dedicado e mais robusto)
      const gpsData = await exifr.gps(file).catch(() => null);
      if (gpsData && typeof gpsData.latitude === 'number' && typeof gpsData.longitude === 'number') {
        lat = Number(gpsData.latitude);
        lon = Number(gpsData.longitude);
      }

      // 2. Ler metadados complementares (altitude, etc) sem o filtro pick restritivo
      const fullExif = await exifr.parse(file, {
        gps: true,
        tiff: true,
        xmp: true,
      }).catch(() => null);

      if (fullExif) {
        if (lat === undefined && typeof fullExif.latitude === 'number' && typeof fullExif.longitude === 'number') {
          lat = Number(fullExif.latitude);
          lon = Number(fullExif.longitude);
        }
        if (fullExif.altitude !== undefined && !isNaN(Number(fullExif.altitude))) {
          alt = Number(fullExif.altitude);
        }
      }

      if (lat !== undefined && lon !== undefined) {
        setPhotoCoords({ lat, lon, alt });

        // Identificar automaticamente a melhor Etapa baseada na coordenada
        const bestMatch = findBestEtapaForCoord([lon, lat], etapas);
        if (bestMatch) {
          setPhotoEtapa(bestMatch.etapaId);
          setGpsStatusInfo(`Dia ${bestMatch.numeroDia} (km ${bestMatch.snappedPoint.kmNoTrajeto ?? 0})`);
          if (onSetPendingPin) {
            onSetPendingPin([lon, lat], alt, bestMatch.snappedPoint.kmNoTrajeto ?? undefined);
          }
        } else {
          setGpsStatusInfo('Coordenada lida (fora das rotas oficiais de pedal)');
          if (onSetPendingPin) {
            onSetPendingPin([lon, lat], alt);
          }
        }
      } else {
        setPhotoCoords(null);
        setGpsStatusInfo(null);
      }
    } catch (err) {
      console.log('Sem EXIF ou falha na leitura', err);
      setPhotoCoords(null);
      setGpsStatusInfo(null);
    }
  };

  // Atualizar etapa e status quando o usuário marcar uma posição no mapa
  React.useEffect(() => {
    if (pendingPinCoord) {
      if (pendingPinInfo?.etapaId) {
        setPhotoEtapa(pendingPinInfo.etapaId);
      }
      const diaTxt = pendingPinInfo?.numeroDia ? `Dia ${pendingPinInfo.numeroDia}` : '';
      const kmTxt =
        pendingPinInfo?.kmNoTrajeto !== null && pendingPinInfo?.kmNoTrajeto !== undefined
          ? `(km ${pendingPinInfo.kmNoTrajeto.toFixed(1)})`
          : '(marcado na rota)';
      setGpsStatusInfo(`${diaTxt} ${kmTxt}`.trim());
    }
  }, [pendingPinCoord, pendingPinInfo]);

  // Se o usuário clicou no mapa para marcar a foto/vídeo
  const effectivePhotoLat = pendingPinCoord ? pendingPinCoord[1] : photoCoords?.lat;
  const effectivePhotoLon = pendingPinCoord ? pendingPinCoord[0] : photoCoords?.lon;

  // Enviar Nova Foto
  const handleUploadPhoto = async () => {
    if (!selectedFile) {
      alert('Selecione uma foto primeiro.');
      return;
    }
    if (effectivePhotoLat === undefined || effectivePhotoLon === undefined) {
      alert('Clique no botão "Marcar no Mapa" para posicionar esta foto na rota.');
      return;
    }

    setPhotoUploading(true);
    try {
      // 1. Upload do arquivo para o bucket do Supabase Storage
      const fileExt = selectedFile.name.split('.').pop();
      const fileName = `${Date.now()}_${Math.random().toString(36).substring(7)}.${fileExt}`;
      const filePath = `uploads/${fileName}`;

      const { data: uploadData, error: uploadErr } = await supabase.storage
        .from('fotos-viagem')
        .upload(filePath, selectedFile);

      if (uploadErr) throw uploadErr;

      const { data: urlData } = supabase.storage
        .from('fotos-viagem')
        .getPublicUrl(filePath);

      const publicUrl = urlData.publicUrl;

      // Calcular o km_no_trajeto se estiver associado a uma etapa com rota
      let calculatedKm: number | null = null;
      if (pendingPinInfo?.kmNoTrajeto !== undefined && pendingPinInfo?.kmNoTrajeto !== null) {
        calculatedKm = pendingPinInfo.kmNoTrajeto;
      } else if (effectivePhotoLat !== undefined && effectivePhotoLon !== undefined && photoEtapa) {
        const etapaObj = etapas.find((e) => e.id === photoEtapa);
        const coords = etapaObj?.geojson_rota?.geometry?.coordinates;
        if (coords && coords.length > 1) {
          const snapped = snapToRouteWithThreshold([effectivePhotoLon, effectivePhotoLat], coords, 500);
          calculatedKm = snapped.kmNoTrajeto;
        }
      }

      const photoAlt = photoCoords?.alt !== undefined ? photoCoords.alt : (pendingPinInfo?.altitude ?? null);

      // 2. Inserir no banco de dados na tabela public.midias
      const { error: dbErr } = await supabase.from('midias').insert({
        etapa_id: photoEtapa || null,
        tipo: 'foto',
        origem: photoCoords ? 's22' : 'manual',
        titulo: photoTitulo || selectedFile.name,
        arquivo_nome: selectedFile.name,
        url_midia: publicUrl,
        url_thumbnail: publicUrl,
        latitude: effectivePhotoLat,
        longitude: effectivePhotoLon,
        altitude: photoAlt,
        km_no_trajeto: calculatedKm,
        is_private: photoPrivate,
        posicao: `POINT(${effectivePhotoLon} ${effectivePhotoLat})`,
      });

      if (dbErr) throw dbErr;

      alert('Foto adicionada com sucesso!');
      setSelectedFile(null);
      setPhotoPreview(null);
      setPhotoCoords(null);
      setGpsStatusInfo(null);
      onResetPendingPin();
      await onRefreshData();
      onClose();
    } catch (err: any) {
      alert(`Erro ao adicionar foto: ${err.message}`);
    } finally {
      setPhotoUploading(false);
    }
  };

  // Salvar Novo Vídeo do Drone
  const handleSaveDroneVideo = async () => {
    if (!ytUrl) {
      alert('Cole o link do YouTube.');
      return;
    }
    if (!pendingPinCoord) {
      alert('Clique em "Marcar Posição do Drone no Mapa" para definir o ponto da filmagem.');
      return;
    }

    // Extrair ID do YouTube
    const match = ytUrl.match(
      /(?:youtu\.be\/|youtube\.com\/(?:embed\/|v\/|watch\?v=|watch\?.+&v=))([\w-]{11})/
    );
    const ytId = match ? match[1] : ytUrl;
    const thumbUrl = `https://img.youtube.com/vi/${ytId}/hqdefault.jpg`;

    setYtSaving(true);
    try {
      const { error: dbErr } = await supabase.from('midias').insert({
        etapa_id: ytEtapa || null,
        tipo: 'video_drone',
        origem: 'youtube',
        titulo: ytTitulo || 'Filmagem Aérea de Drone',
        youtube_id: ytId,
        url_thumbnail: thumbUrl,
        onedrive_download_url: ytOneDriveUrl || null,
        latitude: pendingPinCoord[1],
        longitude: pendingPinCoord[0],
        is_private: ytPrivate,
        posicao: `POINT(${pendingPinCoord[0]} ${pendingPinCoord[1]})`,
      });

      if (dbErr) throw dbErr;

      alert('Vídeo de drone adicionado com sucesso!');
      setYtUrl('');
      setYtOneDriveUrl('');
      setYtTitulo('');
      onResetPendingPin();
      await onRefreshData();
      onClose();
    } catch (err: any) {
      alert(`Erro ao salvar vídeo: ${err.message}`);
    } finally {
      setYtSaving(false);
    }
  };

  // Salvar Link Global do OneDrive
  const handleSaveGlobalConfig = async () => {
    setSavingConfig(true);
    try {
      await onUpdateGlobalOneDrive(globalOneDrive);
      alert('Link da pasta do OneDrive atualizado!');
    } catch (err: any) {
      alert(`Erro: ${err.message}`);
    } finally {
      setSavingConfig(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-slate-950/60 backdrop-blur-sm animate-fadeIn">
      <div className="w-full max-w-md bg-slate-900 border-l border-slate-800 h-full flex flex-col shadow-2xl">
        {/* Cabeçalho */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-950/40">
          <div className="flex items-center gap-2">
            <Lock className="w-5 h-5 text-orange-500" />
            <h2 className="text-base font-bold text-white">Painel do Administrador</h2>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Conteúdo: Se não estiver logado, exibe tela de login */}
        {!isAdmin ? (
          <div className="p-6 flex-1 flex flex-col justify-center">
            <div className="text-center mb-6">
              <div className="w-12 h-12 rounded-2xl bg-orange-600/20 text-orange-400 mx-auto flex items-center justify-center mb-3">
                <LogIn className="w-6 h-6" />
              </div>
              <h3 className="text-lg font-bold text-white">Acesso Restrito</h3>
              <p className="text-xs text-slate-400 mt-1">
                Faça login para adicionar ou excluir mídias e visualizar fotos particulares.
              </p>
            </div>

            <form onSubmit={handleLogin} className="flex flex-col gap-4">
              <div>
                <label className="text-xs text-slate-300 block mb-1">E-mail</label>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="admin@exemplo.com"
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-orange-500"
                />
              </div>

              <div>
                <label className="text-xs text-slate-300 block mb-1">Senha</label>
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-orange-500"
                />
              </div>

              {authError && (
                <div className="p-3 rounded-xl bg-red-950/60 border border-red-800 text-red-300 text-xs flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{authError}</span>
                </div>
              )}

              <button
                type="submit"
                disabled={authLoading}
                className="w-full mt-2 py-2.5 rounded-xl bg-orange-600 hover:bg-orange-500 font-semibold text-sm text-white shadow-lg shadow-orange-600/30 transition"
              >
                {authLoading ? 'Verificando...' : 'Acessar como Admin'}
              </button>
            </form>
          </div>
        ) : (
          /* Se logado, exibe as ferramentas completas de gestão */
          <div className="flex-1 flex flex-col overflow-hidden">
            {/* Seletor de Abas de Administração */}
            <div className="flex border-b border-slate-800 bg-slate-950/60 px-2 sm:px-4">
              <button
                onClick={() => setActiveTab('foto')}
                className={`flex-1 py-3 text-xs font-semibold border-b-2 transition flex items-center justify-center gap-1 sm:gap-1.5 ${
                  activeTab === 'foto'
                    ? 'border-orange-500 text-orange-400'
                    : 'border-transparent text-slate-400 hover:text-white'
                }`}
              >
                <Upload className="w-3.5 h-3.5" /> <span className="hidden xs:inline">+ Foto</span>
              </button>
              <button
                onClick={() => setActiveTab('drone')}
                className={`flex-1 py-3 text-xs font-semibold border-b-2 transition flex items-center justify-center gap-1 sm:gap-1.5 ${
                  activeTab === 'drone'
                    ? 'border-red-500 text-red-400'
                    : 'border-transparent text-slate-400 hover:text-white'
                }`}
              >
                <Video className="w-3.5 h-3.5" /> <span className="hidden xs:inline">+ Drone</span>
              </button>
              <button
                onClick={() => setActiveTab('privacidade')}
                className={`flex-1 py-3 text-xs font-semibold border-b-2 transition flex items-center justify-center gap-1 sm:gap-1.5 ${
                  activeTab === 'privacidade'
                    ? 'border-amber-500 text-amber-400'
                    : 'border-transparent text-slate-400 hover:text-white'
                }`}
                title="Controle de mídias públicas e privadas"
              >
                <Shield className="w-3.5 h-3.5" /> <span className="hidden xs:inline">Privacidade</span>
              </button>
              <button
                onClick={() => setActiveTab('config')}
                className={`flex-1 py-3 text-xs font-semibold border-b-2 transition flex items-center justify-center gap-1 sm:gap-1.5 ${
                  activeTab === 'config'
                    ? 'border-sky-500 text-sky-400'
                    : 'border-transparent text-slate-400 hover:text-white'
                }`}
                title="Configuração da pasta geral no OneDrive"
              >
                <FolderOpen className="w-3.5 h-3.5" /> <span className="hidden xs:inline">OneDrive</span>
              </button>
            </div>

            {/* Conteúdo da Aba */}
            <div className="flex-1 overflow-y-auto p-6 space-y-5">
              {/* ABA 1: ADICIONAR FOTO */}
              {activeTab === 'foto' && (
                <div className="space-y-4">
                  <div>
                    <label className="text-xs font-medium text-slate-300 block mb-1">
                      Foto do Celular / Computador
                    </label>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleFileChange}
                      className="w-full text-xs text-slate-400 file:mr-3 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-xs file:font-semibold file:bg-orange-600 file:text-white hover:file:bg-orange-500 cursor-pointer"
                    />
                  </div>

                  {photoPreview && (
                    <div className="relative rounded-xl overflow-hidden border border-slate-700 aspect-video bg-black/40 flex items-center justify-center">
                      <img
                        src={photoPreview}
                        alt="Preview"
                        className="max-h-full max-w-full object-contain"
                      />
                    </div>
                  )}

                  <div>
                    <label className="text-xs font-medium text-slate-300 block mb-1">
                      Título ou Legenda
                    </label>
                    <input
                      type="text"
                      value={photoTitulo}
                      onChange={(e) => setPhotoTitulo(e.target.value)}
                      placeholder="Ex: Mirante da Serra do Rio do Rastro"
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-orange-500"
                    />
                  </div>

                  <div>
                    <label className="text-xs font-medium text-slate-300 block mb-1">
                      Etapa / Dia da Viagem
                    </label>
                    <select
                      value={photoEtapa}
                      onChange={(e) => setPhotoEtapa(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-orange-500"
                    >
                      {etapas.map((e) => (
                        <option key={e.id} value={e.id}>
                          Dia {e.numero_dia}: {e.titulo}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Status das Coordenadas / Georreferenciamento Automático */}
                  <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 space-y-2.5">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-slate-400">Coordenadas GPS:</span>
                      {effectivePhotoLat ? (
                        <span className="text-emerald-400 font-semibold flex items-center gap-1 font-mono text-[11px]">
                          <Check className="w-3.5 h-3.5" />
                          {effectivePhotoLat.toFixed(5)}, {effectivePhotoLon?.toFixed(5)}
                        </span>
                      ) : (
                        <span className="text-amber-400 font-medium text-[11px]">Não detectada no arquivo</span>
                      )}
                    </div>

                    {!effectivePhotoLat && selectedFile && (
                      <div className="p-2 rounded-lg bg-amber-950/40 border border-amber-500/30 text-[11px] text-amber-200">
                        💡 Foto sem dados de GPS (comum em fotos salvas do WhatsApp ou tiradas com localização desligada). Toque no botão abaixo e toque na rota no mapa para marcar a posição.
                      </div>
                    )}

                    {gpsStatusInfo && (
                      <div className="p-2.5 rounded-lg bg-emerald-950/40 border border-emerald-500/30 text-[11px] text-emerald-200 flex items-center gap-2">
                        <Sparkles className="w-4 h-4 text-emerald-400 shrink-0" />
                        <div>
                          <strong>Georreferência:</strong> {gpsStatusInfo}.
                          <div className="text-[10px] text-emerald-300/80">Marcador posicionado em foco no mapa.</div>
                        </div>
                      </div>
                    )}

                    <button
                      type="button"
                      onClick={() => onStartMapPinPick('foto', { etapaId: photoEtapa })}
                      className="w-full py-2 rounded-lg border border-orange-500/60 text-orange-400 hover:bg-orange-500/10 active:bg-orange-500/20 text-xs font-semibold transition flex items-center justify-center gap-1.5 shadow-sm"
                    >
                      <MapPin className="w-3.5 h-3.5" />
                      {effectivePhotoLat ? 'Ajustar Ponto Clicando na Rota do Mapa' : 'Marcar Local no Mapa (Clique na Rota)'}
                    </button>
                  </div>

                  {/* Privacidade */}
                  <label className="flex items-center gap-2 cursor-pointer p-3 rounded-xl bg-slate-950/60 border border-slate-800">
                    <input
                      type="checkbox"
                      checked={photoPrivate}
                      onChange={(e) => setPhotoPrivate(e.target.checked)}
                      className="rounded bg-slate-900 border-slate-700 text-orange-600 focus:ring-0"
                    />
                    <div className="text-xs">
                      <span className="font-semibold text-white block">Foto Particular</span>
                      <span className="text-slate-400 text-[11px]">
                        Será exibida somente para você quando estiver logado.
                      </span>
                    </div>
                  </label>

                  <button
                    onClick={handleUploadPhoto}
                    disabled={photoUploading}
                    className="w-full py-2.5 rounded-xl bg-orange-600 hover:bg-orange-500 font-semibold text-xs text-white shadow-lg shadow-orange-600/30 transition flex items-center justify-center gap-2"
                  >
                    <Upload className="w-4 h-4" />
                    {photoUploading ? 'Enviando Foto...' : 'Salvar e Publicar Foto'}
                  </button>
                </div>
              )}

              {/* ABA 2: ADICIONAR VÍDEO DO DRONE */}
              {activeTab === 'drone' && (
                <div className="space-y-4">
                  <div>
                    <label className="text-xs font-medium text-slate-300 block mb-1">
                      Link do Vídeo no YouTube (Não Listado)
                    </label>
                    <input
                      type="text"
                      value={ytUrl}
                      onChange={(e) => setYtUrl(e.target.value)}
                      placeholder="https://youtu.be/..."
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-red-500"
                    />
                  </div>

                  <div className="p-2.5 rounded-lg bg-sky-950/30 border border-sky-800/40 text-[11px] text-sky-300 flex items-center gap-2">
                    <FolderOpen className="w-3.5 h-3.5 shrink-0" />
                    <span>Os vídeos de drone direcionam o download para a pasta raiz no OneDrive.</span>
                  </div>

                  <div>
                    <label className="text-xs font-medium text-slate-300 block mb-1">
                      Título do Vídeo
                    </label>
                    <input
                      type="text"
                      value={ytTitulo}
                      onChange={(e) => setYtTitulo(e.target.value)}
                      placeholder="Ex: Sobrevoo nos Cânions de São José dos Ausentes"
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-red-500"
                    />
                  </div>

                  <div>
                    <label className="text-xs font-medium text-slate-300 block mb-1">
                      Etapa / Dia da Viagem
                    </label>
                    <select
                      value={ytEtapa}
                      onChange={(e) => setYtEtapa(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-red-500"
                    >
                      {etapas.map((e) => (
                        <option key={e.id} value={e.id}>
                          Dia {e.numero_dia}: {e.titulo}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Localização no Mapa */}
                  <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 space-y-2">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-slate-400">Ponto de Decolagem / Filmagem:</span>
                      {pendingPinCoord ? (
                        <span className="text-emerald-400 font-semibold flex items-center gap-1">
                          <Check className="w-3.5 h-3.5" />
                          {pendingPinCoord[1].toFixed(5)}, {pendingPinCoord[0].toFixed(5)}
                        </span>
                      ) : (
                        <span className="text-amber-400 font-medium">Aguardando clique</span>
                      )}
                    </div>

                    <button
                      type="button"
                      onClick={() => onStartMapPinPick('video_drone', { etapaId: ytEtapa })}
                      className="w-full py-2 rounded-lg border border-red-500/60 text-red-400 hover:bg-red-500/10 active:bg-red-500/20 text-xs font-semibold transition flex items-center justify-center gap-1.5 shadow-sm"
                    >
                      <MapPin className="w-3.5 h-3.5" />
                      Marcar Posição do Drone no Mapa
                    </button>
                  </div>

                  <button
                    onClick={handleSaveDroneVideo}
                    disabled={ytSaving}
                    className="w-full py-2.5 rounded-xl bg-red-600 hover:bg-red-500 font-semibold text-xs text-white shadow-lg shadow-red-600/30 transition flex items-center justify-center gap-2"
                  >
                    <Video className="w-4 h-4" />
                    {ytSaving ? 'Salvando...' : 'Adicionar Vídeo de Drone'}
                  </button>
                </div>
              )}

              {/* ABA 3: GERENCIADOR DE PRIVACIDADE EM LOTE */}
              {activeTab === 'privacidade' && (
                <div className="space-y-4">
                  <div className="p-3 rounded-xl bg-amber-950/40 border border-amber-800/60 text-xs text-amber-200 space-y-1">
                    <p className="font-semibold flex items-center gap-1.5 text-amber-300">
                      <Shield className="w-4 h-4" /> Controle de Exibição Pública
                    </p>
                    <p className="text-[11px] leading-relaxed text-amber-200/80">
                      Mídias privadas aparecem exclusivamente para você (Administrador), identificadas com o selo de &ldquo;Privado&rdquo;. Visitantes públicos verão apenas mídias marcadas como públicas.
                    </p>
                  </div>

                  {/* Estatísticas e Ações: Fotos */}
                  <div className="bg-slate-950/80 border border-slate-800 rounded-xl p-3.5 space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-white flex items-center gap-1.5">
                        <Upload className="w-3.5 h-3.5 text-orange-400" /> Fotos
                      </span>
                      <span className="text-[11px] text-slate-400">
                        {statsPrivacidade.fotosTotal} fotos no total
                      </span>
                    </div>

                    <div className="grid grid-cols-2 gap-2 text-center text-xs">
                      <div className="p-2 rounded-lg bg-emerald-500/10 border border-emerald-500/20">
                        <span className="text-[10px] text-emerald-400 block font-medium">Públicas</span>
                        <span className="text-base font-bold text-emerald-300">{statsPrivacidade.fotosPublicas}</span>
                      </div>
                      <div className="p-2 rounded-lg bg-amber-500/10 border border-amber-500/20">
                        <span className="text-[10px] text-amber-400 block font-medium">Privadas</span>
                        <span className="text-base font-bold text-amber-300">{statsPrivacidade.fotosPrivadas}</span>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-2 pt-1">
                      <button
                        type="button"
                        disabled={batchLoading || statsPrivacidade.fotosPrivadas === statsPrivacidade.fotosTotal}
                        onClick={() => handleApplyGlobalPrivacy('foto', true)}
                        className="py-2 px-2 bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/50 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed"
                      >
                        {batchLoading ? <Loader2 className="w-3 h-3 animate-spin" /> : <Lock className="w-3 h-3 stroke-[2.5]" />}
                        <span>Todas Privadas</span>
                      </button>
                      <button
                        type="button"
                        disabled={batchLoading || statsPrivacidade.fotosPublicas === statsPrivacidade.fotosTotal}
                        onClick={() => handleApplyGlobalPrivacy('foto', false)}
                        className="py-2 px-2 bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 border border-emerald-500/50 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed"
                      >
                        {batchLoading ? <Loader2 className="w-3 h-3 animate-spin" /> : <Unlock className="w-3 h-3 stroke-[2.5]" />}
                        <span>Todas Públicas</span>
                      </button>
                    </div>
                  </div>

                  {/* Estatísticas e Ações: Vídeos do Drone */}
                  <div className="bg-slate-950/80 border border-slate-800 rounded-xl p-3.5 space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-white flex items-center gap-1.5">
                        <Video className="w-3.5 h-3.5 text-red-400" /> Vídeos de Drone
                      </span>
                      <span className="text-[11px] text-slate-400">
                        {statsPrivacidade.droneTotal} vídeos no total
                      </span>
                    </div>

                    <div className="grid grid-cols-2 gap-2 text-center text-xs">
                      <div className="p-2 rounded-lg bg-emerald-500/10 border border-emerald-500/20">
                        <span className="text-[10px] text-emerald-400 block font-medium">Públicos</span>
                        <span className="text-base font-bold text-emerald-300">{statsPrivacidade.dronePublicos}</span>
                      </div>
                      <div className="p-2 rounded-lg bg-amber-500/10 border border-amber-500/20">
                        <span className="text-[10px] text-amber-400 block font-medium">Privados</span>
                        <span className="text-base font-bold text-amber-300">{statsPrivacidade.dronePrivados}</span>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-2 pt-1">
                      <button
                        type="button"
                        disabled={batchLoading || statsPrivacidade.dronePrivados === statsPrivacidade.droneTotal}
                        onClick={() => handleApplyGlobalPrivacy('video_drone', true)}
                        className="py-2 px-2 bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/50 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed"
                      >
                        {batchLoading ? <Loader2 className="w-3 h-3 animate-spin" /> : <Lock className="w-3 h-3 stroke-[2.5]" />}
                        <span>Todos Privados</span>
                      </button>
                      <button
                        type="button"
                        disabled={batchLoading || statsPrivacidade.dronePublicos === statsPrivacidade.droneTotal}
                        onClick={() => handleApplyGlobalPrivacy('video_drone', false)}
                        className="py-2 px-2 bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 border border-emerald-500/50 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed"
                      >
                        {batchLoading ? <Loader2 className="w-3 h-3 animate-spin" /> : <Unlock className="w-3 h-3 stroke-[2.5]" />}
                        <span>Todos Públicos</span>
                      </button>
                    </div>
                  </div>

                  <p className="text-[11px] text-slate-400 text-center">
                    💡 Dica: Você também pode alternar mídias específicas selecionando-as na <strong>Galeria Lateral</strong>.
                  </p>
                </div>
              )}

              {/* ABA 4: CONFIGURAÇÃO DO ONEDRIVE */}
              {activeTab === 'config' && (
                <div className="space-y-4">
                  <div className="p-3 rounded-xl bg-sky-950/40 border border-sky-800/60 text-xs text-sky-200">
                    O link da pasta do OneDrive é exclusivo para os vídeos originais de Drone em alta resolução. Caso o link da pasta expire ou mude, atualize-o abaixo. Todos os botões passarão a apontar para o novo link imediatamente.
                  </div>

                  <div>
                    <label className="text-xs font-medium text-slate-300 block mb-1">
                      Link da Pasta Geral no OneDrive (Vídeos de Drone)
                    </label>
                    <textarea
                      rows={3}
                      value={globalOneDrive}
                      onChange={(e) => setGlobalOneDrive(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-xs text-white focus:outline-none focus:border-sky-500"
                    />
                  </div>

                  <button
                    onClick={handleSaveGlobalConfig}
                    disabled={savingConfig}
                    className="w-full py-2.5 rounded-xl bg-sky-600 hover:bg-sky-500 font-semibold text-xs text-white shadow-lg shadow-sky-600/30 transition"
                  >
                    {savingConfig ? 'Atualizando...' : 'Salvar Novo Link do OneDrive'}
                  </button>
                </div>
              )}
            </div>

            {/* Rodapé: Botão de Sair */}
            <div className="p-4 border-t border-slate-800 bg-slate-950/40 flex justify-between items-center">
              <span className="text-xs text-slate-400">Logado como Administrador</span>
              <button
                onClick={onLogout}
                className="flex items-center gap-1.5 text-xs text-red-400 hover:text-red-300 p-1.5 rounded-lg hover:bg-red-950/40 transition"
              >
                <LogOut className="w-3.5 h-3.5" />
                <span>Sair</span>
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

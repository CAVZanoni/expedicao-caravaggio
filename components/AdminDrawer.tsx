'use client';

import React, { useState } from 'react';
import { supabase, Etapa, ExpedicaoConfig } from '@/lib/supabase';
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
} from 'lucide-react';

interface AdminDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  isAdmin: boolean;
  onLoginSuccess: () => void;
  onLogout: () => void;
  etapas: Etapa[];
  config?: ExpedicaoConfig | null;
  onUpdateGlobalOneDrive: (novaUrl: string) => Promise<void>;
  onStartMapPinPick: (tipo: 'foto' | 'video_drone', tempInfo: any) => void;
  pendingPinCoord: [number, number] | null;
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
  onUpdateGlobalOneDrive,
  onStartMapPinPick,
  pendingPinCoord,
  onResetPendingPin,
  onRefreshData,
}: AdminDrawerProps) {
  // Estados de Login
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [authLoading, setAuthLoading] = useState(false);
  const [authError, setAuthError] = useState('');

  // Estados de Abas do Admin
  const [activeTab, setActiveTab] = useState<'foto' | 'drone' | 'config'>('foto');

  // Estados de Adicionar Foto
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [photoTitulo, setPhotoTitulo] = useState('');
  const [photoEtapa, setPhotoEtapa] = useState<string>(etapas[0]?.id || '');
  const [photoPrivate, setPhotoPrivate] = useState(false);
  const [photoCoords, setPhotoCoords] = useState<{ lat: number; lon: number; alt?: number } | null>(null);
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

  // Processamento e Leitura EXIF da Foto Selecionada
  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setSelectedFile(file);
    setPhotoPreview(URL.createObjectURL(file));
    setPhotoTitulo(file.name.replace(/\.[^/.]+$/, ''));

    // Ler metadados EXIF via exifr
    try {
      const exif = await exifr.parse(file, {
        gps: true,
        pick: ['latitude', 'longitude', 'altitude', 'DateTimeOriginal'],
      });

      if (exif && exif.latitude && exif.longitude) {
        setPhotoCoords({
          lat: exif.latitude,
          lon: exif.longitude,
          alt: exif.altitude || undefined,
        });
      } else {
        setPhotoCoords(null);
      }
    } catch (err) {
      console.log('Sem EXIF ou falha na leitura', err);
      setPhotoCoords(null);
    }
  };

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
        altitude: photoCoords?.alt || null,
        is_private: photoPrivate,
        posicao: `POINT(${effectivePhotoLon} ${effectivePhotoLat})`,
      });

      if (dbErr) throw dbErr;

      alert('Foto adicionada com sucesso!');
      setSelectedFile(null);
      setPhotoPreview(null);
      setPhotoCoords(null);
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
            <div className="flex border-b border-slate-800 bg-slate-950/60 px-4">
              <button
                onClick={() => setActiveTab('foto')}
                className={`flex-1 py-3 text-xs font-semibold border-b-2 transition flex items-center justify-center gap-1.5 ${
                  activeTab === 'foto'
                    ? 'border-orange-500 text-orange-400'
                    : 'border-transparent text-slate-400 hover:text-white'
                }`}
              >
                <Upload className="w-3.5 h-3.5" /> + Foto
              </button>
              <button
                onClick={() => setActiveTab('drone')}
                className={`flex-1 py-3 text-xs font-semibold border-b-2 transition flex items-center justify-center gap-1.5 ${
                  activeTab === 'drone'
                    ? 'border-red-500 text-red-400'
                    : 'border-transparent text-slate-400 hover:text-white'
                }`}
              >
                <Video className="w-3.5 h-3.5" /> + Vídeo Drone
              </button>
              <button
                onClick={() => setActiveTab('config')}
                className={`flex-1 py-3 text-xs font-semibold border-b-2 transition flex items-center justify-center gap-1.5 ${
                  activeTab === 'config'
                    ? 'border-sky-500 text-sky-400'
                    : 'border-transparent text-slate-400 hover:text-white'
                }`}
              >
                <FolderOpen className="w-3.5 h-3.5" /> OneDrive
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

                  {/* Status das Coordenadas */}
                  <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 space-y-2">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-slate-400">Coordenadas:</span>
                      {effectivePhotoLat ? (
                        <span className="text-emerald-400 font-semibold flex items-center gap-1">
                          <Check className="w-3.5 h-3.5" />
                          {effectivePhotoLat.toFixed(5)}, {effectivePhotoLon?.toFixed(5)}
                        </span>
                      ) : (
                        <span className="text-amber-400 font-medium">Não detectada</span>
                      )}
                    </div>

                    <button
                      type="button"
                      onClick={() => onStartMapPinPick('foto', {})}
                      className="w-full py-1.5 rounded-lg border border-orange-500/40 text-orange-400 hover:bg-orange-500/10 text-xs font-medium transition flex items-center justify-center gap-1.5"
                    >
                      <MapPin className="w-3.5 h-3.5" />
                      {effectivePhotoLat ? 'Alterar Local no Mapa' : 'Marcar Local no Mapa (Clique na Rota)'}
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

                  <div>
                    <label className="text-xs font-medium text-slate-300 block mb-1">
                      Link de Download do Arquivo no OneDrive (Opcional)
                    </label>
                    <input
                      type="text"
                      value={ytOneDriveUrl}
                      onChange={(e) => setYtOneDriveUrl(e.target.value)}
                      placeholder="Link direto do arquivo ou deixe em branco para usar a pasta geral"
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-sky-500"
                    />
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
                      onClick={() => onStartMapPinPick('video_drone', {})}
                      className="w-full py-1.5 rounded-lg border border-red-500/40 text-red-400 hover:bg-red-500/10 text-xs font-medium transition flex items-center justify-center gap-1.5"
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

              {/* ABA 3: CONFIGURAÇÃO DO ONEDRIVE */}
              {activeTab === 'config' && (
                <div className="space-y-4">
                  <div className="p-3 rounded-xl bg-sky-950/40 border border-sky-800/60 text-xs text-sky-200">
                    Caso o link da pasta de vídeos do OneDrive expire ou mude, atualize-o abaixo. Todos os botões de download dos vídeos passarão a apontar para o novo link imediatamente.
                  </div>

                  <div>
                    <label className="text-xs font-medium text-slate-300 block mb-1">
                      Link da Pasta Geral no OneDrive
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

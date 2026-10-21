import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://mmrutnyypisikfxgvsnz.supabase.co';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1tcnV0bnl5cGlzaWtmeGd2c256Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTI0NTk1MjEsImV4cCI6MjEwODAzNTUyMX0.JKv_Hr-OpWCUP3UnyQI-ty7rbx5ky41UCIQE5W4SWIw';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

export interface Etapa {
  id: string;
  numero_dia: number;
  data: string;
  titulo: string;
  cidade_origem: string;
  cidade_destino: string;
  distancia_km: number;
  altimetria_ganho: number;
  altimetria_perda: number;
  alt_min: number;
  alt_max: number;
  duracao_segundos: number;
  cor_trajeto?: string;
  geojson_rota: any;
  perfil_altimetria: {
    km: number;
    altitude: number;
    lat: number;
    lon: number;
    time?: string;
  }[];
  bounds: {
    min_lat: number;
    max_lat: number;
    min_lon: number;
    max_lon: number;
    centro: [number, number];
  };
}

export interface Midia {
  id: string;
  etapa_id?: string;
  tipo: 'foto' | 'video' | 'video_drone';
  origem: 's22' | 'whatsapp' | 'youtube' | 'manual';
  titulo?: string;
  arquivo_nome?: string;
  url_midia?: string;
  url_thumbnail: string;
  youtube_id?: string;
  onedrive_download_url?: string;
  latitude: number;
  longitude: number;
  altitude?: number;
  timestamp_captura?: string;
  km_no_trajeto?: number | null;
  is_private: boolean;
  needs_review?: boolean;
  legenda?: string;
  ordem?: number;
}

export interface ExpedicaoConfig {
  id: string;
  titulo: string;
  onedrive_pasta_url: string;
}

export interface MediaFilters {
  foto: boolean;
  video: boolean;
  video_drone: boolean;
}

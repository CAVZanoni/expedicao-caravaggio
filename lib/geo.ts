/**
 * Módulo de utilitários geométricos para rotas e coordenadas geográficas.
 */

export interface SnappedPoint {
  coord: [number, number]; // [lon, lat]
  altitude: number;
  segmentIndex: number;
  distanceFromRouteMeters: number;
  kmNoTrajeto: number | null;
  isSnapped: boolean;
}

/**
 * Converte graus para radianos.
 */
function toRad(deg: number): number {
  return (deg * Math.PI) / 180;
}

/**
 * Calcula a distância em metros entre duas coordenadas geográficas usando Haversine.
 */
export function distanceMeters(lon1: number, lat1: number, lon2: number, lat2: number): number {
  const R = 6371000; // Raio da Terra em metros
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

/**
 * Projeta um ponto ortogonalmente em um segmento de reta 2D [A, B] em coordenadas planas ou projetadas.
 */
function projectPointOnSegment(
  px: number,
  py: number,
  ax: number,
  ay: number,
  bx: number,
  by: number
): { x: number; y: number; t: number } {
  const dx = bx - ax;
  const dy = by - ay;
  const lenSq = dx * dx + dy * dy;

  if (lenSq === 0) {
    return { x: ax, y: ay, t: 0 };
  }

  // Projeção escalar t limitada a [0, 1]
  const t = Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / lenSq));
  return {
    x: ax + t * dx,
    y: ay + t * dy,
    t,
  };
}

/**
 * Amarra um ponto [lon, lat] estritamente ao caminho mais próximo da rota GPX ("Snap to Route").
 * Retorna as coordenadas projetadas na linha do trajeto e a altitude interpolada.
 * 
 * @param point Coordenadas [lon, lat] do ponto arrastado ou clicado
 * @param routeCoords Array de coordenadas da rota [[lon, lat, ele?], ...]
 */
export function snapToRoute(
  point: [number, number],
  routeCoords: number[][]
): SnappedPoint {
  if (!routeCoords || routeCoords.length === 0) {
    return {
      coord: point,
      altitude: 0,
      segmentIndex: 0,
      distanceFromRouteMeters: 0,
      kmNoTrajeto: 0,
      isSnapped: false,
    };
  }

  if (routeCoords.length === 1) {
    const pt = routeCoords[0];
    return {
      coord: [pt[0], pt[1]],
      altitude: pt[2] || 0,
      segmentIndex: 0,
      distanceFromRouteMeters: distanceMeters(point[0], point[1], pt[0], pt[1]),
      kmNoTrajeto: 0,
      isSnapped: true,
    };
  }

  const [pLon, pLat] = point;
  let minDistance = Infinity;
  let bestCoord: [number, number] = [routeCoords[0][0], routeCoords[0][1]];
  let bestAltitude = routeCoords[0][2] || 0;
  let bestSegment = 0;
  let bestT = 0;

  // Pré-acumular distância acumulada para cálculo do km no trajeto
  let cumDistance = 0;
  const segmentCumDistances: number[] = new Array(routeCoords.length - 1);
  const segmentLengths: number[] = new Array(routeCoords.length - 1);

  for (let i = 0; i < routeCoords.length - 1; i++) {
    const a = routeCoords[i];
    const b = routeCoords[i + 1];

    const aLon = a[0];
    const aLat = a[1];
    const bLon = b[0];
    const bLat = b[1];

    const segLen = distanceMeters(aLon, aLat, bLon, bLat);
    segmentCumDistances[i] = cumDistance;
    segmentLengths[i] = segLen;
    cumDistance += segLen;

    const proj = projectPointOnSegment(pLon, pLat, aLon, aLat, bLon, bLat);
    const dist = distanceMeters(pLon, pLat, proj.x, proj.y);

    if (dist < minDistance) {
      minDistance = dist;
      bestCoord = [Number(proj.x.toFixed(6)), Number(proj.y.toFixed(6))];
      bestSegment = i;
      bestT = proj.t;

      // Interpolar altitude entre os dois pontos da rota
      const aEle = a[2] !== undefined ? a[2] : 0;
      const bEle = b[2] !== undefined ? b[2] : aEle;
      bestAltitude = Number((aEle + proj.t * (bEle - aEle)).toFixed(1));
    }
  }

  // Distância acumulada até o ponto projetado na rota
  const distToProjMeters =
    segmentCumDistances[bestSegment] + bestT * segmentLengths[bestSegment];
  const kmNoTrajeto = Number((distToProjMeters / 1000).toFixed(2));

  return {
    coord: bestCoord,
    altitude: bestAltitude,
    segmentIndex: bestSegment,
    distanceFromRouteMeters: Math.round(minDistance),
    kmNoTrajeto,
    isSnapped: true,
  };
}

/**
 * Amarra um ponto [lon, lat] com limiar magnético de descolamento ("Snap Threshold").
 * Se o ponto estiver próximo da rota (<= thresholdMeters), ele gruda magneticamente na linha.
 * Se o usuário puxar para longe (> thresholdMeters), o imã se solta e o ponto fica livre.
 * 
 * @param point Coordenadas [lon, lat] do ponto arrastado ou clicado
 * @param routeCoords Array de coordenadas da rota GPX
 * @param thresholdMeters Distância máxima em metros para aplicar a atração magnética (padrão: 350m)
 */
export function snapToRouteWithThreshold(
  point: [number, number],
  routeCoords: number[][],
  thresholdMeters: number = 350
): SnappedPoint {
  const snapped = snapToRoute(point, routeCoords);

  if (snapped.distanceFromRouteMeters <= thresholdMeters) {
    return {
      ...snapped,
      isSnapped: true,
    };
  } else {
    // Descolou da rota (fora do raio magnético): mantém a coordenada livre onde o usuário soltou!
    return {
      coord: point,
      altitude: snapped.altitude,
      segmentIndex: snapped.segmentIndex,
      distanceFromRouteMeters: snapped.distanceFromRouteMeters,
      kmNoTrajeto: null, // Fora do trajeto oficial (ex: dia anterior, hotel, concentração)
      isSnapped: false,
    };
  }
}

/**
 * Calcula a distância em km a partir do início da rota até o ponto mais próximo da rota.
 */
export function calculateKmAlongRoute(
  point: [number, number],
  routeCoords: number[][]
): number {
  return snapToRoute(point, routeCoords).kmNoTrajeto ?? 0;
}

export interface EtapaMatchResult {
  etapaId: string;
  numeroDia: number;
  snappedPoint: SnappedPoint;
  distanceFromRouteMeters: number;
}

/**
 * Encontra a etapa mais compatível com uma determinada coordenada [lon, lat],
 * calculando a menor distância até as rotas de todas as etapas disponíveis.
 */
export function findBestEtapaForCoord(
  point: [number, number],
  etapas: { id: string; numero_dia: number; geojson_rota?: any; geojson?: any }[],
  maxDistanceMeters: number = 25000 // 25 km de raio de tolerância para identificar etapa
): EtapaMatchResult | null {
  let bestMatch: EtapaMatchResult | null = null;
  let minDistance = Infinity;

  for (const etapa of etapas) {
    const coords = etapa.geojson_rota?.geometry?.coordinates || etapa.geojson?.geometry?.coordinates;
    if (!coords || !Array.isArray(coords) || coords.length === 0) continue;

    const snapped = snapToRoute(point, coords);
    if (snapped.distanceFromRouteMeters < minDistance) {
      minDistance = snapped.distanceFromRouteMeters;
      bestMatch = {
        etapaId: etapa.id,
        numeroDia: etapa.numero_dia,
        snappedPoint: snapped,
        distanceFromRouteMeters: snapped.distanceFromRouteMeters,
      };
    }
  }

  if (bestMatch && bestMatch.distanceFromRouteMeters <= maxDistanceMeters) {
    return bestMatch;
  }

  return null;
}

/**
 * Extrai um objeto Date a partir de metadados EXIF, nome do arquivo ou timestamp lastModified.
 */
export function extractDateTimeFromMetadata(
  exifDate?: any,
  fileName?: string,
  lastModified?: number
): { date: Date; dateStr: string; timeStr: string; source: 'exif' | 'filename' | 'last_modified' } | null {
  // 1. Tentar via EXIF DateTimeOriginal / CreateDate
  if (exifDate instanceof Date && !isNaN(exifDate.getTime())) {
    const iso = exifDate.toISOString();
    return {
      date: exifDate,
      dateStr: iso.split('T')[0],
      timeStr: iso.split('T')[1].substring(0, 8),
      source: 'exif',
    };
  }

  if (typeof exifDate === 'string') {
    // Formato EXIF típico "YYYY:MM:DD HH:MM:SS"
    const m = exifDate.match(/(\d{4})[-:.](\d{2})[-:.](\d{2})[ T](\d{2})[-:.](\d{2})[-:.](\d{2})/);
    if (m) {
      const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]), Number(m[4]), Number(m[5]), Number(m[6]));
      if (!isNaN(d.getTime())) {
        return {
          date: d,
          dateStr: `${m[1]}-${m[2]}-${m[3]}`,
          timeStr: `${m[4]}:${m[5]}:${m[6]}`,
          source: 'exif',
        };
      }
    }
  }

  // 2. Tentar via padrão no nome do arquivo (ex: 20261016_174146.jpg ou IMG-20261016-WA0001.jpg)
  if (fileName) {
    const mTime = fileName.match(/(\d{4})(\d{2})(\d{2})_(\d{2})(\d{2})(\d{2})/);
    if (mTime) {
      const d = new Date(
        Number(mTime[1]),
        Number(mTime[2]) - 1,
        Number(mTime[3]),
        Number(mTime[4]),
        Number(mTime[5]),
        Number(mTime[6])
      );
      if (!isNaN(d.getTime())) {
        return {
          date: d,
          dateStr: `${mTime[1]}-${mTime[2]}-${mTime[3]}`,
          timeStr: `${mTime[4]}:${mTime[5]}:${mTime[6]}`,
          source: 'filename',
        };
      }
    }

    const mDateOnly = fileName.match(/(\d{4})(\d{2})(\d{2})/);
    if (mDateOnly) {
      const d = new Date(Number(mDateOnly[1]), Number(mDateOnly[2]) - 1, Number(mDateOnly[3]), 12, 0, 0);
      if (!isNaN(d.getTime())) {
        return {
          date: d,
          dateStr: `${mDateOnly[1]}-${mDateOnly[2]}-${mDateOnly[3]}`,
          timeStr: '12:00:00',
          source: 'filename',
        };
      }
    }
  }

  // 3. Fallback para lastModified do arquivo
  if (lastModified && typeof lastModified === 'number' && !isNaN(lastModified)) {
    const d = new Date(lastModified);
    if (!isNaN(d.getTime())) {
      const iso = d.toISOString();
      return {
        date: d,
        dateStr: iso.split('T')[0],
        timeStr: iso.split('T')[1].substring(0, 8),
        source: 'last_modified',
      };
    }
  }

  return null;
}

export interface TimeMatchResult {
  etapaId: string;
  numeroDia: number;
  coord: [number, number];
  altitude?: number;
  kmNoTrajeto: number;
  timeDiffMinutes: number;
  matchType: 'exact_time' | 'stage_start' | 'stage_end' | 'stage_fallback';
}

/**
 * Correlaciona a data e horário da foto com o trajeto GPX da etapa correspondente.
 */
export function findBestPointByDateTime(
  photoDate: Date,
  dateStr: string,
  etapas: {
    id: string;
    numero_dia: number;
    data?: string;
    geojson_rota?: any;
    geojson?: any;
    perfil_altimetria?: { km: number; altitude: number; lat: number; lon: number; time?: string }[];
  }[]
): TimeMatchResult | null {
  // 1. Encontrar etapa daquela data
  const etapa = etapas.find((e) => e.data === dateStr);
  if (!etapa) return null;

  const points = etapa.perfil_altimetria || [];
  const coords = etapa.geojson_rota?.geometry?.coordinates || etapa.geojson?.geometry?.coordinates || [];

  if (points.length === 0 && coords.length === 0) return null;

  // Filtrar pontos que possuem time
  const timedPoints = points.filter((p) => Boolean(p.time));

  if (timedPoints.length > 0) {
    const photoMs = photoDate.getTime();
    let bestPt = timedPoints[0];
    let minDiffMs = Infinity;

    for (const pt of timedPoints) {
      if (!pt.time) continue;
      const ptMs = new Date(pt.time).getTime();
      const diff = Math.abs(photoMs - ptMs);
      if (diff < minDiffMs) {
        minDiffMs = diff;
        bestPt = pt;
      }
    }

    const firstPt = timedPoints[0];
    const lastPt = timedPoints[timedPoints.length - 1];
    const firstMs = new Date(firstPt.time!).getTime();
    const lastMs = new Date(lastPt.time!).getTime();

    let matchType: TimeMatchResult['matchType'] = 'exact_time';
    if (photoMs < firstMs) {
      bestPt = firstPt;
      matchType = 'stage_start';
    } else if (photoMs > lastMs) {
      bestPt = lastPt;
      matchType = 'stage_end';
    }

    return {
      etapaId: etapa.id,
      numeroDia: etapa.numero_dia,
      coord: [bestPt.lon, bestPt.lat],
      altitude: bestPt.altitude,
      kmNoTrajeto: bestPt.km,
      timeDiffMinutes: Math.round(minDiffMs / (60 * 1000)),
      matchType,
    };
  }

  // Fallback se não houver pontos com time: usa o ponto final ou meio da etapa
  if (coords.length > 0) {
    const pt = coords[coords.length - 1];
    return {
      etapaId: etapa.id,
      numeroDia: etapa.numero_dia,
      coord: [pt[0], pt[1]],
      altitude: pt[2] || undefined,
      kmNoTrajeto: 0,
      timeDiffMinutes: 0,
      matchType: 'stage_fallback',
    };
  }

  return null;
}

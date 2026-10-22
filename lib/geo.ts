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
  etapas: { id: string; numero_dia: number; geojson_rota?: any }[],
  maxDistanceMeters: number = 25000 // 25 km de raio de tolerância para identificar etapa
): EtapaMatchResult | null {
  let bestMatch: EtapaMatchResult | null = null;
  let minDistance = Infinity;

  for (const etapa of etapas) {
    const coords = etapa.geojson_rota?.geometry?.coordinates;
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

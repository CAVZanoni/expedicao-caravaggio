import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import { Readable } from 'stream';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ filename: string }> }
) {
  try {
    const { filename } = await params;
    if (!filename) {
      return new NextResponse('Filename is required', { status: 400 });
    }

    // Prevenir Path Traversal
    const safeFilename = path.basename(filename);
    const searchParams = request.nextUrl.searchParams;
    const forceDownload = searchParams.get('download') === 'true';

    let targetPath: string | null = null;
    const rootDir = process.cwd();

    // 1. Procurar na pasta de WhatsApp
    const entries = fs.readdirSync(rootDir, { withFileTypes: true });
    const waDirEntry = entries.find((e) => e.isDirectory() && e.name.includes('WhatsApp'));
    if (waDirEntry) {
      const candidatePath = path.join(rootDir, waDirEntry.name, safeFilename);
      if (fs.existsSync(candidatePath)) {
        targetPath = candidatePath;
      }
    }

    // 2. Procurar na pasta de Thumbnails geradas (com o nome original ou formato .webp)
    if (!targetPath) {
      const thumbCandidate = path.join(rootDir, 'public', 'thumbnails', safeFilename);
      if (fs.existsSync(thumbCandidate)) {
        targetPath = thumbCandidate;
      } else {
        const baseWithoutExt = path.parse(safeFilename).name;
        const webpCandidate = path.join(rootDir, 'public', 'thumbnails', `${baseWithoutExt}.webp`);
        if (fs.existsSync(webpCandidate)) {
          targetPath = webpCandidate;
        }
      }
    }

    // 3. Procurar na pasta de Drone do OneDrive (percorrendo as etapas D1..D9)
    if (!targetPath) {
      const droneBaseDir =
        process.env.DRONE_VIDEOS_PATH ||
        path.join('C:', 'Users', 'cesar', 'OneDrive', 'DRONE', 'D_CARAVAGGIO');

      if (fs.existsSync(droneBaseDir)) {
        // Verificar diretamente na raiz do drone
        const rootCandidate = path.join(droneBaseDir, safeFilename);
        if (fs.existsSync(rootCandidate)) {
          targetPath = rootCandidate;
        } else {
          // Verificar em cada subpasta (ex: D1_20261009, D2_20261010, etc.)
          const subEntries = fs.readdirSync(droneBaseDir, { withFileTypes: true });
          for (const sub of subEntries) {
            if (sub.isDirectory()) {
              const subCandidate = path.join(droneBaseDir, sub.name, safeFilename);
              if (fs.existsSync(subCandidate)) {
                targetPath = subCandidate;
                break;
              }
            }
          }
        }
      }
    }

    if (!targetPath) {
      return new NextResponse('Arquivo não encontrado', { status: 404 });
    }

    const stat = fs.statSync(targetPath);
    const fileSize = stat.size;
    const ext = path.extname(safeFilename).toLowerCase();

    let contentType = 'application/octet-stream';
    if (ext === '.jpg' || ext === '.jpeg') contentType = 'image/jpeg';
    else if (ext === '.png') contentType = 'image/png';
    else if (ext === '.webp') contentType = 'image/webp';
    else if (ext === '.mp4') contentType = 'video/mp4';

    const range = request.headers.get('range');

    // Suporte a HTTP Range para streaming de vídeo (quando não for download forçado)
    if (range && !forceDownload && ext === '.mp4') {
      const parts = range.replace(/bytes=/, '').split('-');
      const start = parseInt(parts[0], 10);
      const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;

      if (start >= fileSize || end >= fileSize) {
        return new NextResponse('Requested range not satisfiable', {
          status: 416,
          headers: { 'Content-Range': `bytes */${fileSize}` },
        });
      }

      const chunkSize = end - start + 1;
      const fileStream = fs.createReadStream(targetPath, { start, end });
      const webStream = Readable.toWeb(fileStream);

      return new NextResponse(webStream as any, {
        status: 206,
        headers: {
          'Content-Range': `bytes ${start}-${end}/${fileSize}`,
          'Accept-Ranges': 'bytes',
          'Content-Length': chunkSize.toString(),
          'Content-Type': contentType,
        },
      });
    }

    // Streaming completo (para imagens e downloads diretos de arquivos grandes)
    const fileStream = fs.createReadStream(targetPath);
    const webStream = Readable.toWeb(fileStream);

    const disposition =
      forceDownload || ext === '.mp4'
        ? `attachment; filename="${safeFilename}"`
        : `inline; filename="${safeFilename}"`;

    return new NextResponse(webStream as any, {
      status: 200,
      headers: {
        'Content-Type': contentType,
        'Content-Length': fileSize.toString(),
        'Content-Disposition': disposition,
        'Accept-Ranges': 'bytes',
        'Cache-Control': 'public, max-age=31536000, immutable',
      },
    });
  } catch (error: any) {
    console.error('Erro ao servir mídia:', error);
    return new NextResponse('Erro interno ao ler arquivo', { status: 500 });
  }
}

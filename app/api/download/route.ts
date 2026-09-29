import { NextResponse } from 'next/server';
import path from 'path';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

function normalize(result: any) {
  if (!result || typeof result !== 'object') return result;
  const r = result.result;
  if (!r || typeof r !== 'object') return result;
  if (!Array.isArray(r.downloads)) {
    const candidate = r.download || r.url;
    if (typeof candidate === 'string') r.downloads = [{ url: candidate, type: r.type || 'media', quality: 'Download' }];
  }
  if (Array.isArray(r.downloads)) {
    r.downloads = r.downloads.filter((x: any) => x && typeof x.url === 'string').map((x: any, i: number) => ({
      ...x,
      id: `${i}-${x.quality || x.type || 'media'}`,
      quality: x.quality || (x.type === 'audio' || x.type === 'mp3' ? 'Audio' : 'Media'),
      type: x.type || 'media'
    }));
  }
  return result;
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const platform = String(body?.platform || '').toLowerCase();
    const url = String(body?.url || '').trim();
    const method = body?.method ? String(body.method) : undefined;
    if (!platform || !url) return NextResponse.json({ status:false, message:'Platform dan URL wajib diisi.' }, { status:400 });
    try { new URL(url); } catch { return NextResponse.json({ status:false, message:'URL tidak valid.' }, { status:400 }); }

    const scrapr = require(path.join(process.cwd(), 'lib/scrapr'));
    const methods = method ? [method] : (require(path.join(process.cwd(), 'lib/scrape-config')).SCRAPER_METHODS[platform] || []);
    if (!scrapr[platform]) return NextResponse.json({ status:false, message:`Platform ${platform} belum didukung.` }, { status:404 });

    let lastError = 'Semua metode scraper gagal.';
    for (const name of methods) {
      const fn = scrapr[platform]?.[name];
      if (typeof fn !== 'function') continue;
      try {
        const res = await Promise.race([
          fn(url),
          new Promise((_, reject) => setTimeout(() => reject(new Error('Scraper timeout')), 18000))
        ]);
        if ((res as any)?.status) return NextResponse.json(normalize(res));
        lastError = (res as any)?.message || lastError;
      } catch (e:any) { lastError = e?.message || lastError; }
    }
    return NextResponse.json({ status:false, message:lastError }, { status:502 });
  } catch (e:any) {
    return NextResponse.json({ status:false, message:e?.message || 'Terjadi kesalahan server.' }, { status:500 });
  }
}

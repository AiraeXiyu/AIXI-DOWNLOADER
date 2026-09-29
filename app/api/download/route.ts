import { NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

type DownloadItem = {
  id?: string;
  url: string;
  type?: string;
  quality?: string;
  thumbnail?: string;
  [key: string]: unknown;
};

type ScraperResult = {
  status?: boolean;
  message?: string;
  result?: {
    title?: string;
    thumbnail?: string;
    type?: string;
    author?: unknown;
    downloads?: DownloadItem[];
    download?: string;
    url?: string;
    [key: string]: unknown;
  };
  [key: string]: unknown;
};

function extractUrl(text: string) {
  const match = text.match(/https?:\/\/[^\s<>"']+/i);
  if (!match) return text.trim();

  return match[0]
    .replace(/[)\],.;!?]+$/g, '')
    .trim();
}

function isYoutubeVideo(url: string) {
  return (
    /(?:youtube\.com\/watch\?[^ ]*v=|youtu\.be\/|youtube\.com\/shorts\/|youtube\.com\/live\/)/i.test(
      url
    )
  );
}

function isYoutubePlaylist(url: string) {
  return /[?&]list=[^&\s]+/i.test(url);
}

function normalize(result: ScraperResult) {
  if (!result || typeof result !== 'object') {
    return result;
  }

  const data = result.result;

  if (!data || typeof data !== 'object') {
    return result;
  }

  if (!Array.isArray(data.downloads)) {
    const candidate = data.download || data.url;

    if (typeof candidate === 'string') {
      data.downloads = [
        {
          url: candidate,
          type: data.type || 'media',
          quality: 'Download'
        }
      ];
    }
  }

  if (Array.isArray(data.downloads)) {
    data.downloads = data.downloads
      .filter(
        (item): item is DownloadItem =>
          Boolean(item) &&
          typeof item === 'object' &&
          typeof item.url === 'string'
      )
      .map((item, index) => ({
        ...item,
        id: `${index}-${item.quality || item.type || 'media'}`,
        quality:
          item.quality ||
          (item.type === 'audio' || item.type === 'mp3'
            ? 'Audio'
            : item.type === 'image'
              ? 'Image'
              : 'Media'),
        type: item.type || 'media'
      }));
  }

  /*
   * Banyak scraper tidak menaruh thumbnail di result.thumbnail,
   * tetapi menaruhnya di masing-masing download item.
   */
  if (
    !data.thumbnail &&
    Array.isArray(data.downloads)
  ) {
    const firstWithThumbnail = data.downloads.find(
      (item) =>
        typeof item.thumbnail === 'string' &&
        item.thumbnail.length > 0
    );

    if (firstWithThumbnail?.thumbnail) {
      data.thumbnail = firstWithThumbnail.thumbnail;
    }
  }

  return result;
}

function getMethods(
  platform: string,
  config: Record<string, string[]>,
  url: string
) {
  const configured = config[platform] || [];

  if (platform !== 'youtube') {
    return configured;
  }

  /*
   * Jangan pernah kirim URL video ke scraper playlist.
   */
  if (isYoutubeVideo(url)) {
    return configured.filter((method) => method !== 'playlist');
  }

  /*
   * Kalau memang playlist, prioritaskan playlist.
   */
  if (isYoutubePlaylist(url)) {
    return configured.filter((method) => method === 'playlist');
  }

  /*
   * Bukan video maupun playlist.
   */
  return configured.filter((method) => method !== 'playlist');
}

export async function POST(req: Request) {
  try {
    const body = await req.json();

    const platform = String(body?.platform || '')
      .trim()
      .toLowerCase();

    let rawUrl = String(body?.url || '').trim();

    const requestedMethod = body?.method
      ? String(body.method).trim()
      : undefined;

    if (!platform || !rawUrl) {
      return NextResponse.json(
        {
          status: false,
          message: 'Platform dan URL wajib diisi.'
        },
        { status: 400 }
      );
    }

    /*
     * Douyin dan Bilibili sering memberikan teks panjang
     * ketika user menekan Share/Copy Link.
     *
     * Contoh:
     * "2.56 复制打开抖音... https://v.douyin.com/..."
     *
     * Kita ambil URL yang ada di dalam teks.
     */
    if (
      platform === 'douyin' ||
      platform === 'bilibili'
    ) {
      rawUrl = extractUrl(rawUrl);
    }

    try {
      new URL(rawUrl);
    } catch {
      return NextResponse.json(
        {
          status: false,
          message:
            'URL tidak valid. Paste link lengkap atau teks share yang mengandung URL.'
        },
        { status: 400 }
      );
    }

    /*
     * Local scraper.
     *
     * Jangan gunakan /var/task/lib/scrapr.
     */
    const scrapr = require('../../../lib/scrapr');
    const configModule = require('../../../lib/scrape-config');

    const config: Record<string, string[]> =
      configModule.SCRAPER_METHODS || {};

    let methods = getMethods(platform, config, rawUrl);

    if (requestedMethod) {
      methods = [requestedMethod];
    }

    if (!scrapr?.[platform]) {
      return NextResponse.json(
        {
          status: false,
          message: `Platform ${platform} belum didukung.`
        },
        { status: 404 }
      );
    }

    if (!methods.length) {
      return NextResponse.json(
        {
          status: false,
          message: `Belum ada metode scraper untuk ${platform}.`
        },
        { status: 404 }
      );
    }

    let lastError = 'Semua metode scraper gagal.';

    for (const methodName of methods) {
      const scraperFunction =
        scrapr?.[platform]?.[methodName];

      if (typeof scraperFunction !== 'function') {
        continue;
      }

      try {
        const result = await Promise.race([
          scraperFunction(rawUrl),

          new Promise<never>((_, reject) => {
            setTimeout(() => {
              reject(new Error('Scraper timeout'));
            }, 18000);
          })
        ]);

        const normalized = normalize(result);

        if (normalized?.status) {
          return NextResponse.json(normalized, {
            status: 200
          });
        }

        lastError =
          normalized?.message ||
          'Scraper tidak menghasilkan media.';
      } catch (error: unknown) {
        lastError =
          error instanceof Error
            ? error.message
            : 'Scraper gagal diproses.';
      }
    }

    return NextResponse.json(
      {
        status: false,
        message: lastError
      },
      { status: 502 }
    );
  } catch (error: unknown) {
    return NextResponse.json(
      {
        status: false,
        message:
          error instanceof Error
            ? error.message
            : 'Terjadi kesalahan server.'
      },
      { status: 500 }
    );
  }
}

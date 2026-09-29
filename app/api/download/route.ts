import { NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

type DownloadItem = {
  id?: string;
  url: string;
  type?: string;
  quality?: string;
  [key: string]: unknown;
};

type ScraperResult = {
  status?: boolean;
  message?: string;
  result?: {
    downloads?: DownloadItem[];
    download?: string;
    url?: string;
    type?: string;
    [key: string]: unknown;
  };
  [key: string]: unknown;
};

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
            : 'Media'),
        type: item.type || 'media'
      }));
  }

  return result;
}

export async function POST(req: Request) {
  try {
    const body = await req.json();

    const platform = String(body?.platform || '')
      .trim()
      .toLowerCase();

    const url = String(body?.url || '').trim();

    const requestedMethod = body?.method
      ? String(body.method).trim()
      : undefined;

    if (!platform || !url) {
      return NextResponse.json(
        {
          status: false,
          message: 'Platform dan URL wajib diisi.'
        },
        {
          status: 400
        }
      );
    }

    try {
      new URL(url);
    } catch {
      return NextResponse.json(
        {
          status: false,
          message: 'URL tidak valid.'
        },
        {
          status: 400
        }
      );
    }

    /*
     * IMPORTANT:
     * Gunakan path lokal project, bukan /var/task/lib/scrapr.
     *
     * File scraper berada di:
     * /lib/scrapr/index.js
     *
     * Karena route ini berada di:
     * /app/api/download/route.ts
     *
     * maka ../../../lib/scrapr
     * mengarah ke /lib/scrapr.
     */

    const scrapr = require('../../../lib/scrapr');

    const config = require('../../../lib/scrape-config');

    const methods: string[] = requestedMethod
      ? [requestedMethod]
      : config.SCRAPER_METHODS?.[platform] || [];

    if (!scrapr?.[platform]) {
      return NextResponse.json(
        {
          status: false,
          message: `Platform ${platform} belum didukung.`
        },
        {
          status: 404
        }
      );
    }

    if (!methods.length) {
      return NextResponse.json(
        {
          status: false,
          message: `Belum ada metode scraper untuk ${platform}.`
        },
        {
          status: 404
        }
      );
    }

    let lastError = 'Semua metode scraper gagal.';

    for (const methodName of methods) {
      const scraperFunction = scrapr?.[platform]?.[methodName];

      if (typeof scraperFunction !== 'function') {
        continue;
      }

      try {
        const result = await Promise.race([
          scraperFunction(url),

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
        if (error instanceof Error) {
          lastError = error.message;
        } else {
          lastError = 'Scraper gagal diproses.';
        }
      }
    }

    return NextResponse.json(
      {
        status: false,
        message: lastError
      },
      {
        status: 502
      }
    );
  } catch (error: unknown) {
    const message =
      error instanceof Error
        ? error.message
        : 'Terjadi kesalahan server.';

    return NextResponse.json(
      {
        status: false,
        message
      },
      {
        status: 500
      }
    );
  }
}

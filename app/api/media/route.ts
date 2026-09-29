import { NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

function getReferer(platform: string) {
  switch (platform) {
    case 'tiktok':
    case 'douyin':
      return 'https://www.tiktok.com/';

    case 'instagram':
      return 'https://www.instagram.com/';

    case 'youtube':
      return 'https://www.youtube.com/';

    case 'twitter':
      return 'https://x.com/';

    case 'facebook':
      return 'https://www.facebook.com/';

    case 'pinterest':
      return 'https://www.pinterest.com/';

    case 'bilibili':
      return 'https://www.bilibili.com/';

    case 'reddit':
      return 'https://www.reddit.com/';

    case 'spotify':
      return 'https://open.spotify.com/';

    default:
      return undefined;
  }
}

function safeFilename(value: string) {
  return value
    .replace(/[^a-zA-Z0-9._-]+/g, '_')
    .slice(0, 80);
}

export async function GET(req: Request) {
  try {
    const requestUrl = new URL(req.url);

    const mediaUrl = requestUrl.searchParams.get('url');
    const platform =
      requestUrl.searchParams.get('platform') || '';
    const download =
      requestUrl.searchParams.get('download') === '1';
    const filename =
      requestUrl.searchParams.get('filename') ||
      'aixi-download';

    if (!mediaUrl) {
      return NextResponse.json(
        {
          status: false,
          message: 'Media URL tidak ditemukan.'
        },
        { status: 400 }
      );
    }

    let target: URL;

    try {
      target = new URL(mediaUrl);
    } catch {
      return NextResponse.json(
        {
          status: false,
          message: 'Media URL tidak valid.'
        },
        { status: 400 }
      );
    }

    if (!['http:', 'https:'].includes(target.protocol)) {
      return NextResponse.json(
        {
          status: false,
          message: 'Protocol media tidak didukung.'
        },
        { status: 400 }
      );
    }

    const referer = getReferer(platform);

    const headers: HeadersInit = {
      'User-Agent':
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/131.0.0.0 Safari/537.36',
      Accept:
        'video/*,audio/*,image/*,application/octet-stream,*/*'
    };

    if (referer) {
      headers.Referer = referer;
    }

    /*
     * Kalau browser mengirim Range, teruskan.
     * Ini membantu video/media besar.
     */
    const range = req.headers.get('range');

    if (range) {
      headers.Range = range;
    }

    let response = await fetch(target.toString(), {
      headers,
      redirect: 'follow',
      cache: 'no-store'
    });

    /*
     * Retry tanpa Referer.
     * Beberapa CDN justru menolak request yang punya referer.
     */
    if (!response.ok && referer) {
      const retryHeaders: HeadersInit = {
        'User-Agent': headers['User-Agent'],
        Accept: headers.Accept
      };

      if (range) {
        retryHeaders.Range = range;
      }

      response = await fetch(target.toString(), {
        headers: retryHeaders,
        redirect: 'follow',
        cache: 'no-store'
      });
    }

    if (!response.ok) {
      return NextResponse.json(
        {
          status: false,
          message: `Media server mengembalikan HTTP ${response.status}.`
        },
        { status: 502 }
      );
    }

    const contentType =
      response.headers.get('content-type') ||
      'application/octet-stream';

    const responseHeaders = new Headers();

    responseHeaders.set(
      'Content-Type',
      contentType
    );

    const contentLength =
      response.headers.get('content-length');

    if (contentLength) {
      responseHeaders.set(
        'Content-Length',
        contentLength
      );
    }

    const contentRange =
      response.headers.get('content-range');

    if (contentRange) {
      responseHeaders.set(
        'Content-Range',
        contentRange
      );
    }

    responseHeaders.set(
      'Accept-Ranges',
      'bytes'
    );

    responseHeaders.set(
      'Cache-Control',
      'no-store, max-age=0'
    );

    if (download) {
      const cleanName = safeFilename(filename);

      responseHeaders.set(
        'Content-Disposition',
        `attachment; filename="${cleanName}"`
      );
    }

    return new Response(
      response.body,
      {
        status: response.status,
        headers: responseHeaders
      }
    );
  } catch (error: unknown) {
    return NextResponse.json(
      {
        status: false,
        message:
          error instanceof Error
            ? error.message
            : 'Gagal mengambil media.'
      },
      { status: 500 }
    );
  }
}

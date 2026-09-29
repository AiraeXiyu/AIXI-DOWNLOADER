import { NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

function safeFilename(value: string) {
  return value
    .replace(/[^a-zA-Z0-9._-]+/g, '_')
    .slice(0, 100);
}

function getHeaders(
  platform: string,
  range?: string | null
): HeadersInit {
  const headers: HeadersInit = {
    'User-Agent':
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',

    Accept:
      'video/*,audio/*,image/*,application/octet-stream,*/*',

    'Accept-Language':
      'en-US,en;q=0.9',

    Connection: 'keep-alive'
  };

  switch (platform) {
    case 'tiktok':
      headers.Referer =
        'https://www.tiktok.com/';
      headers.Origin =
        'https://www.tiktok.com/';
      break;

    case 'douyin':
      headers.Referer =
        'https://www.douyin.com/';
      headers.Origin =
        'https://www.douyin.com/';
      break;

    case 'instagram':
      headers.Referer =
        'https://www.instagram.com/';
      headers.Origin =
        'https://www.instagram.com/';
      break;

    case 'youtube':
      headers.Referer =
        'https://www.youtube.com/';
      headers.Origin =
        'https://www.youtube.com/';
      break;

    case 'bilibili':
      headers.Referer =
        'https://www.bilibili.com/';
      headers.Origin =
        'https://www.bilibili.com/';
      break;

    case 'twitter':
      headers.Referer =
        'https://x.com/';
      headers.Origin =
        'https://x.com/';
      break;

    default:
      break;
  }

  if (range) {
    headers.Range = range;
  }

  return headers;
}

async function fetchMedia(
  target: string,
  platform: string,
  range?: string | null
) {
  const headers =
    getHeaders(platform, range);

  return fetch(target, {
    method: 'GET',
    headers,
    redirect: 'follow',
    cache: 'no-store'
  });
}

export async function GET(req: Request) {
  try {
    const requestUrl =
      new URL(req.url);

    const mediaUrl =
      requestUrl.searchParams.get(
        'url'
      );

    const platform =
      requestUrl.searchParams
        .get('platform')
        ?.toLowerCase() || '';

    const filename =
      requestUrl.searchParams.get(
        'filename'
      ) || 'aixi-download';

    const forceDownload =
      requestUrl.searchParams.get(
        'download'
      ) === '1';

    if (!mediaUrl) {
      return NextResponse.json(
        {
          status: false,
          message:
            'Media URL tidak ditemukan.'
        },
        { status: 400 }
      );
    }

    let target: URL;

    try {
      target =
        new URL(mediaUrl);
    } catch {
      return NextResponse.json(
        {
          status: false,
          message:
            'Media URL tidak valid.'
        },
        { status: 400 }
      );
    }

    if (
      !['http:', 'https:'].includes(
        target.protocol
      )
    ) {
      return NextResponse.json(
        {
          status: false,
          message:
            'Protocol media tidak didukung.'
        },
        { status: 400 }
      );
    }

    const range =
      req.headers.get('range');

    /*
     * Request pertama.
     */
    let upstream =
      await fetchMedia(
        target.toString(),
        platform,
        range
      );

    /*
     * TikTok CDN kadang lebih sensitif
     * terhadap header tertentu.
     *
     * Retry dengan header minimal.
     */
    if (
      !upstream.ok &&
      platform === 'tiktok'
    ) {
      upstream = await fetch(
        target.toString(),
        {
          method: 'GET',
          headers: {
            'User-Agent':
              'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 Version/17.0 Mobile/15E148 Safari/604.1',

            Accept:
              '*/*',

            Referer:
              'https://www.tiktok.com/'
          },

          redirect: 'follow',
          cache: 'no-store'
        }
      );
    }

    /*
     * Retry terakhir tanpa referer.
     */
    if (!upstream.ok) {
      const fallbackHeaders: HeadersInit = {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',

        Accept: '*/*'
      };

      if (range) {
        fallbackHeaders.Range =
          range;
      }

      upstream = await fetch(
        target.toString(),
        {
          method: 'GET',
          headers:
            fallbackHeaders,
          redirect: 'follow',
          cache: 'no-store'
        }
      );
    }

    if (!upstream.ok) {
      return NextResponse.json(
        {
          status: false,
          message:
            `Media server mengembalikan HTTP ${upstream.status}.`
        },
        { status: 502 }
      );
    }

    const headers =
      new Headers();

    const contentType =
      upstream.headers.get(
        'content-type'
      );

    const contentLength =
      upstream.headers.get(
        'content-length'
      );

    const contentRange =
      upstream.headers.get(
        'content-range'
      );

    if (contentType) {
      headers.set(
        'Content-Type',
        contentType
      );
    } else {
      headers.set(
        'Content-Type',
        'application/octet-stream'
      );
    }

    if (contentLength) {
      headers.set(
        'Content-Length',
        contentLength
      );
    }

    if (contentRange) {
      headers.set(
        'Content-Range',
        contentRange
      );
    }

    headers.set(
      'Accept-Ranges',
      'bytes'
    );

    headers.set(
      'Cache-Control',
      'no-store, max-age=0'
    );

    if (forceDownload) {
      const cleanName =
        safeFilename(filename);

      headers.set(
        'Content-Disposition',
        `attachment; filename="${cleanName}"`
      );
    }

    return new Response(
      upstream.body,
      {
        status:
          upstream.status,
        headers
      }
    );
  } catch (error) {
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

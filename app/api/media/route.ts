import { NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

function safeFilename(value: string) {
  return value
    .replace(/[^a-zA-Z0-9._-]+/g, '_')
    .slice(0, 100);
}

function getBaseHeaders(
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

    'Cache-Control':
      'no-cache',

    Pragma:
      'no-cache'
  };

  switch (platform) {
    case 'tiktok':
      headers.Referer =
        'https://www.tiktok.com/';
      headers.Origin =
        'https://www.tiktok.com';
      break;

    case 'douyin':
      headers.Referer =
        'https://www.douyin.com/';
      headers.Origin =
        'https://www.douyin.com';
      break;

    case 'instagram':
      /*
       * Jangan memaksa Origin untuk Instagram CDN.
       *
       * Signed CDN URL Instagram dapat menolak request
       * apabila Origin/Referer tidak sesuai dengan
       * request yang digunakan ketika URL dibuat.
       */
      headers.Referer =
        'https://www.instagram.com/';
      break;

    case 'youtube':
      headers.Referer =
        'https://www.youtube.com/';
      headers.Origin =
        'https://www.youtube.com';
      break;

    case 'bilibili':
      headers.Referer =
        'https://www.bilibili.com/';
      headers.Origin =
        'https://www.bilibili.com';
      break;

    case 'twitter':
      headers.Referer =
        'https://x.com/';
      headers.Origin =
        'https://x.com';
      break;

    default:
      break;
  }

  if (range) {
    headers.Range = range;
  }

  return headers;
}

function getInstagramHeaders(
  mode: 'instagram' | 'cdn' | 'minimal',
  range?: string | null
): HeadersInit {
  const headers: HeadersInit = {
    'User-Agent':
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',

    Accept:
      '*/*'
  };

  /*
   * Request normal dari halaman Instagram.
   */
  if (mode === 'instagram') {
    headers.Referer =
      'https://www.instagram.com/';

    headers['Accept-Language'] =
      'en-US,en;q=0.9';
  }

  /*
   * CDN mode:
   *
   * Jangan mengirim Origin.
   * Jangan menambahkan header yang tidak diperlukan
   * oleh signed media URL.
   */
  if (mode === 'cdn') {
    headers['Accept-Language'] =
      'en-US,en;q=0.9';

    headers['Sec-Fetch-Dest'] =
      'video';

    headers['Sec-Fetch-Mode'] =
      'no-cors';
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
  return fetch(target, {
    method: 'GET',

    headers:
      platform === 'instagram'
        ? getInstagramHeaders(
            'instagram',
            range
          )
        : getBaseHeaders(
            platform,
            range
          ),

    redirect: 'follow',

    cache: 'no-store'
  });
}

async function fetchInstagram(
  target: string,
  range?: string | null
) {
  /*
   * Attempt 1:
   * Request dengan Referer Instagram.
   */
  let response = await fetch(
    target,
    {
      method: 'GET',

      headers:
        getInstagramHeaders(
          'instagram',
          range
        ),

      redirect: 'follow',

      cache: 'no-store'
    }
  );

  if (response.ok) {
    return response;
  }

  /*
   * Attempt 2:
   *
   * Signed CDN URL sering justru tidak membutuhkan
   * Referer sama sekali.
   */
  response = await fetch(
    target,
    {
      method: 'GET',

      headers:
        getInstagramHeaders(
          'cdn',
          range
        ),

      redirect: 'follow',

      cache: 'no-store'
    }
  );

  if (response.ok) {
    return response;
  }

  /*
   * Attempt 3:
   *
   * Header seminimal mungkin.
   *
   * Ini penting untuk signed URL karena kita tidak
   * menambahkan Origin, Referer, Cookie, atau header
   * lain yang dapat mengubah cara CDN memvalidasi request.
   */
  const minimalHeaders: HeadersInit = {
    'User-Agent':
      'Mozilla/5.0',

    Accept:
      '*/*'
  };

  if (range) {
    minimalHeaders.Range =
      range;
  }

  response = await fetch(
    target,
    {
      method: 'GET',

      headers:
        minimalHeaders,

      redirect: 'follow',

      cache: 'no-store'
    }
  );

  return response;
}

async function fetchTikTokFallback(
  target: string,
  range?: string | null
) {
  const headers: HeadersInit = {
    'User-Agent':
      'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 Version/17.0 Mobile/15E148 Safari/604.1',

    Accept:
      '*/*',

    Referer:
      'https://www.tiktok.com/'
  };

  if (range) {
    headers.Range =
      range;
  }

  return fetch(
    target,
    {
      method: 'GET',
      headers,
      redirect: 'follow',
      cache: 'no-store'
    }
  );
}

export async function GET(
  req: Request
) {
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
      ) ||
      'aixi-download';

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
        {
          status: 400
        }
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
        {
          status: 400
        }
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
        {
          status: 400
        }
      );
    }

    const range =
      req.headers.get('range');

    let upstream: Response;

    /*
     * ============================
     * INSTAGRAM
     * ============================
     */
    if (platform === 'instagram') {
      upstream =
        await fetchInstagram(
          target.toString(),
          range
        );
    } else {
      /*
       * ============================
       * PLATFORM LAIN
       * ============================
       */
      upstream =
        await fetchMedia(
          target.toString(),
          platform,
          range
        );

      /*
       * TikTok fallback.
       */
      if (
        !upstream.ok &&
        platform === 'tiktok'
      ) {
        upstream =
          await fetchTikTokFallback(
            target.toString(),
            range
          );
      }

      /*
       * Generic fallback tanpa Referer/Origin.
       */
      if (
        !upstream.ok
      ) {
        const fallbackHeaders:
          HeadersInit = {
            'User-Agent':
              'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',

            Accept:
              '*/*'
          };

        if (range) {
          fallbackHeaders.Range =
            range;
        }

        upstream =
          await fetch(
            target.toString(),
            {
              method: 'GET',
              headers:
                fallbackHeaders,
              redirect:
                'follow',
              cache:
                'no-store'
            }
          );
      }
    }

    /*
     * Semua percobaan gagal.
     */
    if (!upstream.ok) {
      let detail =
        '';

      /*
       * Jangan membaca body terlalu agresif,
       * karena beberapa CDN mengembalikan HTML
       * yang besar.
       */
      try {
        const contentType =
          upstream.headers.get(
            'content-type'
          ) || '';

        if (
          contentType.includes(
            'text/'
          ) ||
          contentType.includes(
            'json'
          )
        ) {
          const text =
            await upstream.text();

          detail =
            text
              .replace(/\s+/g, ' ')
              .slice(0, 180);
        }
      } catch {
        // ignore
      }

      return NextResponse.json(
        {
          status: false,
          message:
            platform ===
            'instagram'
              ? `Media Instagram mengembalikan HTTP ${upstream.status}. URL media kemungkinan sudah expired atau ditolak CDN.${detail ? ` Detail: ${detail}` : ''}`
              : `Media server mengembalikan HTTP ${upstream.status}.${detail ? ` Detail: ${detail}` : ''}`
        },
        {
          status: 502
        }
      );
    }

    /*
     * ============================
     * RESPONSE HEADERS
     * ============================
     */

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

    const etag =
      upstream.headers.get(
        'etag'
      );

    const lastModified =
      upstream.headers.get(
        'last-modified'
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

    if (etag) {
      headers.set(
        'ETag',
        etag
      );
    }

    if (lastModified) {
      headers.set(
        'Last-Modified',
        lastModified
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

    /*
     * Browser harus menerima response
     * sebagai attachment ketika tombol
     * Download digunakan.
     */
    if (forceDownload) {
      const cleanName =
        safeFilename(
          filename
        );

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
      {
        status: 500
      }
    );
  }
}

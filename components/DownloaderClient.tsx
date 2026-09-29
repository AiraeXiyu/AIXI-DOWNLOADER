'use client';

import { useMemo, useState } from 'react';
import type { Platform } from '../lib/platforms';

type DownloadItem = {
  id?: string;
  url: string;
  type?: string;
  quality?: string;
  thumbnail?: string;
};

export default function DownloaderClient({
  platform
}: {
  platform: Platform;
}) {
  const [url, setUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<any>(null);
  const [error, setError] = useState('');
  const [selected, setSelected] = useState(0);

  const downloads: DownloadItem[] = useMemo(
    () => data?.result?.downloads || [],
    [data]
  );

  /*
   * TikTok:
   * Hanya gunakan download pertama.
   */
  const isTikTok =
    platform.slug.toLowerCase() === 'tiktok';

  /*
   * Instagram:
   * URL hasil scraper biasanya merupakan URL CDN
   * yang sudah memiliki token/signature sendiri.
   *
   * Jangan lewat /api/media karena proxy Vercel
   * dapat menyebabkan CDN membalas HTTP 403.
   */
  const isInstagram =
    platform.slug.toLowerCase() === 'instagram';

  const usableDownloads: DownloadItem[] =
    isTikTok
      ? downloads.slice(0, 1)
      : downloads;

  async function analyze() {
    setError('');
    setData(null);
    setSelected(0);

    if (!url.trim()) {
      setError('Masukkan URL terlebih dahulu.');
      return;
    }

    setLoading(true);

    try {
      const res = await fetch('/api/download', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          platform: platform.slug,
          url: url.trim()
        })
      });

      let json: any = null;

      try {
        json = await res.json();
      } catch {
        throw new Error(
          'Server mengembalikan response yang tidak valid.'
        );
      }

      if (!res.ok || !json.status) {
        throw new Error(
          json.message ||
            'Media tidak ditemukan.'
        );
      }

      setData(json);
    } catch (e: any) {
      setError(
        e?.message ||
          'Gagal menganalisis URL.'
      );
    } finally {
      setLoading(false);
    }
  }

  function buildMediaProxy(
    mediaUrl: string,
    options?: {
      download?: boolean;
      filename?: string;
    }
  ) {
    /*
     * INSTAGRAM
     *
     * Jangan proxy melalui /api/media.
     *
     * URL Instagram dari scraper bisa berupa
     * signed CDN URL. Kalau URL tersebut diambil
     * ulang oleh server Vercel, CDN bisa membalas
     * HTTP 403.
     *
     * Untuk Instagram, gunakan URL asli.
     */
    if (isInstagram) {
      return mediaUrl;
    }

    const params = new URLSearchParams();

    params.set(
      'url',
      mediaUrl
    );

    params.set(
      'platform',
      platform.slug
    );

    if (options?.download) {
      params.set(
        'download',
        '1'
      );
    }

    if (options?.filename) {
      params.set(
        'filename',
        options.filename
      );
    }

    return `/api/media?${params.toString()}`;
  }

  const mediaTitle =
    data?.result?.title ||
    `${platform.name} Media`;

  /*
   * Thumbnail utama.
   */
  const rawThumbnail =
    data?.result?.thumbnail ||
    downloads.find(
      (item) =>
        typeof item.thumbnail === 'string' &&
        item.thumbnail.length > 0
    )?.thumbnail ||
    '';

  const selectedDownload =
    usableDownloads[selected];

  const downloadUrl =
    selectedDownload?.url
      ? buildMediaProxy(
          selectedDownload.url,
          {
            download: true,
            filename:
              `${platform.slug}-${selected + 1}.${getExtension(
                selectedDownload
              )}`
          }
        )
      : '';

  return (
    <main className="platform-page">
      <header className="topbar">
        <a
          href="/"
          className="back"
        >
          ‹
        </a>

        <div className="top-title">
          <span
            className="mini-icon"
            style={{
              background:
                platform.accent
            }}
          >
            {platform.icon}
          </span>

          <div>
            <b>{platform.name}</b>
            <small>Downloader</small>
          </div>
        </div>

        <button
          className="icon-button"
          onClick={() =>
            window.scrollTo({
              top: 0,
              behavior: 'smooth'
            })
          }
          aria-label="Menu"
        >
          ☰
        </button>
      </header>

      <section className="platform-hero">
        <div className="hero-photo small">
          <img
            src="/hero.jpg"
            alt="AIXI Downloader"
          />
        </div>

        <div className="hero-copy">
          <span className="eyebrow">
            AIXI DOWNLOADER
          </span>

          <h1>
            {platform.name}{' '}
            <em>♡</em>
          </h1>

          <p>
            {platform.description}{' '}
            Cepat, rapi dan mobile-first.
          </p>
        </div>
      </section>

      <section className="card input-card">
        <label>
          Link {platform.name}
        </label>

        <div className="url-row">
          <input
            value={url}
            onChange={(e) =>
              setUrl(e.target.value)
            }
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                analyze();
              }
            }}
            placeholder={
              platform.placeholder
            }
            autoComplete="off"
          />

          {url && (
            <button
              onClick={() => {
                setUrl('');
                setError('');
              }}
              aria-label="Clear"
            >
              ×
            </button>
          )}
        </div>

        <button
          className="primary-btn"
          onClick={analyze}
          disabled={loading}
        >
          {loading ? (
            <>
              <span className="spinner" />
              Menganalisis...
            </>
          ) : (
            <>
              Analisis{' '}
              <span>→</span>
            </>
          )}
        </button>

        {error && (
          <div className="error">
            {error}
          </div>
        )}
      </section>

      <section className="feature-grid">
        {platform.features.map(
          (feature, index) => (
            <div
              className="feature"
              key={feature}
            >
              <span>
                {['✦', '▣', '♫', '♡'][
                  index % 4
                ]}
              </span>

              {feature}
            </div>
          )
        )}
      </section>

      {data && (
        <section className="result-card card">
          <div className="media-preview">
            {rawThumbnail ? (
              <img
                src={buildMediaProxy(
                  rawThumbnail
                )}
                alt="Thumbnail"
                onError={(event) => {
                  const target =
                    event.currentTarget;

                  target.style.display =
                    'none';

                  const parent =
                    target.parentElement;

                  if (parent) {
                    parent.classList.add(
                      'thumbnail-failed'
                    );
                  }
                }}
              />
            ) : (
              <div className="no-thumb">
                AIXI
              </div>
            )}

            <div className="preview-badge">
              {data.result?.type ||
                'MEDIA'}
            </div>
          </div>

          <div className="result-meta">
            <h2>
              {mediaTitle}
            </h2>

            <p>
              {getAuthor(
                data?.result?.author
              )}
            </p>
          </div>

          {isTikTok ? (
            <>
              <div className="quality-head">
                <b>
                  TikTok HD
                </b>

                <span>
                  1 opsi
                </span>
              </div>

              {usableDownloads.length > 0 ? (
                <div className="download-list">
                  <div
                    className="download-option selected"
                  >
                    <span className="radio-dot" />

                    <span>
                      <b>
                        HD
                      </b>

                      <small>
                        Video
                      </small>
                    </span>

                    <strong>
                      ✓
                    </strong>
                  </div>
                </div>
              ) : (
                <div className="error">
                  Tidak ada pilihan download.
                </div>
              )}
            </>
          ) : (
            <>
              <div className="quality-head">
                <b>
                  Pilih kualitas
                </b>

                <span>
                  {usableDownloads.length}{' '}
                  opsi
                </span>
              </div>

              {usableDownloads.length > 0 ? (
                <div className="download-list">
                  {usableDownloads.map(
                    (
                      download,
                      index
                    ) => (
                      <button
                        type="button"
                        className={`download-option ${
                          selected === index
                            ? 'selected'
                            : ''
                        }`}
                        key={
                          download.id ||
                          `${index}-${download.url}`
                        }
                        onClick={() =>
                          setSelected(
                            index
                          )
                        }
                      >
                        <span className="radio-dot" />

                        <span>
                          <b>
                            {download.quality ||
                              `Download ${
                                index + 1
                              }`}
                          </b>

                          <small>
                            {download.type ||
                              'media'}
                          </small>
                        </span>

                        <strong>
                          {selected ===
                          index
                            ? '✓'
                            : '○'}
                        </strong>
                      </button>
                    )
                  )}
                </div>
              ) : (
                <div className="error">
                  Tidak ada pilihan download.
                </div>
              )}
            </>
          )}

          {downloadUrl && (
            <a
              className="primary-btn download-now"
              href={downloadUrl}
              target="_blank"
              rel="noopener noreferrer"
              download={
                isInstagram
                  ? true
                  : undefined
              }
            >
              {isTikTok
                ? 'Download HD ↓'
                : 'Download Sekarang ↓'}
            </a>
          )}
        </section>
      )}

      <p className="tiny-note">
        Gunakan hanya untuk media yang
        boleh Anda unduh dan simpan.
      </p>

      <BottomNav />
    </main>
  );
}

function getAuthor(
  author: any
) {
  if (!author) {
    return 'Media siap diunduh';
  }

  if (typeof author === 'string') {
    return author;
  }

  return (
    author.name ||
    author.username ||
    'Media siap diunduh'
  );
}

function getExtension(
  item: DownloadItem
) {
  const type =
    String(
      item.type || ''
    ).toLowerCase();

  if (
    type.includes('audio') ||
    type.includes('mp3')
  ) {
    return 'mp3';
  }

  if (
    type.includes('image') ||
    type.includes('photo')
  ) {
    return 'jpg';
  }

  return 'mp4';
}

function BottomNav() {
  return (
    <nav className="bottom-nav">
      <a
        href="/"
        className="active"
      >
        <span>⌂</span>
        Home
      </a>

      <a href="#">
        <span>♡</span>
        Favorite
      </a>

      <a href="#">
        <span>ⓘ</span>
        Tutorial
      </a>
    </nav>
  );
}

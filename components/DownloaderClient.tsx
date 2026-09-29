'use client';

import { useMemo, useState } from 'react';
import type { Platform } from '../lib/platforms';

export default function DownloaderClient({ platform }: { platform: Platform }) {
  const [url, setUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<any>(null);
  const [error, setError] = useState('');
  const [method, setMethod] = useState('');
  const [selected, setSelected] = useState(0);
  const downloads = useMemo(() => data?.result?.downloads || [], [data]);

  async function analyze() {
    setError(''); setData(null);
    if (!url.trim()) { setError('Masukkan URL terlebih dahulu.'); return; }
    setLoading(true);
    try {
      const res = await fetch('/api/download', { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({ platform:platform.slug, url, ...(method ? {method}: {}) }) });
      const json = await res.json();
      if (!json.status) throw new Error(json.message || 'Media tidak ditemukan.');
      setData(json);
      setSelected(0);
    } catch (e:any) { setError(e?.message || 'Gagal menganalisis URL.'); }
    finally { setLoading(false); }
  }

  const mediaTitle = data?.result?.title || `${platform.name} Media`;
  const thumb = data?.result?.thumbnail;

  return <main className="platform-page">
    <header className="topbar">
      <a href="/" className="back">‹</a>
      <div className="top-title"><span className="mini-icon" style={{background:platform.accent}}>{platform.icon}</span><div><b>{platform.name}</b><small>Downloader</small></div></div>
      <button className="icon-button" onClick={() => window.scrollTo({top:0,behavior:'smooth'})}>☰</button>
    </header>

    <section className="platform-hero">
      <div className="hero-photo small"><img src="/hero.jpg" alt="AIXI" /></div>
      <div className="hero-copy"><span className="eyebrow">AIXI DOWNLOADER</span><h1>{platform.name} <em>♡</em></h1><p>{platform.description} Cepat, rapi dan mobile-first.</p></div>
    </section>

    <section className="card input-card">
      <label>Link {platform.name}</label>
      <div className="url-row"><input value={url} onChange={e=>setUrl(e.target.value)} onKeyDown={e=>e.key==='Enter'&&analyze()} placeholder={platform.placeholder}/><button onClick={()=>setUrl('')} aria-label="Clear">×</button></div>
      {method && <div className="method-chip">Engine: {method}</div>}
      <button className="primary-btn" onClick={analyze} disabled={loading}>{loading ? <><span className="spinner"/> Menganalisis...</> : <>Analisis <span>→</span></>}</button>
      {error && <div className="error">{error}</div>}
    </section>

    <section className="feature-grid">
      {platform.features.map((f,i)=><div className="feature" key={f}><span>{['✦','▣','♫','♡'][i%4]}</span>{f}</div>)}
    </section>

    {data && <section className="result-card card">
      <div className="media-preview">{thumb ? <img src={thumb} alt="Thumbnail"/> : <div className="no-thumb">AIXI</div>}<div className="preview-badge">{data.result?.type || 'MEDIA'}</div></div>
      <div className="result-meta"><h2>{mediaTitle}</h2><p>{data.result?.author?.name || data.result?.author?.username || 'Media siap diunduh'}</p></div>
      <div className="quality-head"><b>Pilih kualitas</b><span>{downloads.length} opsi</span></div>
      <div className="download-list">{downloads.map((d:any,i:number)=><button type="button" className={`download-option ${selected===i ? 'selected' : ''}`} key={d.id || i} onClick={()=>setSelected(i)}><span className="radio-dot"/><span><b>{d.quality || 'Download'}</b><small>{d.type || 'media'}</small></span><strong>{selected===i ? '✓' : '○'}</strong></button>)}</div>
      {downloads[selected]?.url && <a className="primary-btn download-now" href={downloads[selected].url} target="_blank" rel="noreferrer">Download Sekarang ↓</a>}
    </section>}

    <p className="tiny-note">Gunakan hanya untuk media yang boleh Anda unduh dan simpan.</p>
    <BottomNav />
  </main>
}

function BottomNav(){return <nav className="bottom-nav"><a href="/" className="active"><span>⌂</span>Home</a><a href="#"><span>♡</span>Favorite</a><a href="#"><span>ⓘ</span>Tutorial</a></nav>}

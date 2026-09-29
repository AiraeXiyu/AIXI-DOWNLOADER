import Image from 'next/image';
import { platforms } from '../lib/platforms';

export default function Home() {
  return (
    <main className="home-page">
      <header className="home-top">
        <div className="brand">
          <span>♕</span>

          <div>
            <b>AIXI DOWNLOADER</b>
            <small>Fast · Secure · No watermark</small>
          </div>
        </div>

        <button className="icon-button">
          ☰
        </button>
      </header>

      <section className="welcome">
        <div>
          <span className="eyebrow">
            WELCOME TO AIXI
          </span>

          <h1>
            Download media
            <br />
            <em>lebih mudah.</em>
          </h1>

          <p>
            Pilih platform yang kamu gunakan,
            tempel link, lalu download dengan
            beberapa ketukan.
          </p>
        </div>
      </section>

      <section className="hero-home">
        <Image
          src="/hero.jpg"
          alt="AIXI Downloader"
          fill
          priority
          sizes="(max-width: 700px) 100vw, 700px"
        />

        <div className="hero-overlay" />

        <div className="hero-text">
          <span>AIXI ♡</span>

          <b>
            Download Media
            <br />
            from Social Media
          </b>

          <small>
            Mudah · Cepat · Mobile First
          </small>
        </div>
      </section>

      <section className="platform-section">
        <div className="section-title">
          <div>
            <span className="eyebrow">
              CHOOSE PLATFORM
            </span>

            <h2>
              Mau download dari mana?
            </h2>
          </div>

          <span className="count">
            {platforms.length}
          </span>
        </div>

        <div className="platform-grid">
          {platforms.map((p) => (
            <a
              className="platform-card"
              key={p.slug}
              href={`/${p.slug}`}
            >
              <span
                className="platform-icon"
                style={{
                  background: p.accent,
                }}
              >
                {p.icon}
              </span>

              <span>
                <b>{p.name}</b>

                <small>
                  {p.features
                    .slice(0, 2)
                    .join(' · ')}
                </small>
              </span>

              <i>›</i>
            </a>
          ))}
        </div>
      </section>

      <section className="tip-card">
        <span>♕</span>

        <div>
          <b>
            Download cepat, kualitas terbaik
          </b>

          <p>
            Semua halaman dibuat khusus untuk
            pengalaman mobile yang nyaman.
          </p>
        </div>

        <span>›</span>
      </section>

      <footer>
        AIXI DOWNLOADER · Made with ♡ for you
      </footer>

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
    </main>
  );
}

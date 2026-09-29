import './globals.css';

export const metadata = {
  title: 'AIXI Downloader',
  description: 'Download media from social platforms with a clean mobile-first experience.'
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return <html lang="id"><body>{children}</body></html>;
}

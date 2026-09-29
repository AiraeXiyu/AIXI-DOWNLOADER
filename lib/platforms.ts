export type Platform = {
  slug: string;
  name: string;
  icon: string;
  accent: string;
  description: string;
  placeholder: string;
  features: string[];
};

export const platforms: Platform[] = [
  {
    slug: 'tiktok',
    name: 'TikTok',
    icon: '♪',
    accent: '#ff4bb8',
    description: 'Video pendek, HD dan audio.',
    placeholder: 'Paste link TikTok di sini...',
    features: ['Tanpa watermark', 'HD', 'MP3'],
  },

  {
    slug: 'instagram',
    name: 'Instagram',
    icon: '◎',
    accent: '#e945a8',
    description: 'Reels, video, foto dan carousel.',
    placeholder: 'Paste link Instagram di sini...',
    features: ['Reels', 'Video', 'Foto', 'Carousel'],
  },

  {
    slug: 'youtube',
    name: 'YouTube - Perbaikan',
    icon: '▶',
    accent: '#ff4d7d',
    description: 'Video dan audio dari YouTube.',
    placeholder: 'Paste link YouTube di sini...',
    features: ['Video', 'MP3', 'Playlist'],
  },

  {
    slug: 'twitter',
    name: 'X / Twitter',
    icon: '𝕏',
    accent: '#d9d8ff',
    description: 'Video, GIF dan gambar dari X.',
    placeholder: 'Paste link X di sini...',
    features: ['Video', 'GIF', 'Gambar'],
  },

  {
    slug: 'facebook',
    name: 'Facebook',
    icon: 'f',
    accent: '#6e8cff',
    description: 'Ambil media dari Facebook.',
    placeholder: 'Paste link Facebook di sini...',
    features: ['Video', 'HD'],
  },

  {
    slug: 'pinterest',
    name: 'Pinterest',
    icon: 'P',
    accent: '#ff5d89',
    description: 'Simpan video dan gambar Pinterest.',
    placeholder: 'Paste link Pinterest di sini...',
    features: ['Video', 'Gambar', 'HD'],
  },

  {
    slug: 'spotify',
    name: 'Spotify',
    icon: '◉',
    accent: '#73e7b0',
    description: 'Track, playlist dan audio.',
    placeholder: 'Paste link Spotify di sini...',
    features: ['MP3', 'Playlist', 'Audio'],
  },

  {
    slug: 'soundcloud',
    name: 'SoundCloud',
    icon: '≋',
    accent: '#ff9b65',
    description: 'Download track SoundCloud.',
    placeholder: 'Paste link SoundCloud di sini...',
    features: ['MP3', 'Audio'],
  },

  {
    slug: 'threads',
    name: 'Threads',
    icon: '@',
    accent: '#d9d8ff',
    description: 'Media dari posting Threads.',
    placeholder: 'Paste link Threads di sini...',
    features: ['Video', 'Gambar'],
  },

  {
    slug: 'reddit',
    name: 'Reddit',
    icon: '●',
    accent: '#ff8b68',
    description: 'Media dari posting Reddit.',
    placeholder: 'Paste link Reddit di sini...',
    features: ['Video', 'Gambar'],
  },

  {
    slug: 'douyin',
    name: 'Douyin',
    icon: '♪',
    accent: '#7deaff',
    description: 'Video Douyin dengan cepat.',
    placeholder: 'Paste link Douyin di sini...',
    features: ['Video', 'HD'],
  },

  {
    slug: 'bilibili',
    name: 'Bilibili',
    icon: 'B',
    accent: '#72d7ff',
    description: 'Media dari Bilibili.',
    placeholder: 'Paste link Bilibili di sini...',
    features: ['Video', 'HD'],
  },

  {
    slug: 'pixiv',
    name: 'Pixiv',
    icon: 'P',
    accent: '#71b8ff',
    description: 'Artwork dan media Pixiv.',
    placeholder: 'Paste link Pixiv di sini...',
    features: ['Gambar', 'HD'],
  },

  {
    slug: 'rednote',
    name: 'RedNote',
    icon: '小',
    accent: '#ff718f',
    description: 'Media dari Xiaohongshu / RedNote.',
    placeholder: 'Paste link RedNote di sini...',
    features: ['Video', 'Gambar'],
  },

  {
    slug: 'terabox',
    name: 'TeraBox',
    icon: '☁',
    accent: '#72a7ff',
    description: 'Resolve file dari TeraBox.',
    placeholder: 'Paste link TeraBox di sini...',
    features: ['File', 'Download'],
  },

  {
    slug: 'applemusic',
    name: 'Apple Music',
    icon: '',
    accent: '#ff6e9b',
    description: 'Track Apple Music.',
    placeholder: 'Paste link Apple Music di sini...',
    features: ['MP3', 'Audio'],
  },

  {
    slug: 'bandcamp',
    name: 'Bandcamp',
    icon: 'b',
    accent: '#6ed8ff',
    description: 'Track dan album Bandcamp.',
    placeholder: 'Paste link Bandcamp di sini...',
    features: ['Track', 'Album'],
  },
];

export const getPlatform = (slug: string) =>
  platforms.find((p) => p.slug === slug);

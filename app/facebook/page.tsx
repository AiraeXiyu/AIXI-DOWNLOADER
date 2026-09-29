import DownloaderClient from '../../components/DownloaderClient';
import { getPlatform } from '../../lib/platforms';
import { notFound } from 'next/navigation';

export default function Page(){ const platform = getPlatform('facebook'); if(!platform) return notFound(); return <DownloaderClient platform={platform}/>; }

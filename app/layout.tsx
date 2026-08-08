import './globals.css';
import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import { AuthProvider } from '@/lib/auth-context';
import { Toaster } from '@/components/ui/sonner';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  metadataBase: new URL('https://deeplive.app'),
  title: 'DeepLive — Real-Time AI Avatar Video Calls',
  description:
    'Transform your webcam into a realistic AI avatar in real-time. Use it on Zoom, Meet, OBS, Twitch, and more.',
  openGraph: {
    title: 'DeepLive — Real-Time AI Avatar Video Calls',
    description:
      'Transform your webcam into a realistic AI avatar in real-time.',
    images: [{ url: 'https://bolt.new/static/og_default.png' }],
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark">
      <body className={`${inter.className} min-h-screen bg-background antialiased`}>
        <AuthProvider>
          {children}
          <Toaster />
        </AuthProvider>
      </body>
    </html>
  );
}

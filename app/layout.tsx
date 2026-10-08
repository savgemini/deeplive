import './globals.css';
import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import { AuthProvider } from '@/lib/auth-context';
import { Toaster } from '@/components/ui/sonner';

const inter = Inter({ subsets: ['latin'] });

export async function generateMetadata(): Promise<Metadata> {
  const title = 'DeepLive — Real-Time AI Avatar Video Calls';
  const description = 'Transform your webcam into a realistic AI avatar in real-time.';
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  let imageUrl = '/api/social-preview';

  if (supabaseUrl && anonKey) {
    try {
      const response = await fetch(
        `${supabaseUrl.replace(/\/$/, '')}/rest/v1/settings_public?select=social_preview_image_url&id=eq.1`,
        {
          headers: { apikey: anonKey, Authorization: `Bearer ${anonKey}` },
          next: { revalidate: 60 },
        }
      );
      if (response.ok) {
        const [settings] = (await response.json()) as { social_preview_image_url: string | null }[];
        if (settings?.social_preview_image_url?.startsWith('https://')) {
          imageUrl = settings.social_preview_image_url;
        }
      }
    } catch {
      imageUrl = '/api/social-preview';
    }
  }

  return {
    metadataBase: new URL('https://deeplive.app'),
    title,
    description: `${description} Use it on Zoom, Meet, OBS, Twitch, and more.`,
    openGraph: {
      title,
      description,
      images: [{ url: imageUrl, width: 1200, height: 630, alt: 'DeepLive social preview' }],
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
      images: [imageUrl],
    },
  };
}

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

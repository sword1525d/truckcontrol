import type {Metadata} from 'next';
import './globals.css';
import { Toaster } from "@/components/ui/toaster";
import { FirebaseClientProvider } from '@/firebase/client-provider';
import { Footer } from '@/components/footer';
import { GeistSans } from 'geist/font/sans';
import { GeistMono } from 'geist/font/mono';

export const metadata: Metadata = {
  title: 'Frotacontrol',
  description: 'Gerado pelo Firebase Studio',
  manifest: '/manifest.json',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt-BR" className={`${GeistSans.variable} ${GeistMono.variable}`}>
      <head>
        <link rel="icon" href="/icon.svg" sizes="any" type="image/svg+xml" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
      </head>
      <body className="font-sans antialiased flex flex-col min-h-screen bg-background text-foreground">
        <script dangerouslySetInnerHTML={{ __html: `
          window.addEventListener('contextmenu', function (e) {
            if (window.innerWidth <= 1024) {
              e.preventDefault();
            }
          }, false);
        ` }} />
        <FirebaseClientProvider>
          <main className="flex-grow flex flex-col">
            {children}
          </main>
          <Toaster />
        </FirebaseClientProvider>
      </body>
    </html>
  );
}

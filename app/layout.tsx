import type { Metadata } from 'next';
import { Geist, Geist_Mono } from 'next/font/google';
import './globals.css';

const geistSans = Geist({
  variable: '--font-geist-sans',
  subsets: ['latin'],
});

const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
});

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL ?? 'https://hostly-solutions.dewy-tapir-0442.chatgpt.site'),
  title: 'Hostly Solutions — Practical experience, shared',
  description: 'Practical assistance for property owners, Airbnb builders, operators, investors, and growing businesses.',
  openGraph: {
    title: 'Hostly Solutions — Practical experience, shared',
    description: 'We started by renting. Then we built. Then we scaled.',
    images: ['/og.png'],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Hostly Solutions — Practical experience, shared',
    description: 'We started by renting. Then we built. Then we scaled.',
    images: ['/og.png'],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        {children}
      </body>
    </html>
  );
}

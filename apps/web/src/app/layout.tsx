import type { Metadata, Viewport } from 'next';
import { IBM_Plex_Mono, Mona_Sans, Space_Grotesk } from 'next/font/google';
import './globals.css';

const spaceGrotesk = Space_Grotesk({
  subsets: ['latin'],
  weight: ['500', '600', '700'],
  variable: '--next-font-display',
  display: 'swap'
});

const monaSans = Mona_Sans({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700', '800'],
  variable: '--next-font-sans',
  display: 'swap'
});

const ibmPlexMono = IBM_Plex_Mono({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  variable: '--next-font-mono',
  display: 'swap'
});

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5
};

export const metadata: Metadata = {
  title: 'MpcFirewall — Pre-Signing Security Firewall for NEAR Agents',
  description:
    'Deterministic RLP, EVM ABI calldata, nested multicall, and Bitcoin raw-transaction security layer for NEAR Chain Signatures (v1.signer).'
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${spaceGrotesk.variable} ${monaSans.variable} ${ibmPlexMono.variable}`}>
      <body className="min-h-[100dvh] bg-white text-[#0B0F17] antialiased selection:bg-[#05DF72] selection:text-black">
        {children}
      </body>
    </html>
  );
}

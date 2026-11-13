import type { Metadata, Viewport } from 'next';
import { Plus_Jakarta_Sans, JetBrains_Mono } from 'next/font/google';
import './globals.css';

const jakarta = Plus_Jakarta_Sans({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700', '800'],
  variable: '--font-jakarta',
  display: 'swap'
});

const jetbrains = JetBrains_Mono({
  subsets: ['latin'],
  weight: ['400', '500', '600'],
  variable: '--font-jetbrains',
  display: 'swap'
});

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5
};

export const metadata: Metadata = {
  title: 'MpcFirewall — X-Ray Security Gate for NEAR AI Assistants',
  description:
    'Zero-blind-signing RLP, EVM ABI calldata, nested multicall, and Bitcoin raw-transaction security layer for NEAR Chain Signatures (v1.signer).'
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${jakarta.variable} ${jetbrains.variable}`}>
      <body className="min-h-[100dvh] bg-[#F4F5F8] text-[#0B0F17] antialiased selection:bg-[#1F3CFF] selection:text-white">
        {children}
      </body>
    </html>
  );
}

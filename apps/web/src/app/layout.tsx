import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'MpcFirewall — Zero-Blind-Signing Calldata Firewall for NEAR Chain Signatures',
  description:
    'On-chain RLP, EVM ABI calldata, nested multicall, and Bitcoin raw-tx firewall protecting NEAR Chain Signatures (v1.signer) from 32-byte blind-signing drains.'
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark">
      <body className="min-h-screen font-sans antialiased selection:bg-[#00ec97]/20 selection:text-[#00ec97]">
        {children}
      </body>
    </html>
  );
}

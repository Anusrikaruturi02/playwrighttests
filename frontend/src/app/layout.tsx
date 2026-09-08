import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'AI Talent Acquisition',
  description: 'Connecting the right talent with the right opportunity — powered by AI.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}

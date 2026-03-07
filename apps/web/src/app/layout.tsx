import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Fedatario',
  description: 'Plataforma de Fe Pública con IA — Correduría Pública',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <body>{children}</body>
    </html>
  );
}

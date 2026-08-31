import type { Metadata } from 'next';
import './globals.css';
import { ToastProvider } from '@/components/Toast';
import { ThemeProvider } from '@/lib/theme';

export const metadata: Metadata = {
  title: 'CPH-Balamban Transmittal & Deadline Monitor',
  description: 'PhilHealth & Billing Section Claims Transmittal and Deadline Monitoring System',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" data-theme="sapphire">
      <body className="antialiased min-h-screen">
        <ThemeProvider>
          <ToastProvider>{children}</ToastProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}

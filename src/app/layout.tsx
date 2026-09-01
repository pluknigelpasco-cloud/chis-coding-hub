import type { Metadata } from 'next';
import './globals.css';
import { ToastProvider } from '@/components/Toast';
import { ThemeProvider } from '@/lib/theme';

export const metadata: Metadata = {
  title: 'CHIS Coding Hub & Transmittal Monitor | CPH-Balamban',
  description: 'PhilHealth ICD-10 & RVS Coding Search, Live CRS Sync, and Transmittal Deadline Monitor',
  icons: {
    icon: '/app_icon.jpg',
    apple: '/app_icon.jpg',
  },
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

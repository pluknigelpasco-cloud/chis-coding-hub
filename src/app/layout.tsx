import type { Metadata } from 'next';
import './globals.css';
import { ToastProvider } from '@/components/Toast';
import { ThemeProvider } from '@/lib/theme';

export const metadata: Metadata = {
  title: 'CPH-B HealthLink Hub | Transmittal & CHIS Coding Suite',
  description: 'Cebu Provincial Hospital - Balamban Transmittal Monitoring, RTH/Denied Tracking & PhilHealth CHIS ICD-10/RVS Coding Suite',
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

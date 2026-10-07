import '../styles/globals.css';
import { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'PayPal Guardian — The firewall between AI and your money',
  description: 'AI-powered transaction safety and policy authorization gateway for autonomous shopping agents.',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark">
      <body className="antialiased bg-slate-950 text-slate-100 min-h-screen">
        {children}
      </body>
    </html>
  );
}

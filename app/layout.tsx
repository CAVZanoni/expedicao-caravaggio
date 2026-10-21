import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Expedição Cânions & Caminho de Caravaggio",
  description: "Webapp interativo com rotas GPX, perfis de altimetria e fotos/vídeos dos 10 dias da expedição cicloturística.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt-BR">
      <body className="antialiased bg-slate-950 text-slate-100 min-h-screen">
        {children}
      </body>
    </html>
  );
}

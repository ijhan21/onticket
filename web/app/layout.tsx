import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "온티켓 (OnTicket)",
  description: "(주)승승장구 자체 공연 티켓 예매 서비스",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ko">
      <body className="bg-bg text-text antialiased min-h-screen">
        {children}
      </body>
    </html>
  );
}

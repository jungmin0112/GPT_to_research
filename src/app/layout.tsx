import "./globals.css";
export const metadata = { title: "GPT to search · 연구 공간" };
export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko">
      <body>{children}</body>
    </html>
  );
}

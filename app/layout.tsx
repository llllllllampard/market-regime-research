import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "市场状态研判助手",
  description: "用可追溯证据理解沪深 300 当前状态，而不是预测涨跌。",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="zh-CN">
      <body>{children}</body>
    </html>
  );
}

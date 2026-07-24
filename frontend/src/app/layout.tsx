import type { Metadata } from "next";
import { AntdRegistry } from "@ant-design/nextjs-registry";

import { AntDesignProvider } from "@/components/ui/ant-design-provider";

import "./globals.css";

export const metadata: Metadata = {
  title: "学生入职登记系统",
  description: "学生入职资料登记与管理系统",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN" className="h-full antialiased">
      <body className="flex min-h-full flex-col">
        <AntdRegistry>
          <AntDesignProvider>{children}</AntDesignProvider>
        </AntdRegistry>
      </body>
    </html>
  );
}

"use client";

import { ConfigProvider } from "antd";
import zhCN from "antd/locale/zh_CN";
import dayjs from "dayjs";
import "dayjs/locale/zh-cn";
import type { ReactNode } from "react";

dayjs.locale("zh-cn");

interface AntDesignProviderProps {
  children: ReactNode;
}

export function AntDesignProvider({ children }: AntDesignProviderProps) {
  return (
    <ConfigProvider
      locale={zhCN}
      theme={{
        token: {
          colorPrimary: "#184268",
          colorInfo: "#184268",
          colorText: "#172735",
          colorTextSecondary: "#5f7285",
          colorBorder: "#b9c9d7",
          colorBgContainer: "#ffffff",
          borderRadius: 6,
          controlHeight: 44,
          fontFamily: "Arial, Helvetica, sans-serif",
        },
        components: {
          DatePicker: {
            activeBorderColor: "#184268",
            hoverBorderColor: "#3f6f99",
          },
          Select: {
            activeBorderColor: "#184268",
            hoverBorderColor: "#3f6f99",
            optionSelectedBg: "#edf4fa",
          },
        },
      }}
    >
      {children}
    </ConfigProvider>
  );
}

"use client";

import { ExternalLink, FileText } from "lucide-react";
import { useState } from "react";

interface HrSharedDocumentProps {
  documentUrl?: string;
  documentTitle?: string;
}

export function HrSharedDocument({
  documentUrl,
  documentTitle = "HR 在线文档",
}: HrSharedDocumentProps) {
  const [iframeFailed, setIframeFailed] = useState(false);
  const configuredUrl = documentUrl?.trim() ?? "";

  if (!configuredUrl) {
    return (
      <section className="rounded-lg border border-[#d8b875] bg-[#fff9eb] px-6 py-12 text-center">
        <FileText aria-hidden="true" className="mx-auto text-[#9a6b16]" />
        <h2 className="mt-4 text-lg font-semibold text-[#5d471d]">
          共享文档尚未配置
        </h2>
        <p className="mt-2 text-sm text-[#7a6332]">
          请在前端环境变量中配置腾讯文档地址。
        </p>
      </section>
    );
  }

  return (
    <section aria-labelledby="shared-document-heading">
      <div className="flex flex-col gap-4 border-b border-[#c9d7e3] pb-5 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-sm font-semibold text-[#557089]">共享文档</p>
          <h1
            id="shared-document-heading"
            className="mt-1 text-3xl font-semibold text-[#172735]"
          >
            {documentTitle}
          </h1>
        </div>
        <a
          href={configuredUrl}
          target="_blank"
          rel="noreferrer"
          className="inline-flex h-11 items-center justify-center gap-2 rounded-md bg-[#184b73] px-5 text-sm font-semibold text-white transition hover:bg-[#123b5c] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#184268]/30"
        >
          在腾讯文档中打开
          <ExternalLink aria-hidden="true" size={16} />
        </a>
      </div>

      <div className="mt-6 overflow-hidden rounded-lg border border-[#c9d7e3] bg-white">
        {iframeFailed ? (
          <div className="grid min-h-[36rem] place-items-center px-6 text-center">
            <div>
              <FileText
                aria-hidden="true"
                className="mx-auto text-[#60758a]"
                size={32}
              />
              <p className="mt-4 font-semibold text-[#263a4b]">
                腾讯文档无法在当前页面显示
              </p>
              <p className="mt-2 text-sm text-[#6b7f92]">
                请使用上方按钮在腾讯文档中打开。
              </p>
            </div>
          </div>
        ) : (
          <iframe
            src={configuredUrl}
            title={documentTitle}
            className="h-[72vh] min-h-[36rem] w-full border-0"
            referrerPolicy="strict-origin-when-cross-origin"
            onError={() => setIframeFailed(true)}
          />
        )}
      </div>

      <p className="mt-3 text-xs text-[#71869a]">
        若文档区域为空白或要求重新登录，请在腾讯文档中打开。访问权限由腾讯文档控制。
      </p>
    </section>
  );
}

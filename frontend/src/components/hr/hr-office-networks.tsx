"use client";

import { Input, Select, Switch } from "antd";
import { RefreshCw, Save } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import {
  listHrOfficeNetworks,
  updateHrOfficeNetwork,
} from "@/lib/api/hr-attendance-settings";
import { getWorkLocationAddress } from "@/lib/work-location";
import type { HrOfficeNetwork } from "@/types/hr-attendance-settings";

interface OfficeNetworkDraft {
  cidrs: string[];
  enabled: boolean;
  description: string;
}

function toDraft(network: HrOfficeNetwork): OfficeNetworkDraft {
  return {
    cidrs: network.cidrs,
    enabled: network.enabled,
    description: network.description ?? "",
  };
}

function formatUpdatedAt(value: string | null): string {
  if (!value) return "尚未保存";

  return new Intl.DateTimeFormat("zh-CN", {
    timeZone: "Asia/Shanghai",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(new Date(value));
}

export function HrOfficeNetworks() {
  const [networks, setNetworks] = useState<HrOfficeNetwork[]>([]);
  const [drafts, setDrafts] = useState<Record<string, OfficeNetworkDraft>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [savingLocation, setSavingLocation] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const load = useCallback(async () => {
    setIsLoading(true);
    setErrorMessage(null);

    try {
      const response = await listHrOfficeNetworks();
      setNetworks(response.items);
      setDrafts(
        Object.fromEntries(
          response.items.map((network) => [
            network.workLocation,
            toDraft(network),
          ]),
        ),
      );
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "办公网络配置加载失败",
      );
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    let isActive = true;

    void listHrOfficeNetworks()
      .then((response) => {
        if (!isActive) return;
        setNetworks(response.items);
        setDrafts(
          Object.fromEntries(
            response.items.map((network) => [
              network.workLocation,
              toDraft(network),
            ]),
          ),
        );
        setErrorMessage(null);
      })
      .catch((error: unknown) => {
        if (!isActive) return;
        setErrorMessage(
          error instanceof Error ? error.message : "办公网络配置加载失败",
        );
      })
      .finally(() => {
        if (isActive) setIsLoading(false);
      });

    return () => {
      isActive = false;
    };
  }, []);

  function updateDraft(
    workLocation: string,
    update: Partial<OfficeNetworkDraft>,
  ) {
    setDrafts((current) => ({
      ...current,
      [workLocation]: { ...current[workLocation], ...update },
    }));
  }

  async function saveNetwork(network: HrOfficeNetwork) {
    const draft = drafts[network.workLocation];

    if (!draft) return;

    setSavingLocation(network.workLocation);
    setErrorMessage(null);
    setSuccessMessage(null);

    try {
      const response = await updateHrOfficeNetwork(network.workLocation, {
        cidrs: draft.cidrs.map((cidr) => cidr.trim()).filter(Boolean),
        enabled: draft.enabled,
        description: draft.description.trim() || null,
      });
      setNetworks((current) =>
        current.map((item) =>
          item.workLocation === network.workLocation ? response.item : item,
        ),
      );
      setDrafts((current) => ({
        ...current,
        [network.workLocation]: toDraft(response.item),
      }));
      setSuccessMessage(`${network.workLocation}配置保存成功`);
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "办公网络配置保存失败",
      );
    } finally {
      setSavingLocation(null);
    }
  }

  if (isLoading) {
    return (
      <section className="rounded-lg border border-[#c9d7e3] bg-white px-6 py-16 text-center text-sm text-[#6b7f92]">
        正在加载办公网络配置...
      </section>
    );
  }

  return (
    <section aria-labelledby="office-network-heading">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2
            id="office-network-heading"
            className="text-xl font-semibold text-[#263a4b]"
          >
            办公网络
          </h2>
          <p className="mt-1 text-sm text-[#6b7f92]">
            配置线下签到允许使用的办公室公网出口 IP 或 CIDR。
          </p>
        </div>
        <button
          type="button"
          onClick={() => void load()}
          className="inline-flex h-10 items-center justify-center gap-2 rounded-md border border-[#b8cad9] bg-white px-4 text-sm font-semibold text-[#184268] transition hover:border-[#184268] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#184268]/30"
        >
          <RefreshCw aria-hidden="true" size={16} />
          刷新
        </button>
      </div>

      {errorMessage ? (
        <p
          role="alert"
          className="mt-4 rounded-md border border-[#e4a99f] bg-[#fff3f1] px-4 py-3 text-sm text-[#9d3426]"
        >
          {errorMessage}
        </p>
      ) : null}
      {successMessage ? (
        <p
          role="status"
          className="mt-4 rounded-md border border-[#9bc9b9] bg-[#edf8f3] px-4 py-3 text-sm text-[#17664e]"
        >
          {successMessage}
        </p>
      ) : null}

      <div className="mt-5 grid gap-4 lg:grid-cols-2">
        {networks.map((network) => {
          const draft = drafts[network.workLocation];
          const address = getWorkLocationAddress(network.workLocation);
          const isSaving = savingLocation === network.workLocation;

          if (!draft) return null;

          return (
            <article
              key={network.workLocation}
              className="rounded-lg border border-[#c9d7e3] bg-white p-5"
            >
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h3 className="font-semibold text-[#263a4b]">
                    {network.workLocation}
                  </h3>
                  <p className="mt-1 text-sm text-[#71869a]">
                    {address ?? "未配置详细地址"}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-sm text-[#52677a]">启用</span>
                  <Switch
                    aria-label={`${network.workLocation}启用状态`}
                    checked={draft.enabled}
                    onChange={(enabled) =>
                      updateDraft(network.workLocation, { enabled })
                    }
                  />
                </div>
              </div>

              <label className="mt-5 block text-sm font-semibold text-[#30475b]">
                允许的公网 IP / CIDR
              </label>
              <Select
                mode="tags"
                value={draft.cidrs}
                onChange={(cidrs) =>
                  updateDraft(network.workLocation, { cidrs })
                }
                tokenSeparators={[",", "\n"]}
                placeholder="例如 140.207.40.253/32"
                className="mt-2 w-full"
                aria-label={`${network.workLocation}允许的 IP 或 CIDR`}
              />

              <label className="mt-4 block text-sm font-semibold text-[#30475b]">
                备注
              </label>
              <Input.TextArea
                value={draft.description}
                onChange={(event) =>
                  updateDraft(network.workLocation, {
                    description: event.target.value,
                  })
                }
                maxLength={200}
                autoSize={{ minRows: 2, maxRows: 3 }}
                placeholder="例如：等待 IT 提供正式出口 IP"
                className="mt-2"
                aria-label={`${network.workLocation}网络备注`}
              />

              <div className="mt-5 flex flex-col gap-3 border-t border-[#e0e8ef] pt-4 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-xs text-[#71869a]">
                  最后更新：{formatUpdatedAt(network.updatedAt)}
                </p>
                <button
                  type="button"
                  disabled={isSaving}
                  onClick={() => void saveNetwork(network)}
                  className="inline-flex h-10 items-center justify-center gap-2 rounded-md bg-[#184b73] px-4 text-sm font-semibold text-white transition hover:bg-[#123b5c] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#184268]/30 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  <Save aria-hidden="true" size={16} />
                  {isSaving ? "正在保存" : "保存配置"}
                </button>
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}

"use client";

import { Select } from "antd";
import { RefreshCw, ShieldCheck } from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";

import { HrModal } from "@/components/hr/hr-modal";
import {
  listHrRegionPermissions,
  updateHrRegionPermissions,
} from "@/lib/api/hr-attendance-settings";
import { normalizeHrAttendanceError } from "@/lib/api/hr-attendance";
import type {
  AttendanceRegionCode,
  HrRegionPermissionUser,
} from "@/types/hr-attendance-settings";
import {
  ATTENDANCE_REGION_CODES,
  ATTENDANCE_REGION_LABELS,
} from "@/types/hr-attendance-settings";

interface PendingPermissionUpdate {
  user: HrRegionPermissionUser;
  regions: AttendanceRegionCode[];
}

function createRegionDrafts(items: HrRegionPermissionUser[]) {
  return Object.fromEntries(
    items.map((user) => [user.id, [...user.managedRegionCodes]]),
  );
}

export function HrRegionPermissions() {
  const router = useRouter();
  const [users, setUsers] = useState<HrRegionPermissionUser[]>([]);
  const [drafts, setDrafts] = useState<Record<string, AttendanceRegionCode[]>>(
    {},
  );
  const [isLoading, setIsLoading] = useState(true);
  const [savingUserId, setSavingUserId] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const [pendingUpdate, setPendingUpdate] =
    useState<PendingPermissionUpdate | null>(null);

  const regionOptions = useMemo(
    () =>
      ATTENDANCE_REGION_CODES.map((regionCode) => ({
        value: regionCode,
        label: ATTENDANCE_REGION_LABELS[regionCode],
      })),
    [],
  );

  const load = useCallback(async () => {
    try {
      const response = await listHrRegionPermissions();
      setUsers(response.items);
      setDrafts(createRegionDrafts(response.items));
      setErrorMessage("");
    } catch (error: unknown) {
      const requestError = normalizeHrAttendanceError(
        error,
        "无法读取 HR 地区权限",
      );
      if (requestError.requiresLogin) {
        router.replace("/hr/login");
        return;
      }
      setErrorMessage(requestError.message);
      setUsers([]);
    } finally {
      setIsLoading(false);
    }
  }, [router]);

  useEffect(() => {
    let isActive = true;

    void listHrRegionPermissions()
      .then((response) => {
        if (!isActive) return;
        setUsers(response.items);
        setDrafts(createRegionDrafts(response.items));
        setErrorMessage("");
      })
      .catch((error: unknown) => {
        if (!isActive) return;
        const requestError = normalizeHrAttendanceError(
          error,
          "无法读取 HR 地区权限",
        );
        if (requestError.requiresLogin) {
          router.replace("/hr/login");
          return;
        }
        setErrorMessage(requestError.message);
        setUsers([]);
      })
      .finally(() => {
        if (isActive) setIsLoading(false);
      });

    return () => {
      isActive = false;
    };
  }, [router]);

  useEffect(() => {
    if (!successMessage) return;
    const timeoutId = window.setTimeout(() => setSuccessMessage(""), 3000);
    return () => window.clearTimeout(timeoutId);
  }, [successMessage]);

  function hasChanged(user: HrRegionPermissionUser): boolean {
    const original = [...user.managedRegionCodes].sort().join(",");
    const draft = [...(drafts[user.id] ?? [])].sort().join(",");
    return original !== draft;
  }

  function requestSave(user: HrRegionPermissionUser) {
    const regions = drafts[user.id] ?? [];
    if (regions.length === 0) {
      setPendingUpdate({ user, regions });
      return;
    }
    void save(user, regions);
  }

  async function save(
    user: HrRegionPermissionUser,
    regions: AttendanceRegionCode[],
  ) {
    if (savingUserId) return;
    setSavingUserId(user.id);
    setErrorMessage("");

    try {
      const response = await updateHrRegionPermissions(user.id, regions);
      setUsers((current) =>
        current.map((item) =>
          item.id === user.id ? response.user : item,
        ),
      );
      setDrafts((current) => ({
        ...current,
        [user.id]: [...response.user.managedRegionCodes],
      }));
      setPendingUpdate(null);
      setSuccessMessage(`${user.name} 的地区权限已更新`);
    } catch (error: unknown) {
      setErrorMessage(
        normalizeHrAttendanceError(error, "保存 HR 地区权限失败").message,
      );
    } finally {
      setSavingUserId(null);
    }
  }

  return (
    <section className="space-y-5" aria-labelledby="region-permissions-heading">
      {successMessage ? (
        <div
          className="rounded-md border border-[#9bd0bd] bg-[#eef9f4] px-4 py-3 text-sm font-medium text-[#176555]"
          role="status"
        >
          {successMessage}
        </div>
      ) : null}

      <div className="rounded-lg border border-[#c9d7e3] bg-white px-5 py-5 sm:px-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2
              id="region-permissions-heading"
              className="text-xl font-semibold text-[#203448]"
            >
              HR 地区权限
            </h2>
            <p className="mt-1 text-sm text-[#60758a]">
              地区权限只控制临时假期维护范围，不改变学生负责人或学生可见范围。
            </p>
          </div>
          <button
            type="button"
            title="刷新地区权限"
            aria-label="刷新地区权限"
            className="grid size-10 place-items-center rounded-md border border-[#b8cad9] bg-white text-[#184268] transition hover:bg-[#edf4fa] disabled:opacity-50"
            disabled={isLoading}
            onClick={() => {
              setIsLoading(true);
              setErrorMessage("");
              void load();
            }}
          >
            <RefreshCw aria-hidden="true" size={17} />
          </button>
        </div>
      </div>

      {errorMessage ? (
        <div
          className="rounded-md border border-[#e4a99f] bg-[#fff3f1] px-4 py-3 text-sm text-[#9d3426]"
          role="alert"
        >
          {errorMessage}
        </div>
      ) : null}

      <div className="overflow-hidden rounded-lg border border-[#c9d7e3] bg-white">
        {isLoading ? (
          <p className="px-6 py-14 text-center text-sm text-[#60758a]">
            正在读取 HR 权限...
          </p>
        ) : users.length === 0 ? (
          <div className="grid min-h-56 place-items-center px-6 py-12 text-center">
            <div>
              <ShieldCheck
                className="mx-auto text-[#8ca4b8]"
                aria-hidden="true"
                size={28}
              />
              <p className="mt-3 text-sm font-medium text-[#52677a]">
                暂无普通 HR 账号
              </p>
            </div>
          </div>
        ) : (
          <ul className="divide-y divide-[#d9e3eb]">
            {users.map((user) => {
              const changed = hasChanged(user);
              const isSaving = savingUserId === user.id;
              const selected = drafts[user.id] ?? [];

              return (
                <li
                  key={user.id}
                  className="grid gap-4 px-5 py-5 sm:grid-cols-[minmax(12rem,0.7fr)_minmax(18rem,1.3fr)_auto] sm:items-center sm:px-6"
                >
                  <div className="min-w-0">
                    <p className="font-semibold text-[#203448]">{user.name}</p>
                    <p className="mt-1 truncate text-sm text-[#6b7f92]">
                      {user.email}
                    </p>
                  </div>

                  <div>
                    <label
                      htmlFor={`regions-${user.id}`}
                      className="mb-2 block text-xs font-semibold text-[#60758a]"
                    >
                      负责地区
                    </label>
                    <Select<AttendanceRegionCode[]>
                      id={`regions-${user.id}`}
                      mode="multiple"
                      value={selected}
                      options={regionOptions}
                      placeholder="未分配地区"
                      maxTagCount="responsive"
                      className="app-select w-full"
                      aria-label={`${user.name} 负责地区`}
                      onChange={(regions) =>
                        setDrafts((current) => ({
                          ...current,
                          [user.id]: regions,
                        }))
                      }
                    />
                    {selected.length === 0 ? (
                      <p className="mt-1.5 text-xs text-[#9a6620]">
                        清空后，该 HR 将不能维护任何地区临时假期。
                      </p>
                    ) : null}
                  </div>

                  <button
                    type="button"
                    className="min-h-10 rounded-md bg-[#184b73] px-4 text-sm font-semibold text-white transition hover:bg-[#123b5d] disabled:cursor-not-allowed disabled:bg-[#a9bac8]"
                    disabled={!changed || Boolean(savingUserId)}
                    onClick={() => requestSave(user)}
                  >
                    {isSaving ? "正在保存" : "保存权限"}
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      <HrModal
        title="确认清空地区权限"
        description="该操作不会删除学生，也不会改变学生负责人。"
        isOpen={Boolean(pendingUpdate)}
        onClose={() => {
          if (!savingUserId) setPendingUpdate(null);
        }}
      >
        {pendingUpdate ? (
          <div className="space-y-5 px-5 py-5 sm:px-6">
            <p className="text-sm leading-6 text-[#52677a]">
              清空后，{pendingUpdate.user.name}
              将不能创建、修改或取消任何地区临时假期，仍可查看全国法定假期。
            </p>
            <div className="flex justify-end gap-3 border-t border-[#d9e3eb] pt-4">
              <button
                type="button"
                className="min-h-10 rounded-md border border-[#b8cad9] px-4 text-sm font-semibold text-[#30475b] hover:bg-[#f3f7fa]"
                disabled={Boolean(savingUserId)}
                onClick={() => setPendingUpdate(null)}
              >
                取消
              </button>
              <button
                type="button"
                className="min-h-10 rounded-md bg-[#a64031] px-5 text-sm font-semibold text-white hover:bg-[#843326] disabled:opacity-50"
                disabled={Boolean(savingUserId)}
                onClick={() =>
                  void save(pendingUpdate.user, pendingUpdate.regions)
                }
              >
                {savingUserId ? "正在清空" : "确认清空"}
              </button>
            </div>
          </div>
        ) : null}
      </HrModal>
    </section>
  );
}

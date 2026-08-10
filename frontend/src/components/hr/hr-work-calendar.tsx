"use client";

import { DatePicker } from "antd";
import dayjs, { type Dayjs } from "dayjs";
import { CalendarDays, Pencil, Plus, RefreshCw, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";

import { HrModal } from "@/components/hr/hr-modal";
import { SelectInput } from "@/components/ui/select-input";
import {
  createHrCalendarException,
  deleteHrCalendarException,
  getHrCalendarAccess,
  listHrCalendarExceptions,
  updateHrCalendarException,
} from "@/lib/api/hr-attendance-settings";
import { normalizeHrAttendanceError } from "@/lib/api/hr-attendance";
import { getChinaTodayInput } from "@/lib/format-date";
import type {
  AttendanceCalendarScope,
  AttendanceRegionCode,
  HrCalendarAccessResponse,
  HrCalendarException,
} from "@/types/hr-attendance-settings";
import {
  ATTENDANCE_REGION_LABELS,
} from "@/types/hr-attendance-settings";

const { RangePicker } = DatePicker;

interface CalendarDraft {
  dateRange: [Dayjs, Dayjs] | null;
  date: Dayjs | null;
  name: string;
  scope: AttendanceCalendarScope;
  regionCode: AttendanceRegionCode | undefined;
  reason: string;
}

function currentChinaMonth(): string {
  return getChinaTodayInput().slice(0, 7);
}

function createDraft(
  access: HrCalendarAccessResponse,
  item?: HrCalendarException,
): CalendarDraft {
  const defaultScope: AttendanceCalendarScope = access.canManageGlobal
    ? "global"
    : "region";
  const scope = item?.scope ?? defaultScope;
  const regionCode =
    item?.regionCode ??
    (scope === "region" ? access.managedRegionCodes[0] : undefined);

  return {
    dateRange: item
      ? null
      : [dayjs(getChinaTodayInput()), dayjs(getChinaTodayInput())],
    date: item ? dayjs(item.date) : null,
    name: item?.name ?? "",
    scope,
    regionCode: regionCode ?? undefined,
    reason: item?.reason ?? "",
  };
}

function formatDate(value: string): string {
  const parsed = dayjs(value);
  return parsed.isValid() ? parsed.format("YYYY年M月D日") : value;
}

function fetchCalendarData(month: string) {
  return Promise.all([
    getHrCalendarAccess(),
    listHrCalendarExceptions({ month }),
  ]);
}

export function HrWorkCalendar() {
  const router = useRouter();
  const [month, setMonth] = useState(currentChinaMonth);
  const [access, setAccess] = useState<HrCalendarAccessResponse | null>(null);
  const [items, setItems] = useState<HrCalendarException[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const [editingItem, setEditingItem] = useState<HrCalendarException | null>(
    null,
  );
  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const [draft, setDraft] = useState<CalendarDraft | null>(null);
  const [deleteItem, setDeleteItem] = useState<HrCalendarException | null>(null);
  const [historicalConfirmed, setHistoricalConfirmed] = useState(false);

  const regionOptions = useMemo(
    () =>
      (access?.managedRegionCodes ?? []).map((regionCode) => ({
        value: regionCode,
        label: ATTENDANCE_REGION_LABELS[regionCode],
      })),
    [access],
  );

  const load = useCallback(async () => {
    try {
      const [currentAccess, response] = await fetchCalendarData(month);
      setAccess(currentAccess);
      setItems(response.items);
      setErrorMessage("");
    } catch (error: unknown) {
      const requestError = normalizeHrAttendanceError(
        error,
        "无法读取工作日历，请稍后重试",
      );
      if (requestError.requiresLogin) {
        router.replace("/hr/login");
        return;
      }
      setErrorMessage(requestError.message);
      setItems([]);
    } finally {
      setIsLoading(false);
    }
  }, [month, router]);

  useEffect(() => {
    let isActive = true;

    void fetchCalendarData(month)
      .then(([currentAccess, response]) => {
        if (!isActive) return;
        setAccess(currentAccess);
        setItems(response.items);
        setErrorMessage("");
      })
      .catch((error: unknown) => {
        if (!isActive) return;
        const requestError = normalizeHrAttendanceError(
          error,
          "无法读取工作日历，请稍后重试",
        );
        if (requestError.requiresLogin) {
          router.replace("/hr/login");
          return;
        }
        setErrorMessage(requestError.message);
        setItems([]);
      })
      .finally(() => {
        if (isActive) setIsLoading(false);
      });

    return () => {
      isActive = false;
    };
  }, [month, router]);

  useEffect(() => {
    if (!successMessage) return;
    const timeoutId = window.setTimeout(() => setSuccessMessage(""), 3000);
    return () => window.clearTimeout(timeoutId);
  }, [successMessage]);

  function openCreate() {
    if (!access) return;
    setEditingItem(null);
    setDraft(createDraft(access));
    setHistoricalConfirmed(false);
    setIsEditorOpen(true);
  }

  function openEdit(item: HrCalendarException) {
    if (!access) return;
    setEditingItem(item);
    setDraft(createDraft(access, item));
    setHistoricalConfirmed(false);
    setIsEditorOpen(true);
  }

  function closeEditor() {
    if (isSaving) return;
    setIsEditorOpen(false);
    setEditingItem(null);
    setDraft(null);
    setErrorMessage("");
  }

  function canManage(item: HrCalendarException): boolean {
    if (!access) return false;
    if (item.scope === "global") return access.canManageGlobal;
    return Boolean(
      item.regionCode && access.managedRegionCodes.includes(item.regionCode),
    );
  }

  function isHistorical(item: HrCalendarException): boolean {
    return item.date < getChinaTodayInput();
  }

  async function handleSave() {
    if (!draft || !access || isSaving) return;

    const name = draft.name.trim();
    const isEditingHistory = Boolean(
      editingItem &&
        (isHistorical(editingItem) ||
          (draft.date && draft.date.format("YYYY-MM-DD") < getChinaTodayInput())),
    );

    if (!name) {
      setErrorMessage("请填写假期名称");
      return;
    }
    if (draft.scope === "region" && !draft.regionCode) {
      setErrorMessage("请选择地区");
      return;
    }
    if (editingItem && !draft.date) {
      setErrorMessage("请选择日期");
      return;
    }
    if (!editingItem && !draft.dateRange) {
      setErrorMessage("请选择日期范围");
      return;
    }
    if (isEditingHistory && !historicalConfirmed) {
      setErrorMessage("请先确认已了解历史日期修改可能影响既有考勤");
      return;
    }

    setIsSaving(true);
    setErrorMessage("");

    try {
      if (editingItem && draft.date) {
        await updateHrCalendarException(editingItem.id, {
          date: draft.date.format("YYYY-MM-DD"),
          name,
          scope: draft.scope,
          regionCode: draft.scope === "region" ? draft.regionCode : null,
          reason: draft.reason.trim(),
        });
        setSuccessMessage("日历记录修改成功");
      } else if (draft.dateRange) {
        await createHrCalendarException({
          startDate: draft.dateRange[0].format("YYYY-MM-DD"),
          endDate: draft.dateRange[1].format("YYYY-MM-DD"),
          name,
          scope: draft.scope,
          regionCode: draft.scope === "region" ? draft.regionCode : null,
          reason: draft.reason.trim(),
        });
        setSuccessMessage("休息日添加成功");
      }

      setIsEditorOpen(false);
      setEditingItem(null);
      setDraft(null);
      await load();
    } catch (error: unknown) {
      setErrorMessage(
        normalizeHrAttendanceError(error, "保存工作日历失败").message,
      );
    } finally {
      setIsSaving(false);
    }
  }

  async function handleDelete() {
    if (!deleteItem || isSaving) return;
    if (isHistorical(deleteItem) && !historicalConfirmed) {
      setErrorMessage("请先确认已了解删除历史日期可能影响既有考勤");
      return;
    }

    setIsSaving(true);
    setErrorMessage("");
    try {
      await deleteHrCalendarException(deleteItem.id);
      setDeleteItem(null);
      setHistoricalConfirmed(false);
      setSuccessMessage("日历记录已取消");
      await load();
    } catch (error: unknown) {
      setErrorMessage(
        normalizeHrAttendanceError(error, "取消日历记录失败").message,
      );
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <section className="space-y-5" aria-labelledby="work-calendar-heading">
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
              id="work-calendar-heading"
              className="text-xl font-semibold text-[#203448]"
            >
              工作日历
            </h2>
            <p className="mt-1 text-sm text-[#60758a]">
              全国假期适用于所有地区，地区休息日仅影响对应地区的出勤核算。
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <DatePicker
              picker="month"
              value={dayjs(`${month}-01`)}
              format="YYYY年M月"
              allowClear={false}
              inputReadOnly
              className="app-date-picker min-h-10 w-40"
              aria-label="日历月份"
              onChange={(value) => {
                if (!value) return;
                setIsLoading(true);
                setErrorMessage("");
                setMonth(value.format("YYYY-MM"));
              }}
            />
            <button
              type="button"
              title="刷新工作日历"
              aria-label="刷新工作日历"
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
            <button
              type="button"
              className="inline-flex min-h-10 items-center gap-2 rounded-md bg-[#184b73] px-4 text-sm font-semibold text-white transition hover:bg-[#123b5d] disabled:cursor-not-allowed disabled:opacity-50"
              disabled={!access || (!access.canManageGlobal && regionOptions.length === 0)}
              onClick={openCreate}
            >
              <Plus aria-hidden="true" size={17} />
              添加休息日
            </button>
          </div>
        </div>

        {access ? (
          <p className="mt-4 rounded-md bg-[#f3f7fa] px-3 py-2 text-xs text-[#60758a]">
            {access.canManageGlobal
              ? "Admin HR：可维护全国及全部地区日历。"
              : access.managedRegionCodes.length > 0
                ? `可维护地区：${access.managedRegionCodes.map((code) => ATTENDANCE_REGION_LABELS[code]).join("、")}。全国假期为只读。`
                : "当前未分配地区权限，只能查看全国假期。"}
          </p>
        ) : null}
      </div>

      {errorMessage && !isEditorOpen && !deleteItem ? (
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
            正在读取工作日历...
          </p>
        ) : items.length === 0 ? (
          <div className="grid min-h-56 place-items-center px-6 py-12 text-center">
            <div>
              <CalendarDays
                className="mx-auto text-[#8ca4b8]"
                aria-hidden="true"
                size={28}
              />
              <p className="mt-3 text-sm font-medium text-[#52677a]">
                该月份没有休息日记录
              </p>
            </div>
          </div>
        ) : (
          <ul className="divide-y divide-[#d9e3eb]">
            {items.map((item) => (
              <li
                key={item.id}
                className="grid gap-4 px-5 py-4 sm:grid-cols-[8rem_minmax(0,1fr)_11rem_auto] sm:items-center sm:px-6"
              >
                <p className="font-semibold text-[#203448]">
                  {formatDate(item.date)}
                </p>
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-medium text-[#263a4b]">
                      {item.name}
                    </span>
                    <span className="rounded border border-[#b8cad9] bg-[#f3f7fa] px-2 py-0.5 text-xs text-[#52677a]">
                      {item.scope === "global"
                        ? "全国"
                        : item.regionCode
                          ? ATTENDANCE_REGION_LABELS[item.regionCode]
                          : "地区"}
                    </span>
                  </div>
                  <p className="mt-1 truncate text-sm text-[#6b7f92]">
                    {item.reason || "未填写原因"}
                  </p>
                </div>
                <p className="text-xs text-[#6b7f92]">
                  最后更新：{dayjs(item.updatedAt).format("YYYY/MM/DD HH:mm")}
                </p>
                <div className="flex gap-2 sm:justify-end">
                  {canManage(item) ? (
                    <>
                      <button
                        type="button"
                        title="修改日历记录"
                        aria-label={`修改 ${item.name}`}
                        className="grid size-9 place-items-center rounded-md border border-[#b8cad9] text-[#184268] transition hover:bg-[#edf4fa]"
                        onClick={() => openEdit(item)}
                      >
                        <Pencil aria-hidden="true" size={16} />
                      </button>
                      <button
                        type="button"
                        title="取消日历记录"
                        aria-label={`取消 ${item.name}`}
                        className="grid size-9 place-items-center rounded-md border border-[#e4b5ad] text-[#a64031] transition hover:bg-[#fff3f1]"
                        onClick={() => {
                          setHistoricalConfirmed(false);
                          setErrorMessage("");
                          setDeleteItem(item);
                        }}
                      >
                        <Trash2 aria-hidden="true" size={16} />
                      </button>
                    </>
                  ) : (
                    <span className="text-xs text-[#8a9aa8]">只读</span>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      <HrModal
        title={editingItem ? "修改日历记录" : "添加休息日"}
        description={
          editingItem
            ? "单条修改仅影响所选日期。"
            : "可一次添加连续日期范围，后端会保存为每日记录。"
        }
        isOpen={isEditorOpen}
        onClose={closeEditor}
      >
        {draft && access ? (
          <div className="space-y-5 px-5 py-5 sm:px-6">
            <label className="block text-sm font-semibold text-[#30475b]">
              {editingItem ? "日期" : "日期范围"}
              {editingItem ? (
                <DatePicker
                  value={draft.date}
                  format="YYYY/MM/DD"
                  inputReadOnly
                  className="app-date-picker mt-2 min-h-11 w-full"
                  onChange={(value) => setDraft({ ...draft, date: value })}
                />
              ) : (
                <RangePicker
                  value={draft.dateRange}
                  format="YYYY/MM/DD"
                  inputReadOnly
                  allowClear={false}
                  className="app-date-picker mt-2 min-h-11 w-full"
                  onChange={(value) =>
                    setDraft({
                      ...draft,
                      dateRange:
                        value?.[0] && value[1] ? [value[0], value[1]] : null,
                    })
                  }
                />
              )}
            </label>

            <label className="block text-sm font-semibold text-[#30475b]">
              假期名称
              <input
                value={draft.name}
                maxLength={100}
                className="mt-2 min-h-11 w-full rounded-md border border-[#b8cad9] bg-white px-3 text-[#263a4b] outline-none transition focus:border-[#184268] focus:ring-2 focus:ring-[#184268]/15"
                placeholder="例如：国庆节、上海临时休息日"
                onChange={(event) =>
                  setDraft({ ...draft, name: event.target.value })
                }
              />
            </label>

            <div className="grid gap-4 sm:grid-cols-2">
              <label className="block text-sm font-semibold text-[#30475b]">
                适用范围
                <SelectInput<AttendanceCalendarScope>
                  value={draft.scope}
                  className="mt-2 min-h-11"
                  options={[
                    ...(access.canManageGlobal
                      ? [{ value: "global" as const, label: "全国" }]
                      : []),
                    { value: "region" as const, label: "指定地区" },
                  ]}
                  onChange={(scope) =>
                    setDraft({
                      ...draft,
                      scope,
                      regionCode:
                        scope === "region"
                          ? draft.regionCode ?? access.managedRegionCodes[0]
                          : undefined,
                    })
                  }
                />
              </label>

              <label className="block text-sm font-semibold text-[#30475b]">
                地区
                <SelectInput<AttendanceRegionCode>
                  value={draft.regionCode}
                  disabled={draft.scope === "global"}
                  placeholder={draft.scope === "global" ? "全国" : "请选择地区"}
                  className="mt-2 min-h-11"
                  options={regionOptions}
                  onChange={(regionCode) =>
                    setDraft({ ...draft, regionCode })
                  }
                />
              </label>
            </div>

            <label className="block text-sm font-semibold text-[#30475b]">
              原因（选填）
              <textarea
                value={draft.reason}
                maxLength={500}
                rows={3}
                className="mt-2 w-full resize-y rounded-md border border-[#b8cad9] bg-white px-3 py-2 text-[#263a4b] outline-none transition focus:border-[#184268] focus:ring-2 focus:ring-[#184268]/15"
                placeholder="补充公司安排或说明"
                onChange={(event) =>
                  setDraft({ ...draft, reason: event.target.value })
                }
              />
            </label>

            {editingItem &&
            (isHistorical(editingItem) ||
              Boolean(
                draft.date &&
                  draft.date.format("YYYY-MM-DD") < getChinaTodayInput(),
              )) ? (
              <label className="flex items-start gap-2 rounded-md border border-[#e8c177] bg-[#fff9e9] px-3 py-3 text-sm text-[#7a5318]">
                <input
                  type="checkbox"
                  className="mt-0.5 size-4"
                  checked={historicalConfirmed}
                  onChange={(event) =>
                    setHistoricalConfirmed(event.target.checked)
                  }
                />
                我已了解修改历史日期可能影响既有考勤，保存后会核对相关记录。
              </label>
            ) : null}

            {errorMessage ? (
              <p className="text-sm text-[#9d3426]" role="alert">
                {errorMessage}
              </p>
            ) : null}

            <div className="flex justify-end gap-3 border-t border-[#d9e3eb] pt-4">
              <button
                type="button"
                className="min-h-10 rounded-md border border-[#b8cad9] px-4 text-sm font-semibold text-[#30475b] hover:bg-[#f3f7fa]"
                disabled={isSaving}
                onClick={closeEditor}
              >
                取消
              </button>
              <button
                type="button"
                className="min-h-10 rounded-md bg-[#184b73] px-5 text-sm font-semibold text-white hover:bg-[#123b5d] disabled:opacity-50"
                disabled={isSaving}
                onClick={() => void handleSave()}
              >
                {isSaving ? "正在保存" : "保存"}
              </button>
            </div>
          </div>
        ) : null}
      </HrModal>

      <HrModal
        title="取消日历记录"
        description="取消后，该日期将恢复由周末和其他有效日历规则判断。"
        isOpen={Boolean(deleteItem)}
        onClose={() => {
          if (isSaving) return;
          setDeleteItem(null);
          setHistoricalConfirmed(false);
          setErrorMessage("");
        }}
      >
        {deleteItem ? (
          <div className="space-y-5 px-5 py-5 sm:px-6">
            <p className="text-sm text-[#52677a]">
              确认取消 {formatDate(deleteItem.date)} 的“{deleteItem.name}”吗？
            </p>
            {isHistorical(deleteItem) ? (
              <label className="flex items-start gap-2 rounded-md border border-[#e8c177] bg-[#fff9e9] px-3 py-3 text-sm text-[#7a5318]">
                <input
                  type="checkbox"
                  className="mt-0.5 size-4"
                  checked={historicalConfirmed}
                  onChange={(event) =>
                    setHistoricalConfirmed(event.target.checked)
                  }
                />
                我已了解取消历史日期可能影响既有考勤，操作后会核对相关记录。
              </label>
            ) : null}
            {errorMessage ? (
              <p className="text-sm text-[#9d3426]" role="alert">
                {errorMessage}
              </p>
            ) : null}
            <div className="flex justify-end gap-3 border-t border-[#d9e3eb] pt-4">
              <button
                type="button"
                className="min-h-10 rounded-md border border-[#b8cad9] px-4 text-sm font-semibold text-[#30475b] hover:bg-[#f3f7fa]"
                disabled={isSaving}
                onClick={() => setDeleteItem(null)}
              >
                保留记录
              </button>
              <button
                type="button"
                className="min-h-10 rounded-md bg-[#a64031] px-5 text-sm font-semibold text-white hover:bg-[#843326] disabled:opacity-50"
                disabled={isSaving}
                onClick={() => void handleDelete()}
              >
                {isSaving ? "正在取消" : "确认取消"}
              </button>
            </div>
          </div>
        ) : null}
      </HrModal>
    </section>
  );
}

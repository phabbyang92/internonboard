import {
  correctHrAttendanceRecord,
  getHrStudentAttendance,
  listHrAttendanceSummary,
  listHrDailyAttendance,
  normalizeHrAttendanceError,
} from "@/lib/api/hr-attendance";
import { ApiError } from "@/lib/api/client";
import { beforeEach, describe, expect, it, vi } from "vitest";

const fetchMock = vi.fn();

describe("HR attendance API", () => {
  beforeEach(() => {
    fetchMock.mockReset();
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify({ items: [] }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );
    vi.stubGlobal("fetch", fetchMock);
  });

  it("serializes daily filters and trims the keyword", async () => {
    await listHrDailyAttendance({
      date: "2026-08-07",
      page: 2,
      limit: 10,
      keyword: "  张三  ",
      workLocation: "上海办公室 - 会德丰",
      checkInMode: "offline",
      ownerHrId: "6a574ec45bd0f7b2a8b65b91",
      status: "late",
      sortBy: "check_in_at_desc",
    });

    const [url, options] = fetchMock.mock.calls[0] as [string, RequestInit];
    const parsedUrl = new URL(url);

    expect(parsedUrl.pathname).toBe("/api/hr/attendance/daily");
    expect(Object.fromEntries(parsedUrl.searchParams)).toEqual({
      date: "2026-08-07",
      page: "2",
      limit: "10",
      keyword: "张三",
      workLocation: "上海办公室 - 会德丰",
      checkInMode: "offline",
      ownerHrId: "6a574ec45bd0f7b2a8b65b91",
      status: "late",
      sortBy: "check_in_at_desc",
    });
    expect(options.method).toBe("GET");
    expect(options.credentials).toBe("include");
  });

  it("omits unused summary filters", async () => {
    await listHrAttendanceSummary({
      month: "2026-08",
      keyword: "   ",
      sortBy: "total_attendance_days_desc",
    });

    const [url] = fetchMock.mock.calls[0] as [string];
    const parsedUrl = new URL(url);

    expect(parsedUrl.pathname).toBe("/api/hr/attendance/summary");
    expect(Object.fromEntries(parsedUrl.searchParams)).toEqual({
      month: "2026-08",
      sortBy: "total_attendance_days_desc",
    });
  });

  it("encodes the student detail route and month query", async () => {
    await getHrStudentAttendance("student/id", "2026-08");

    const [url, options] = fetchMock.mock.calls[0] as [string, RequestInit];

    expect(url).toBe(
      "http://localhost:3001/api/hr/attendance/students/student%2Fid?month=2026-08",
    );
    expect(options.method).toBe("GET");
  });

  it("sends a controlled attendance correction payload", async () => {
    const payload = {
      status: "leave" as const,
      reason: "补录已批准请假",
    };

    await correctHrAttendanceRecord(
      "student/id",
      "2026/08/07",
      payload,
    );

    const [url, options] = fetchMock.mock.calls[0] as [string, RequestInit];

    expect(url).toBe(
      "http://localhost:3001/api/hr/attendance/students/student%2Fid/records/2026%2F08%2F07",
    );
    expect(options.method).toBe("PATCH");
    expect(options.body).toBe(JSON.stringify(payload));
  });

  it("normalizes expired HR sessions for a shared login redirect", () => {
    const result = normalizeHrAttendanceError(
      new ApiError("请先登录", 401),
    );

    expect(result).toEqual({
      message: "HR 登录已过期，请重新登录",
      statusCode: 401,
      requiresLogin: true,
    });
  });

  it("preserves backend business messages and handles unknown errors", () => {
    expect(
      normalizeHrAttendanceError(
        new ApiError("普通 HR 只能查询自己负责学生的考勤", 403),
      ),
    ).toEqual({
      message: "普通 HR 只能查询自己负责学生的考勤",
      statusCode: 403,
      requiresLogin: false,
    });

    expect(normalizeHrAttendanceError(new Error("network"), "读取失败"))
      .toEqual({
        message: "读取失败",
        statusCode: null,
        requiresLogin: false,
      });
  });
});

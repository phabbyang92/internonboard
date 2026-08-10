import {
  cancelStudentLeave,
  checkInStudentAttendance,
  getLeaveDateOptions,
  getStudentAttendanceRecords,
  getStudentPortal,
  getTodayAttendance,
  registerStudentLeave,
} from "@/lib/api/student-attendance";
import { beforeEach, describe, expect, it, vi } from "vitest";

const fetchMock = vi.fn();

describe("student attendance API", () => {
  beforeEach(() => {
    fetchMock.mockReset();
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify({}), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );
    vi.stubGlobal("fetch", fetchMock);
  });

  it.each([
    [getStudentPortal, "/api/student/portal"],
    [getTodayAttendance, "/api/student/attendance/today"],
    [getLeaveDateOptions, "/api/student/attendance/leave-options"],
  ] as const)("sends an authenticated GET request to %s", async (call, path) => {
    await call();

    const [url, options] = fetchMock.mock.calls[0] as [string, RequestInit];

    expect(url).toBe(`http://localhost:3001${path}`);
    expect(options.method).toBe("GET");
    expect(options.credentials).toBe("include");
  });

  it("sends only the controlled check-in payload", async () => {
    const payload = { checkInMode: "offline" as const, deviceId: "browser-1" };

    await checkInStudentAttendance(payload);

    const [url, options] = fetchMock.mock.calls[0] as [string, RequestInit];

    expect(url).toBe("http://localhost:3001/api/student/attendance/check-in");
    expect(options.method).toBe("POST");
    expect(options.body).toBe(JSON.stringify(payload));
  });

  it("registers multiple leave dates in one request", async () => {
    const payload = { dates: ["2026-08-10", "2026-08-11"] };

    await registerStudentLeave(payload);

    const [url, options] = fetchMock.mock.calls[0] as [string, RequestInit];

    expect(url).toBe("http://localhost:3001/api/student/attendance/leaves");
    expect(options.method).toBe("POST");
    expect(options.body).toBe(JSON.stringify(payload));
  });

  it("encodes a leave date before cancellation", async () => {
    await cancelStudentLeave("2026/08/10");

    const [url, options] = fetchMock.mock.calls[0] as [string, RequestInit];

    expect(url).toBe(
      "http://localhost:3001/api/student/attendance/leaves/2026%2F08%2F10",
    );
    expect(options.method).toBe("DELETE");
  });

  it("serializes the attendance record month", async () => {
    await getStudentAttendanceRecords("2026-08");

    const [url, options] = fetchMock.mock.calls[0] as [string, RequestInit];

    expect(url).toBe(
      "http://localhost:3001/api/student/attendance/records?month=2026-08",
    );
    expect(options.method).toBe("GET");
  });
});

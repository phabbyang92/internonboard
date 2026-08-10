import {
  createHrCalendarException,
  deleteHrCalendarException,
  getHrCalendarAccess,
  listHrCalendarExceptions,
  listHrOfficeNetworks,
  listHrRegionPermissions,
  updateHrCalendarException,
  updateHrOfficeNetwork,
  updateHrRegionPermissions,
} from "@/lib/api/hr-attendance-settings";
import { beforeEach, describe, expect, it, vi } from "vitest";

const fetchMock = vi.fn();

describe("HR attendance settings API", () => {
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

  it("uses the dedicated calendar access endpoint", async () => {
    await getHrCalendarAccess();

    const [url, options] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe(
      "http://localhost:3001/api/hr/attendance/calendar/access",
    );
    expect(options.method).toBe("GET");
    expect(options.credentials).toBe("include");
  });

  it("serializes defined calendar filters only", async () => {
    await listHrCalendarExceptions({
      month: "2026-10",
      scope: "region",
      regionCode: "shanghai",
    });

    const [url] = fetchMock.mock.calls[0] as [string];
    const parsedUrl = new URL(url);
    expect(parsedUrl.pathname).toBe("/api/hr/attendance/calendar");
    expect(Object.fromEntries(parsedUrl.searchParams)).toEqual({
      month: "2026-10",
      scope: "region",
      regionCode: "shanghai",
    });
  });

  it("sends controlled calendar create, update, and delete requests", async () => {
    const createPayload = {
      startDate: "2026-10-01",
      endDate: "2026-10-07",
      name: "国庆节",
      scope: "global" as const,
      regionCode: null,
      reason: "全国法定假期",
    };
    await createHrCalendarException(createPayload);
    await updateHrCalendarException("calendar/id", {
      name: "调整后的假期",
    });
    await deleteHrCalendarException("calendar/id");

    expect(fetchMock.mock.calls[0][1]).toMatchObject({
      method: "POST",
      body: JSON.stringify(createPayload),
    });
    expect(fetchMock.mock.calls[1][0]).toContain("calendar%2Fid");
    expect(fetchMock.mock.calls[1][1]).toMatchObject({
      method: "PATCH",
      body: JSON.stringify({ name: "调整后的假期" }),
    });
    expect(fetchMock.mock.calls[2][1]).toMatchObject({ method: "DELETE" });
  });

  it("lists users and updates region codes without accepting unrelated fields", async () => {
    await listHrRegionPermissions();
    await updateHrRegionPermissions("hr/id", ["shanghai", "nanjing"]);

    expect(fetchMock.mock.calls[0][0]).toBe(
      "http://localhost:3001/api/hr/admin/users",
    );
    expect(fetchMock.mock.calls[1][0]).toContain("hr%2Fid/regions");
    expect(fetchMock.mock.calls[1][1]).toMatchObject({
      method: "PATCH",
      body: JSON.stringify({
        managedRegionCodes: ["shanghai", "nanjing"],
      }),
    });
  });

  it("lists and updates an encoded office-network location", async () => {
    await listHrOfficeNetworks();
    await updateHrOfficeNetwork("上海办公室 - 会德丰", {
      cidrs: ["140.207.40.253/32"],
      enabled: true,
      description: "会德丰办公室",
    });

    expect(fetchMock.mock.calls[0][0]).toBe(
      "http://localhost:3001/api/hr/attendance/office-networks",
    );
    expect(fetchMock.mock.calls[1][0]).toContain(
      encodeURIComponent("上海办公室 - 会德丰"),
    );
    expect(fetchMock.mock.calls[1][1]).toMatchObject({
      method: "PUT",
      body: JSON.stringify({
        cidrs: ["140.207.40.253/32"],
        enabled: true,
        description: "会德丰办公室",
      }),
    });
  });
});

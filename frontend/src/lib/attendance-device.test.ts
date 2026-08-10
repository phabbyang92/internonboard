import {
  ATTENDANCE_DEVICE_STORAGE_KEY,
  clearAttendanceDeviceId,
  getAttendanceDeviceId,
  getOrCreateAttendanceDeviceId,
  isValidAttendanceDeviceId,
} from "@/lib/attendance-device";
import { beforeEach, describe, expect, it, vi } from "vitest";

const EXISTING_DEVICE_ID = "29c9a7b8-14a1-4f35-98ba-2a5a7ad91391";
const NEW_DEVICE_ID = "960f536f-8a67-48ec-99be-25607ebd290f";

describe("attendance device id", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it("accepts valid UUID v4 values and rejects invalid values", () => {
    expect(isValidAttendanceDeviceId(EXISTING_DEVICE_ID)).toBe(true);
    expect(isValidAttendanceDeviceId("not-a-device-id")).toBe(false);
    expect(
      isValidAttendanceDeviceId("29c9a7b8-14a1-3f35-98ba-2a5a7ad91391"),
    ).toBe(false);
  });

  it("reuses a valid device id saved by the browser", () => {
    window.localStorage.setItem(
      ATTENDANCE_DEVICE_STORAGE_KEY,
      EXISTING_DEVICE_ID,
    );

    expect(getAttendanceDeviceId()).toBe(EXISTING_DEVICE_ID);
    expect(getOrCreateAttendanceDeviceId()).toBe(EXISTING_DEVICE_ID);
  });

  it("replaces an invalid stored value with a generated UUID", () => {
    window.localStorage.setItem(ATTENDANCE_DEVICE_STORAGE_KEY, "invalid");
    const randomUUID = vi
      .spyOn(globalThis.crypto, "randomUUID")
      .mockReturnValue(NEW_DEVICE_ID);

    expect(getOrCreateAttendanceDeviceId()).toBe(NEW_DEVICE_ID);
    expect(randomUUID).toHaveBeenCalledOnce();
    expect(window.localStorage.getItem(ATTENDANCE_DEVICE_STORAGE_KEY)).toBe(
      NEW_DEVICE_ID,
    );
  });

  it("clears the saved device id", () => {
    window.localStorage.setItem(
      ATTENDANCE_DEVICE_STORAGE_KEY,
      EXISTING_DEVICE_ID,
    );

    clearAttendanceDeviceId();

    expect(getAttendanceDeviceId()).toBeNull();
  });
});

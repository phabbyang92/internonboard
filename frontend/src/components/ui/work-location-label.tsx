import type { ReactNode } from "react";

import { getWorkLocationAddress } from "@/lib/work-location";
import {
  WORK_LOCATIONS,
  type WorkLocation,
} from "@/types/student";

interface WorkLocationLabelProps {
  location: string;
  className?: string;
  nameClassName?: string;
  addressClassName?: string;
}

export function WorkLocationLabel({
  location,
  className = "",
  nameClassName = "",
  addressClassName = "",
}: WorkLocationLabelProps) {
  const address = getWorkLocationAddress(location);

  return (
    <span className={`block min-w-0 text-left ${className}`}>
      <span
        className={`block break-words font-medium leading-5 ${nameClassName}`}
      >
        {location}
      </span>
      {address ? (
        <span
          className={`mt-0.5 block break-words text-xs font-normal leading-4 text-[#6b7f92] ${addressClassName}`}
        >
          {address}
        </span>
      ) : null}
    </span>
  );
}

export function getWorkLocationSelectOptions(
  locations: readonly WorkLocation[] = WORK_LOCATIONS,
): Array<{ value: WorkLocation; label: ReactNode }> {
  return locations.map((location) => ({
    value: location,
    label: <WorkLocationLabel location={location} />,
  }));
}

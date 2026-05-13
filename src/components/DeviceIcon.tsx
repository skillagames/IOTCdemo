import React from "react";
import {
  Cctv,
  HardDrive,
  Phone,
  Video,
  Lock,
  LayoutGrid,
  Cpu,
  Smartphone,
  Mic2,
  LucideProps,
} from "lucide-react";

interface DeviceIconProps extends LucideProps {
  className?: string;
  description?: string;
  name?: string;
}

export const DeviceIcon = ({
  description = "",
  name = "",
  ...props
}: DeviceIconProps) => {
  const text = (description + " " + name).toLowerCase();

  // Priority for specific device types
  if (text.includes("intercom") || text.includes("doorbell")) {
    if (text.includes("video")) return <Video {...props} />;
    return <Phone {...props} />;
  }

  if (text.includes("camera") || text.includes("cctv"))
    return <Cctv {...props} />;

  if (text.includes("video")) return <Video {...props} />;

  if (
    text.includes("dvr") ||
    text.includes("nvr") ||
    text.includes("recorder") ||
    text.includes("server") ||
    text.includes("switch") ||
    text.includes("router") ||
    text.includes("hub") ||
    text.includes("network")
  ) {
    return <HardDrive {...props} />;
  }

  if (
    text.includes("access") ||
    text.includes("lock") ||
    text.includes("reader")
  ) {
    return <Lock {...props} />;
  }

  if (
    text.includes("alarm") ||
    text.includes("panel") ||
    text.includes("siren")
  ) {
    return <LayoutGrid {...props} />;
  }

  if (
    text.includes("iot") ||
    text.includes("terminal") ||
    text.includes("controller")
  ) {
    return <Cpu {...props} />;
  }

  return <Smartphone {...props} />;
};

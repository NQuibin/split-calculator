import { ImageResponse } from "next/og";
import { CalculatorIcon } from "@/lib/appIcon";

export const dynamic = "force-static";

export function GET() {
  return new ImageResponse(<CalculatorIcon size={512} />, { width: 512, height: 512 });
}

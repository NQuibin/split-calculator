import { ImageResponse } from "next/og";
import { CalculatorIcon } from "@/lib/appIcon";

export const dynamic = "force-static";

export function GET() {
  return new ImageResponse(<CalculatorIcon size={192} />, { width: 192, height: 192 });
}

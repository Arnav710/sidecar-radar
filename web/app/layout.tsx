import type { Metadata, Viewport } from "next";
import { Bricolage_Grotesque, DM_Sans, Space_Mono } from "next/font/google";
import { RealUserMonitoring } from "@/components/RealUserMonitoring";
import "./globals.css";

const bricolage = Bricolage_Grotesque({ subsets: ["latin"], variable: "--font-bricolage", weight: ["500", "700", "800"] });
const dm = DM_Sans({ subsets: ["latin"], variable: "--font-dm" });
const spaceMono = Space_Mono({ subsets: ["latin"], variable: "--font-space-mono", weight: ["400", "700"] });

export const metadata: Metadata = {
  title: "Sidecar",
  description: "Ask the talk anything, live. The people stuck on the same thing become your hallway track.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#fff6e6",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${bricolage.variable} ${dm.variable} ${spaceMono.variable}`}>
      <body className="min-h-dvh">
        {process.env.DASH0_RUM_TOKEN && process.env.OTEL_EXPORTER_OTLP_ENDPOINT && (
          <RealUserMonitoring
            endpoint={process.env.OTEL_EXPORTER_OTLP_ENDPOINT}
            token={process.env.DASH0_RUM_TOKEN}
            version={process.env.APP_VERSION ?? "dev"}
            environment={process.env.DEPLOYMENT_ENVIRONMENT ?? (process.env.NODE_ENV === "production" ? "production" : "development")}
          />
        )}
        {children}
      </body>
    </html>
  );
}

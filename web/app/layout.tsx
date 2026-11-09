import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import { RealUserMonitoring } from "@/components/RealUserMonitoring";
import "./globals.css";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });

export const metadata: Metadata = {
  title: "Sidecar",
  description: "Ask the talk anything, live. The people stuck on the same thing become your hallway track.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#f6f6f3",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={inter.variable}>
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

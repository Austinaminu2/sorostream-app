import type { Metadata, Viewport } from "next";
import { ToastProvider } from "@/src/lib/toast";
import { NetworkProvider } from "@/src/lib/network";
import { WalletProvider } from "@/src/context/WalletContext";
import { SettingsProvider } from "@/src/context/SettingsContext";
import { PreferencesProvider } from "@/src/context/PreferencesContext";
import { BookmarksProvider } from "@/src/context/BookmarksContext";
import { NotificationProvider } from "@/src/context/NotificationContext";
import { ContractVersionProvider } from "@/src/context/ContractVersionContext";
import NavHeader from "@/components/NavHeader";
import BottomNav from "@/components/BottomNav";
import AppFooter from "@/components/AppFooter";
import OnboardingWizard from "@/components/OnboardingWizard";
import { SessionWarningToast } from "@/src/components/SessionWarningToast";
import { SessionTimeoutModal } from "@/src/components/SessionTimeoutModal";
import { ThemeProvider } from "@/src/lib/theme";
import PwaInit from "@/src/components/PwaInit";
import InstallPrompt from "@/src/components/InstallPrompt";
import PageViewTracker from "@/src/components/PageViewTracker";
import { GlobalShortcutsProvider } from "@/components/GlobalShortcuts";
import "./globals.css";
import { validateEnv } from "@/src/lib/env";
import { initAnalytics } from "@/src/lib/analytics";
import WebVitalsReporter from "@/src/components/WebVitalsReporter";
import { RpcUnreachableBanner } from "@/components/RpcHealthIndicator";
import RateLimitBanner from "@/components/RateLimitBanner";
import { RateLimitProvider } from "@/src/context/RateLimitContext";
import ContractVersionBanner from "@/components/ContractVersionBanner";
import { XlmPriceProvider } from "@/src/context/XlmPriceContext";

validateEnv();
initAnalytics();

export const metadata: Metadata = {
  title: "SoroStream",
  description: "Real-time XLM payment streaming on Stellar Soroban",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "SoroStream",
  },
  other: {
    // Android / Chrome home screen
    "mobile-web-app-capable": "yes",
    // Tile colour for Windows
    "msapplication-TileColor": "#16a34a",
    "msapplication-TileImage": "/icons/icon-192.png",
  },
};

export const viewport: Viewport = {
  themeColor: "#16a34a",
  width: "device-width",
  initialScale: 1,
  minimumScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        {/*
         * Apply the persisted/system theme before first paint to avoid a
         * flash of the wrong theme. Mirrors the logic in ThemeProvider.
         */}
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var s=localStorage.getItem('theme');var m=window.matchMedia?window.matchMedia('(prefers-color-scheme: dark)').matches:false;var c=window.matchMedia?window.matchMedia('(prefers-contrast: more)').matches:false;var t=(s==='light'||s==='dark'||s==='high-contrast')?s:(c?'high-contrast':(m?'dark':'light'));var r=document.documentElement;r.classList.toggle('light',t==='light');r.classList.toggle('dark',t==='dark'||t==='high-contrast');r.classList.toggle('high-contrast',t==='high-contrast');r.style.colorScheme=t==='high-contrast'?'dark':t;}catch(e){}})();`,
          }}
        />
        {/* iOS home screen icon */}
        <link rel="apple-touch-icon" sizes="192x192" href="/icons/icon-192.png" />
        <link rel="apple-touch-icon" sizes="512x512" href="/icons/icon-512.png" />
        {/* iOS splash / standalone tweaks */}
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
      </head>
      <body className="min-h-screen bg-gray-50 text-gray-900 dark:bg-gray-900 dark:text-gray-100">
        <a href="#main-content" className="skip-link">
          Skip to main content
        </a>
        <SettingsProvider>
          <WalletProvider>
            <BookmarksProvider>
              <ThemeProvider>
                <NetworkProvider>
                  <ToastProvider>
                    <XlmPriceProvider>
                      <NotificationProvider>
                        <GlobalShortcutsProvider>
                          <ContractVersionProvider>
                            <RateLimitProvider>
                              <NavHeader />
                              <RpcUnreachableBanner />
                              <RateLimitBanner />
                              <ContractVersionBanner />
                              <PageViewTracker />
                              <WebVitalsReporter />
                              <PwaInit />
                              <InstallPrompt />
                              <div className="flex-1">
                                {children}
                              </div>
                              <AppFooter />
                              <BottomNav />
                              <OnboardingWizard />
                              <SessionWarningToast />
                              <SessionTimeoutModal />
                            </RateLimitProvider>
                          </ContractVersionProvider>
                        </GlobalShortcutsProvider>
                      </NotificationProvider>
                    </XlmPriceProvider>
                  </ToastProvider>
                </NetworkProvider>
              </ThemeProvider>
            </BookmarksProvider>
          </WalletProvider>
        </SettingsProvider>
      </body>
    </html>
  );
}

import type { Metadata, Viewport } from "next"
import { Inter } from "next/font/google"
import "./globals.css"

const inter = Inter({
  subsets: ["latin", "cyrillic"],
  variable: "--font-inter",
})

export const metadata: Metadata = {
  title: "UltraVet",
  description: "Ветеринарна клініка — система запису",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "UltraVet",
  },
  icons: {
    icon: "/logo.svg",
    apple: "/logo.svg",
  },
}

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  viewportFit: "cover",
  themeColor: "#fafafa",
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="uk" className={`${inter.variable} h-full`} suppressHydrationWarning>
      <head>
        {/* Застосовуємо збережену тему ДО першого рендера, щоб уникнути спалаху
            світлої теми. Ключ має збігатися з THEME_STORAGE_KEY у useTheme. */}
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var t=localStorage.getItem('uv-theme');if(t==='dark'){document.documentElement.classList.add('dark');var m=document.querySelector('meta[name="theme-color"]');if(m)m.setAttribute('content','#0d0d0f');}}catch(e){}})();`,
          }}
        />
      </head>
      <body className="text-[var(--ink)] antialiased">
        {children}
      </body>
    </html>
  )
}

import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { ThemeProvider } from "@/components/providers/theme-provider";
import { ModeToggle } from "@/components/mode-toggle";
import { Toaster } from "@/components/ui/sonner";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://swaggerextractor.camilohenriquez.com";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: "Swagger Extractor - Extract & Test OpenAPI Endpoints",
    template: "%s | Swagger Extractor",
  },
  description:
    "Free online tool to extract, filter, and test API endpoints from Swagger/OpenAPI specifications. Export in JSON or TOON format optimized for LLM prompts. Supports OpenAPI 3.x and Swagger 2.0.",
  keywords: [
    "swagger",
    "openapi",
    "api",
    "extractor",
    "swagger editor",
    "openapi editor",
    "api documentation",
    "api testing",
    "swagger json",
    "openapi 3.0",
    "swagger 2.0",
    "rest api",
    "api endpoints",
    "json to toon",
    "llm prompts",
    "api specification",
    "swagger viewer",
    "openapi viewer",
    "api explorer",
    "swagger parser",
  ],
  authors: [{ name: "Swagger Extractor" }],
  creator: "Swagger Extractor",
  publisher: "Swagger Extractor",
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-video-preview": -1,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },
  openGraph: {
    type: "website",
    locale: "en_US",
    url: siteUrl,
    siteName: "Swagger Extractor",
    title: "Swagger Extractor - Extract & Test OpenAPI Endpoints",
    description:
      "Free online tool to extract, filter, and test API endpoints from Swagger/OpenAPI specifications. Export optimized for LLM prompts.",
    images: [
      {
        url: "/android-chrome-512x512.png",
        width: 512,
        height: 512,
        alt: "Swagger Extractor - Extract & Test OpenAPI Endpoints",
      },
    ],
  },
  twitter: {
    card: "summary",
    title: "Swagger Extractor - Extract & Test OpenAPI Endpoints",
    description:
      "Free online tool to extract, filter, and test API endpoints from Swagger/OpenAPI specifications.",
    images: ["/android-chrome-512x512.png"],
  },
  alternates: {
    canonical: siteUrl,
  },
  category: "Developer Tools",
  classification: "API Tools, Developer Tools, Software Development",
};

// JSON-LD structured data for SEO
const jsonLd = {
  "@context": "https://schema.org",
  "@type": "WebApplication",
  name: "Swagger Extractor",
  description:
    "Free online tool to extract, filter, and test API endpoints from Swagger/OpenAPI specifications.",
  url: siteUrl,
  applicationCategory: "DeveloperApplication",
  operatingSystem: "Any",
  offers: {
    "@type": "Offer",
    price: "0",
    priceCurrency: "USD",
  },
  featureList: [
    "OpenAPI 3.x support",
    "Swagger 2.0 support",
    "Tag-based filtering",
    "API endpoint testing",
    "JSON export",
    "TOON format export for LLM prompts",
    "Auto-detect authentication schemes",
    "File upload support",
  ],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <link rel="icon" type="image/png" sizes="32x32" href="/favicon-32x32.png" />
        <link rel="icon" type="image/png" sizes="16x16" href="/favicon-16x16.png" />
        <link rel="icon" href="/favicon.ico" sizes="any" />
        <link rel="apple-touch-icon" sizes="180x180" href="/apple-touch-icon.png" />
        <link rel="manifest" href="/site.webmanifest" />
        <meta name="theme-color" content="#000000" media="(prefers-color-scheme: dark)" />
        <meta name="theme-color" content="#ffffff" media="(prefers-color-scheme: light)" />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
      </head>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          <div className="fixed top-4 right-4 z-50">
            <ModeToggle />
          </div>
          {children}
          <Toaster />
        </ThemeProvider>
      </body>
    </html>
  );
}

import type { Metadata } from "next";
import Link from "next/link";
import "@fontsource-variable/inter";
import "@fontsource-variable/fraunces";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "Seller Disclosure Assistant", template: "%s · Seller Disclosure Assistant" },
  description: "Answer your home's disclosure questions by typing or speaking.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en">
      <body>
        <a className="skip-link" href="#main">
          Skip to content
        </a>
        <header className="site-header">
          <div className="site-header__inner">
            <Link href="/" className="wordmark">
              Seller Disclosure Assistant
            </Link>
          </div>
        </header>
        <main id="main" className="page">
          {children}
        </main>
      </body>
    </html>
  );
}

// src/components/Footer.tsx
import React from "react";
import { Globe, Share2, MessageCircle, Link as LinkIcon, Send, Feather } from "lucide-react";
import logo from "./logo/logo.png"; // <-- relative path from src/components/Footer.tsx

const NAV_LINKS = [
  { title: "Features", href: "#" },
  { title: "Solution", href: "#" },
  { title: "Customers", href: "#" },
  { title: "Pricing", href: "#" },
  { title: "Help", href: "#" },
  { title: "About", href: "#" },
];

const SOCIALS = [
  { Icon: Share2, label: "Instagram", href: "#" },
  { Icon: MessageCircle, label: "LinkedIn", href: "#" },
  { Icon: LinkIcon, label: "Facebook", href: "#" },
  { Icon: Globe, label: "Website", href: "#" },
  { Icon: Send, label: "Email", href: "mailto:founders@popclozet.com" },
  { Icon: Feather, label: "Blog", href: "#" },
];

export default function Footer() {
  return (
    <footer className="bg-background/80 border-t border-border mt-20">
      <div className="mx-auto max-w-6xl px-6 py-16">
        {/* Top: brand + newsletter */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-8">
          <div className="flex items-center gap-4">
            <a href="/" aria-label="PopClozet home" className="flex items-center gap-3">
              <img src={logo} alt="PopClozet logo" className="w-10 h-10 rounded-full object-contain" />
              <span className="font-bold text-lg text-foreground">PopClozet</span>
            </a>

            <div className="hidden sm:block text-sm text-muted-foreground">
              Rent premium outfits on-demand • Fast delivery
            </div>
          </div>

          <form onSubmit={(e) => e.preventDefault()} className="w-full max-w-md flex items-center gap-2" aria-label="Newsletter signup form">
            <label htmlFor="footer-email" className="sr-only">Email address</label>
            <input
              id="footer-email"
              type="email"
              placeholder="Your email for early access"
              className="flex-1 rounded-full border border-border bg-card px-4 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
            />
            <button type="submit" className="inline-flex items-center gap-2 rounded-full bg-primary px-4 py-2 text-sm font-medium text-white shadow hover:opacity-95 transition" aria-label="Subscribe">
              <Send className="w-4 h-4" />
              Join
            </button>
          </form>
        </div>

        {/* Middle: nav links + contact + socials */}
        <div className="mt-10 grid grid-cols-1 md:grid-cols-3 gap-8">
          <div>
            <h4 className="text-sm font-semibold mb-4 text-foreground/90">Explore</h4>
            <ul className="flex flex-wrap gap-2">
              {NAV_LINKS.map((l) => (
                <li key={l.title}>
                  <a href={l.href} className="text-sm text-muted-foreground hover:text-primary transition">{l.title}</a>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h4 className="text-sm font-semibold mb-4 text-foreground/90">Contact</h4>
            <div className="text-sm text-muted-foreground space-y-2">
              <a href="mailto:founders@popclozet.com" className="block hover:text-primary">founders@popclozet.com</a>
              <a href="mailto:investors@popclozet.com" className="block hover:text-primary">investors@popclozet.com</a>
              <p className="mt-3 text-xs">Support: Mon–Fri, 9am–6pm IST</p>
            </div>
          </div>

          <div>
            <h4 className="text-sm font-semibold mb-4 text-foreground/90">Follow</h4>
            <div className="flex gap-3">
              {SOCIALS.map(({ Icon, label, href }) => (
                <a key={label} href={href} target={href.startsWith("http") ? "_blank" : undefined} rel={href.startsWith("http") ? "noopener noreferrer" : undefined} aria-label={label} className="inline-flex items-center justify-center rounded-full border border-border bg-card w-9 h-9 hover:bg-primary/10 transition text-muted-foreground">
                  <Icon className="w-4 h-4" />
                </a>
              ))}
            </div>

            <div className="mt-4 text-sm text-muted-foreground"><p>Secure checkout powered by Stripe</p></div>
          </div>
        </div>

        <div className="mt-10 border-t border-border pt-6 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <p className="text-sm text-muted-foreground">© {new Date().getFullYear()} PopClozet. All rights reserved.</p>

          <div className="flex items-center gap-4">
            <a href="/terms" className="text-sm text-muted-foreground hover:text-primary">Terms</a>
            <a href="/privacy" className="text-sm text-muted-foreground hover:text-primary">Privacy</a>
            <span className="text-sm text-muted-foreground">•</span>
            <span className="text-sm text-muted-foreground">Built with ♥ in India</span>
          </div>
        </div>
      </div>
    </footer>
  );
}

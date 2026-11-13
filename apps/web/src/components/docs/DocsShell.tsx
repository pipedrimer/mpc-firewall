'use client';

import { useState, type ReactNode } from 'react';
import Link from 'next/link';
import {
  ArrowLeft,
  ArrowRight,
  ArrowUpRight,
  BookOpen,
  ChevronRight,
  Menu,
  Search,
  ShieldCheck,
  X
} from 'lucide-react';
import {
  DOC_CATEGORIES,
  DOC_PAGES,
  getAdjacentPages,
  type DocPageMeta
} from './docsConfig';

export function DocsShell({
  page,
  children
}: {
  page: DocPageMeta;
  children: ReactNode;
}) {
  const [query, setQuery] = useState('');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const normalizedQuery = query.trim().toLowerCase();
  const filteredPages = DOC_PAGES.filter((item) => {
    if (!normalizedQuery) return true;
    return (
      item.title.toLowerCase().includes(normalizedQuery) ||
      item.shortTitle.toLowerCase().includes(normalizedQuery) ||
      item.description.toLowerCase().includes(normalizedQuery) ||
      item.headings.some((h) => h.label.toLowerCase().includes(normalizedQuery))
    );
  });

  const { prev, next } = getAdjacentPages(page.slug);

  function renderSidebarNav(onSelect?: () => void) {
    return (
      <div className="space-y-5">
        <div className="relative">
          <Search className="pointer-events-none absolute left-2.5 top-2.5 h-3.5 w-3.5 text-[#64748B]" />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Filter docs…"
            aria-label="Filter documentation pages"
            className="w-full rounded-lg border border-[#DCE2EE] bg-[#F8FAFC] py-1.5 pl-8 pr-3 text-xs text-[#0B0F17] placeholder:text-[#64748B] focus:border-[#1F3CFF] focus:bg-white focus:outline-none"
          />
        </div>

        {DOC_CATEGORIES.map((category) => {
          const items = filteredPages.filter((p) => p.category === category);
          if (items.length === 0) return null;

          return (
            <div key={category} className="space-y-1">
              <div className="px-2 font-mono text-[10px] font-bold uppercase tracking-wider text-[#64748B]">
                {category}
              </div>
              <ul className="space-y-0.5">
                {items.map((item) => {
                  const isActive = item.slug === page.slug;
                  return (
                    <li key={item.href}>
                      <Link
                        href={item.href}
                        onClick={onSelect}
                        className={`flex items-center justify-between rounded-lg border-l-2 px-2.5 py-1.5 text-[13px] font-semibold transition-colors ${
                          isActive
                            ? 'border-[#1F3CFF] bg-[#EEF2FF] text-[#1F3CFF]'
                            : 'border-transparent text-[#475569] hover:bg-[#F8FAFC] hover:text-[#0B0F17]'
                        }`}
                      >
                        <span>{item.shortTitle}</span>
                        {isActive && <ChevronRight className="h-3.5 w-3.5 shrink-0" />}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </div>
          );
        })}

        {filteredPages.length === 0 && (
          <p className="px-2 text-xs text-[#64748B]">No matching pages for &ldquo;{query}&rdquo;.</p>
        )}
      </div>
    );
  }

  return (
    <div className="min-h-[100dvh]">
      {/* Sticky Documentation Header */}
      <header className="sticky top-0 z-50 border-b border-[#DCE2EE] bg-white/92 backdrop-blur-xl shadow-[0_10px_30px_-15px_rgba(11,15,23,0.07)]">
        <div className="h-[3px] w-full bg-gradient-to-r from-[#1F3CFF] via-[#059669] to-[#D97706]" />
        <div className="mx-auto flex h-16 max-w-[1400px] items-center justify-between gap-3 px-4 sm:px-6">
          <div className="flex items-center gap-2.5">
            <button
              type="button"
              onClick={() => setMobileMenuOpen((v) => !v)}
              aria-label="Toggle documentation menu"
              className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-[#DCE2EE] bg-white text-[#0B0F17] lg:hidden"
            >
              {mobileMenuOpen ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
            </button>

            <Link href="/docs" className="flex items-center gap-2.5 text-[#0B0F17] hover:opacity-85">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-[#1F3CFF] via-[#1528B0] to-[#0B0F17] text-white shadow-[0_6px_16px_-3px_rgba(31,60,255,0.45)]">
                <ShieldCheck className="h-4.5 w-4.5" />
              </div>
              <div className="flex items-center gap-2">
                <span className="text-base font-extrabold tracking-tight">MpcFirewall</span>
                <span className="rounded-full border border-[#C7D2FE] bg-[#EEF2FF] px-2.5 py-0.5 font-mono text-[10px] font-bold uppercase tracking-wider text-[#1F3CFF]">
                  Docs
                </span>
              </div>
            </Link>
          </div>

          <div className="flex items-center gap-2">
            <a
              href="https://testnet.nearblocks.io/address/mpc-firewall.testnet"
              target="_blank"
              rel="noreferrer"
              className="hidden items-center gap-1 rounded-full border border-[#A7F3D0] bg-[#ECFDF5] px-3 py-1.5 font-mono text-[11px] font-semibold text-[#065F46] hover:bg-[#D1FAE5] md:inline-flex"
            >
              <span>mpc-firewall.testnet</span>
              <ArrowUpRight className="h-3 w-3" />
            </a>
            <Link
              href="/"
              className="inline-flex items-center gap-1.5 rounded-full border border-[#0B0F17] bg-[#0B0F17] px-3.5 py-1.5 text-xs font-bold text-white hover:border-[#1F3CFF] hover:bg-[#1F3CFF]"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              <span>Security Console</span>
            </Link>
          </div>
        </div>

        {/* Mobile Drawer */}
        {mobileMenuOpen && (
          <div className="border-t border-[#E6EAF2] bg-white px-4 py-4 lg:hidden">
            {renderSidebarNav(() => setMobileMenuOpen(false))}
          </div>
        )}
      </header>

      {/* 3-Column NEAR-Docs Style Layout: Sidebar | Focused Page | On This Page */}
      <div className="mx-auto grid max-w-[1400px] grid-cols-1 gap-8 px-4 py-8 sm:px-6 lg:grid-cols-12 lg:py-10">
        {/* Left Navigation Sidebar */}
        <aside className="hidden lg:col-span-3 lg:block">
          <div className="sticky top-24 rounded-2xl border border-[#DCE2EE] bg-white p-4 shadow-2xs">
            <div className="mb-4 flex items-center gap-2 border-b border-[#EDF1F7] pb-3">
              <BookOpen className="h-4 w-4 text-[#1F3CFF]" />
              <span className="text-xs font-extrabold uppercase tracking-wider text-[#0B0F17]">
                Documentation
              </span>
            </div>
            {renderSidebarNav()}
          </div>
        </aside>

        {/* Center Focused Article */}
        <main className="min-w-0 lg:col-span-9 xl:col-span-7">
          <article className="space-y-6 rounded-2xl border border-[#DCE2EE] bg-white p-6 shadow-2xs sm:p-8">
            {/* Breadcrumb */}
            <nav aria-label="Breadcrumb" className="flex items-center gap-1.5 font-mono text-[11px] text-[#64748B]">
              <Link href="/docs" className="hover:text-[#1F3CFF]">
                Docs
              </Link>
              <ChevronRight className="h-3 w-3" />
              <span>{page.category}</span>
              <ChevronRight className="h-3 w-3" />
              <span className="font-semibold text-[#0B0F17]">{page.shortTitle}</span>
            </nav>

            {/* Page Title */}
            <header className="border-b border-[#EDF1F7] pb-5">
              <h1 className="text-2xl font-extrabold tracking-tight text-[#0B0F17] sm:text-3xl">
                {page.title}
              </h1>
              <p className="mt-2.5 text-sm leading-relaxed text-[#4A5568] sm:text-base">
                {page.description}
              </p>
            </header>

            {/* Page Content */}
            <div className="space-y-8">{children}</div>

            {/* Previous / Next Footer Pagination */}
            <footer className="grid grid-cols-1 gap-3 border-t border-[#EDF1F7] pt-6 sm:grid-cols-2">
              {prev ? (
                <Link
                  href={prev.href}
                  className="group flex flex-col items-start rounded-xl border border-[#DCE2EE] bg-[#F8FAFC] p-3.5 transition-colors hover:border-[#1F3CFF] hover:bg-[#EEF2FF]/40"
                >
                  <span className="inline-flex items-center gap-1 font-mono text-[10px] font-bold uppercase tracking-wider text-[#64748B]">
                    <ArrowLeft className="h-3 w-3 transition-transform group-hover:-translate-x-0.5" />
                    Previous
                  </span>
                  <span className="mt-1 text-sm font-bold text-[#0B0F17]">{prev.shortTitle}</span>
                </Link>
              ) : (
                <div />
              )}

              {next && (
                <Link
                  href={next.href}
                  className="group flex flex-col items-end rounded-xl border border-[#DCE2EE] bg-[#F8FAFC] p-3.5 text-right transition-colors hover:border-[#1F3CFF] hover:bg-[#EEF2FF]/40"
                >
                  <span className="inline-flex items-center gap-1 font-mono text-[10px] font-bold uppercase tracking-wider text-[#64748B]">
                    Next
                    <ArrowRight className="h-3 w-3 transition-transform group-hover:translate-x-0.5" />
                  </span>
                  <span className="mt-1 text-sm font-bold text-[#0B0F17]">{next.shortTitle}</span>
                </Link>
              )}
            </footer>
          </article>
        </main>

        {/* Right Sticky "On This Page" Mini-TOC */}
        <aside className="hidden xl:col-span-2 xl:block">
          <div className="sticky top-24 space-y-2.5">
            <div className="font-mono text-[10px] font-bold uppercase tracking-wider text-[#64748B]">
              On This Page
            </div>
            <ul className="space-y-1.5 border-l border-[#DCE2EE] pl-3">
              {page.headings.map((h) => (
                <li key={h.id}>
                  <a
                    href={`#${h.id}`}
                    className="block text-xs font-medium text-[#475569] transition-colors hover:text-[#1F3CFF]"
                  >
                    {h.label}
                  </a>
                </li>
              ))}
            </ul>
          </div>
        </aside>
      </div>
    </div>
  );
}


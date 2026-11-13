import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { DocsArticle } from '@/components/docs/DocsArticle';
import { DocsShell } from '@/components/docs/DocsShell';
import { DOC_PAGES, getDocPage } from '@/components/docs/docsConfig';

export function generateStaticParams() {
  return DOC_PAGES.filter((p) => p.slug !== '').map((p) => ({ slug: p.slug }));
}

export async function generateMetadata({
  params
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const page = getDocPage(slug);
  if (!page) return { title: 'Docs — MpcFirewall' };
  return {
    title: `${page.title} — MpcFirewall Docs`,
    description: page.description
  };
}

export default async function DocsSlugPage({
  params
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const page = getDocPage(slug);
  if (!page || page.slug === '') {
    notFound();
  }

  return (
    <DocsShell page={page}>
      <DocsArticle slug={slug} />
    </DocsShell>
  );
}


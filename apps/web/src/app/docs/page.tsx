import type { Metadata } from 'next';
import { DocsArticle } from '@/components/docs/DocsArticle';
import { DocsShell } from '@/components/docs/DocsShell';
import { getDocPage } from '@/components/docs/docsConfig';

const pageMeta = getDocPage('')!;

export const metadata: Metadata = {
  title: `${pageMeta.title} — MpcFirewall Docs`,
  description: pageMeta.description
};

export default function DocsOverviewPage() {
  return (
    <DocsShell page={pageMeta}>
      <DocsArticle slug="" />
    </DocsShell>
  );
}

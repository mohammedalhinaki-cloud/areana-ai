import type { ReactNode } from 'react';
import type { Category, Tool } from '../config/tools';
import { Breadcrumbs } from '../components/Breadcrumbs';
import { ToolNavigation } from '../components/ToolNavigation';
import { AdSlot } from '../components/AdSlot';
import { useDocumentMeta } from '../hooks/useDocumentMeta';

type ToolPageProps = { tool: Tool; category: Category; children: ReactNode };

export function ToolPage({ tool, category, children }: ToolPageProps) {
  const ToolIcon = tool.icon;
  useDocumentMeta(`${tool.nameAr} | ${tool.nameEn} | أدوات الدراسة`, tool.descAr);

  return (
    <div className="page-container tool-page">
      <Breadcrumbs category={category} tool={tool} />
      <div className="tool-page-grid">
        <aside className="tool-sidebar" aria-label="التنقل بين الأدوات">
          <div className="sidebar-heading">
            <span>استكشف الأدوات</span>
            <small>مرتبة حسب القسم</small>
          </div>
          <ToolNavigation id="sidebar-navigation" />
        </aside>
        <article className="tool-main-content">
          <header className="tool-page-heading">
            <div>
              <span className="tool-page-category">{category.nameAr}</span>
              <h1>{tool.nameAr}</h1>
              <p>{tool.descAr}</p>
            </div>
            <span className="tool-heading-icon"><ToolIcon size={27} strokeWidth={1.7} aria-hidden="true" /></span>
          </header>
          <AdSlot />
          {children}
        </article>
      </div>
    </div>
  );
}

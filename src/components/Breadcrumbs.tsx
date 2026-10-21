import { ChevronLeft, Home } from 'lucide-react';
import { Link } from 'react-router-dom';
import type { Category, Tool } from '../config/tools';

type BreadcrumbsProps = { category: Category; tool: Tool };

export function Breadcrumbs({ category, tool }: BreadcrumbsProps) {
  return (
    <nav className="breadcrumbs" aria-label="مسار التنقل">
      <ol>
        <li>
          <Link to="/" aria-label="الرئيسية">
            <Home size={16} aria-hidden="true" />
            <span>الرئيسية</span>
          </Link>
        </li>
        <li className="breadcrumb-separator" aria-hidden="true"><ChevronLeft size={15} /></li>
        <li><Link to={`/#category-${category.id}`}>{category.nameAr}</Link></li>
        <li className="breadcrumb-separator" aria-hidden="true"><ChevronLeft size={15} /></li>
        <li aria-current="page"><span>{tool.nameAr}</span></li>
      </ol>
    </nav>
  );
}

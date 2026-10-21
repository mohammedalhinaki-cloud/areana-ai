import { useEffect, useMemo, useState, type KeyboardEvent } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { ChevronDown, Search } from 'lucide-react';
import { CATEGORIES } from '../config/tools';
import { useNavigationExpansion } from '../providers/NavigationProvider';

type ToolNavigationProps = {
  id: string;
  searchable?: boolean;
  onNavigate?: () => void;
};

function normalize(value: string) {
  return value.trim().toLocaleLowerCase('ar');
}

export function ToolNavigation({ id, searchable = false, onNavigate }: ToolNavigationProps) {
  const location = useLocation();
  const { expandedIds, toggleCategory, openCategory } = useNavigationExpansion();
  const [query, setQuery] = useState('');
  const activeCategory = CATEGORIES.find((category) =>
    category.tools.some((tool) => tool.path === location.pathname),
  );

  useEffect(() => {
    if (activeCategory) openCategory(activeCategory.id);
  }, [activeCategory, location.pathname, openCategory]);

  const normalizedQuery = normalize(query);
  const filteredCategories = useMemo(() => {
    if (!normalizedQuery) return CATEGORIES.map((category) => ({ ...category, visibleTools: category.tools }));

    return CATEGORIES.map((category) => {
      const categoryMatches = normalize(`${category.nameAr} ${category.nameEn}`).includes(normalizedQuery);
      const visibleTools = categoryMatches
        ? category.tools
        : category.tools.filter((tool) =>
            normalize(`${tool.nameAr} ${tool.nameEn} ${tool.descAr}`).includes(normalizedQuery),
          );
      return { ...category, visibleTools };
    }).filter((category) => category.visibleTools.length > 0);
  }, [normalizedQuery]);

  useEffect(() => {
    if (normalizedQuery) filteredCategories.forEach((category) => openCategory(category.id));
  }, [filteredCategories, normalizedQuery, openCategory]);

  const handleTreeKeyDown = (event: KeyboardEvent<HTMLUListElement>) => {
    if (!(event.target instanceof HTMLElement)) return;
    const current = event.target.closest<HTMLElement>('[data-tree-node]');
    if (!current) return;

    const visibleNodes = Array.from(
      event.currentTarget.querySelectorAll<HTMLElement>('[data-tree-node]'),
    ).filter((node) => node.getClientRects().length > 0);
    const currentIndex = visibleNodes.indexOf(current);

    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      const offset = event.key === 'ArrowDown' ? 1 : -1;
      const nextNode = visibleNodes[(currentIndex + offset + visibleNodes.length) % visibleNodes.length];
      nextNode?.focus();
      return;
    }
    if (event.key === 'Home' || event.key === 'End') {
      event.preventDefault();
      (event.key === 'Home' ? visibleNodes[0] : visibleNodes[visibleNodes.length - 1])?.focus();
      return;
    }

    const categoryId = current.dataset.categoryId;
    const expandsWithKey = document.documentElement.dir === 'rtl' ? 'ArrowLeft' : 'ArrowRight';
    const collapsesWithKey = document.documentElement.dir === 'rtl' ? 'ArrowRight' : 'ArrowLeft';
    if (categoryId && event.key === expandsWithKey) {
      event.preventDefault();
      if (expandedIds.includes(categoryId)) {
        document.getElementById(`${id}-${categoryId}-tools`)
          ?.querySelector<HTMLElement>('[data-tree-node]')?.focus();
      } else {
        toggleCategory(categoryId);
      }
      return;
    }
    if (event.key === collapsesWithKey) {
      event.preventDefault();
      if (categoryId && expandedIds.includes(categoryId)) {
        toggleCategory(categoryId);
      } else if (!categoryId) {
        current.closest('[role="group"]')
          ?.parentElement?.querySelector<HTMLElement>('[data-category-trigger]')?.focus();
      }
    }
  };

  return (
    <nav className="tool-navigation" aria-label="الأدوات حسب القسم">
      {searchable && (
        <div className="nav-search">
          <label htmlFor={`${id}-search`}>
            <Search size={18} aria-hidden="true" />
            <span className="visually-hidden">ابحث في الأدوات</span>
            <input
              id={`${id}-search`}
              type="search"
              placeholder="ابحث عن أداة أو قسم"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              autoComplete="off"
            />
          </label>
          {query && (
            <button type="button" className="search-clear" onClick={() => setQuery('')} aria-label="مسح البحث">
              ×
            </button>
          )}
        </div>
      )}

      <ul className="nav-tree" role="tree" aria-label="شجرة أقسام الأدوات" onKeyDown={handleTreeKeyDown}>
        {filteredCategories.map((category) => {
          const Icon = category.icon;
          const expanded = expandedIds.includes(category.id);
          const isCurrentCategory = activeCategory?.id === category.id;
          const groupId = `${id}-${category.id}-tools`;
          const tools = category.visibleTools;

          return (
            <li className="nav-tree-category" key={category.id} role="treeitem" aria-expanded={expanded}>
              <button
                type="button"
                className={`nav-category-trigger${isCurrentCategory ? ' is-current' : ''}`}
                data-tree-node
                data-category-id={category.id}
                data-category-trigger
                aria-expanded={expanded}
                aria-controls={groupId}
                aria-current={isCurrentCategory ? 'location' : undefined}
                onClick={() => toggleCategory(category.id)}
              >
                <span className="nav-category-icon"><Icon size={18} strokeWidth={1.8} aria-hidden="true" /></span>
                <span className="nav-category-label">
                  <span>{category.nameAr}</span>
                  <small>{category.nameEn}</small>
                </span>
                <ChevronDown className={`nav-chevron${expanded ? ' is-open' : ''}`} size={17} aria-hidden="true" />
              </button>
              <ul id={groupId} className="nav-tree-group" role="group" hidden={!expanded}>
                {tools.map((tool) => {
                  const ToolIcon = tool.icon;
                  return (
                    <li key={tool.id} role="none">
                      <NavLink
                        to={tool.path}
                        role="treeitem"
                        data-tree-node
                        className={({ isActive }) => `nav-tool-link${isActive ? ' is-active' : ''}`}
                        onClick={onNavigate}
                      >
                        <ToolIcon size={17} strokeWidth={1.8} aria-hidden="true" />
                        <span className="nav-tool-copy">
                          <span className="nav-tool-name">{tool.nameAr}</span>
                          <small>{tool.descAr}</small>
                        </span>
                      </NavLink>
                    </li>
                  );
                })}
              </ul>
            </li>
          );
        })}
        {filteredCategories.length === 0 && (
          <li className="nav-no-results" role="none">
            <p role="status">لا توجد أدوات تطابق «{query}».</p>
          </li>
        )}
      </ul>
    </nav>
  );
}

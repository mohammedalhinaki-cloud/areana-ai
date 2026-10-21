import { useEffect, useRef, useState, type KeyboardEvent } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { BookOpen, ChevronDown, ExternalLink, Languages, Menu, Moon, Sun, X } from 'lucide-react';
import { SITE_NAME_AR } from '../config/site';
import { InstallPwaButton } from './InstallPwaButton';
import { ShareButton } from './ShareButton';
import { ToolNavigation } from './ToolNavigation';
import { usePreferences } from '../providers/PreferencesProvider';

export function Header() {
  const [menuOpen, setMenuOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(() => window.matchMedia('(max-width: 1023px)').matches);
  const toggleRef = useRef<HTMLButtonElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const location = useLocation();
  const { isDark, direction, toggleTheme, toggleDirection } = usePreferences();

  useEffect(() => {
    const mediaQuery = window.matchMedia('(max-width: 1023px)');
    const update = () => setIsMobile(mediaQuery.matches);
    mediaQuery.addEventListener('change', update);
    return () => mediaQuery.removeEventListener('change', update);
  }, []);

  useEffect(() => {
    if (!menuOpen) return undefined;
    const onKeyDown = (event: globalThis.KeyboardEvent) => {
      if (event.key === 'Escape') {
        setMenuOpen(false);
        toggleRef.current?.focus();
      }

      if (isMobile && event.key === 'Tab' && menuRef.current) {
        const focusable = Array.from(
          menuRef.current.querySelectorAll<HTMLElement>(
            'button:not([disabled]), a[href], input:not([disabled])',
          ),
        ).filter((element) => element.getClientRects().length > 0);
        if (focusable.length === 0) return;
        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last?.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first?.focus();
        }
      }
    };
    window.addEventListener('keydown', onKeyDown);
    if (isMobile) {
      document.body.classList.add('drawer-open');
      closeRef.current?.focus();
    }
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      document.body.classList.remove('drawer-open');
    };
  }, [isMobile, menuOpen]);

  useEffect(() => {
    setMenuOpen(false);
  }, [location.pathname, location.hash]);

  const closeMenu = () => setMenuOpen(false);
  const onMenuKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === 'Escape') {
      setMenuOpen(false);
      toggleRef.current?.focus();
    }
  };

  return (
    <header className="site-header" id="top">
      <a className="skip-link" href="#main-content">تخطّي إلى المحتوى</a>
      <div className="header-inner">
        <Link to="/" className="brand" aria-label={`${SITE_NAME_AR} - الرئيسية`}>
          <span className="brand-mark"><BookOpen size={21} strokeWidth={2} aria-hidden="true" /></span>
          <span className="brand-copy">
            <strong>{SITE_NAME_AR}</strong>
            <small>رفيقك في رحلة التعلّم</small>
          </span>
        </Link>

        <button
          ref={toggleRef}
          type="button"
          className={`tools-menu-button${menuOpen ? ' is-open' : ''}`}
          aria-expanded={menuOpen}
          aria-controls="tools-menu"
          onClick={() => setMenuOpen((open) => !open)}
        >
          <Menu size={19} aria-hidden="true" />
          <span>الأدوات</span>
          <ChevronDown className={menuOpen ? 'rotate-180' : ''} size={16} aria-hidden="true" />
        </button>

        <div className="header-actions">
          <Link className="header-action browse-action" to="/#tools">
            <span>تصفح تطبيقاتنا</span>
            <ExternalLink size={15} aria-hidden="true" />
          </Link>
          <ShareButton compact />
          <InstallPwaButton />
          <button
            type="button"
            className="icon-action"
            onClick={toggleDirection}
            aria-label={`تغيير اتجاه العرض إلى ${direction === 'rtl' ? 'LTR' : 'RTL'}`}
            title={`اتجاه العرض: ${direction.toUpperCase()}`}
          >
            <Languages size={18} aria-hidden="true" />
            <span>{direction.toUpperCase()}</span>
          </button>
          <button
            type="button"
            className="icon-action theme-action"
            onClick={toggleTheme}
            aria-label={isDark ? 'تفعيل الوضع الفاتح' : 'تفعيل الوضع الداكن'}
            title={isDark ? 'الوضع الفاتح' : 'الوضع الداكن'}
          >
            {isDark ? <Sun size={18} aria-hidden="true" /> : <Moon size={18} aria-hidden="true" />}
          </button>
        </div>
      </div>

      <div
        ref={menuRef}
        className={`menu-layer${menuOpen ? ' is-open' : ''}`}
        id="tools-menu"
        hidden={!menuOpen}
        onKeyDown={onMenuKeyDown}
      >
        <button type="button" className="drawer-backdrop" aria-label="إغلاق قائمة الأدوات" onClick={closeMenu} />
        <section
          className="menu-panel"
          role={isMobile ? 'dialog' : 'region'}
          aria-modal={isMobile ? true : undefined}
          aria-label="قائمة الأدوات والأقسام"
        >
          <div className="drawer-heading">
            <div>
              <span className="drawer-kicker">استكشف المنصة</span>
              <h2>الأدوات حسب القسم</h2>
            </div>
            <button ref={closeRef} type="button" className="drawer-close" onClick={closeMenu} aria-label="إغلاق قائمة الأدوات">
              <X size={20} aria-hidden="true" />
            </button>
          </div>
          <ToolNavigation id="header-navigation" searchable onNavigate={closeMenu} />
        </section>
      </div>
    </header>
  );
}

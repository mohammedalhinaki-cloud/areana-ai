import { ArrowLeft, ArrowUpLeft, Sparkles } from 'lucide-react';
import { Link } from 'react-router-dom';
import { CATEGORIES } from '../config/tools';
import { SITE_DESCRIPTION_AR, SITE_NAME_AR } from '../config/site';
import { useDocumentMeta } from '../hooks/useDocumentMeta';

const toolCount = CATEGORIES.reduce((total, category) => total + category.tools.length, 0);

export function HomePage() {
  useDocumentMeta(`${SITE_NAME_AR} | أدوات عملية للطلاب والطالبات`, SITE_DESCRIPTION_AR);

  return (
    <div className="home-page">
      <section className="hero-section" aria-labelledby="hero-title">
        <div className="hero-orb hero-orb-one" aria-hidden="true" />
        <div className="hero-orb hero-orb-two" aria-hidden="true" />
        <div className="hero-content page-container">
          <div className="hero-copy">
            <p className="hero-eyebrow"><Sparkles size={16} aria-hidden="true" /> مساحة دراسية صُمّمت لك</p>
            <h1 id="hero-title">دراستك، <span>بترتيب أبسط.</span></h1>
            <p className="hero-description">
              أدوات عملية تساعدك على تنظيم ملفاتك، إدارة وقت مذاكرتك، والاستعداد لمواعيدك — في مكان واحد.
            </p>
            <a className="primary-button hero-cta" href="#tools">
              اكتشف الأدوات <ArrowLeft size={18} aria-hidden="true" />
            </a>
          </div>
          <div className="hero-summary" aria-label={`${CATEGORIES.length} أقسام و${toolCount} أدوات دراسية`}>
            <div className="summary-topline"><span className="summary-dot" /> أدواتك اليومية، في مساحة واحدة</div>
            <div className="summary-numbers">
              <div><strong>{toolCount}</strong><span>أداة دراسية</span></div>
              <span className="summary-divider" aria-hidden="true" />
              <div><strong>{CATEGORIES.length}</strong><span>أقسام مرتبة</span></div>
            </div>
            <div className="summary-category-list">
              {CATEGORIES.map((category) => {
                const Icon = category.icon;
                return (
                  <div className="summary-category" key={category.id}>
                    <span className="summary-category-icon"><Icon size={16} aria-hidden="true" /></span>
                    <span>{category.nameAr}</span>
                    <small>{category.tools.length}</small>
                  </div>
                );
              })}
            </div>
            <ArrowUpLeft className="summary-decoration" size={23} aria-hidden="true" />
          </div>
        </div>
        <a className="hero-scroll-link" href="#tools" aria-label="انتقل إلى أقسام الأدوات">
          <span />
        </a>
      </section>

      <div className="page-container tools-home" id="tools">
        <div className="section-intro">
          <div>
            <p className="eyebrow">مساحتك الدراسية</p>
            <h2>اختر ما تحتاجه اليوم</h2>
            <p>كل مجموعة مرتبة حسب المهمة، لتصل إلى الأداة المناسبة بسرعة.</p>
          </div>
          <div className="section-count"><span>{CATEGORIES.length}</span> أقسام</div>
        </div>

        <div className="category-sections">
          {CATEGORIES.map((category, categoryIndex) => {
            const CategoryIcon = category.icon;
            return (
              <section
                className="tool-category-section"
                id={`category-${category.id}`}
                key={category.id}
                aria-labelledby={`category-heading-${category.id}`}
              >
                <header className="category-section-heading">
                  <div className="category-heading-main">
                    <span className={`category-heading-icon category-tone-${categoryIndex + 1}`}>
                      <CategoryIcon size={21} strokeWidth={1.8} aria-hidden="true" />
                    </span>
                    <div>
                      <h3 id={`category-heading-${category.id}`}>{category.nameAr}</h3>
                      <span className="category-name-en">{category.nameEn}</span>
                    </div>
                  </div>
                  <span className="category-count"><strong>{category.tools.length}</strong> {category.tools.length === 1 ? 'أداة' : 'أدوات'}</span>
                </header>

                <div className="tool-card-grid">
                  {category.tools.map((tool) => {
                    const ToolIcon = tool.icon;
                    return (
                      <Link className="tool-card" to={tool.path} key={tool.id}>
                        <span className="tool-card-icon"><ToolIcon size={21} strokeWidth={1.8} aria-hidden="true" /></span>
                        <span className="tool-card-content">
                          <span className="tool-card-title">{tool.nameAr}</span>
                          <span className="tool-card-description">{tool.descAr}</span>
                        </span>
                        <span className="tool-card-arrow"><ArrowLeft size={18} aria-hidden="true" /></span>
                      </Link>
                    );
                  })}
                </div>
              </section>
            );
          })}
        </div>
      </div>
    </div>
  );
}

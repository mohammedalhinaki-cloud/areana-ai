import { lazy, Suspense, type ComponentType } from 'react';
import { BrowserRouter, Route, Routes } from 'react-router-dom';
import { CATEGORIES, TOOLS, type Category, type Tool } from './config/tools';
import { Footer } from './components/Footer';
import { Header } from './components/Header';
import { ScrollManager } from './components/ScrollManager';
import { HomePage } from './pages/HomePage';
import { NotFoundPage } from './pages/NotFoundPage';
import { ToolPage } from './pages/ToolPage';
import { NavigationProvider } from './providers/NavigationProvider';
import { PreferencesProvider } from './providers/PreferencesProvider';
import { ToastProvider } from './providers/ToastProvider';

const toolModules = import.meta.glob<{ default: ComponentType }>('./tools/*.tsx');
const toolViews = new Map(
  TOOLS.flatMap((tool) => {
    const loader = toolModules[`./tools/${tool.id}.tsx`];
    return loader ? [[tool.id, lazy(loader)] as const] : [];
  }),
);

function ToolLoadingState() {
  return (
    <div className="tool-loading-state" role="status" aria-live="polite">
      <span className="loading-spinner" aria-hidden="true" />
      <span>جارٍ تجهيز الأداة…</span>
    </div>
  );
}

function ToolLoadError() {
  return (
    <section className="tool-load-error" role="alert">
      <h2>تعذّر تحميل الأداة</h2>
      <p>لم يتمكن التطبيق من تجهيز صفحة هذه الأداة. أعد تحميل الصفحة، وإذا استمر الخطأ فتواصل مع إدارة الموقع.</p>
    </section>
  );
}

function ToolRoute({ tool, category }: { tool: Tool; category: Category }) {
  const ToolView = toolViews.get(tool.id);
  return (
    <ToolPage tool={tool} category={category}>
      {ToolView ? <Suspense fallback={<ToolLoadingState />}><ToolView /></Suspense> : <ToolLoadError />}
    </ToolPage>
  );
}

function AppRoutes() {
  return (
    <>
      <ScrollManager />
      <Header />
      <main id="main-content" tabIndex={-1}>
        <Routes>
          <Route path="/" element={<HomePage />} />
          {CATEGORIES.flatMap((category) =>
            category.tools.map((tool) => (
              <Route
                key={tool.id}
                path={tool.path}
                element={<ToolRoute tool={tool} category={category} />}
              />
            )),
          )}
          <Route path="*" element={<NotFoundPage />} />
        </Routes>
      </main>
      <Footer />
    </>
  );
}

// Vite sets BASE_URL to '/' locally and to '/<repo>/' when the site is built
// for GitHub Pages, so the router must mount under the same prefix.
const routerBasename = import.meta.env.BASE_URL.replace(/\/$/, '') || '/';

export default function App() {
  return (
    // LIMITATION: React Router v6 is a mandated dependency. This client-only app uses static local routes from tools.ts and has no SSR hydration or user-supplied destinations; revisit the major version when the v6 requirement changes.
    <BrowserRouter basename={routerBasename}>
      <PreferencesProvider>
        <NavigationProvider>
          <ToastProvider>
            <AppRoutes />
          </ToastProvider>
        </NavigationProvider>
      </PreferencesProvider>
    </BrowserRouter>
  );
}

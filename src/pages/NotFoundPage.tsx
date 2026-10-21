import { Link } from 'react-router-dom';
import { ArrowLeft, Compass } from 'lucide-react';
import { useDocumentMeta } from '../hooks/useDocumentMeta';

export function NotFoundPage() {
  useDocumentMeta('الصفحة غير موجودة | أدوات الدراسة', 'تعذّر العثور على الصفحة المطلوبة.');

  return (
    <section className="not-found page-container" aria-labelledby="not-found-title">
      <span className="not-found-icon"><Compass size={30} aria-hidden="true" /></span>
      <p className="eyebrow">404</p>
      <h1 id="not-found-title">لم نعثر على هذه الصفحة</h1>
      <p>قد يكون الرابط تغيّر أو كُتب بطريقة غير صحيحة.</p>
      <Link className="primary-button" to="/">العودة إلى الرئيسية <ArrowLeft size={17} aria-hidden="true" /></Link>
    </section>
  );
}

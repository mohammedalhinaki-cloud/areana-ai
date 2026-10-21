import { ArrowUp, ExternalLink } from 'lucide-react';
import { Link } from 'react-router-dom';
import { TELEGRAM_BOT_URL } from '../config/site';

export function Footer() {
  return (
    <footer className="site-footer">
      <div className="footer-inner">
        <div className="footer-message">
          <p>هذا العمل تطوعي لخدمة الطلاب والطالبات، نسأل الله أن ينفع به، ولا تنسونا من صالح دعائكم</p>
          <span>© 2026 أدوات الدراسة</span>
        </div>
        <div className="footer-links">
          <Link to="/#tools">تصفح تطبيقاتنا</Link>
          {TELEGRAM_BOT_URL && (
            <a href={TELEGRAM_BOT_URL} target="_blank" rel="noreferrer">
              تواصل عبر تيليجرام <ExternalLink size={14} aria-hidden="true" />
            </a>
          )}
          <a className="back-to-top" href="#top" aria-label="العودة إلى أعلى الصفحة">
            <ArrowUp size={16} aria-hidden="true" />
          </a>
        </div>
      </div>
    </footer>
  );
}

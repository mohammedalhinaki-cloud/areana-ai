import type { LucideIcon } from 'lucide-react';
import {
  BookOpen,
  Calendar,
  CalendarDays,
  Calculator,
  Files,
  FolderOpen,
  ImagePlus,
  Scissors,
  SlidersHorizontal,
  Timer,
} from 'lucide-react';

export type Tool = {
  id: string;
  path: string;
  nameAr: string;
  nameEn: string;
  descAr: string;
  icon: LucideIcon;
};

export type Category = {
  id: string;
  nameAr: string;
  nameEn: string;
  icon: LucideIcon;
  tools: Tool[];
};

export const CATEGORIES: Category[] = [
  {
    id: 'files-images',
    nameAr: 'الملفات والصور',
    nameEn: 'Files & Images',
    icon: FolderOpen,
    tools: [
      {
        id: 'reader',
        path: '/reader',
        nameAr: 'قارئ الملفات',
        nameEn: 'PDF Reader',
        descAr: 'افتح ملفات PDF واقرأها وابحث في نصوصها.',
        icon: BookOpen,
      },
      {
        id: 'image-to-pdf',
        path: '/image-to-pdf',
        nameAr: 'تحويل الصور إلى PDF',
        nameEn: 'Image to PDF',
        descAr: 'رتّب الصور وحوّلها إلى ملف PDF.',
        icon: ImagePlus,
      },
      {
        id: 'merge-pdf',
        path: '/merge-pdf',
        nameAr: 'دمج PDF',
        nameEn: 'Merge PDF',
        descAr: 'اجمع ملفات PDF في مستند واحد.',
        icon: Files,
      },
      {
        id: 'pdf-pages',
        path: '/pdf-pages',
        nameAr: 'حذف صفحات PDF',
        nameEn: 'Delete Pages',
        descAr: 'اختر الصفحات التي تريد حذفها من المستند.',
        icon: Scissors,
      },
      {
        id: 'image-tools',
        path: '/image-tools',
        nameAr: 'أدوات الصور',
        nameEn: 'Image Tools',
        descAr: 'عدّل أبعاد الصور وصيغتها وجودتها.',
        icon: SlidersHorizontal,
      },
    ],
  },
  {
    id: 'focus',
    nameAr: 'التركيز والمذاكرة',
    nameEn: 'Focus',
    icon: Timer,
    tools: [
      {
        id: 'pomodoro',
        path: '/pomodoro',
        nameAr: 'مؤقت المذاكرة Pomodoro',
        nameEn: 'Pomodoro Timer',
        descAr: 'قسّم وقتك بين جلسات تركيز واستراحات.',
        icon: Timer,
      },
    ],
  },
  {
    id: 'planning',
    nameAr: 'التخطيط والمواعيد',
    nameEn: 'Planning',
    icon: CalendarDays,
    tools: [
      {
        id: 'exam-countdown',
        path: '/exam-countdown',
        nameAr: 'عداد الاختبارات',
        nameEn: 'Exam Countdown',
        descAr: 'نظّم اختباراتك وتابع الوقت المتبقي لها.',
        icon: Calendar,
      },
      {
        id: 'countdowns',
        path: '/countdowns',
        nameAr: 'عداد المواسم والإجازات',
        nameEn: 'Seasons Countdown',
        descAr: 'تابع المناسبات والمواسم التي تهمك.',
        icon: CalendarDays,
      },
      {
        id: 'schedule',
        path: '/schedule',
        nameAr: 'مصمم الجدول الدراسي',
        nameEn: 'Schedule Maker',
        descAr: 'رتّب محاضراتك وأوقات دراستك في جدول واضح.',
        icon: CalendarDays,
      },
    ],
  },
  {
    id: 'calculators',
    nameAr: 'الحاسبات',
    nameEn: 'Calculators',
    icon: Calculator,
    tools: [
      {
        id: 'calculator',
        path: '/calculator',
        nameAr: 'الحاسبة العلمية',
        nameEn: 'Scientific Calculator',
        descAr: 'نفّذ العمليات العلمية والإحصائية والمصفوفات.',
        icon: Calculator,
      },
    ],
  },
];

export const TOOLS = CATEGORIES.flatMap((category) => category.tools);

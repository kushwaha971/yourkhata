import {
  Armchair,
  BookOpen,
  CalendarCheck,
  Home,
  IndianRupee,
  Library,
  MessageCircle,
  Receipt,
  ScanLine,
  Settings,
  Users,
  Wallet,
} from 'lucide-react';

import { ROUTES } from 'src/routes';

import type { AppManifest } from 'modules/DigiKhaato/features/navigation/appManifest';

/**
 * Members & Fees (code name `library`), rebuilt from scratch on 12 Nov 2026 as
 * an app that stands alone: its own screens, API and tables, nothing of the
 * Shop's. Its menu is the design's (Part I, `APP.library`): Today — Counter,
 * Home; Students — Students, Seats, Fees, Attendance, Messages; Money — Income
 * & expenses, Expenses; Books — Books. The phone bar: Home, Students, Seats, Fees.
 */
const READ = 'library.member.read';
const MANAGE = 'library.settings.manage';

export const LIBRARY_APP: AppManifest = {
  code: 'library',
  labelId: 'nav.workspace.library',
  icon: Library,
  routePrefixes: [ROUTES.LIBRARY_HOME],
  peopleHref: ROUTES.LIBRARY_STUDENTS,
  sections: [
    { key: 'libraryToday', labelId: 'library.nav.section.today' },
    { key: 'libraryStudents', labelId: 'library.nav.section.students' },
    { key: 'libraryMoney', labelId: 'library.nav.section.money' },
    { key: 'libraryBooks', labelId: 'library.nav.section.books' },
  ],
  navigation: [
    { key: 'libraryCounter', icon: ScanLine, labelId: 'library.nav.counter', href: ROUTES.LIBRARY_COUNTER, module: 'library', permission: 'library.fee.create', section: 'libraryToday', order: 1 },
    { key: 'libraryHome', icon: Home, labelId: 'library.nav.home', href: ROUTES.LIBRARY_HOME, module: 'library', permission: READ, section: 'libraryToday', order: 2, bottomNav: true },
    { key: 'libraryStudents', icon: Users, labelId: 'library.nav.students', href: ROUTES.LIBRARY_STUDENTS, module: 'library', permission: READ, section: 'libraryStudents', order: 3, bottomNav: true },
    { key: 'librarySeats', icon: Armchair, labelId: 'library.nav.seats', href: ROUTES.LIBRARY_SEATS, module: 'library', permission: READ, section: 'libraryStudents', order: 4, bottomNav: true },
    { key: 'libraryFees', icon: IndianRupee, labelId: 'library.nav.fees', href: ROUTES.LIBRARY_FEES, module: 'library', permission: READ, section: 'libraryStudents', order: 5, bottomNav: true },
    { key: 'libraryAttendance', icon: CalendarCheck, labelId: 'library.nav.attendance', href: ROUTES.LIBRARY_ATTENDANCE, module: 'library', permission: READ, section: 'libraryStudents', order: 6 },
    { key: 'libraryMessages', icon: MessageCircle, labelId: 'library.nav.messages', href: ROUTES.LIBRARY_MESSAGES, module: 'library', permission: READ, section: 'libraryStudents', order: 7 },
    { key: 'libraryMoney', icon: Wallet, labelId: 'library.nav.money', href: ROUTES.LIBRARY_MONEY, module: 'library', permission: READ, section: 'libraryMoney', order: 8 },
    { key: 'libraryExpenses', icon: Receipt, labelId: 'library.nav.expenses', href: ROUTES.LIBRARY_EXPENSES, module: 'library', permission: MANAGE, section: 'libraryMoney', order: 9 },
    { key: 'libraryBooks', icon: BookOpen, labelId: 'library.nav.books', href: ROUTES.LIBRARY_BOOKS, module: 'library', permission: READ, section: 'libraryBooks', order: 10 },
    { key: 'librarySettings', icon: Settings, labelId: 'library.nav.settings', href: ROUTES.LIBRARY_SETTINGS, module: 'library', permission: MANAGE, section: 'account', order: 60 },
  ],
  // Each Library screen owns its search; a student page has its own back.
  shell: { pageBackPattern: '^/library/students/[^/]+/?$' },
};

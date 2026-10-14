/**
 * Supported locales and default translation dictionaries.
 */

import { LocaleMeta, TranslationResources } from './types'

export const DEFAULT_LOCALE = 'en'

export const SUPPORTED_LOCALES: LocaleMeta[] = [
  {
    code: 'en',
    name: 'English',
    nativeName: 'English',
    direction: 'ltr',
    defaultCurrency: 'USD',
    defaultTimezone: 'UTC',
    flag: '🇺🇸',
  },
  {
    code: 'es',
    name: 'Spanish',
    nativeName: 'Español',
    direction: 'ltr',
    defaultCurrency: 'EUR',
    defaultTimezone: 'Europe/Madrid',
    flag: '🇪🇸',
  },
  {
    code: 'fr',
    name: 'French',
    nativeName: 'Français',
    direction: 'ltr',
    defaultCurrency: 'EUR',
    defaultTimezone: 'Europe/Paris',
    flag: '🇫🇷',
  },
  {
    code: 'de',
    name: 'German',
    nativeName: 'Deutsch',
    direction: 'ltr',
    defaultCurrency: 'EUR',
    defaultTimezone: 'Europe/Berlin',
    flag: '🇩🇪',
  },
  {
    code: 'ar',
    name: 'Arabic',
    nativeName: 'العربية',
    direction: 'rtl',
    defaultCurrency: 'AED',
    defaultTimezone: 'Asia/Dubai',
    flag: '🇦🇪',
  },
]

export const DEFAULT_TRANSLATIONS: TranslationResources = {
  en: {
    common: {
      welcome: 'Welcome, {{name}}!',
      loading: 'Loading...',
      save: 'Save Changes',
      cancel: 'Cancel',
      delete: 'Delete',
      language: 'Language',
      dashboard: 'Dashboard',
      settings: 'Settings',
      notifications: 'Notifications',
      refresh: 'Refresh Data',
    },
    items: {
      zero: 'No tasks pending',
      one: '{{count}} task pending',
      other: '{{count}} tasks pending',
    },
    analytics: {
      title: 'Metrics & Performance',
      description: 'Locale-aware formatting and internationalized viewports.',
      revenue: 'Total Revenue',
      users: 'Active Users',
      conversion: 'Conversion Rate',
    },
    a11y: {
      skipToContent: 'Skip to main content',
      screenReaderAlert: 'Announcement: {{message}}',
      openMenu: 'Open language selection menu',
    },
  },
  es: {
    common: {
      welcome: '¡Bienvenido, {{name}}!',
      loading: 'Cargando...',
      save: 'Guardar Cambios',
      cancel: 'Cancelar',
      delete: 'Eliminar',
      language: 'Idioma',
      dashboard: 'Panel de Control',
      settings: 'Configuración',
      notifications: 'Notificaciones',
      refresh: 'Actualizar Datos',
    },
    items: {
      zero: 'Sin tareas pendientes',
      one: '{{count}} tarea pendiente',
      other: '{{count}} tareas pendientes',
    },
    analytics: {
      title: 'Métricas y Rendimiento',
      description: 'Formateo adaptado al idioma y vistas internacionales.',
      revenue: 'Ingresos Totales',
      users: 'Usuarios Activos',
      conversion: 'Tasa de Conversión',
    },
    a11y: {
      skipToContent: 'Saltar al contenido principal',
      screenReaderAlert: 'Aviso: {{message}}',
      openMenu: 'Abrir menú de selección de idioma',
    },
  },
  fr: {
    common: {
      welcome: 'Bienvenue, {{name}} !',
      loading: 'Chargement...',
      save: 'Enregistrer les modifications',
      cancel: 'Annuler',
      delete: 'Supprimer',
      language: 'Langue',
      dashboard: 'Tableau de bord',
      settings: 'Paramètres',
      notifications: 'Notifications',
      refresh: 'Actualiser les données',
    },
    items: {
      zero: 'Aucune tâche en attente',
      one: '{{count}} tâche en attente',
      other: '{{count}} tâches en attente',
    },
    analytics: {
      title: 'Métriques et Performances',
      description: 'Formatage adapté aux paramètres régionaux.',
      revenue: 'Revenu Total',
      users: 'Utilisateurs Actifs',
      conversion: 'Taux de Conversion',
    },
    a11y: {
      skipToContent: 'Passer au contenu principal',
      screenReaderAlert: 'Annonce : {{message}}',
      openMenu: 'Ouvrir le menu de sélection de la langue',
    },
  },
  de: {
    common: {
      welcome: 'Willkommen, {{name}}!',
      loading: 'Wird geladen...',
      save: 'Änderungen speichern',
      cancel: 'Abbrechen',
      delete: 'Löschen',
      language: 'Sprache',
      dashboard: 'Dashboard',
      settings: 'Einstellungen',
      notifications: 'Benachrichtigungen',
      refresh: 'Daten aktualisieren',
    },
    items: {
      zero: 'Keine anstehenden Aufgaben',
      one: '{{count}} anstehende Aufgabe',
      other: '{{count}} anstehende Aufgaben',
    },
    analytics: {
      title: 'Metriken & Leistung',
      description: 'Gebietsschema-angepasste Formatierung.',
      revenue: 'Gesamtumsatz',
      users: 'Aktive Benutzer',
      conversion: 'Konversionsrate',
    },
    a11y: {
      skipToContent: 'Zum Hauptinhalt springen',
      screenReaderAlert: 'Ansage: {{message}}',
      openMenu: 'Sprachauswahlmenü öffnen',
    },
  },
  ar: {
    common: {
      welcome: 'مرحبًا، {{name}}!',
      loading: 'جارٍ التحميل...',
      save: 'حفظ التغييرات',
      cancel: 'إلغاء',
      delete: 'حذف',
      language: 'اللغة',
      dashboard: 'لوحة التحكم',
      settings: 'الإعدادات',
      notifications: 'الإشعارات',
      refresh: 'تحديث البيانات',
    },
    items: {
      zero: 'لا توجد مهام معلقة',
      one: 'مهمة واحدة معلقة',
      other: '{{count}} مهام معلقة',
    },
    analytics: {
      title: 'المقاييس والأداء',
      description: 'تنسيق متوافق مع اللغة والمنطقة المحلية.',
      revenue: 'إجمالي الإيرادات',
      users: 'المستخدمون النشطون',
      conversion: 'معدل التحويل',
    },
    a11y: {
      skipToContent: 'الانتقال إلى المحتوى الرئيسي',
      screenReaderAlert: 'تنبيه: {{message}}',
      openMenu: 'فتح قائمة اختيار اللغة',
    },
  },
}

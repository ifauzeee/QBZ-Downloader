/**
 * Internationalization (i18n) Service
 * Multi-language support for the dashboard
 */

export type Locale = 'en' | 'id' | 'es' | 'fr' | 'de' | 'ja' | 'zh';

interface TranslationSet {
    appName: string;
    loading: string;
    save: string;
    cancel: string;
    delete: string;
    confirm: string;
    close: string;
    search: string;
    download: string;
    settings: string;
    history: string;
    queue: string;
    statistics: string;

    queueEmpty: string;
    queuePause: string;
    queueResume: string;
    queueClear: string;
    addToQueue: string;
    pasteUrl: string;
    downloading: string;
    pending: string;
    completed: string;
    failed: string;

    downloadComplete: string;
    downloadFailed: string;
    downloadStarting: string;
    skipExisting: string;

    credentials: string;
    downloadPath: string;
    quality: string;
    theme: string;
    language: string;
    darkMode: string;
    lightMode: string;

    invalidUrl: string;
    tokenExpired: string;
    networkError: string;

    totalDownloads: string;
    todayDownloads: string;
    totalSize: string;
    averagePerDay: string;

    notificationTitle: string;
    markAllRead: string;
    noNotifications: string;
}

const translations: Record<Locale, TranslationSet> = {
    en: {
        appName: 'QBZ Downloader',
        loading: 'Loading...',
        save: 'Save',
        cancel: 'Cancel',
        delete: 'Delete',
        confirm: 'Confirm',
        close: 'Close',
        search: 'Search',
        download: 'Download',
        settings: 'Settings',
        history: 'History',
        queue: 'Queue',
        statistics: 'Statistics',

        queueEmpty: 'Queue is empty',
        queuePause: 'Pause Queue',
        queueResume: 'Resume Queue',
        queueClear: 'Clear Queue',
        addToQueue: 'Add to Queue',
        pasteUrl: 'Paste Qobuz URL here...',
        downloading: 'Downloading',
        pending: 'Pending',
        completed: 'Completed',
        failed: 'Failed',

        downloadComplete: 'Download Complete',
        downloadFailed: 'Download Failed',
        downloadStarting: 'Starting download...',
        skipExisting: 'Skip existing files',

        credentials: 'Credentials',
        downloadPath: 'Download Path',
        quality: 'Quality',
        theme: 'Theme',
        language: 'Language',
        darkMode: 'Dark Mode',
        lightMode: 'Light Mode',

        invalidUrl: 'Invalid Qobuz URL',
        tokenExpired: 'Token expired, please update in settings',
        networkError: 'Network error, please try again',

        totalDownloads: 'Total Downloads',
        todayDownloads: 'Today',
        totalSize: 'Total Size',
        averagePerDay: 'Average/Day',

        notificationTitle: 'Notifications',
        markAllRead: 'Mark all as read',
        noNotifications: 'No notifications'
    },

    id: {
        appName: 'QBZ Downloader',
        loading: 'Memuat...',
        save: 'Simpan',
        cancel: 'Batal',
        delete: 'Hapus',
        confirm: 'Konfirmasi',
        close: 'Tutup',
        search: 'Cari',
        download: 'Unduh',
        settings: 'Pengaturan',
        history: 'Riwayat',
        queue: 'Antrian',
        statistics: 'Statistik',

        queueEmpty: 'Antrian kosong',
        queuePause: 'Jeda Antrian',
        queueResume: 'Lanjutkan Antrian',
        queueClear: 'Hapus Antrian',
        addToQueue: 'Tambah ke Antrian',
        pasteUrl: 'Tempel URL Qobuz di sini...',
        downloading: 'Mengunduh',
        pending: 'Menunggu',
        completed: 'Selesai',
        failed: 'Gagal',

        downloadComplete: 'Unduhan Selesai',
        downloadFailed: 'Unduhan Gagal',
        downloadStarting: 'Memulai unduhan...',
        skipExisting: 'Lewati file yang sudah ada',

        credentials: 'Kredensial',
        downloadPath: 'Lokasi Unduhan',
        quality: 'Kualitas',
        theme: 'Tema',
        language: 'Bahasa',
        darkMode: 'Mode Gelap',
        lightMode: 'Mode Terang',

        invalidUrl: 'URL Qobuz tidak valid',
        tokenExpired: 'Token kadaluarsa, silakan perbarui di pengaturan',
        networkError: 'Kesalahan jaringan, coba lagi',

        totalDownloads: 'Total Unduhan',
        todayDownloads: 'Hari Ini',
        totalSize: 'Total Ukuran',
        averagePerDay: 'Rata-rata/Hari',

        notificationTitle: 'Notifikasi',
        markAllRead: 'Tandai semua telah dibaca',
        noNotifications: 'Tidak ada notifikasi'
    },

    es: {
        appName: 'QBZ Downloader',
        loading: 'Cargando...',
        save: 'Guardar',
        cancel: 'Cancelar',
        delete: 'Eliminar',
        confirm: 'Confirmar',
        close: 'Cerrar',
        search: 'Buscar',
        download: 'Descargar',
        settings: 'Configuración',
        history: 'Historial',
        queue: 'Cola',
        statistics: 'Estadísticas',

        queueEmpty: 'La cola está vacía',
        queuePause: 'Pausar Cola',
        queueResume: 'Reanudar Cola',
        queueClear: 'Limpiar Cola',
        addToQueue: 'Añadir a la Cola',
        pasteUrl: 'Pega la URL de Qobuz aquí...',
        downloading: 'Descargando',
        pending: 'Pendiente',
        completed: 'Completado',
        failed: 'Fallido',

        downloadComplete: 'Descarga Completa',
        downloadFailed: 'Descarga Fallida',
        downloadStarting: 'Iniciando descarga...',
        skipExisting: 'Omitir archivos existentes',

        credentials: 'Credenciales',
        downloadPath: 'Ruta de Descarga',
        quality: 'Calidad',
        theme: 'Tema',
        language: 'Idioma',
        darkMode: 'Modo Oscuro',
        lightMode: 'Modo Claro',

        invalidUrl: 'URL de Qobuz inválida',
        tokenExpired: 'Token expirado, actualiza en configuración',
        networkError: 'Error de red, intenta de nuevo',

        totalDownloads: 'Total de Descargas',
        todayDownloads: 'Hoy',
        totalSize: 'Tamaño Total',
        averagePerDay: 'Promedio/Día',

        notificationTitle: 'Notificaciones',
        markAllRead: 'Marcar todo como leído',
        noNotifications: 'Sin notificaciones'
    },

    fr: {
        appName: 'QBZ Downloader',
        loading: 'Chargement...',
        save: 'Enregistrer',
        cancel: 'Annuler',
        delete: 'Supprimer',
        confirm: 'Confirmer',
        close: 'Fermer',
        search: 'Rechercher',
        download: 'Télécharger',
        settings: 'Paramètres',
        history: 'Historique',
        queue: "File d'attente",
        statistics: 'Statistiques',

        queueEmpty: 'La file est vide',
        queuePause: 'Pause',
        queueResume: 'Reprendre',
        queueClear: 'Vider la file',
        addToQueue: 'Ajouter à la file',
        pasteUrl: "Collez l'URL Qobuz ici...",
        downloading: 'Téléchargement',
        pending: 'En attente',
        completed: 'Terminé',
        failed: 'Échoué',

        downloadComplete: 'Téléchargement Terminé',
        downloadFailed: 'Téléchargement Échoué',
        downloadStarting: 'Démarrage du téléchargement...',
        skipExisting: 'Ignorer les fichiers existants',

        credentials: 'Identifiants',
        downloadPath: 'Chemin de téléchargement',
        quality: 'Qualité',
        theme: 'Thème',
        language: 'Langue',
        darkMode: 'Mode Sombre',
        lightMode: 'Mode Clair',

        invalidUrl: 'URL Qobuz invalide',
        tokenExpired: 'Token expiré, mettez à jour dans les paramètres',
        networkError: 'Erreur réseau, réessayez',

        totalDownloads: 'Total des Téléchargements',
        todayDownloads: "Aujourd'hui",
        totalSize: 'Taille Totale',
        averagePerDay: 'Moyenne/Jour',

        notificationTitle: 'Notifications',
        markAllRead: 'Tout marquer comme lu',
        noNotifications: 'Aucune notification'
    },

    de: {
        appName: 'QBZ Downloader',
        loading: 'Laden...',
        save: 'Speichern',
        cancel: 'Abbrechen',
        delete: 'Löschen',
        confirm: 'Bestätigen',
        close: 'Schließen',
        search: 'Suchen',
        download: 'Herunterladen',
        settings: 'Einstellungen',
        history: 'Verlauf',
        queue: 'Warteschlange',
        statistics: 'Statistiken',

        queueEmpty: 'Warteschlange ist leer',
        queuePause: 'Pause',
        queueResume: 'Fortsetzen',
        queueClear: 'Leeren',
        addToQueue: 'Zur Warteschlange',
        pasteUrl: 'Qobuz-URL hier einfügen...',
        downloading: 'Wird heruntergeladen',
        pending: 'Ausstehend',
        completed: 'Abgeschlossen',
        failed: 'Fehlgeschlagen',

        downloadComplete: 'Download Abgeschlossen',
        downloadFailed: 'Download Fehlgeschlagen',
        downloadStarting: 'Download startet...',
        skipExisting: 'Vorhandene überspringen',

        credentials: 'Zugangsdaten',
        downloadPath: 'Download-Pfad',
        quality: 'Qualität',
        theme: 'Design',
        language: 'Sprache',
        darkMode: 'Dunkelmodus',
        lightMode: 'Hellmodus',

        invalidUrl: 'Ungültige Qobuz-URL',
        tokenExpired: 'Token abgelaufen',
        networkError: 'Netzwerkfehler',

        totalDownloads: 'Downloads Gesamt',
        todayDownloads: 'Heute',
        totalSize: 'Gesamtgröße',
        averagePerDay: 'Durchschnitt/Tag',

        notificationTitle: 'Benachrichtigungen',
        markAllRead: 'Alle als gelesen markieren',
        noNotifications: 'Keine Benachrichtigungen'
    },

    ja: {
        appName: 'QBZ Downloader',
        loading: '読み込み中...',
        save: '保存',
        cancel: 'キャンセル',
        delete: '削除',
        confirm: '確認',
        close: '閉じる',
        search: '検索',
        download: 'ダウンロード',
        settings: '設定',
        history: '履歴',
        queue: 'キュー',
        statistics: '統計',

        queueEmpty: 'キューは空です',
        queuePause: '一時停止',
        queueResume: '再開',
        queueClear: 'クリア',
        addToQueue: 'キューに追加',
        pasteUrl: 'Qobuz URLを貼り付け...',
        downloading: 'ダウンロード中',
        pending: '待機中',
        completed: '完了',
        failed: '失敗',

        downloadComplete: 'ダウンロード完了',
        downloadFailed: 'ダウンロード失敗',
        downloadStarting: 'ダウンロード開始中...',
        skipExisting: '既存をスキップ',

        credentials: '認証情報',
        downloadPath: '保存先',
        quality: '品質',
        theme: 'テーマ',
        language: '言語',
        darkMode: 'ダークモード',
        lightMode: 'ライトモード',

        invalidUrl: '無効なURL',
        tokenExpired: 'トークン期限切れ',
        networkError: 'ネットワークエラー',

        totalDownloads: '総ダウンロード',
        todayDownloads: '今日',
        totalSize: '合計サイズ',
        averagePerDay: '日平均',

        notificationTitle: '通知',
        markAllRead: 'すべて既読にする',
        noNotifications: '通知なし'
    },

    zh: {
        appName: 'QBZ Downloader',
        loading: '加载中...',
        save: '保存',
        cancel: '取消',
        delete: '删除',
        confirm: '确认',
        close: '关闭',
        search: '搜索',
        download: '下载',
        settings: '设置',
        history: '历史',
        queue: '队列',
        statistics: '统计',

        queueEmpty: '队列为空',
        queuePause: '暂停',
        queueResume: '继续',
        queueClear: '清空',
        addToQueue: '添加到队列',
        pasteUrl: '粘贴 Qobuz URL...',
        downloading: '下载中',
        pending: '等待中',
        completed: '已完成',
        failed: '失败',

        downloadComplete: '下载完成',
        downloadFailed: '下载失败',
        downloadStarting: '开始下载...',
        skipExisting: '跳过已存在文件',

        credentials: '凭证',
        downloadPath: '下载路径',
        quality: '质量',
        theme: '主题',
        language: '语言',
        darkMode: '深色模式',
        lightMode: '浅色模式',

        invalidUrl: '无效的URL',
        tokenExpired: '令牌已过期',
        networkError: '网络错误',

        totalDownloads: '总下载',
        todayDownloads: '今日',
        totalSize: '总大小',
        averagePerDay: '日均',

        notificationTitle: '通知',
        markAllRead: '全部标记已读',
        noNotifications: '暂无通知'
    }
};

class I18nService {
    private currentLocale: Locale = 'en';

    /**
     * Set current locale
     */
    setLocale(locale: Locale): void {
        if (translations[locale]) {
            this.currentLocale = locale;
        }
    }

    /**
     * Get current locale
     */
    getLocale(): Locale {
        return this.currentLocale;
    }

    /**
     * Get available locales
     */
    getAvailableLocales(): { code: Locale; name: string }[] {
        return [
            { code: 'en', name: 'English' },
            { code: 'id', name: 'Bahasa Indonesia' },
            { code: 'es', name: 'Español' },
            { code: 'fr', name: 'Français' },
            { code: 'de', name: 'Deutsch' },
            { code: 'ja', name: '日本語' },
            { code: 'zh', name: '中文' }
        ];
    }

    /**
     * Get translation
     */
    t(key: keyof TranslationSet): string {
        return translations[this.currentLocale][key] || translations.en[key] || key;
    }

    /**
     * Get all translations for current locale
     */
    getAll(): TranslationSet {
        return translations[this.currentLocale];
    }
}

export const i18n = new I18nService();

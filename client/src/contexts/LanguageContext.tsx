
import React, { createContext, useContext, useState, type ReactNode } from 'react';

export type Language = 'en' | 'id' | 'es' | 'fr' | 'de' | 'ja' | 'zh';

interface Translations {
    [key: string]: {
        [key in Language]: string;
    }
}

const translations: Translations = {
    menu_queue: {
        en: 'Queue', id: 'Antrian', es: 'Cola', fr: 'File d\'attente', de: 'Warteschlange', ja: 'キュー', zh: '队列'
    },
    menu_search: {
        en: 'Search', id: 'Cari', es: 'Buscar', fr: 'Rechercher', de: 'Suchen', ja: '検索', zh: '搜索'
    },
    menu_batch: {
        en: 'Batch Import', id: 'Impor Batch', es: 'Importar Lote', fr: 'Import par lot', de: 'Stapelimport', ja: '一括インポート', zh: '批量导入'
    },
    menu_analytics: {
        en: 'Analytics', id: 'Analitik', es: 'Analítica', fr: 'Analytique', de: 'Statistiken', ja: '分析', zh: '分析'
    },
    menu_library: {
        en: 'Library', id: 'Pustaka', es: 'Biblioteca', fr: 'Bibliothèque', de: 'Bibliothek', ja: 'ライブラリ', zh: '库'
    },
    menu_playlists: {
        en: 'Playlists', id: 'Playlist', es: 'Listas', fr: 'Playlists', de: 'Wiedergabelisten', ja: 'プレイリスト', zh: '播放列表'
    },
    menu_history: {
        en: 'History', id: 'Riwayat', es: 'Historial', fr: 'Historique', de: 'Verlauf', ja: '履歴', zh: '历史'
    },
    menu_settings: {
        en: 'Settings', id: 'Pengaturan', es: 'Ajustes', fr: 'Paramètres', de: 'Einstellungen', ja: '設定', zh: '设置'
    },

    title_queue: {
        en: 'Download Queue', id: 'Antrian Unduhan', es: 'Cola de Descarga', fr: 'File de Téléchargement', de: 'Download-Warteschlange', ja: 'ダウンロードキュー', zh: '下载队列'
    },
    title_search: {
        en: 'Library Search', id: 'Pencarian Pustaka', es: 'Búsqueda de Biblioteca', fr: 'Recherche de Bibliothèque', de: 'Bibliothekssuche', ja: 'ライブラリ検索', zh: '库搜索'
    },
    title_batch: {
        en: 'Batch Import', id: 'Impor Batch', es: 'Importar Lote', fr: 'Import par lot', de: 'Stapelimport', ja: '一括インポート', zh: '批量导入'
    },
    title_analytics: {
        en: 'Analytics Dashboard', id: 'Dasbor Analitik', es: 'Panel de Analítica', fr: 'Tableau de Bord Analytique', de: 'Analyse-Dashboard', ja: '分析ダッシュボード', zh: '分析仪表板'
    },
    title_library: {
        en: 'Music Library', id: 'Pustaka Musik', es: 'Biblioteca de Música', fr: 'Bibliothèque Musicale', de: 'Musikbibliothek', ja: '音楽ライブラリ', zh: '音乐库'
    },
    title_playlists: {
        en: 'Watched Playlists', id: 'Playlist Tersimpan', es: 'Listas Guardadas', fr: 'Playlists Suivies', de: 'Beobachtete Playlists', ja: '保存されたプレイリスト', zh: '观察的播放列表'
    },
    title_history: {
        en: 'Download History', id: 'Riwayat Unduhan', es: 'Historial de Descargas', fr: 'Historique des Téléchargements', de: 'Download-Verlauf', ja: 'ダウンロード履歴', zh: '下载历史'
    },
    title_settings: {
        en: 'Settings', id: 'Pengaturan', es: 'Configuración', fr: 'Paramètres', de: 'Einstellungen', ja: '設定', zh: '设置'
    },
    title_album: {
        en: 'Album View', id: 'Tampilan Album', es: 'Vista de Álbum', fr: 'Vue Album', de: 'Albumansicht', ja: 'アルバムビュー', zh: '专辑视图'
    },
    title_artist: {
        en: 'Artist Detail', id: 'Detail Artis', es: 'Detalle del Artista', fr: 'Détail Artiste', de: 'Künstlerdetails', ja: 'アーティスト詳細', zh: '艺术家详情'
    },
    title_dashboard: {
        en: 'Dashboard', id: 'Dasbor', es: 'Tablero', fr: 'Tableau de Bord', de: 'Dashboard', ja: 'ダッシュボード', zh: '仪表板'
    },

    action_add_url: {
        en: 'Add URL', id: 'Tambah URL', es: 'Añadir URL', fr: 'Ajouter URL', de: 'URL hinzufügen', ja: 'URLを追加', zh: '添加URL'
    },
    action_scan: {
        en: 'Scan Library', id: 'Pindai Pustaka', es: 'Escanear Biblioteca', fr: 'Scanner Bibliothèque', de: 'Bibliothek scannen', ja: 'ライブラリスキャン', zh: '扫描库'
    },
    action_stop: {
        en: 'Stop', id: 'Berhenti', es: 'Detener', fr: 'Arrêter', de: 'Stopp', ja: '停止', zh: '停止'
    },
    action_pause: {
        en: 'Pause', id: 'Jeda', es: 'Pausar', fr: 'Pause', de: 'Pause', ja: '一時停止', zh: '暂停'
    },
    action_resume: {
        en: 'Resume', id: 'Lanjut', es: 'Reanudar', fr: 'Reprendre', de: 'Fortsetzen', ja: '再開', zh: '恢复'
    },
    action_clear: {
        en: 'Clear All', id: 'Hapus Semua', es: 'Limpiar Todo', fr: 'Tout Effacer', de: 'Alles Löschen', ja: 'すべてクリア', zh: '全部清除'
    },
    action_download: {
        en: 'Download', id: 'Unduh', es: 'Descargar', fr: 'Télécharger', de: 'Herunterladen', ja: 'ダウンロード', zh: '下载'
    },
    action_delete: {
        en: 'Delete', id: 'Hapus', es: 'Eliminar', fr: 'Supprimer', de: 'Löschen', ja: '削除', zh: '删除'
    },
    action_play: {
        en: 'Play', id: 'Putar', es: 'Reproducir', fr: 'Lire', de: 'Abspielen', ja: '再生', zh: '播放'
    },
    action_view_tracks: {
        en: 'View Tracks', id: 'Lihat Lagu', es: 'Ver Pistas', fr: 'Voir Pistes', de: 'Titel ansehen', ja: 'トラックを表示', zh: '查看曲目'
    },
    action_upgrade: {
        en: 'Upgrade', id: 'Upgrade', es: 'Mejorar', fr: 'Mettre à niveau', de: 'Upgraden', ja: 'アップグレード', zh: '升级'
    },
    action_resolve: {
        en: 'Magic Resolve', id: 'Resolve Otomatis', es: 'Resolución Mágica', fr: 'Résolution Magique', de: 'Magische Auflösung', ja: '自動解決', zh: '自动解析'
    },
    action_export_json: {
        en: 'Export JSON', id: 'Ekspor JSON', es: 'Exportar JSON', fr: 'Exporter JSON', de: 'JSON exportieren', ja: 'JSONエクスポート', zh: '导出JSON'
    },
    action_export_csv: {
        en: 'Export CSV', id: 'Ekspor CSV', es: 'Exportar CSV', fr: 'Exporter CSV', de: 'CSV exportieren', ja: 'CSVエクスポート', zh: '导出CSV'
    },
    action_delete_history: {
        en: 'Delete All History', id: 'Hapus Semua Riwayat', es: 'Borrar Historial', fr: 'Effacer Historique', de: 'Verlauf löschen', ja: '履歴を削除', zh: '删除所有历史'
    },

    msg_confirm_delete: {
        en: 'Are you sure you want to delete this item?', id: 'Apakah Anda yakin ingin menghapus item ini?', es: '¿Estás seguro de eliminar este ítem?', fr: 'Êtes-vous sûr de vouloir supprimer cet élément ?', de: 'Sind Sie sicher, dass Sie dieses Element löschen möchten?', ja: 'この項目を削除してもよろしいですか？', zh: '确定要删除此项吗？'
    },
    msg_confirm_clear_history: {
        en: 'Clear all history? This cannot be undone.', id: 'Hapus semua riwayat? Tindakan ini tidak dapat dibatalkan.', es: '¿Borrar todo el historial? Esto no se puede deshacer.', fr: 'Effacer tout l\'historique ? Ceci est irréversible.', de: 'Verlauf löschen? Dies kann nicht rückgängig gemacht werden.', ja: '履歴をすべて消去しますか？これは元に戻せません。', zh: '清除所有历史记录？此操作无法撤销。'
    },
    msg_no_results: {
        en: 'No Results', id: 'Tidak Ada Hasil', es: 'Sin Resultados', fr: 'Aucun Résultat', de: 'Keine Ergebnisse', ja: '結果なし', zh: '无结果'
    },
    msg_start_searching: {
        en: 'Start Searching', id: 'Mulai Mencari', es: 'Empezar a Buscar', fr: 'Commencer la Recherche', de: 'Suche starten', ja: '検索を開始', zh: '开始搜索'
    },
    msg_enter_keywords: {
        en: 'Enter keywords to search', id: 'Masukkan kata kunci untuk mencari', es: 'Introduce palabras clave', fr: 'Entrez des mots-clés', de: 'Suchbegriffe eingeben', ja: 'キーワードを入力', zh: '输入关键词搜索'
    },
    msg_try_keywords: {
        en: 'Try different keywords', id: 'Coba kata kunci lain', es: 'Prueba otras palabras clave', fr: 'Essayez d\'autres mots-clés', de: 'Versuchen Sie andere Suchbegriffe', ja: '別のキーワードを試してください', zh: '尝试不同的关键词'
    },
    msg_scanning: {
        en: 'Scanning...', id: 'Memindai...', es: 'Escaneando...', fr: 'Scan en cours...', de: 'Scannen...', ja: 'スキャン中...', zh: '扫描中...'
    },
    msg_not_scanning: {
        en: 'Not scanning', id: 'Tidak memindai', es: 'No escaneando', fr: 'Pas de scan', de: 'Nicht scannen', ja: 'スキャンしていません', zh: '未扫描'
    },
    msg_queue_empty: {
        en: 'Queue is Empty', id: 'Antrian Kosong', es: 'Cola Vacía', fr: 'File vide', de: 'Warteschlange leer', ja: 'キューは空です', zh: '队列为空'
    },
    msg_add_urls: {
        en: 'Add URLs to start downloading', id: 'Tambahkan URL untuk mulai mengunduh', es: 'Añade URLs para descargar', fr: 'Ajoutez des URL pour télécharger', de: 'URLs hinzufügen', ja: 'URLを追加して開始', zh: '添加URL以开始下载'
    },
    msg_no_history: {
        en: 'No History', id: 'Tidak Ada Riwayat', es: 'Sin Historial', fr: 'Aucun Historique', de: 'Kein Verlauf', ja: '履歴なし', zh: '无历史'
    },
    msg_history_empty: {
        en: 'Completed downloads will appear here', id: 'Unduhan yang selesai akan muncul di sini', es: 'Las descargas completadas aparecerán aquí', fr: 'Les téléchargements terminés apparaîtront ici', de: 'Abgeschlossene Downloads erscheinen hier', ja: '完了したダウンロードはここに表示されます', zh: '已完成的下载将显示在这里'
    },
    msg_added_to_queue: {
        en: 'Added to download queue', id: 'Ditambahkan ke antrian unduh', es: 'Añadido a la cola', fr: 'Ajouté à la file', de: 'Zur Warteschlange hinzugefügt', ja: 'キューに追加されました', zh: '已添加到下载队列'
    },

    label_total_files: {
        en: 'Total Files', id: 'Total File', es: 'Total Archivos', fr: 'Total Fichiers', de: 'Dateien Gesamt', ja: '総ファイル', zh: '总文件'
    },
    label_duplicates: {
        en: 'Duplicates', id: 'Duplikat', es: 'Duplicados', fr: 'Doublons', de: 'Duplikate', ja: '重複', zh: '重复'
    },
    label_hires: {
        en: 'Hi-Res', id: 'Hi-Res', es: 'Hi-Res', fr: 'Hi-Res', de: 'Hi-Res', ja: 'ハイレゾ', zh: '高解析度'
    },
    label_total_size: {
        en: 'Total Size', id: 'Ukuran Total', es: 'Tamaño Total', fr: 'Taille Totale', de: 'Gesamtgröße', ja: '合計サイズ', zh: '总大小'
    },
    label_daily_avg: {
        en: 'Daily Average', id: 'Rata-rata Harian', es: 'Promedio Diario', fr: 'Moyenne Quotidienne', de: 'Tagesdurchschnitt', ja: '日平均', zh: '日均'
    },

    tab_duplicates: {
        en: 'Duplicates', id: 'Duplikat', es: 'Duplicados', fr: 'Doublons', de: 'Duplikate', ja: '重複', zh: '重复'
    },
    tab_upgradeable: {
        en: 'Hi-Res Available', id: 'Tersedia Hi-Res', es: 'Hi-Res Disponible', fr: 'Hi-Res Disponible', de: 'Hi-Res Verfügbar', ja: 'ハイレゾ利用可能', zh: '可用高解析度'
    },

    common_loading: {
        en: 'Loading...', id: 'Memuat...', es: 'Cargando...', fr: 'Chargement...', de: 'Laden...', ja: '読み込み中...', zh: '加载中...'
    },
    common_search_placeholder: {
        en: 'Search albums, tracks, or artists...', id: 'Cari album, lagu, atau artis...', es: 'Buscar álbumes, pistas o artistas...', fr: 'Rechercher albums, pistes, artistes...', de: 'Alben, Titel oder Künstler suchen...', ja: 'アルバム、曲、アーティストを検索...', zh: '搜索专辑、曲目或艺术家...'
    },

    sec_danger: {
        en: 'Danger Zone', id: 'Area Berbahaya', es: 'Zona de Peligro', fr: 'Zone de Danger', de: 'Gefahrenzone', ja: '危険地帯', zh: '危险区域'
    },
    desc_danger: {
        en: 'Irreversible actions that affect your data.', id: 'Tindakan permanen yang mempengaruhi data Anda.', es: 'Acciones irreversibles.', fr: 'Actions irréversibles.', de: 'Irreversible Aktionen.', ja: '取り消せない操作。', zh: '不可逆的操作。'
    },
    action_reset_full: {
        en: 'Clear All Data (Reset Database)', id: 'Hapus Semua Data (Reset Database)', es: 'Borrar Todo (Reset DB)', fr: 'Tout Effacer (Reset DB)', de: 'Alles Löschen (Reset DB)', ja: '全データ消去（DBリセット）', zh: '清除所有数据（重置数据库）'
    },
    sec_creds: {
        en: 'Credential Status', id: 'Status Kredensial', es: 'Estado de Credenciales', fr: 'État des Identifiants', de: 'Anmeldedaten Status', ja: '認証情報の状態', zh: '凭证状态'
    },
    action_validate: {
        en: 'Validate Credentials', id: 'Validasi Kredensial', es: 'Validar Credenciales', fr: 'Valider Identifiants', de: 'Anmeldedaten prüfen', ja: '認証情報を検証', zh: '验证凭证'
    },
    sec_update_creds: {
        en: 'Update Credentials', id: 'Perbarui Kredensial', es: 'Actualizar Credenciales', fr: 'Mettre à jour Identifiants', de: 'Anmeldedaten aktualisieren', ja: '認証情報を更新', zh: '更新凭证'
    },
    desc_update_creds: {
        en: 'Leave fields empty to keep current values.', id: 'Biarkan kosong untuk menyimpan nilai saat ini.', es: 'Dejar vacío para mantener actual.', fr: 'Laisser vide pour conserver actuel.', de: 'Leer lassen um beizubehalten.', ja: '現在の値を保持するには空のままにしてください。', zh: '留空以保留当前值。'
    },
    action_update_creds: {
        en: 'Update Credentials', id: 'Perbarui Kredensial', es: 'Actualizar', fr: 'Mettre à jour', de: 'Aktualisieren', ja: '更新', zh: '更新'
    },
    sec_config: {
        en: 'Current Configuration', id: 'Konfigurasi Saat Ini', es: 'Configuración Actual', fr: 'Configuration Actuelle', de: 'Aktuelle Konfiguration', ja: '現在の設定', zh: '当前配置'
    },
    desc_config: {
        en: 'These settings are loaded from .env file.', id: 'Pengaturan ini dimuat dari file .env.', es: 'Cargado desde .env.', fr: 'Chargé depuis .env.', de: 'Aus .env geladen.', ja: '.envファイルから読み込まれました。', zh: '这些设置从.env文件加载。'
    },
    sec_appearance: {
        en: 'Appearance', id: 'Tampilan', es: 'Apariencia', fr: 'Apparence', de: 'Erscheinungsbild', ja: '外観', zh: '外观'
    },
    label_theme: {
        en: 'Theme', id: 'Tema', es: 'Tema', fr: 'Thème', de: 'Thema', ja: 'テーマ', zh: '主题'
    },
    default_theme: {
        en: 'Default Theme', id: 'Tema Bawaan', es: 'Tema Predeterminado', fr: 'Thème par défaut', de: 'Standardthema', ja: 'デフォルトテーマ', zh: '默认主题'
    },
    common_toggle_theme: {
        en: 'Toggle Theme', id: 'Ganti Tema', es: 'Cambiar Tema', fr: 'Changer de Thème', de: 'Thema umschalten', ja: 'テーマを切り替え', zh: '切换主题'
    },
    label_language: {
        en: 'Language', id: 'Bahasa', es: 'Idioma', fr: 'Langue', de: 'Sprache', ja: '言語', zh: '语言'
    },
    label_dl_path: {
        en: 'Download Path', id: 'Folder Unduhan', es: 'Ruta Descarga', fr: 'Chemin Téléchargement', de: 'Download-Pfad', ja: '保存先', zh: '下载路径'
    },
    label_folder_tmpl: {
        en: 'Folder Template', id: 'Template Folder', es: 'Plantilla Carpeta', fr: 'Modèle Dossier', de: 'Umbenennung Ordner', ja: 'フォルダテンプレート', zh: '文件夹模板'
    },
    label_file_tmpl: {
        en: 'File Template', id: 'Template File', es: 'Plantilla Archivo', fr: 'Modèle Fichier', de: 'Umbenennung Datei', ja: 'ファイルテンプレート', zh: '文件模板'
    },
    label_concurrency: {
        en: 'Max Concurrent', id: 'Maks. Bersamaan', es: 'Máx. Simultáneo', fr: 'Max Simultané', de: 'Max. Gleichzeitig', ja: '最大同時', zh: '最大并发'
    }
};

interface LanguageContextType {
    language: Language;
    setLanguage: (lang: Language) => void;
    t: (key: string) => string;
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

export const LanguageProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
    const [language, setLanguageState] = useState<Language>(
        (localStorage.getItem('language') as Language) || 'id'
    );

    const setLanguage = (lang: Language) => {
        setLanguageState(lang);
        localStorage.setItem('language', lang);
    };

    const t = (key: string): string => {
        if (!translations[key]) return key;
        return translations[key][language] || translations[key].en;
    };

    return (
        <LanguageContext.Provider value={{ language, setLanguage, t }}>
            {children}
        </LanguageContext.Provider>
    );
};

export const useLanguage = () => {
    const context = useContext(LanguageContext);
    if (context === undefined) {
        throw new Error('useLanguage must be used within a LanguageProvider');
    }
    return context;
};

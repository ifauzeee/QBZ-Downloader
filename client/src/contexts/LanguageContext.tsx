
import React, { createContext, useContext, useState, type ReactNode } from 'react';

export type Language = 'en' | 'id' | 'es' | 'fr' | 'de' | 'ja' | 'zh' | 'hi' | 'tr';

interface Translations {
    [key: string]: {
        [key in Language]: string;
    }
}

const translations: Translations = {
    menu_queue: {
        en: 'Queue', id: 'Antrian', es: 'Cola', fr: 'File d\'attente', de: 'Warteschlange', ja: 'キュー', zh: '队列', hi: 'कतार', tr: 'Kuyruk'
    },
    menu_search: {
        en: 'Search', id: 'Cari', es: 'Buscar', fr: 'Rechercher', de: 'Suchen', ja: '検索', zh: '搜索', hi: 'खोज', tr: 'Ara'
    },
    menu_batch: {
        en: 'Batch Import', id: 'Impor Batch', es: 'Importar Lote', fr: 'Import par lot', de: 'Stapelimport', ja: '一括インポート', zh: '批量导入', hi: 'बैच आयात', tr: 'Toplu İçe Aktar'
    },
    menu_analytics: {
        en: 'Analytics', id: 'Analitik', es: 'Analítica', fr: 'Analytique', de: 'Statistiken', ja: '分析', zh: '分析', hi: 'एनालिटिक्स', tr: 'Analizler'
    },
    menu_library: {
        en: 'Library', id: 'Pustaka', es: 'Biblioteca', fr: 'Bibliothèque', de: 'Bibliothek', ja: 'ライブラリ', zh: '库', hi: 'लाइब्रेरी', tr: 'Kütüphane'
    },
    menu_playlists: {
        en: 'Playlists', id: 'Playlist', es: 'Listas', fr: 'Playlists', de: 'Wiedergabelisten', ja: 'プレイリスト', zh: '播放列表', hi: 'प्लेलिस्ट', tr: 'Çalma Listeleri'
    },
    menu_history: {
        en: 'History', id: 'Riwayat', es: 'Historial', fr: 'Historique', de: 'Verlauf', ja: '履歴', zh: '历史', hi: 'इतिहास', tr: 'Geçmiş'
    },
    menu_settings: {
        en: 'Settings', id: 'Pengaturan', es: 'Ajustes', fr: 'Paramètres', de: 'Einstellungen', ja: '設定', zh: '设置', hi: 'सेटिंग्स', tr: 'Ayarlar'
    },

    title_queue: {
        en: 'Download Queue', id: 'Antrian Unduhan', es: 'Cola de Descarga', fr: 'File de Téléchargement', de: 'Download-Warteschlange', ja: 'ダウンロードキュー', zh: '下载队列', hi: 'डाउनलोड कतार', tr: 'İndirme Kuyruğu'
    },
    title_search: {
        en: 'Library Search', id: 'Pencarian Pustaka', es: 'Búsqueda de Biblioteca', fr: 'Recherche de Bibliothèque', de: 'Bibliothekssuche', ja: 'ライブラリ検索', zh: '库搜索', hi: 'लाइब्रेरी खोज', tr: 'Kütüphane Araması'
    },
    title_batch: {
        en: 'Batch Import', id: 'Impor Batch', es: 'Importar Lote', fr: 'Import par lot', de: 'Stapelimport', ja: '一括インポート', zh: '批量导入', hi: 'बैच आयात', tr: 'Toplu İçe Aktar'
    },
    title_analytics: {
        en: 'Analytics Dashboard', id: 'Dasbor Analitik', es: 'Panel de Analítica', fr: 'Tableau de Bord Analytique', de: 'Analyse-Dashboard', ja: '分析ダッシュボード', zh: '分析仪表板', hi: 'एनालिटिक्स डैशबोर्ड', tr: 'Analiz Paneli'
    },
    title_library: {
        en: 'Music Library', id: 'Pustaka Musik', es: 'Biblioteca de Música', fr: 'Bibliothèque Musicale', de: 'Musikbibliothek', ja: '音楽ライブラリ', zh: '音乐库', hi: 'संगीत लाइब्रेरी', tr: 'Müzik Kütüphanesi'
    },
    title_playlists: {
        en: 'Watched Playlists', id: 'Playlist Tersimpan', es: 'Listas Guardadas', fr: 'Playlists Suivies', de: 'Beobachtete Playlists', ja: '保存されたプレイリスト', zh: '观察的播放列表', hi: 'देखी गई प्लेलिस्ट', tr: 'İzlenen Çalma Listeleri'
    },
    title_history: {
        en: 'Download History', id: 'Riwayat Unduhan', es: 'Historial de Descargas', fr: 'Historique des Téléchargements', de: 'Download-Verlauf', ja: 'ダウンロード履歴', zh: '下载历史', hi: 'डाउनलोड इतिहास', tr: 'İndirme Geçmişi'
    },
    title_settings: {
        en: 'Settings', id: 'Pengaturan', es: 'Configuración', fr: 'Paramètres', de: 'Einstellungen', ja: '設定', zh: '设置', hi: 'सेटिंग्स', tr: 'Ayarlar'
    },
    title_album: {
        en: 'Album View', id: 'Tampilan Album', es: 'Vista de Álbum', fr: 'Vue Album', de: 'Albumansicht', ja: 'アルバムビュー', zh: '专辑视图', hi: 'एल्बम दृश्य', tr: 'Albüm Görünümü'
    },
    title_artist: {
        en: 'Artist Detail', id: 'Detail Artis', es: 'Detalle del Artista', fr: 'Détail Artiste', de: 'Künstlerdetails', ja: 'アーティスト詳細', zh: '艺术家详情', hi: 'कलाकार विवरण', tr: 'Sanatçı Detayı'
    },
    title_dashboard: {
        en: 'Dashboard', id: 'Dasbor', es: 'Tablero', fr: 'Tableau de Bord', de: 'Dashboard', ja: 'ダッシュボード', zh: '仪表板', hi: 'डैशबोर्ड', tr: 'Panel'
    },

    action_add_url: {
        en: 'Add URL', id: 'Tambah URL', es: 'Añadir URL', fr: 'Ajouter URL', de: 'URL hinzufügen', ja: 'URLを追加', zh: '添加URL', hi: 'URL जोड़ें', tr: 'URL Ekle'
    },
    action_scan: {
        en: 'Scan Library', id: 'Pindai Pustaka', es: 'Escanear Biblioteca', fr: 'Scanner Bibliothèque', de: 'Bibliothek scannen', ja: 'ライブラリスキャン', zh: '扫描库', hi: 'लाइब्रेरी स्कैन करें', tr: 'Kütüphaneyi Tara'
    },
    action_stop: {
        en: 'Stop', id: 'Berhenti', es: 'Detener', fr: 'Arrêter', de: 'Stopp', ja: '停止', zh: '停止', hi: 'रोकें', tr: 'Durdur'
    },
    action_pause: {
        en: 'Pause', id: 'Jeda', es: 'Pausar', fr: 'Pause', de: 'Pause', ja: '一時停止', zh: '暂停', hi: 'रोकें', tr: 'Duraklat'
    },
    action_resume: {
        en: 'Resume', id: 'Lanjut', es: 'Reanudar', fr: 'Reprendre', de: 'Fortsetzen', ja: '再開', zh: '恢复', hi: 'फिर से शुरू करें', tr: 'Devam Et'
    },
    action_clear: {
        en: 'Clear All', id: 'Hapus Semua', es: 'Limpiar Todo', fr: 'Tout Effacer', de: 'Alles Löschen', ja: 'すべてクリア', zh: '全部清除', hi: 'सभी साफ करें', tr: 'Tümünü Temizle'
    },
    action_download: {
        en: 'Download', id: 'Unduh', es: 'Descargar', fr: 'Télécharger', de: 'Herunterladen', ja: 'ダウンロード', zh: '下载', hi: 'डाउनलोड', tr: 'İndir'
    },
    action_delete: {
        en: 'Delete', id: 'Hapus', es: 'Eliminar', fr: 'Supprimer', de: 'Löschen', ja: '削除', zh: '删除', hi: 'हटाएं', tr: 'Sil'
    },
    action_play: {
        en: 'Play', id: 'Putar', es: 'Reproducir', fr: 'Lire', de: 'Abspielen', ja: '再生', zh: '播放', hi: 'çalar', tr: 'Oynat'
    },
    action_view_tracks: {
        en: 'View Tracks', id: 'Lihat Lagu', es: 'Ver Pistas', fr: 'Voir Pistes', de: 'Titel ansehen', ja: 'トラックを表示', zh: '查看曲目', hi: 'ट्रैक देखें', tr: 'Parçaları Görüntüle'
    },
    action_upgrade: {
        en: 'Upgrade', id: 'Upgrade', es: 'Mejorar', fr: 'Mettre à niveau', de: 'Upgraden', ja: 'アップグレード', zh: '升级', hi: 'अपग्रेड', tr: 'Yükselt'
    },
    action_resolve: {
        en: 'Magic Resolve', id: 'Resolve Otomatis', es: 'Resolución Mágica', fr: 'Résolution Magique', de: 'Magische Auflösung', ja: '自動解決', zh: '自动解析', hi: 'जादू समाधान', tr: 'Sihirli Çözüm'
    },
    action_export_json: {
        en: 'Export JSON', id: 'Ekspor JSON', es: 'Exportar JSON', fr: 'Exporter JSON', de: 'JSON exportieren', ja: 'JSONエクスポート', zh: '导出JSON', hi: 'JSON निर्यात करें', tr: 'JSON Dışa Aktar'
    },
    action_export_csv: {
        en: 'Export CSV', id: 'Ekspor CSV', es: 'Exportar CSV', fr: 'Exporter CSV', de: 'CSV exportieren', ja: 'CSVエクスポート', zh: '导出CSV', hi: 'CSV निर्यात करें', tr: 'CSV Dışa Aktar'
    },
    action_delete_history: {
        en: 'Delete All History', id: 'Hapus Semua Riwayat', es: 'Borrar Historial', fr: 'Effacer Historique', de: 'Verlauf löschen', ja: '履歴を削除', zh: '删除所有历史', hi: 'सभी इतिहास हटाएं', tr: 'Tüm Geçmişi Sil'
    },

    msg_confirm_delete: {
        en: 'Are you sure you want to delete this item?', id: 'Apakah Anda yakin ingin menghapus item ini?', es: '¿Estás seguro de eliminar este ítem?', fr: 'Êtes-vous sûr de vouloir supprimer cet élément ?', de: 'Sind Sie sicher, dass Sie dieses Element löschen möchten?', ja: 'この項目 を削除してもよろしいですか？', zh: '确定要删除此项吗？', hi: 'क्या आप वाकई इस आइटम को हटाना चाहते हैं?', tr: 'Bu öğeyi silmek istediğinizden emin misiniz?'
    },
    msg_confirm_clear_history: {
        en: 'Clear all history? This cannot be undone.', id: 'Hapus semua riwayat? Tindakan ini tidak dapat dibatalkan.', es: '¿Borrar todo el historial? Esto no se puede deshacer.', fr: 'Effacer tout l\'historique ? Ceci est irréversible.', de: 'Verlauf löschen? Dies kann nicht rückgängig gemacht werden.', ja: '履歴をすべて消去しますか？これは元に戻せません。', zh: '清除所有历史记录？此操作无法撤销。', hi: 'सभी इतिहास साफ़ करें? इसे पूर्ववत नहीं किया जा सकता।', tr: 'Tüm geçmişi temizle? Bu işlem geri alınamaz.'
    },
    msg_no_results: {
        en: 'No Results', id: 'Tidak Ada Hasil', es: 'Sin Resultados', fr: 'Aucun Résultat', de: 'Keine Ergebnisse', ja: '結果なし', zh: '无结果', hi: 'कोई परिणाम नहीं', tr: 'Sonuç Yok'
    },
    msg_start_searching: {
        en: 'Start Searching', id: 'Mulai Mencari', es: 'Empezar a Buscar', fr: 'Commencer la Recherche', de: 'Suche starten', ja: '検索を開始', zh: '开始搜索', hi: 'खोज शुरू करें', tr: 'Aramaya Başla'
    },
    msg_enter_keywords: {
        en: 'Enter keywords to search', id: 'Masukkan kata kunci untuk mencari', es: 'Introduce palabras clave', fr: 'Entrez des mots-clés', de: 'Suchbegriffe eingeben', ja: 'キーワードを入力', zh: '输入关键词搜索', hi: 'खozने के लिए कीवर्ड दर्ज करें', tr: 'Aramak için anahtar kelimeler girin'
    },
    msg_try_keywords: {
        en: 'Try different keywords', id: 'Coba kata kunci lain', es: 'Prueba otras palabras clave', fr: 'Essayez d\'autres mots-clés', de: 'Versuchen Sie andere Suchbegriffe', ja: '別のキーワードを試してください', zh: '尝试不同的关键词', hi: 'अलग-अलग कीवर्ड आज़माएं', tr: 'Farklı anahtar kelimeler deneyin'
    },
    msg_scanning: {
        en: 'Scanning...', id: 'Memindai...', es: 'Escaneando...', fr: 'Scan en cours...', de: 'Scannen...', ja: 'スキャン中...', zh: '扫描中...', hi: 'स्कैनिंग...', tr: 'Taranıyor...'
    },
    msg_not_scanning: {
        en: 'Not scanning', id: 'Tidak memindai', es: 'No escaneando', fr: 'Pas de scan', de: 'Nicht scannen', ja: 'スキャンしていません', zh: '未扫描', hi: 'स्कैन नहीं कर रहा', tr: 'Taranmıyor'
    },
    msg_queue_empty: {
        en: 'Queue is Empty', id: 'Antrian Kosong', es: 'Cola Vacía', fr: 'File vide', de: 'Warteschlange leer', ja: 'キューは空です', zh: '队列为空', hi: 'कतार खाली है', tr: 'Kuyruk Boş'
    },
    msg_add_urls: {
        en: 'Add URLs to start downloading', id: 'Tambahkan URL untuk mulai mengunduh', es: 'Añade URLs para descargar', fr: 'Ajoutez des URL untuk télécharger', de: 'URLs hinzufügen', ja: 'URLを追加して開始', zh: '添加URL以开始下载', hi: 'डाउनलोड शुरू करने के लिए URL जोड़ें', tr: 'İndirmeye başlamak için URL ekleyin'
    },
    msg_no_history: {
        en: 'No History', id: 'Tidak Ada Riwayat', es: 'Sin Historial', fr: 'Aucun Historique', de: 'Kein Verlauf', ja: '履歴なし', zh: '无历史', hi: 'कोई इतिहास नहीं', tr: 'Geçmiş Yok'
    },
    msg_history_empty: {
        en: 'Completed downloads will appear here', id: 'Unduhan yang selesai akan muncul di sini', es: 'Las descargas completadas aparecerán aquí', fr: 'Les téléchargements terminés apparaîtront ici', de: 'Abgeschlossene Downloads erscheinen hier', ja: '完了したダウンロードはここに表示されます', zh: '已完成的下载将显示在这里', hi: 'पूर्ण डाउनलोड यहां दिखाई देंगे', tr: 'Tamamlanan indirmeler burada görünecek'
    },
    msg_added_to_queue: {
        en: 'Added to download queue', id: 'Ditambahkan ke antrian unduh', es: 'Añadido a la cola', fr: 'Ajouté à la file', de: 'Zur Warteschlange hinzugefügt', ja: 'キューに追加されました', zh: '已添加到下载队列', hi: 'डाउनलोड कतार में जोड़ा गया', tr: 'İndirme kuyruğuna eklendi'
    },

    label_total_files: {
        en: 'Total Files', id: 'Total File', es: 'Total Archivos', fr: 'Total Fichiers', de: 'Dateien Gesamt', ja: '総ファイル', zh: '总文件', hi: 'कुल फ़ाइलें', tr: 'Toplam Dosya'
    },
    label_duplicates: {
        en: 'Duplicates', id: 'Duplikat', es: 'Duplicados', fr: 'Doublons', de: 'Duplikate', ja: '重複', zh: '重复', hi: 'डुप्लिकेट', tr: 'Kopyalar'
    },
    label_hires: {
        en: 'Hi-Res', id: 'Hi-Res', es: 'Hi-Res', fr: 'Hi-Res', de: 'Hi-Res', ja: 'ハイレゾ', zh: '高解析度', hi: 'Hi-Res', tr: 'Hi-Res'
    },
    label_total_size: {
        en: 'Total Size', id: 'Ukuran Total', es: 'Tamaño Total', fr: 'Taille Totale', de: 'Gesamtgröße', ja: '合計サイズ', zh: '总大小', hi: 'कुल आकार', tr: 'Toplam Boyut'
    },
    label_daily_avg: {
        en: 'Daily Average', id: 'Rata-rata Harian', es: 'Promedio Diario', fr: 'Moyenne Quotidienne', de: 'Tagesdurchschnitt', ja: '日平均', zh: '日均', hi: 'दैनिक औसत', tr: 'Günlük Ortalama'
    },

    tab_duplicates: {
        en: 'Duplicates', id: 'Duplikat', es: 'Duplicados', fr: 'Doublons', de: 'Duplikate', ja: '重複', zh: '重复', hi: 'डुप्लिकेट', tr: 'Kopyalar'
    },
    tab_upgradeable: {
        en: 'Hi-Res Available', id: 'Tersedia Hi-Res', es: 'Hi-Res Disponible', fr: 'Hi-Res Disponible', de: 'Hi-Res Verfügbar', ja: 'ハイレゾ利用可能', zh: '可用高解析度', hi: 'Hi-Res उपलब्ध', tr: 'Hi-Res Mevcut'
    },

    common_loading: {
        en: 'Loading...', id: 'Memuat...', es: 'Cargando...', fr: 'Chargement...', de: 'Laden...', ja: '読み込み中...', zh: '加载中...', hi: 'लोड हो रहा है...', tr: 'Yükleniyor...'
    },
    common_search_placeholder: {
        en: 'Search albums, tracks, or artists...', id: 'Cari album, lagu, atau artis...', es: 'Buscar álbumes, pistas o artistas...', fr: 'Rechercher albums, pistes, artistes...', de: 'Alben, Titel oder Künstler suchen...', ja: 'アルバム、曲、アーティストを検索...', zh: '搜索专辑、曲目或艺术家...', hi: 'एल्बम, ट्रैक या कलाकार खोजें...', tr: 'Albüm, parça veya sanatçı ara...'
    },

    sec_danger: {
        en: 'Danger Zone', id: 'Area Berbahaya', es: 'Zona de Peligro', fr: 'Zone de Danger', de: 'Gefahrenzone', ja: '危険地帯', zh: '危险区域', hi: 'खतरा क्षेत्र', tr: 'Tehlikeli Bölge'
    },
    desc_danger: {
        en: 'Irreversible actions that affect your data.', id: 'Tindakan permanen yang mempengaruhi data Anda.', es: 'Acciones irreversibles.', fr: 'Actions irréversibles.', de: 'Irreversible Aktionen.', ja: '取り消せない操作。', zh: '不可逆的操作。', hi: 'अपरivर्तनीय क्रियाएं जो आपके डेटा को प्रभावित करती हैं।', tr: 'Verilerinizi etkileyen geri alınamaz eylemler.'
    },
    action_reset_full: {
        en: 'Clear All Data (Reset Database)', id: 'Hapus Semua Data (Reset Database)', es: 'Borrar Todo (Reset DB)', fr: 'Tout Effacer (Reset DB)', de: 'Alles Löschen (Reset DB)', ja: '全データ消去（DBリセット）', zh: '清除所有数据（重置数据库）', hi: 'सभी डेटा साफ़ करें (रिसेट DB)', tr: 'Tüm Verileri Temizle (Veritabanını Sıfırla)'
    },
    sec_creds: {
        en: 'Credential Status', id: 'Status Kredensial', es: 'Estado de Credenciales', fr: 'État des Identifiants', de: 'Anmeldedaten Status', ja: '認証情報の状態', zh: '凭证状态', hi: 'क्रेडेंशियल स्थिति', tr: 'Kimlik Bilgisi Durumu'
    },
    action_validate: {
        en: 'Validate Credentials', id: 'Validasi Kredensial', es: 'Validar Credenciales', fr: 'Valider Identifiants', de: 'Anmeldedaten prüfen', ja: '認証情報を検証', zh: '验证凭证', hi: 'क्रेडेंशियल सत्यापित करें', tr: 'Kimlik Bilgilerini Doğrula'
    },
    sec_update_creds: {
        en: 'Update Credentials', id: 'Perbarui Kredensial', es: 'Actualizar Credenciales', fr: 'Mettre à jour Identifiants', de: 'Anmeldedaten aktualisieren', ja: '認証情報を更新', zh: '更新凭证', hi: 'क्रेडेंशियल अपडेट करें', tr: 'Kimlik Bilgilerini Güncelle'
    },
    desc_update_creds: {
        en: 'Leave fields empty to keep current values.', id: 'Biarkan kosong untuk menyimpan nilai saat ini.', es: 'Dejar vacío para mantener actual.', fr: 'Laisser vide pour conserver actuel.', de: 'Leer lassen um beizubehalten.', ja: '現在の値を保持するには空のままにしてください。', zh: '留空以保留当前值。', hi: 'वर्तमान मान रखने के लिए खाली छोड़ दें।', tr: 'Mevcut değerleri korumak için alanları boş bırakın.'
    },
    action_update_creds: {
        en: 'Update Credentials', id: 'Perbarui Kredensial', es: 'Actualizar', fr: 'Mettre à jour', de: 'Aktualisieren', ja: '更新', zh: '更新', hi: 'अपडेट करें', tr: 'Kimlik Bilgilerini Güncelle'
    },
    sec_config: {
        en: 'Current Configuration', id: 'Konfigurasi Saat Ini', es: 'Configuración Actual', fr: 'Configuration Actuelle', de: 'Aktuelle Konfiguration', ja: '現在の設定', zh: '当前配置', hi: 'वर्तमान कॉन्फ़िगरेशन', tr: 'Mevcut Yapılandırma'
    },
    desc_config: {
        en: 'These settings are stored in local app database.', id: 'Pengaturan ini disimpan di database lokal aplikasi.', es: 'Estos ajustes se guardan en la base de datos local.', fr: 'Ces reglages sont stockes dans la base locale de application.', de: 'Diese Einstellungen werden in der lokalen App-Datenbank gespeichert.', ja: 'Settings tersimpan di database lokal aplikasi.', zh: 'Settings disimpan di database lokal aplikasi.', hi: 'Settings disimpan di database lokal aplikasi.', tr: 'Bu ayarlar yerel uygulama veritabanında saklanır.'
    },
    sec_appearance: {
        en: 'Appearance', id: 'Tampilan', es: 'Apariencia', fr: 'Apparence', de: 'Erscheinungsbild', ja: '外観', zh: '外观', hi: 'दिखावट', tr: 'Görünüm'
    },
    label_theme: {
        en: 'Theme', id: 'Tema', es: 'Tema', fr: 'Thème', de: 'Thema', ja: 'テーマ', zh: '主题', hi: 'थीम', tr: 'Tema'
    },
    default_theme: {
        en: 'Default Theme', id: 'Tema Bawaan', es: 'Tema Predeterminado', fr: 'Thème par défaut', de: 'Standardthema', ja: 'デフォルトテーマ', zh: '默认主题', hi: 'डिफ़ॉल्ट थीम', tr: 'Varsayılan Tema'
    },
    common_toggle_theme: {
        en: 'Toggle Theme', id: 'Ganti Tema', es: 'Cambiar Tema', fr: 'Changer de Thème', de: 'Thema umschalten', ja: 'テーマを切り替え', zh: '切换主题', hi: 'थीम टॉगल करें', tr: 'Temayı Değiştir'
    },
    label_language: {
        en: 'Language', id: 'Bahasa', es: 'Idioma', fr: 'Langue', de: 'Sprache', ja: '言語', zh: '语言', hi: 'भाषा', tr: 'Dil'
    },
    label_dl_path: {
        en: 'Download Path', id: 'Folder Unduhan', es: 'Ruta Descarga', fr: 'Chemin Téléchargement', de: 'Download-Pfad', ja: '保存先', zh: '下载路径', hi: 'डाउनलोड पथ', tr: 'İndirme Yolu'
    },
    label_folder_tmpl: {
        en: 'Folder Template', id: 'Template Folder', es: 'Plantilla Carpeta', fr: 'Modèle Dossier', de: 'Umbenennung Ordner', ja: 'フォルダテンプレート', zh: '文件夹模板', hi: 'फ़ोल्डर टेम्प्लेट', tr: 'Klasör Şablonu'
    },
    label_file_tmpl: {
        en: 'File Template', id: 'Template File', es: 'Plantilla Archivo', fr: 'Modèle Fichier', de: 'Umbenennung Datei', ja: 'ファイルテンプレート', zh: '文件模板', hi: 'फ़ाइल टेम्प्लेट', tr: 'Dosya Şablonu'
    },
    label_concurrency: {
        en: 'Max Concurrent', id: 'Maks. Bersamaan', es: 'Máx. Simultáneo', fr: 'Max Simultané', de: 'Max. Gleichzeitig', ja: '最大同時', zh: '最大并发', hi: 'अधिकतम समवर्ती', tr: 'Maks. Eşzamanlı'
    },
    label_default_quality: {
        en: 'Default Quality', id: 'Kualitas Bawaan', es: 'Calidad Predeterminada', fr: 'Qualité par défaut', de: 'Standardqualität', ja: 'デフォルト品質', zh: '默认质量', hi: 'डिफ़ॉल्ट गुणवत्ता', tr: 'Varsayılan Kalite'
    },
    label_streaming_quality: {
        en: 'Streaming Quality', id: 'Kualitas Streaming', es: 'Calidad de Streaming', fr: 'Qualité de Streaming', de: 'Streaming-Qualität', ja: 'ストリーミング品質', zh: '流媒体质量', hi: 'स्ट्रीमिंग गुणवत्ता', tr: 'Yayın Kalitesi'
    },
    label_retry_attempts: {
        en: 'Retry Attempts', id: 'Upaya Percobaan', es: 'Reintentos', fr: 'Tentatives', de: 'Wiederholungsversuche', ja: 'リトライ回数', zh: '重试次数', hi: 'पुनः प्रयास प्रयास', tr: 'Yeniden Deneme Sayısı'
    },
    label_retry_delay: {
        en: 'Retry Delay', id: 'Jeda Percobaan', es: 'Retraso de Reintento', fr: 'Délai de relance', de: 'Wiederholungsverzögerung', ja: 'リトライ遅延', zh: '重试延迟', hi: 'पुनः प्रयास विलंब', tr: 'Yeniden Deneme Gecikmesi'
    },
    label_cover_size: {
        en: 'Cover Size', id: 'Ukuran Sampul', es: 'Tamaño de Portada', fr: 'Taille de la couverture', de: 'Cover-Größe', ja: 'カバーサイズ', zh: '封面大小', hi: 'कवर आकार', tr: 'Kapak Boyutu'
    },
    label_lyrics_type: {
        en: 'Lyrics Type', id: 'Tipe Lirik', es: 'Tipo de Letras', fr: 'Type de paroles', de: 'Songtext-Typ', ja: '歌詞のタイプ', zh: '歌词类型', hi: 'गीत प्रकार', tr: 'Şarkı Sözü Türü'
    },
    label_dashboard_port: {
        en: 'Dashboard Port', id: 'Port Dasbor', es: 'Puerto del Panel', fr: 'Port du tableau de bord', de: 'Dashboard-Port', ja: 'ダッシュボードポート', zh: '仪表板端口', hi: 'डैशबोर्ड पोर्ट', tr: 'Panel Portu'
    },
    label_dashboard_password: {
        en: 'Dashboard Password', id: 'Kata Sandi Dasbor', es: 'Contraseña del Panel', fr: 'Mot de passe du tableau de bord', de: 'Dashboard-Passwort', ja: 'ダッシュボードパスワード', zh: '仪表板密码', hi: 'डैशबोर्ड पासवर्ड', tr: 'Panel Şifresi'
    },
    label_embed_cover: {
        en: 'Embed Cover Art', id: 'Masukkan Sampul', es: 'Incrustar Portada', fr: 'Intégrer la pochette', de: 'Cover einbetten', ja: 'カバーを埋め込む', zh: '内嵌封面', hi: 'कवर आर्ट एम्बेड करें', tr: 'Kapak Resmini Göm'
    },
    label_save_cover: {
        en: 'Save Cover File', id: 'Simpan File Sampul', es: 'Guardar Archivo de Portada', fr: 'Enregistrer le fichier de pochette', de: 'Cover-Datei speichern', ja: 'カバーを保存', zh: '保存封面文件', hi: 'कवर फ़ाइल सहेजें', tr: 'Kapak Dosyasını Kaydet'
    },
    label_download_lyrics: {
        en: 'Download Lyrics', id: 'Unduh Lirik', es: 'Descargar Letras', fr: 'Télécharger les paroles', de: 'Songtexte herunterladen', ja: '歌詞をダウンロード', zh: '下载歌词', hi: 'गीत डाउनलोड करें', tr: 'Şarkı Sözlerini İndir'
    },
    label_embed_lyrics: {
        en: 'Embed Lyrics', id: 'Masukkan Lirik', es: 'Incrustar Letras', fr: 'Intégrer les paroles', de: 'Songtexte einbetten', ja: '歌詞を埋め込む', zh: '内嵌歌词', hi: 'गीत एम्बेड करें', tr: 'Şarkı Sözlerini Göm'
    },
    label_save_lrc: {
        en: 'Save LRC File', id: 'Simpan File LRC', es: 'Guardar Archivo LRC', fr: 'Enregistrer le fichier LRC', de: 'LRC-Datei speichern', ja: 'LRCファイルを保存', zh: '保存LRC文件', hi: 'LRC फ़ाइल सहेजें', tr: 'LRC Dosyasını Kaydet'
    },
    action_save_settings: {
        en: 'Save App Settings', id: 'Simpan Pengaturan', es: 'Guardar Ajustes', fr: 'Enregistrer les paramètres', de: 'Einstellungen speichern', ja: '設定を保存', zh: '保存应用设置', hi: 'सेटिंग्स सहेजें', tr: 'Uygulama Ayarlarını Kaydet'
    },
    label_total: {
        en: 'Total', id: 'Total', es: 'Total', fr: 'Total', de: 'Gesamt', ja: '合計', zh: '总计', hi: 'कुल', tr: 'Toplam'
    },
    label_downloading: {
        en: 'Downloading', id: 'Mengunduh', es: 'Descargando', fr: 'Téléchargement', de: 'Wird heruntergeladen', ja: 'ダウンロード中', zh: '正在下载', hi: 'डाउनलोड हो रहा है', tr: 'İndiriliyor'
    },
    label_completed: {
        en: 'Completed', id: 'Selesai', es: 'Completado', fr: 'Terminé', de: 'Abgeschlossen', ja: '完了', zh: '已完成', hi: 'पूरा हुआ', tr: 'Tamamlandı'
    },
    label_failed: {
        en: 'Failed', id: 'Gagal', es: 'Fallido', fr: 'Échoué', de: 'Fehlgeschlagen', ja: '失敗', zh: '失败', hi: 'विफल', tr: 'Başarısız'
    },
    label_title: {
        en: 'Title', id: 'Judul', es: 'Título', fr: 'Titre', de: 'Titel', ja: 'タイトル', zh: '标题', hi: 'शीर्षक', tr: 'Başlık'
    },
    label_type: {
        en: 'Type', id: 'Tipe', es: 'Tipo', fr: 'Type', de: 'Typ', ja: 'タイプ', zh: '类型', hi: 'प्रकार', tr: 'Tür'
    },
    label_quality: {
        en: 'Quality', id: 'Kualitas', es: 'Calidad', fr: 'Qualité', de: 'Qualität', ja: '品質', zh: '质量', hi: 'गुणवत्ता', tr: 'Kalite'
    },
    label_status: {
        en: 'Status', id: 'Status', es: 'Estado', fr: 'Statut', de: 'Status', ja: 'ステータス', zh: '状态', hi: 'स्थिति', tr: 'Durum'
    },
    label_progress: {
        en: 'Progress', id: 'Progres', es: 'Progreso', fr: 'Progression', de: 'Fortschritt', ja: '進捗', zh: '进度', hi: 'प्रगति', tr: 'İlerleme'
    },
    label_action: {
        en: 'Action', id: 'Aksi', es: 'Acción', fr: 'Action', de: 'Action', ja: 'アクション', zh: '动作', hi: 'कार्रवाई', tr: 'İşlem'
    },
    action_cancel: {
        en: 'Cancel', id: 'Batal', es: 'Cancelar', fr: 'Annuler', de: 'Abbrechen', ja: 'キャンセル', zh: '取消', hi: 'रद्द करें', tr: 'İptal'
    },
    label_date: {
        en: 'Date', id: 'Tanggal', es: 'Fecha', fr: 'Date', de: 'Datum', ja: '日付', zh: '日期', hi: 'तारीख', tr: 'Tarih'
    },
    label_artist: {
        en: 'Artist', id: 'Artis', es: 'Artista', fr: 'Artiste', de: 'Künstler', ja: 'アーティスト', zh: '艺术家', hi: 'कलाकार', tr: 'Sanatçı'
    },
    label_filename: {
        en: 'Filename', id: 'Nama File', es: 'Nombre Archivo', fr: 'Nom Fichier', de: 'Dateiname', ja: 'ファイル名', zh: '文件名', hi: 'फ़ाइल नाम', tr: 'Dosya Adı'
    },
    label_hires_only: {
        en: 'Hi-Res Only', id: 'Hanya Hi-Res', es: 'Solo Hi-Res', fr: 'Hi-Res Uniquement', de: 'Nur Hi-Res', ja: 'ハイレゾのみ', zh: '仅限高解析度', hi: 'केवल हाई-रेज', tr: 'Sadece Hi-Res'
    },
    label_artists: {
        en: 'Artists', id: 'Artis', es: 'Artistas', fr: 'Artistes', de: 'Künstler', ja: 'アーティスト', zh: '艺术家', hi: 'कलाकार', tr: 'Sanatçılar'
    },
    label_albums: {
        en: 'Albums', id: 'Album', es: 'Álbumes', fr: 'Albums', de: 'Alben', ja: 'アルバム', zh: '专辑', hi: 'एल्बम', tr: 'Albümler'
    },
    label_tracks: {
        en: 'Tracks', id: 'Lagu', es: 'Pistas', fr: 'Pistes', de: 'Titel', ja: 'トラック', zh: '曲目', hi: 'ट्रैक', tr: 'Parçalar'
    },
    action_view: {
        en: 'View', id: 'Lihat', es: 'Ver', fr: 'Voir', de: 'Ansehen', ja: '表示', zh: '查看', hi: 'देखें', tr: 'Görüntüle'
    },
    label_page: {
        en: 'Page', id: 'Halaman', es: 'Página', fr: 'Page', de: 'Seite', ja: 'ページ', zh: '页', hi: 'पृष्ठ', tr: 'Sayfa'
    },
    label_of: {
        en: 'of', id: 'dari', es: 'de', fr: 'de', de: 'von', ja: 'の', zh: '的', hi: 'का', tr: '/'
    },
    label_prev: {
        en: 'Prev', id: 'Sebel', es: 'Anterior', fr: 'Préc', de: 'Zurück', ja: '前', zh: '上一页', hi: 'पिछला', tr: 'Geri'
    },
    label_next: {
        en: 'Next', id: 'Selan', es: 'Siguiente', fr: 'Suiv', de: 'Weiter', ja: '次', zh: '下一页', hi: 'अगला', tr: 'İleri'
    },
    label_already_downloaded: {
        en: 'Already Downloaded', id: 'Sudah Diunduh', es: 'Ya Descargado', fr: 'Déjà Téléchargé', de: 'Bereits heruntergeladen', ja: 'ダウンロード済み', zh: '已下载', hi: 'पहले ही डाउनलोड किया गया', tr: 'Zaten İndirildi'
    },
    label_input_source: {
        en: 'Input Source', id: 'Sumber Input', es: 'Fuente de Entrada', fr: 'Source d\'entrée', de: 'Eingabequelle', ja: '入力ソース', zh: '输入源', hi: 'इनपुट स्रोत', tr: 'Giriş Kaynağı'
    },
    label_direct_input: {
        en: 'Direct Input', id: 'Input Langsung', es: 'Entrada Directa', fr: 'Entrée directe', de: 'Direkteingabe', ja: 'ダイレクト入力', zh: '直接输入', hi: 'सीधा इनपुट', tr: 'Doğrudan Giriş'
    },
    label_text_file: {
        en: 'Text File', id: 'File Teks', es: 'Archivo de Texto', fr: 'Fichier texte', de: 'Textdatei', ja: 'テキストファイル', zh: '文本文件', hi: 'पाठ फ़ाइल', tr: 'Metin Dosyası'
    },
    label_playlist: {
        en: 'Playlist', id: 'Daftar Putar', es: 'Lista de Reproducción', fr: 'Playlist', de: 'Wiedergabeliste', ja: 'プレイリスト', zh: '播放列表', hi: 'प्लेलिस्ट', tr: 'Oynatma Listesi'
    },
    label_csv_data: {
        en: 'CSV Data', id: 'Data CSV', es: 'Datos CSV', fr: 'Données CSV', de: 'CSV-Daten', ja: 'CSVデータ', zh: 'CSV数据', hi: 'CSV डेटा', tr: 'CSV Verisi'
    },
    label_target_quality: {
        en: 'Target Quality', id: 'Kualitas Target', es: 'Calidad de Destino', fr: 'Qualité cible', de: 'Zielqualität', ja: 'ターゲット品質', zh: '目标质量', hi: 'लक्ष्य गुणवत्ता', tr: 'Hedef Kalite'
    },
    label_create_zip: {
        en: 'Create ZIP Archive', id: 'Buat Arsip ZIP', es: 'Crear Archivo ZIP', fr: 'Créer une archive ZIP', de: 'ZIP-Archiv erstellen', ja: 'ZIPアーカイブを作成', zh: '创建 ZIP 存档', hi: 'ZIP आर्काइव बनाएं', tr: 'ZIP Arşivi Oluştur'
    },
    label_zip_desc: {
        en: 'Automatically bundle all files into a single ZIP archive after download', id: 'Otomatis membundel semua file ke dalam satu arsip ZIP setelah diunduh', es: 'Agrupa automáticamente todos los archivos en un solo archivo ZIP después de la descarga', fr: 'Regroupez automatiquement tous les fichiers dans une seule archive ZIP après le téléchargement', de: 'Alle Dateien nach dem Download automatisch in einem ZIP-Archiv bündeln', ja: 'ダウンロード後、すべてのファイルを単一のZIPアーカイブに自動的にまとめます', zh: '下载后自动将所有文件打包成一个 ZIP 存档', hi: 'डाउनलोड के बाद स्वचालित रूप से सभी फ़ाइलों को एक एकल ZIP आर्काइव में बंडल करें', tr: 'İndirmeden sonra tüm dosyaları otomatik olarak tek bir ZIP arşivinde topla'
    },
    label_url_list: {
        en: 'URL List', id: 'Daftar URL', es: 'Lista de URLs', fr: 'Liste d\'URL', de: 'URL-Liste', ja: 'URLリスト', zh: 'URL列表', hi: 'URL सूची', tr: 'URL Listesi'
    },
    label_select_file: {
        en: 'Select File', id: 'Pilih File', es: 'Seleccionar Archivo', fr: 'Sélectionner un fichier', de: 'Datei auswählen', ja: 'ファイルを選択', zh: '选择文件', hi: 'फ़ाइल चुनें', tr: 'Dosya Seç'
    },
    action_load_staged: {
        en: 'Load Staged', id: 'Muat Aşamalı', es: 'Cargar Gradual', fr: 'Charger par étapes', de: 'Gereitit laden', ja: 'ステージ済みの読み込み', zh: '加载暂存', hi: 'स्टेज्ड लोड करें', tr: 'Aşamalı Yükle'
    },
    action_start_import: {
        en: 'Start Import', id: 'Mulai Impor', es: 'Iniciar Importación', fr: 'Lancer l\'importation', de: 'Import starten', ja: 'インポートを開始', zh: '开始导入', hi: 'आयात शुरू करें', tr: 'İçe Aktarmayı Başlat'
    },
    msg_confirm_clear_staging: {
        en: 'This will clear all staged URLs and current input. This action cannot be undone.', id: 'Ini akan menghapus semua URL yang dipentaskan dan input saat ini. Tindakan ini tidak dapat dibatalkan.', es: 'Esto borrará todas las URL preparadas y la entrada actual. Esta acción no se puede deshacer.', fr: 'Cela effacera toutes les URL mises en scène et la saisie actuelle. Cette action est irréversible.', de: 'Dadurch werden alle bereitgestellten URLs und die aktuelle Eingabe gelöscht. Diese Aktion kann nicht rückgängig gemacht werden.', ja: 'これにより、ステージングされたすべてのURLと現在の入力がクリアされます。このアクションは取り消せません。', zh: '这将清除所有暂存的 URL 和当前输入。此操作无法撤消。', hi: 'यह सभी स्टेज किए गए URL और वर्तमान इनपुट को साफ़ कर देगा। इस क्रिया को पूर्ववत नहीं किया जा सकता है।', tr: 'Bu, tüm aşamalı URL\'leri ve geçerli girişi temizleyecektir. Bu işlem geri alınamaz.'
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

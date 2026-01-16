const state = {
    connected: false,
    queue: [],
    stats: {},
    activeTab: localStorage.getItem('lastTab') || 'queue',
    searchOffset: 0,
    searchLimit: 20,
    password: localStorage.getItem('dashboard_password') || '',
    theme: localStorage.getItem('theme') || 'dark'
};

if (state.theme === 'light') {
    document.body.classList.add('light-theme');
    document.body.classList.remove('dark-theme');
}

window.toggleSidebar = function () {
    if (window.innerWidth <= 768) {
        document.querySelector('.sidebar').classList.toggle('open');
    } else {
        document.body.classList.toggle('sidebar-collapsed');
    }
};

const menuToggle = document.getElementById('menu-toggle');
if (menuToggle) menuToggle.onclick = window.toggleSidebar;

const themeBtn = document.getElementById('theme-toggle');
if (themeBtn) {
    themeBtn.onclick = () => {
        const isLight = document.body.classList.toggle('light-theme');
        document.body.classList.toggle('dark-theme');
        state.theme = isLight ? 'light' : 'dark';
        localStorage.setItem('theme', state.theme);
    };
}

window.openModal = function (id) {
    const modal = document.getElementById(id);
    if (modal) {
        modal.style.display = 'block';
        const input = modal.querySelector('input');
        if (input) input.focus();
    } else {
        console.error(`Modal with ID '${id}' not found`);
    }
};

window.closeModal = function (id) {
    const modal = document.getElementById(id);
    if (modal) modal.style.display = 'none';
};

window.addEventListener('click', (event) => {
    if (event.target.classList.contains('modal')) {
        event.target.style.display = 'none';
    }
});

if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('/sw.js').catch(console.error);
}

function requestNotificationPermission() {
    if ('Notification' in window && Notification.permission !== 'granted') {
        Notification.requestPermission();
    }
}
document.body.addEventListener('click', requestNotificationPermission, { once: true });

function notifyDownloadComplete(item) {
    if ('Notification' in window && Notification.permission === 'granted') {
        new Notification('Download Complete', {
            body: `${item.title} has finished downloading.`,
            icon: '/favicon.ico'
        });
    }
}

const loginOverlay = document.getElementById('login-overlay');
const loginForm = document.getElementById('login-form');
const loginError = document.getElementById('login-error');

async function smartFetch(url, options = {}) {
    if (state.password) {
        options.headers = {
            ...options.headers,
            'x-password': state.password
        };
    }
    const res = await fetch(url, options);
    if (res.status === 401) {
        showLogin();
    }
    return res;
}

const socket = io({
    auth: { password: state.password }
});

socket.on('connect_error', (err) => {
    if (err.message === 'Authentication failed') {
        showLogin();
    }
});

function showLogin() {
    if (loginOverlay) loginOverlay.style.display = 'flex';
}

function hideLogin() {
    if (loginOverlay) loginOverlay.style.display = 'none';
}

if (loginForm) {
    loginForm.onsubmit = async (e) => {
        e.preventDefault();
        const pw = document.getElementById('login-password').value;
        loginError.textContent = 'Verifying...';

        try {
            const res = await fetch('/api/status', {
                headers: { 'x-password': pw }
            });

            if (res.ok) {
                state.password = pw;
                localStorage.setItem('dashboard_password', pw);
                location.reload();
            } else {
                loginError.textContent = 'Invalid password. Please try again.';
            }
        } catch (err) {
            loginError.textContent = 'Connection error. Is the server running?';
        }
    };
}

const views = {
    queue: document.getElementById('view-queue'),
    search: document.getElementById('view-search'),
    batch: document.getElementById('view-batch'),
    statistics: document.getElementById('view-statistics'),
    analytics: document.getElementById('view-analytics'),
    library: document.getElementById('view-library'),

    album: document.getElementById('view-album'),
    artist: document.getElementById('view-artist'),
    playlists: document.getElementById('view-playlists'),
    history: document.getElementById('view-history'),
    settings: document.getElementById('view-settings')
};

const navItems = document.querySelectorAll('.nav-item');
const queueList = document.getElementById('queue-list');
const historyList = document.getElementById('history-list');
const resultsGrid = document.getElementById('search-results');
const albumFullContent = document.getElementById('album-full-content');
const artistFullContent = document.getElementById('artist-full-content');

socket.on('connect', () => {
    state.connected = true;
    updateConnectionStatus(true);
    fetchQueue();
    fetchHistory();
});

socket.on('disconnect', () => {
    state.connected = false;
    updateConnectionStatus(false);
});

socket.on('queue:update', (stats) => {
    updateStats(stats);
    fetchQueue();
});

socket.on('queue:stats', (stats) => {
    updateStats(stats);
});

socket.on('item:added', () => fetchQueue());
socket.on('item:completed', (item) => {
    fetchQueue();
    fetchHistory();
    if (item) notifyDownloadComplete(item);
});
socket.on('item:progress', (data) => updateItemProgress(data));
socket.on('item:failed', () => fetchQueue());

navItems.forEach((item) => {
    item.addEventListener('click', (e) => {
        e.preventDefault();
        const tab = item.dataset.tab;
        switchTab(tab);
        if (window.innerWidth <= 768) {
            document.querySelector('.sidebar').classList.remove('open');
        }
    });
});

window.switchTab = function (tab) {
    state.activeTab = tab;
    localStorage.setItem('lastTab', tab);

    navItems.forEach((i) => i.classList.remove('active'));
    const navItem = document.querySelector(`[data-tab="${tab}"]`);
    if (navItem) navItem.classList.add('active');

    Object.values(views).forEach((v) => {
        if (v) v.style.display = 'none';
    });
    if (views[tab]) views[tab].style.display = 'block';

    const titles = {
        queue: 'Download Queue',
        search: 'Library Search',
        batch: 'Batch Import',
        statistics: 'Analytics Dashboard',
        library: 'Music Library',

        album: 'Album View',
        artist: 'Artist Detail',
        playlists: 'Watched Playlists',
        history: 'Download History',
        settings: 'Settings'
    };
    document.getElementById('page-title').textContent = titles[tab] || 'Dashboard';

    if (tab === 'history') fetchHistory();
    if (tab === 'statistics') loadStatistics();
    if (tab === 'settings') loadSettings();
    if (tab === 'playlists') fetchPlaylists();
    if (tab === 'library') loadLibraryStats();

};

async function fetchQueue() {
    try {
        const response = await smartFetch('/api/queue');
        const items = await response.json();
        renderQueue(items);
    } catch (err) {
        console.error('Failed to fetch queue:', err);
    }
}

setInterval(() => {
    if (state.connected && state.activeTab === 'queue' && document.visibilityState === 'visible') {
        fetchQueue();
    }
}, 3000);

function renderQueue(items) {
    if (!queueList) return;

    if (items.length === 0) {
        queueList.innerHTML = `
            <div class="empty-state">
                <div class="empty-icon">📥</div>
                <h3>Queue is Empty</h3>
                <p>Add URLs to start downloading</p>
            </div>
        `;
        return;
    }

    const emptyState = queueList.querySelector('.empty-state');
    if (emptyState) emptyState.remove();

    const currentIds = new Set();

    items.forEach((item) => {
        const rowId = `item-${item.id}`;
        currentIds.add(rowId);

        let row = document.getElementById(rowId);
        if (!row) {
            row = document.createElement('div');
            row.className = 'list-row';
            row.id = rowId;
            queueList.appendChild(row);
        }

        const currentStatus = row.getAttribute('data-status');
        if (currentStatus !== item.status) {
            row.setAttribute('data-status', item.status);
            row.innerHTML = getRowHtml(item);
        } else {
            const fill = row.querySelector('.progress-fill');
            if (fill) fill.style.width = `${item.progress || 0}%`;
        }
    });

    Array.from(queueList.children).forEach(child => {
        if (!currentIds.has(child.id) && child.classList.contains('list-row')) {
            child.remove();
        }
    });
}

function getRowHtml(item) {
    return `
        <div class="title-cell">
            <div style="font-weight: 600">${item.title || 'Loading...'}</div>
        </div>
        <div><span class="badge ${item.type}">${item.type}</span></div>
        <div class="quality-cell">${getQualityLabel(item.quality)}</div>
        <div><span class="badge ${item.status} status-badge">${item.status}</span></div>
        <div class="progress-cell">
            <div class="progress-bar">
                <div class="progress-fill" style="width: ${item.progress || 0}%"></div>
            </div>
        </div>
        <div>
            ${item.status === 'downloading' || item.status === 'pending' || item.status === 'processing'
            ? `<button class="btn danger" style="padding: 6px 12px; font-size: 12px;" onclick="cancelItem('${item.id}')">Cancel</button>`
            : item.status === 'completed'
                ? `<button class="btn primary" style="padding: 6px 12px; font-size: 12px;" onclick="downloadFile('${item.contentId}')">Download</button>`
                : ''
        }
        </div>
    `;
}

window.queueAction = async function (action) {
    try {
        await smartFetch('/api/queue/action', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action })
        });
        fetchQueue();
        showToast(`Queue ${action} successful`, 'success');
    } catch (err) {
        showToast('Action failed', 'error');
    }
};

window.cancelItem = async function (id) {
    await smartFetch(`/api/item/${id}/cancel`, { method: 'POST' });
    fetchQueue();
};

window.downloadFile = function (id) {
    window.location.href = `/api/download/${id}`;
};

function updateItemProgress(data) {
    const row = document.getElementById(`item-${data.id}`);
    if (row) {
        const fill = row.querySelector('.progress-fill');
        if (fill) fill.style.width = `${data.progress}%`;

        if (data.title) {
            const titleEl = row.querySelector('.title-cell div');
            if (titleEl && titleEl.textContent !== data.title) {
                titleEl.textContent = data.title;
            }
        }

        if (data.quality) {
            const qualityEl = row.querySelector('.quality-cell');
            const newLabel = getQualityLabel(data.quality);
            if (qualityEl && qualityEl.textContent !== newLabel) {
                qualityEl.textContent = newLabel;
            }
        }

        if (data.status) {
            const statusEl = row.querySelector('.status-badge');
            if (statusEl) {
                statusEl.textContent = data.status;
                statusEl.className = `badge ${data.status} status-badge`;
            }
        }
    }
}

function updateStats(stats) {
    const pending = document.getElementById('stat-pending');
    const active = document.getElementById('stat-active');
    const total = document.getElementById('q-total');
    const downloading = document.getElementById('q-downloading');
    const completed = document.getElementById('q-completed');
    const failed = document.getElementById('q-failed');

    if (pending) pending.textContent = stats.pending;
    if (active) active.textContent = stats.downloading;
    if (total) total.textContent = stats.total;
    if (downloading) downloading.textContent = stats.downloading;
    if (completed) completed.textContent = stats.completed;
    if (failed) failed.textContent = stats.failed;
}

function updateConnectionStatus(online) {
    const el = document.querySelector('.status-indicator');
    if (!el) return;
    if (online) {
        el.innerHTML = '<span class="dot"></span> Online';
        el.style.color = 'var(--success)';
    } else {
        el.innerHTML = '<span class="dot"></span> Disconnected';
        el.style.color = 'var(--danger)';
    }
}

async function fetchHistory() {
    try {
        const response = await smartFetch('/api/history');
        const items = await response.json();
        renderHistory(items);
    } catch (err) {
        console.error('Failed to fetch history:', err);
    }
}

function renderHistory(items) {
    if (!historyList) return;
    historyList.innerHTML = '';

    if (items.length === 0) {
        historyList.innerHTML = `
            <div class="empty-state">
                <div class="empty-icon">📜</div>
                <h3>No History</h3>
                <p>Completed downloads will appear here</p>
            </div>
        `;
        return;
    }

    items.forEach((item) => {
        const row = document.createElement('div');
        row.className = 'list-row';
        row.style.gridTemplateColumns = '0.8fr 1.2fr 1.5fr 0.8fr 1.5fr 0.5fr';
        row.style.gap = '10px';

        const date = new Date(item.downloadedAt).toLocaleString();
        const artist = item.albumArtist || item.artist || 'Unknown';

        row.innerHTML = `
            <div style="color: var(--text-secondary); font-size: 12px;">${date}</div>
            <div style="font-weight: 500; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${artist}</div>
            <div style="font-weight: 600; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${item.title}</div>
            <div>${getQualityLabel(item.quality)}</div>
            <div style="font-family: monospace; font-size: 11px; color: var(--text-secondary); overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${item.filename || '-'}</div>
            <div style="display: flex; gap: 8px;">
                <button class="btn primary" style="padding: 6px 12px; font-size: 12px;" onclick="downloadFile('${item.id}')">
                    Download
                </button>
                <button class="btn danger" style="padding: 6px 12px; font-size: 12px;" onclick="deleteHistoryItem('${item.id}')" title="Delete from History">
                    🗑️
                </button>
            </div>
        `;
        historyList.appendChild(row);
    });
}

window.showConfirm = function (message, title = 'Attention', isDanger = false) {
    return new Promise((resolve) => {
        const modal = document.getElementById('generic-modal');
        if (!modal) {
            resolve(confirm(message));
            return;
        }
        const titleEl = document.getElementById('generic-modal-title');
        const msgEl = document.getElementById('generic-modal-message');
        const iconEl = document.getElementById('generic-modal-icon');
        const actionsEl = document.getElementById('generic-modal-actions');

        titleEl.textContent = title;
        msgEl.innerHTML = message.replace(/\n/g, '<br>');
        iconEl.textContent = isDanger ? '⚠️' : '🤔';

        actionsEl.innerHTML = '';

        const cancelBtn = document.createElement('button');
        cancelBtn.className = 'btn secondary';
        cancelBtn.textContent = 'Cancel';
        cancelBtn.style.marginRight = '12px';
        cancelBtn.onclick = () => {
            modal.style.display = 'none';
            resolve(false);
        };

        const confirmBtn = document.createElement('button');
        confirmBtn.className = isDanger ? 'btn danger' : 'btn primary';
        confirmBtn.textContent = 'Confirm';
        confirmBtn.onclick = () => {
            modal.style.display = 'none';
            resolve(true);
        };

        actionsEl.appendChild(cancelBtn);
        actionsEl.appendChild(confirmBtn);

        modal.style.display = 'flex';
    });
};

window.showAlert = function (message, title = 'Info') {
    return new Promise((resolve) => {
        const modal = document.getElementById('generic-modal');
        if (!modal) {
            alert(message);
            resolve();
            return;
        }
        const titleEl = document.getElementById('generic-modal-title');
        const msgEl = document.getElementById('generic-modal-message');
        const iconEl = document.getElementById('generic-modal-icon');
        const actionsEl = document.getElementById('generic-modal-actions');

        titleEl.textContent = title;
        msgEl.innerHTML = message.replace(/\n/g, '<br>');
        iconEl.textContent = 'ℹ️';

        actionsEl.innerHTML = '';

        const okBtn = document.createElement('button');
        okBtn.className = 'btn primary';
        okBtn.textContent = 'OK';
        okBtn.onclick = () => {
            modal.style.display = 'none';
            resolve();
        };

        actionsEl.appendChild(okBtn);
        modal.style.display = 'flex';
    });
};

window.resetApplication = async function () {
    const warning1 = await showConfirm(
        '⚠️ FACTORY RESET WARNING ⚠️\n\nThis will permanently delete:\n- All download history\n- Current queue\n- Statistics database\n\nThis action cannot be undone. Are you sure?',
        'Factory Reset',
        true
    );
    if (!warning1) return;

    const warning2 = await showConfirm('Are you absolutely sure you want to wipe all data?', 'Final Confirmation', true);
    if (!warning2) return;

    try {
        const res = await smartFetch('/api/system/reset', { method: 'POST' });
        if (res.ok) {
            showToast('System reset successfully', 'success');
            setTimeout(() => location.reload(), 1500);
        } else {
            const data = await res.json();
            showToast('Reset failed: ' + (data.error || 'Unknown error'), 'error');
        }
    } catch (e) {
        showToast('Connection failed', 'error');
    }
};

window.deleteHistoryItem = async function (id) {
    const confirmed = await showConfirm(
        'Are you sure you want to delete this item from history?',
        'Delete History',
        'Delete'
    );

    if (!confirmed) return;

    try {
        const res = await smartFetch(`/api/history/${id}`, { method: 'DELETE' });
        if (res.ok) {
            showToast('Item deleted from history', 'success');
            fetchHistory();
        } else {
            showToast('Failed to delete history item', 'error');
        }
    } catch (err) {
        showToast('Connection error', 'error');
    }
};

const clearHistoryBtn = document.getElementById('clear-history-btn');
if (clearHistoryBtn) {
    clearHistoryBtn.onclick = async () => {

        try {
            const res = await smartFetch('/api/history/clear', { method: 'POST' });
            if (res.ok) {
                showToast('History cleared', 'success');
                fetchHistory();
            } else {
                showToast('Failed to clear history', 'error');
            }
        } catch (err) {
            showToast('Connection error', 'error');
        }
    };
}

window.exportHistory = function (format) {
    window.location.href = `/api/history/export?format=${format}`;
};

const searchBtn = document.getElementById('search-btn');
const searchInput = document.getElementById('search-input');
let currentSearchType = 'albums';

if (searchBtn) searchBtn.onclick = () => doSearch(0);
if (searchInput) {
    searchInput.onkeypress = (e) => {
        if (e.key === 'Enter') doSearch(0);
    };
}

document.querySelectorAll('.type-btn').forEach(btn => {
    btn.addEventListener('click', () => {
        document.querySelectorAll('.type-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        currentSearchType = btn.dataset.type;
        if (searchInput && searchInput.value.trim()) {
            doSearch(0);
        }
    });
});

async function doSearch(offset = 0) {
    const query = searchInput.value.trim();
    if (!query) return;

    state.searchOffset = offset;
    const type = currentSearchType;

    resultsGrid.innerHTML = '<div class="empty-state"><div class="spinner"></div><p>Searching...</p></div>';
    document.getElementById('search-pagination').innerHTML = '';

    try {
        const url = `/api/search?query=${encodeURIComponent(query)}&type=${type}&limit=${state.searchLimit}&offset=${offset}`;
        const res = await smartFetch(url);
        const data = await res.json();
        renderResults(data, type);
    } catch (err) {
        resultsGrid.innerHTML = '<div class="empty-state"><p style="color: var(--danger);">Search failed</p></div>';
    }
}

function renderResults(data, type) {
    resultsGrid.innerHTML = '';
    const itemsData = data[type] || { items: [], total: 0, offset: 0 };
    const list = itemsData.items || [];

    if (list.length === 0) {
        resultsGrid.innerHTML = '<div class="empty-state"><h3>No Results</h3><p>Try different keywords</p></div>';
        return;
    }

    renderPagination('search-pagination', itemsData.total, itemsData.offset, (newOffset) => doSearch(newOffset));

    list.forEach((item) => {
        const card = document.createElement('div');
        let itemType = type.slice(0, -1);
        card.className = `result-card ${itemType}`;

        let title = item.title || item.name;
        let artist = item.artist?.name || item.performer?.name || '';
        let cover = '';
        let id = item.id;
        let isHiRes = !!item.hires;

        if (itemType === 'artist') {
            cover = item.image?.large || item.image?.medium || item.image?.small ||
                item.picture?.large || item.picture?.medium || item.picture?.small;
            artist = '';
            isHiRes = false;
        } else if (itemType === 'track') {
            cover = item.album?.image?.large || item.album?.image?.medium || item.image?.large;
        } else {
            cover = item.image?.large || item.image?.medium || item.image?.small;
        }

        if (cover) cover = cover.replace('_642', '_600').replace('_50', '_600');

        let overlayButtons = '';
        if (itemType === 'album') {
            overlayButtons = `
                <button class="btn secondary" onclick="window.fetchAlbumDetail('${id}')">View Tracks</button>
                <div style="display:flex; gap:8px; margin-top:8px;">
                    <button class="btn primary" onclick="event.stopPropagation(); window.addToQueue('${itemType}', '${id}')">Download</button>
                    <button class="btn secondary" onclick="event.stopPropagation(); window.addToBatch('${itemType}', '${id}')" title="Add to Batch">+</button>
                </div>
            `;
        } else if (itemType === 'artist') {
            overlayButtons = `
                <button class="btn secondary" onclick="window.fetchArtistDetail('${id}', 'albums')">Albums</button>
                <button class="btn secondary" onclick="window.fetchArtistDetail('${id}', 'tracks')">Tracks</button>
            `;
        } else {
            overlayButtons = `
                <button class="btn primary" onclick="event.stopPropagation(); window.addToQueue('${itemType}', '${id}')">Download</button>
                <div style="display:flex; gap:8px; margin-top:8px;">
                    <button class="btn secondary" onclick="event.stopPropagation(); window.playTrack('${id}', '${title.replace(/'/g, "\\'")}', '${artist.replace(/'/g, "\\'")}', '${cover}')" title="Play">▶</button>
                    <button class="btn secondary" onclick="event.stopPropagation(); window.addToBatch('${itemType}', '${id}')" title="Add to Batch">+</button>
                </div>
            `;
        }

        card.innerHTML = `
            ${cover ? `<img src="${cover}" class="result-cover" loading="lazy">` : '<div class="result-cover"></div>'}
            ${isHiRes ? '<div class="hires-badge">HI-RES</div>' : ''}
            <div class="result-badge">${itemType}</div>
            <div class="result-info">
                <div class="result-title" title="${title}">${title}</div>
                ${artist ? `<div class="result-artist" title="${artist}">${artist}</div>` : ''}
            </div>
            <div class="download-overlay">${overlayButtons}</div>
        `;
        card.onclick = (e) => {
            if (!e.target.closest('button')) {
                if (itemType === 'album') fetchAlbumDetail(id);
                else if (itemType === 'artist') fetchArtistDetail(id, 'albums');
                else addToQueue('track', id);
            }
        };
        resultsGrid.appendChild(card);
    });
}

function renderPagination(containerId, total, offset, callback) {
    const container = document.getElementById(containerId);
    if (!container) return;
    container.innerHTML = '';

    const totalPages = Math.ceil(total / state.searchLimit);
    if (totalPages <= 1) return;

    const currentPage = Math.floor(offset / state.searchLimit) + 1;

    const prevBtn = document.createElement('button');
    prevBtn.innerHTML = '←';
    prevBtn.disabled = currentPage === 1;
    prevBtn.onclick = () => callback((currentPage - 2) * state.searchLimit);
    container.appendChild(prevBtn);

    let startPage = Math.max(1, currentPage - 3);
    let endPage = Math.min(totalPages, startPage + 6);
    if (endPage === totalPages) startPage = Math.max(1, endPage - 6);

    for (let i = startPage; i <= endPage; i++) {
        const btn = document.createElement('button');
        btn.innerHTML = i;
        if (i === currentPage) btn.className = 'active';
        btn.onclick = () => callback((i - 1) * state.searchLimit);
        container.appendChild(btn);
    }

    const nextBtn = document.createElement('button');
    nextBtn.innerHTML = '→';
    nextBtn.disabled = currentPage === totalPages;
    nextBtn.onclick = () => callback(currentPage * state.searchLimit);
    container.appendChild(nextBtn);
}

window.fetchAlbumDetail = async function (id) {
    window.switchTab('album');
    albumFullContent.innerHTML = '<div class="empty-state"><div class="spinner"></div><p>Loading album...</p></div>';

    try {
        const res = await smartFetch(`/api/album/${id}`);
        const album = await res.json();
        renderAlbumDetail(album);
    } catch (err) {
        albumFullContent.innerHTML = '<div class="empty-state"><p style="color: var(--danger);">Failed to load album</p></div>';
    }
};

let currentViewTracks = [];

window.startContextPlayback = function (index) {
    if (!currentViewTracks || currentViewTracks.length === 0) return;

    const queue = currentViewTracks.map(t => ({
        id: t.id,
        title: t.title,
        artist: t.artistName,
        cover: t.coverUrl
    }));

    window.playContext(queue, index);
};

function renderAlbumDetail(album) {
    let cover = album.image?.large || album.image?.medium;
    if (cover) cover = cover.replace('_642', '_600');

    currentViewTracks = album.tracks.items.map(t => ({
        ...t,
        artistName: album.artist?.name || 'Unknown',
        coverUrl: cover
    }));

    const hiresText = album.maximum_sampling_rate
        ? `${album.maximum_bit_depth}-Bit / ${album.maximum_sampling_rate} kHz`
        : '';

    albumFullContent.innerHTML = `
        <div class="album-header">
            <img src="${cover}" class="album-header-cover">
            <div class="album-header-info">
                <div class="album-header-title">
                    ${album.title}
                    ${album.hires ? '<span class="hires-indicator">HI-RES</span>' : ''}
                </div>
                <div class="album-header-artist">${album.artist?.name || 'Unknown'}</div>
                <div class="album-header-meta">
                    ${album.tracks_count} tracks • ${album.release_date_original || album.release_date_any || ''}
                    ${hiresText ? `<br><span style="color: var(--warning); font-weight: 600; margin-top: 8px; display: inline-block;">${hiresText}</span>` : ''}
                </div>
                <div style="margin-top: 20px; display: flex; gap: 12px;">
                    <button class="btn primary" onclick="window.startContextPlayback(0)">
                        ▶ Play Album
                    </button>
                    <button class="btn secondary" onclick="window.addToQueue('album', '${album.id}')">
                        Download Album
                    </button>
                    <button class="btn secondary" onclick="window.addToBatch('album', '${album.id}')">
                        + Batch
                    </button>
                </div>
            </div>
        </div>
        <div class="track-list">
            ${album.tracks.items.map((track, index) => `
                <div class="track-item">
                    <div class="track-number">${index + 1}</div>
                    <div class="track-title">
                        ${track.title}
                        ${track.hires ? '<span class="hires-indicator">HI-RES</span>' : ''}
                    </div>
                    <div class="track-duration">${formatDuration(track.duration)}</div>
                    <div class="track-actions">
                        <button class="btn-track-dl" title="Play" onclick="window.startContextPlayback(${index})">
                            <svg class="icon-svg" viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>
                        </button>
                        <button class="btn-track-dl" title="Add to Batch" onclick="window.addToBatch('track', '${track.id}')">
                            <svg class="icon-svg" viewBox="0 0 24 24"><path d="M14 10H2v2h12v-2zm0-4H2v2h12V6zm4 8v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zM2 16h8v-2H2v2z"/></svg>
                        </button>
                        <button class="btn-track-dl" title="Download" onclick="window.addToQueue('track', '${track.id}')">
                            <svg class="icon-svg" viewBox="0 0 24 24"><path d="M19 9h-4V3H9v6H5l7 7 7-7zM5 18v2h14v-2H5z"/></svg>
                        </button>
                    </div>
                </div>
            `).join('')}
        </div>
    `;
}

window.fetchArtistDetail = async function (id, viewType, offset = 0) {
    window.switchTab('artist');
    artistFullContent.innerHTML = '<div class="empty-state"><div class="spinner"></div><p>Loading artist...</p></div>';

    try {
        const res = await smartFetch(`/api/artist/${id}?offset=${offset}&limit=${state.searchLimit}&type=${viewType}`);
        const data = await res.json();
        renderArtistDetail(data, viewType, offset);
    } catch (err) {
        artistFullContent.innerHTML = '<div class="empty-state"><p style="color: var(--danger);">Failed to load artist</p></div>';
    }
};

function renderArtistDetail(artist, viewType, offset = 0) {
    let cover = artist.image?.large || artist.image?.medium || artist.picture?.large;
    if (cover) cover = cover.replace('_642', '_600');

    if (!cover && artist.albums?.items?.length > 0) {
        cover = artist.albums.items[0].image?.large || artist.albums.items[0].image?.medium;
    }

    let contentHtml = '';

    if (viewType === 'albums') {
        const albums = artist.albums?.items || [];
        if (albums.length === 0) {
            contentHtml = '<div class="empty-state"><p>No albums found</p></div>';
        } else {
            contentHtml = '<div class="results-grid">';
            albums.forEach(album => {
                let albumCover = album.image?.large || album.image?.medium;
                if (albumCover) albumCover = albumCover.replace('_642', '_600');
                contentHtml += `
                    <div class="result-card album" onclick="window.fetchAlbumDetail('${album.id}')">
                        <img src="${albumCover}" class="result-cover" loading="lazy">
                        ${album.hires ? '<div class="hires-badge">HI-RES</div>' : ''}
                        <div class="result-info">
                            <div class="result-title">${album.title}</div>
                            <div class="result-artist">${formatDate(album.release_date_original)}</div>
                        </div>
                        <div class="download-overlay">
                            <button class="btn secondary">View Tracks</button>
                        </div>
                    </div>
                `;
            });
            contentHtml += '</div>';
        }
    } else {
        const tracks = artist.tracks?.items || [];
        if (tracks.length === 0) {
            contentHtml = '<div class="empty-state"><p>No tracks found</p></div>';
        } else {
            currentViewTracks = tracks.map(t => ({
                ...t,
                artistName: artist.name,
                coverUrl: t.album?.image?.small || cover
            }));

            contentHtml = '<div class="track-list">';
            tracks.forEach((track, index) => {
                const trackCover = track.album?.image?.small || cover;

                contentHtml += `
                    <div class="track-item">
                        <div class="track-number">${offset + index + 1}</div>
                        <div class="track-title">
                            ${track.title}
                            ${track.hires ? '<span class="hires-indicator">HI-RES</span>' : ''}
                            <div style="font-size: 11px; color: var(--text-secondary);">${track.album?.title || ''}</div>
                        </div>
                        <div class="track-duration">${formatDuration(track.duration)}</div>
                        <div class="track-actions">
                            <button class="btn-track-dl" title="Play" onclick="window.startContextPlayback(${index})">
                                <svg class="icon-svg" viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>
                            </button>
                            <button class="btn-track-dl" title="Add to Batch" onclick="window.addToBatch('track', '${track.id}')">
                                <svg class="icon-svg" viewBox="0 0 24 24"><path d="M14 10H2v2h12v-2zm0-4H2v2h12V6zm4 8v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zM2 16h8v-2H2v2z"/></svg>
                            </button>
                            <button class="btn-track-dl" title="Download" onclick="window.addToQueue('track', '${track.id}')">
                                <svg class="icon-svg" viewBox="0 0 24 24"><path d="M19 9h-4V3H9v6H5l7 7 7-7zM5 18v2h14v-2H5z"/></svg>
                            </button>
                        </div>
                    </div>
                `;
            });
            contentHtml += '</div>';
        }
    }

    artistFullContent.innerHTML = `
        <div class="album-header">
            ${cover ? `<img src="${cover}" class="album-header-cover" style="border-radius: 50%;">` : '<div class="album-header-cover" style="background: var(--bg-hover); border-radius: 50%;"></div>'}
            <div class="album-header-info">
                <div class="album-header-title">${artist.name}</div>
                <div class="album-header-meta">${artist.albums_count || 0} Albums</div>
                <div style="margin-top: 20px; display: flex; gap: 12px;">
                    <button class="btn ${viewType === 'albums' ? 'primary' : 'secondary'}" onclick="window.fetchArtistDetail('${artist.id}', 'albums')">Albums</button>
                    <button class="btn ${viewType === 'tracks' ? 'primary' : 'secondary'}" onclick="window.fetchArtistDetail('${artist.id}', 'tracks')">Tracks</button>
                    ${viewType === 'tracks' && tracks.length > 0 ? `<button class="btn secondary" onclick="window.startContextPlayback(0)">▶ Play Top Tracks</button>` : ''}
                </div>
            </div>
        </div>
        <h3 style="margin: 24px 0 16px; padding-bottom: 12px; border-bottom: 1px solid var(--border);">
            ${viewType === 'albums' ? 'Albums' : 'Popular Tracks'}
        </h3>
        ${contentHtml}
    `;

    if (viewType === 'albums' && artist.albums) {
        renderPagination('artist-pagination', artist.albums.total, offset, (newOffset) => window.fetchArtistDetail(artist.id, 'albums', newOffset));
    } else if (viewType === 'tracks' && artist.tracks) {
        renderPagination('artist-pagination', artist.tracks.total, offset, (newOffset) => window.fetchArtistDetail(artist.id, 'tracks', newOffset));
    }
}

window.addToQueue = async function (type, id) {
    const quality = document.getElementById('quality-input')?.value || 27;
    const finalUrl = `https://www.qobuz.com/${type}/${id}`;

    try {
        const res = await smartFetch('/api/queue/add', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ url: finalUrl, quality })
        });
        if (res.ok) {
            showToast('Added to queue', 'success');
            fetchQueue();
        } else {
            const data = await res.json();
            showToast('Error: ' + data.error, 'error');
        }
    } catch (err) {
        showToast('Failed to add to queue', 'error');
    }
};

const batchUrlsTextarea = document.getElementById('batch-urls');

if (batchUrlsTextarea) {
    batchUrlsTextarea.addEventListener('input', updateBatchCount);
}

function updateBatchCount() {
    const textarea = document.getElementById('batch-urls');
    const countEl = document.getElementById('batch-url-count');
    if (!textarea || !countEl) return;

    const urls = textarea.value.split('\n')
        .map(u => u.trim())
        .filter(u => u && !u.startsWith('#'));
    countEl.textContent = urls.length;
}

window.clearBatchUrls = function () {
    const textarea = document.getElementById('batch-urls');
    if (textarea) {
        textarea.value = '';
        updateBatchCount();
    }
};

window.addToBatch = function (type, id) {
    const url = `https://www.qobuz.com/${type}/${id}`;
    const textarea = document.getElementById('batch-urls');

    if (textarea) {
        const currentVal = textarea.value.trim();
        if (currentVal.includes(url)) {
            showToast('Already in batch list', 'info');
            return;
        }
        textarea.value = currentVal ? (currentVal + '\n' + url) : url;
        updateBatchCount();
        showToast('Added to batch', 'success');
    }
};

window.submitBatchImport = async function () {
    const textarea = document.getElementById('batch-urls');
    const quality = document.getElementById('batch-quality')?.value || 27;
    const resultArea = document.getElementById('batch-result-area');

    const urls = textarea.value.split('\n')
        .map(u => u.trim())
        .filter(u => u && !u.startsWith('#'));

    if (urls.length === 0) {
        showToast('No valid URLs found', 'error');
        return;
    }

    resultArea.innerHTML = '<div class="empty-state small"><div class="spinner"></div><p>Importing...</p></div>';

    try {
        const res = await smartFetch('/api/batch/import', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ urls, quality: parseInt(quality) })
        });

        const data = await res.json();

        let html = '';
        if (data.imported > 0) {
            html += `<div class="batch-result-item success">✓ Imported ${data.imported} items successfully</div>`;
        }
        if (data.failed > 0) {
            html += `<div class="batch-result-item error">✗ Failed: ${data.failed} items</div>`;
            if (data.errors && data.errors.length > 0) {
                data.errors.slice(0, 5).forEach(err => {
                    html += `<div class="batch-result-item error" style="font-size: 11px;">${err}</div>`;
                });
            }
        }

        resultArea.innerHTML = html || '<div class="empty-state small"><p>No results</p></div>';

        if (data.imported > 0) {
            textarea.value = '';
            updateBatchCount();
            fetchQueue();
            showToast(`Imported ${data.imported} items`, 'success');
        }
    } catch (err) {
        resultArea.innerHTML = `<div class="batch-result-item error">Import failed: ${err.message}</div>`;
        showToast('Import failed', 'error');
    }
};

let trendChart = null;

async function loadStatistics() {
    return loadAdvancedAnalytics();
}

window.refreshAnalytics = loadStatistics;

function renderStatistics(data, analytics = {}) {
    document.getElementById('stats-total').textContent = data.overall?.totalDownloads || analytics.summary?.totalTracks || 0;
    document.getElementById('stats-albums').textContent = analytics.summary?.totalAlbums || data.overall?.totalAlbums || 0;
    document.getElementById('stats-artists').textContent = analytics.summary?.totalArtists || data.topArtists?.length || 0;
    document.getElementById('stats-size').textContent = formatBytes(data.overall?.totalSize || 0);

    const todayDownloads = data.daily?.[data.daily.length - 1]?.downloads || 0;
    document.getElementById('stats-today').textContent = todayDownloads;

    const weekDownloads = data.daily?.slice(-7).reduce((sum, d) => sum + (d.downloads || 0), 0) || 0;
    const monthDownloads = data.daily?.slice(-30).reduce((sum, d) => sum + (d.downloads || 0), 0) || 0;

    if (document.getElementById('stats-week')) {
        document.getElementById('stats-week').textContent = weekDownloads;
    }
    if (document.getElementById('stats-month')) {
        document.getElementById('stats-month').textContent = monthDownloads;
    }
    document.getElementById('stats-avg').textContent = data.overall?.averagePerDay || 0;

    const insightsEl = document.getElementById('analytics-insights');
    if (insightsEl) {
        const insights = analytics.insights || generateInsights(data);
        insightsEl.innerHTML = insights.length > 0
            ? insights.map(i => `<div class="insight-item">${i}</div>`).join('')
            : '<div class="insight-item">Download more music to see personalized insights!</div>';
    }

    renderTrendChart(data.daily || []);
    renderQualityStats(data.byQuality || analytics.qualityDistribution || []);
    renderArtistStats(data.topArtists || analytics.topArtists || []);
    renderGenreStats(analytics.genreBreakdown || []);
    renderActivityHeatmap(data.daily || []);
}

function generateInsights(data) {
    const insights = [];

    if (data.overall?.totalDownloads > 0) {
        insights.push(`🎵 You've downloaded ${data.overall.totalDownloads} tracks total`);
    }
    if (data.topArtists?.[0]) {
        insights.push(`🎤 Your most downloaded artist is ${data.topArtists[0].name}`);
    }
    if (data.byQuality) {
        const hiRes = data.byQuality.find(q => q.quality >= 7);
        if (hiRes && hiRes.count > 0) {
            insights.push(`✨ ${hiRes.count} of your tracks are Hi-Res quality`);
        }
    }
    if (data.daily?.length > 7) {
        const trend = data.daily.slice(-7).reduce((sum, d) => sum + d.downloads, 0) / 7;
        if (trend > data.overall.averagePerDay) {
            insights.push(`📈 You're downloading more than usual this week!`);
        }
    }

    return insights;
}

function renderGenreStats(genres) {
    const container = document.getElementById('genre-stats');
    if (!container) return;

    if (!genres || genres.length === 0) {
        container.innerHTML = '<div class="empty-state small"><p>No genre data yet</p></div>';
        return;
    }

    container.innerHTML = genres.slice(0, 8).map(g => `
        <div class="genre-item">
            <span class="genre-name">${g.genre}</span>
            <span class="genre-count">${g.count} tracks</span>
        </div>
    `).join('');
}

function renderActivityHeatmap(daily) {
    const container = document.getElementById('activity-heatmap');
    if (!container || !daily || daily.length === 0) {
        if (container) container.innerHTML = '<div class="empty-state small"><p>Not enough data</p></div>';
        return;
    }

    const last28Days = daily.slice(-28);
    const maxDownloads = Math.max(...last28Days.map(d => d.downloads || 0), 1);

    let html = '';
    last28Days.forEach(d => {
        const level = Math.ceil((d.downloads / maxDownloads) * 5);
        const date = new Date(d.date).toLocaleDateString();
        html += `<div class="heatmap-cell level-${level}" title="${date}: ${d.downloads} downloads"></div>`;
    });

    const remaining = 28 - last28Days.length;
    for (let i = 0; i < remaining; i++) {
        html += '<div class="heatmap-cell"></div>';
    }

    html += `
        <div class="heatmap-legend" style="grid-column: 1/-1;">
            <span>Less</span>
            <div class="heatmap-legend-item level-1"></div>
            <div class="heatmap-legend-item level-2"></div>
            <div class="heatmap-legend-item level-3"></div>
            <div class="heatmap-legend-item level-4"></div>
            <div class="heatmap-legend-item level-5"></div>
            <span>More</span>
        </div>
    `;

    container.innerHTML = html;
}

function renderTrendChart(daily) {
    const ctx = document.getElementById('trend-chart');
    if (!ctx) return;

    if (trendChart) trendChart.destroy();

    const labels = daily.map(d => d.date.slice(5));
    const downloads = daily.map(d => d.downloads);

    trendChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: labels,
            datasets: [{
                label: 'Downloads',
                data: downloads,
                borderColor: '#6366f1',
                backgroundColor: 'rgba(99, 102, 241, 0.1)',
                fill: true,
                tension: 0.4,
                pointRadius: 3,
                pointHoverRadius: 6
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: false }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    grid: { color: 'rgba(255,255,255,0.05)' },
                    ticks: { color: '#8b8b9e' }
                },
                x: {
                    grid: { display: false },
                    ticks: { color: '#8b8b9e' }
                }
            }
        }
    });
}

function renderQualityStats(byQuality) {
    const container = document.getElementById('quality-stats');
    if (!container) return;

    if (!byQuality || byQuality.length === 0) {
        container.innerHTML = '<div class="empty-state small"><p>No data yet</p></div>';
        return;
    }

    const maxCount = Math.max(...byQuality.map(q => q.count));

    container.innerHTML = byQuality.map(q => `
        <div class="quality-bar-item">
            <span class="quality-bar-label">${q.label}</span>
            <div class="quality-bar-track">
                <div class="quality-bar-fill" style="width: ${(q.count / maxCount) * 100}%">
                    ${q.count}
                </div>
            </div>
        </div>
    `).join('');
}

function renderArtistStats(artists) {
    const container = document.getElementById('artist-stats');
    if (!container) return;

    if (!artists || artists.length === 0) {
        container.innerHTML = '<div class="empty-state small"><p>No data yet</p></div>';
        return;
    }

    container.innerHTML = artists.slice(0, 10).map(a => {
        let imageHtml = '';
        if (a.imageUrl) {
            let img = a.imageUrl;
            if (img.includes('_large')) img = img.replace('_large', '_medium');
            imageHtml = `<img src="${img}" class="artist-stat-image" loading="lazy" onerror="this.onerror=null;this.parentNode.innerHTML='<div class=\\'artist-stat-image\\' style=\\'display:flex;align-items:center;justify-content:center;background:var(--bg-hover);color:var(--text-secondary);font-weight:700;\\'>${a.name.charAt(0).toUpperCase()}</div>'">`;
        } else {
            const initial = a.name.charAt(0).toUpperCase();
            imageHtml = `<div class="artist-stat-image" style="display:flex;align-items:center;justify-content:center;background:var(--bg-hover);color:var(--text-secondary);font-weight:700;">${initial}</div>`;
        }

        return `
        <div class="artist-stat-item">
            ${imageHtml}
            <div class="artist-stat-info">
                <span class="artist-stat-name">${a.name}</span>
            </div>
            <div style="text-align:right">
                <span class="artist-stat-count">${a.count}</span>
            </div>
        </div>
    `}).join('');
}

async function loadSettings() {
    try {
        const [settingsRes, credRes] = await Promise.all([
            smartFetch('/api/settings'),
            smartFetch('/api/credentials/status')
        ]);

        const settings = await settingsRes.json();
        const creds = await credRes.json();

        document.getElementById('cred-appid').textContent = creds.configured.appId ? '✓ Configured' : '✗ Missing';
        document.getElementById('cred-appid').className = 'cred-value ' + (creds.configured.appId ? 'valid' : 'invalid');

        document.getElementById('cred-secret').textContent = creds.configured.appSecret ? '✓ Configured' : '✗ Missing';
        document.getElementById('cred-secret').className = 'cred-value ' + (creds.configured.appSecret ? 'valid' : 'invalid');

        document.getElementById('cred-token').textContent = creds.configured.token ? '✓ Configured' : '✗ Missing';
        document.getElementById('cred-token').className = 'cred-value ' + (creds.configured.token ? 'valid' : 'invalid');

        document.getElementById('cred-userid').textContent = creds.configured.userId ? '✓ Configured' : '✗ Missing';
        document.getElementById('cred-userid').className = 'cred-value ' + (creds.configured.userId ? 'valid' : 'invalid');

        document.getElementById('set-path').textContent = settings.DOWNLOADS_PATH || '-';
        document.getElementById('set-folder').textContent = settings.FOLDER_TEMPLATE || '-';
        document.getElementById('set-file').textContent = settings.FILE_TEMPLATE || '-';
        document.getElementById('set-concurrent').textContent = settings.MAX_CONCURRENCY || '-';

    } catch (err) {
        console.error('Failed to load settings:', err);
    }
}

window.validateCredentials = async function () {
    const resultDiv = document.getElementById('cred-result');
    resultDiv.textContent = 'Validating...';
    resultDiv.className = 'cred-result';

    try {
        const res = await smartFetch('/api/credentials/validate?refresh=true');
        const data = await res.json();

        if (data.valid) {
            resultDiv.textContent = `✓ ${data.message} (${data.subscription || 'Unknown'})`;
            resultDiv.className = 'cred-result valid';
        } else {
            resultDiv.textContent = `✗ ${data.message}`;
            resultDiv.className = 'cred-result invalid';
        }
    } catch (err) {
        resultDiv.textContent = '✗ Validation failed';
        resultDiv.className = 'cred-result invalid';
    }
};

window.updateCredentials = async function () {
    const appId = document.getElementById('update-appid')?.value.trim();
    const appSecret = document.getElementById('update-secret')?.value.trim();
    const token = document.getElementById('update-token')?.value.trim();
    const userId = document.getElementById('update-userid')?.value.trim();

    if (!appId && !appSecret && !token && !userId) {
        showToast('Enter at least one value', 'info');
        return;
    }

    try {
        const res = await smartFetch('/api/settings/update', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                app_id: appId,
                app_secret: appSecret,
                token: token,
                user_id: userId
            })
        });

        const data = await res.json();
        if (data.success) {
            showToast(data.message || 'Updated!', 'success');
            document.getElementById('update-appid').value = '';
            document.getElementById('update-secret').value = '';
            document.getElementById('update-token').value = '';
            document.getElementById('update-userid').value = '';
            setTimeout(validateCredentials, 1000);
            loadSettings();
        } else {
            showToast(data.error || 'Update failed', 'error');
        }
    } catch (err) {
        showToast('Update error', 'error');
    }
};

const themeSelect = document.getElementById('theme-select');
if (themeSelect) {
    themeSelect.value = state.theme;
    themeSelect.onchange = () => {
        const theme = themeSelect.value;
        state.theme = theme;
        localStorage.setItem('theme', theme);

        if (theme === 'light') {
            document.body.classList.add('light-theme');
            document.body.classList.remove('dark-theme');
        } else {
            document.body.classList.add('dark-theme');
            document.body.classList.remove('light-theme');
        }
    };
}

const translations = {
    en: {
        queue: 'Queue', search: 'Search', batch: 'Batch Import', statistics: 'Statistics',
        playlists: 'Playlists', history: 'History', settings: 'Settings'
    },
    id: {
        queue: 'Antrian', search: 'Cari', batch: 'Impor Massal', statistics: 'Statistik',
        playlists: 'Playlist', history: 'Riwayat', settings: 'Pengaturan'
    },
    es: {
        queue: 'Cola', search: 'Buscar', batch: 'Importación', statistics: 'Estadísticas',
        playlists: 'Listas', history: 'Historial', settings: 'Ajustes'
    },
    fr: {
        queue: 'File', search: 'Recherche', batch: 'Import', statistics: 'Statistiques',
        playlists: 'Playlists', history: 'Historique', settings: 'Paramètres'
    },
    de: {
        queue: 'Warteschlange', search: 'Suche', batch: 'Batch-Import', statistics: 'Statistiken',
        playlists: 'Playlists', history: 'Verlauf', settings: 'Einstellungen'
    },
    ja: {
        queue: 'キュー', search: '検索', batch: '一括インポート', statistics: '統計',
        playlists: 'プレイリスト', history: '履歴', settings: '設定'
    },
    zh: {
        queue: '队列', search: '搜索', batch: '批量导入', statistics: '统计',
        playlists: '播放列表', history: '历史', settings: '设置'
    }
};

const navIcons = {
    queue: '📥', search: '🔍', batch: '📦', statistics: '📊',
    playlists: '🔄', history: '📜', settings: '⚙️'
};

let currentLang = localStorage.getItem('language') || 'en';

function applyTranslations(lang) {
    const t = translations[lang] || translations.en;

    document.querySelectorAll('.nav-item').forEach(item => {
        const tab = item.dataset.tab;
        if (t[tab] && navIcons[tab]) {
            item.innerHTML = `<span class="icon">${navIcons[tab]}</span> ${t[tab]}`;
        }
    });

    showToast(`Language: ${lang.toUpperCase()}`, 'info');
}

const langSelect = document.getElementById('settings-lang');
if (langSelect) {
    langSelect.value = currentLang;
    langSelect.onchange = () => {
        currentLang = langSelect.value;
        localStorage.setItem('language', currentLang);
        applyTranslations(currentLang);
    };
    if (currentLang !== 'en') {
        setTimeout(() => applyTranslations(currentLang), 100);
    }
}

async function fetchPlaylists() {
    const playlistsList = document.getElementById('playlists-list');
    if (!playlistsList) return;

    try {
        const res = await smartFetch('/api/playlists/watched');
        const items = await res.json();
        renderPlaylists(items);
    } catch (err) {
        console.error('Failed to fetch playlists:', err);
    }
}

function renderPlaylists(items) {
    const playlistsList = document.getElementById('playlists-list');
    if (!playlistsList) return;

    playlistsList.innerHTML = '';
    if (items.length === 0) {
        playlistsList.innerHTML = `
            <div class="empty-state">
                <div class="empty-icon">🔄</div>
                <h3>No Watched Playlists</h3>
                <p>Track playlists to automatically download new songs</p>
            </div>
        `;
        return;
    }

    items.forEach(item => {
        const row = document.createElement('div');
        row.className = 'list-row';
        row.innerHTML = `
            <div style="font-weight: 600">${item.title || item.playlistId}</div>
            <div>${getQualityLabel(item.quality)}</div>
            <div>${item.intervalHours}h</div>
            <div style="font-size: 12px; color: var(--text-secondary);">${item.lastSyncedAt ? new Date(item.lastSyncedAt).toLocaleString() : 'Never'}</div>
            <div>
                <button class="btn danger" style="padding: 6px 12px; font-size: 12px;" onclick="deletePlaylist('${item.id}')">Stop</button>
            </div>
        `;
        playlistsList.appendChild(row);
    });
}

window.deletePlaylist = async function (id) {
    try {
        await smartFetch(`/api/playlists/watch/${id}`, { method: 'DELETE' });
        fetchPlaylists();
    } catch (err) {
        showToast('Failed to delete', 'error');
    }
};

const addModal = document.getElementById('add-modal');
const addBtn = document.getElementById('add-btn');
const addPlaylistModal = document.getElementById('add-playlist-modal');
const addPlaylistBtn = document.getElementById('add-playlist-btn');

if (addBtn) addBtn.onclick = () => addModal.style.display = 'block';
if (addPlaylistBtn) addPlaylistBtn.onclick = () => addPlaylistModal.style.display = 'block';

window.closeModal = function (id) {
    const m = document.getElementById(id);
    if (m) m.style.display = 'none';
};

window.onclick = (e) => {
    if (e.target === addModal) addModal.style.display = 'none';
    if (e.target === addPlaylistModal) addPlaylistModal.style.display = 'none';
};

const addForm = document.getElementById('add-form');
if (addForm) {
    addForm.onsubmit = async (e) => {
        e.preventDefault();
        const url = document.getElementById('url-input').value;
        const quality = document.getElementById('quality-input').value;

        try {
            const res = await smartFetch('/api/queue/add', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ url, quality })
            });
            const data = await res.json();
            if (res.ok) {
                addModal.style.display = 'none';
                document.getElementById('url-input').value = '';
                showToast('Added to queue', 'success');
                fetchQueue();
            } else {
                showToast('Error: ' + (data.error || 'Failed'), 'error');
            }
        } catch (err) {
            showToast('Connection failed', 'error');
        }
    };
}

const addPlaylistForm = document.getElementById('add-playlist-form');
if (addPlaylistForm) {
    addPlaylistForm.onsubmit = async (e) => {
        e.preventDefault();
        const input = document.getElementById('playlist-id-input').value;
        const quality = document.getElementById('playlist-quality-input').value;
        const interval = document.getElementById('playlist-interval-input').value;

        let id = input;
        if (input.includes('qobuz.com')) {
            const match = input.match(/playlist\/([a-zA-Z0-9]+)/);
            if (match) id = match[1];
        }

        try {
            const res = await smartFetch('/api/playlists/watch', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ playlistId: id, quality, intervalHours: interval })
            });

            if (res.ok) {
                addPlaylistModal.style.display = 'none';
                document.getElementById('playlist-id-input').value = '';
                showToast('Playlist tracked', 'success');
                fetchPlaylists();
            } else {
                const data = await res.json();
                showToast('Error: ' + (data.error || 'Failed'), 'error');
            }
        } catch (err) {
            showToast('Connection failed', 'error');
        }
    };
}

const player = {
    audio: document.getElementById('audio-element'),
    bar: document.getElementById('audio-player-bar'),
    playBtn: document.getElementById('player-play'),
    prevBtn: document.getElementById('player-prev'),
    nextBtn: document.getElementById('player-next'),
    downloadBtn: document.getElementById('player-download'),
    seek: document.getElementById('player-seek'),
    volume: document.getElementById('player-volume'),
    currentTime: document.getElementById('player-current-time'),
    duration: document.getElementById('player-duration'),
    cover: document.getElementById('player-cover'),
    title: document.getElementById('player-title'),
    artist: document.getElementById('player-artist'),
    quality: document.getElementById('player-quality'),
    queueInfo: document.getElementById('player-queue-info'),
    isPlaying: false,
    queue: [],
    currentIndex: -1,
    currentTrackId: null
};

async function playCurrentQueueItem() {
    if (player.currentIndex < 0 || player.currentIndex >= player.queue.length) return;

    const track = player.queue[player.currentIndex];
    await window.playTrack(track.id, track.title, track.artist, track.cover, true);
    updatePlayerControls();
}

window.playContext = function (tracks, startIndex = 0) {
    if (!tracks || tracks.length === 0) return;
    player.queue = tracks;
    player.currentIndex = startIndex;
    playCurrentQueueItem();
    updatePlayerControls();
};

window.playNext = function () {
    if (player.currentIndex < player.queue.length - 1) {
        player.currentIndex++;
        playCurrentQueueItem();
    }
};

window.playPrev = function () {
    if (player.currentIndex > 0) {
        player.currentIndex--;
        playCurrentQueueItem();
    } else {
        if (player.audio) player.audio.currentTime = 0;
    }
};

window.playTrack = async function (id, title, artist, cover, isInternal = false) {
    if (!player.audio) return;

    if (!isInternal) {
        player.queue = [{ id, title, artist, cover }];
        player.currentIndex = 0;
    }

    player.currentTrackId = id;
    updatePlayerControls();

    if (player.quality) player.quality.textContent = 'Loading...';
    if (cover) cover = cover.replace(/&amp;/g, '&');

    player.title.textContent = title;
    player.artist.textContent = artist;
    if (cover && player.cover) player.cover.src = cover;

    if ('mediaSession' in navigator) {
        navigator.mediaSession.metadata = new MediaMetadata({
            title: title,
            artist: artist,
            artwork: [{ src: cover || '/favicon.ico', sizes: '512x512', type: 'image/jpeg' }]
        });
    }

    try {
        const infoRes = await smartFetch(`/api/stream/info/${id}`);
        if (infoRes.ok) {
            const info = await infoRes.json();
            if (player.quality) {
                const label = info.qualityLabel || '-';
                player.quality.textContent = label;
                player.quality.className = 'mini-player-quality';

                const qId = info.qualityId || info.format_id || 0;
                const isHiRes = qId === 27 || qId === 7 ||
                    label.toLowerCase().includes('hi-res') ||
                    label.includes('24-bit') || label.includes('24bit');
                const isLossless = qId === 6 ||
                    label.toLowerCase().includes('lossless') ||
                    label.includes('16-bit') || label.includes('16bit');

                if (isHiRes) {
                    player.quality.classList.add('hires');
                } else if (isLossless) {
                    player.quality.classList.add('lossless');
                } else {
                    player.quality.classList.add('lossy');
                }
            }
            player.audio.src = info.url;
            player.audio.play().then(() => {
                player.isPlaying = true;
                updatePlayButton();
                if (player.bar) {
                    player.bar.style.display = 'flex';
                    player.bar.classList.add('playing');
                }
            }).catch(e => {
                console.error('Play error:', e);
                showToast('Playback failed', 'error');
            });
        } else {
            if (player.quality) player.quality.textContent = 'Error';
            showToast('Stream unavailable', 'error');
            if (isInternal && player.currentIndex < player.queue.length - 1) {
                setTimeout(() => window.playNext(), 2000);
            }
        }
    } catch (e) {
        showToast('Network error', 'error');
    }
};

function updatePlayButton() {
    if (!player.playBtn) return;
    player.playBtn.innerHTML = player.isPlaying
        ? '<svg class="icon-svg" viewBox="0 0 24 24" style="fill:currentColor; width:28px; height:28px;"><path d="M8 19c1.1 0 2-.9 2-2V7c0-1.1-.9-2-2-2s-2 .9-2 2v10c0 1.1.9 2 2 2zm6-12v10c0 1.1.9 2 2 2s2-.9 2-2V7c0-1.1-.9-2-2-2s-2 .9-2 2z"/></svg>'
        : '<svg class="icon-svg" viewBox="0 0 24 24" style="fill:currentColor; width:28px; height:28px;"><path d="M8 5v14l11-7z"/></svg>';
}

function updatePlayerControls() {
    if (player.queueInfo) {
        if (player.queue && player.queue.length > 1) {
            player.queueInfo.style.display = 'block';
            player.queueInfo.textContent = `Queue: ${player.currentIndex + 1} / ${player.queue.length}`;
        } else {
            player.queueInfo.style.display = 'none';
        }
    }
}

if (player.playBtn) {
    player.playBtn.onclick = () => {
        if (!player.audio.src) return;
        if (player.isPlaying) {
            player.audio.pause();
        } else {
            player.audio.play();
        }
        player.isPlaying = !player.isPlaying;
        updatePlayButton();
    };
}

if (player.prevBtn) {
    player.prevBtn.onclick = () => window.playPrev();
}

if (player.nextBtn) {
    player.nextBtn.onclick = () => window.playNext();
}

if (player.downloadBtn) {
    player.downloadBtn.onclick = (e) => {
        e.stopPropagation();
        if (player.currentTrackId) {
            window.addToQueue('track', player.currentTrackId);
        } else {
            showToast('No track playing', 'error');
        }
    };
}

if ('mediaSession' in navigator) {
    navigator.mediaSession.setActionHandler('play', () => { player.audio.play(); player.isPlaying = true; updatePlayButton(); });
    navigator.mediaSession.setActionHandler('pause', () => { player.audio.pause(); player.isPlaying = false; updatePlayButton(); });
    navigator.mediaSession.setActionHandler('previoustrack', () => window.playPrev());
    navigator.mediaSession.setActionHandler('nexttrack', () => window.playNext());
}

if (player.audio) {
    player.audio.ontimeupdate = () => {
        if (!player.seek || isNaN(player.audio.duration)) return;
        const percent = (player.audio.currentTime / player.audio.duration) * 100;
        player.seek.value = percent || 0;
        player.currentTime.textContent = formatDuration(Math.floor(player.audio.currentTime));
        player.duration.textContent = formatDuration(Math.floor(player.audio.duration || 0));
    };

    player.audio.onended = () => {
        if (player.currentIndex < player.queue.length - 1) {
            window.playNext();
        } else {
            player.isPlaying = false;
            updatePlayButton();
        }
    };

    player.audio.onplay = () => { player.isPlaying = true; updatePlayButton(); };
    player.audio.onpause = () => { player.isPlaying = false; updatePlayButton(); };

    player.audio.onerror = () => {
        player.isPlaying = false;
        updatePlayButton();
        if (player.currentIndex < player.queue.length - 1) {
            console.log('Track error, skipping to next...');
            setTimeout(() => window.playNext(), 1000);
        }
    };
}



if (player.seek) {
    player.seek.oninput = (e) => {
        if (!player.audio.duration) return;
        player.audio.currentTime = (e.target.value / 100) * player.audio.duration;
    };
}

if (player.volume) {
    player.volume.oninput = (e) => {
        if (player.audio) player.audio.volume = e.target.value / 100;
    };
}

function formatDuration(seconds) {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
}

function formatDate(dateStr) {
    if (!dateStr) return '';
    return new Date(dateStr).getFullYear();
}

function formatBytes(bytes) {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

function getQualityLabel(q) {
    const map = { 5: 'MP3 320', 6: 'FLAC 16/44', 7: 'FLAC 24/96', 27: 'FLAC 24/192' };
    return map[q] || `Q${q}`;
}

function showToast(message, type = 'success') {
    const container = document.getElementById('toast-container');
    if (!container) return;

    const toast = document.createElement('div');
    toast.className = `toast ${type}`;

    const icons = { success: '✓', error: '✗', info: 'ℹ' };

    toast.innerHTML = `
        <span class="toast-icon">${icons[type] || ''}</span>
        <span class="toast-message">${message}</span>
    `;

    container.appendChild(toast);

    setTimeout(() => {
        toast.style.animation = 'fadeOut 0.5s ease-out forwards';
        setTimeout(() => toast.remove(), 500);
    }, 3000);
}

window.showConfirm = function (message, title = 'Confirm Action', okText = 'Confirm') {
    return new Promise((resolve) => {
        const modal = document.getElementById('confirm-modal');
        const titleEl = document.getElementById('confirm-title');
        const msgEl = document.getElementById('confirm-message');
        const okBtn = document.getElementById('confirm-ok');
        const cancelBtn = document.getElementById('confirm-cancel');

        if (!modal) {
            return resolve(confirm(message));
        }

        titleEl.textContent = title;
        msgEl.textContent = message;
        okBtn.textContent = okText;

        const handleOk = () => {
            modal.style.display = 'none';
            cleanup();
            resolve(true);
        };

        const handleCancel = () => {
            modal.style.display = 'none';
            cleanup();
            resolve(false);
        };

        const cleanup = () => {
            okBtn.removeEventListener('click', handleOk);
            cancelBtn.removeEventListener('click', handleCancel);
        };

        okBtn.addEventListener('click', handleOk);
        cancelBtn.addEventListener('click', handleCancel);

        modal.style.display = 'block';
    });
};

window.closePlayer = function () {
    if (player.audio) {
        player.audio.pause();
        player.audio.src = '';
        player.isPlaying = false;
    }
    if (player.bar) {
        player.bar.classList.remove('playing');
        player.bar.style.display = 'none';
    }
};

window.togglePlayerExpand = function () {
    if (player.audio && player.audio.src) {
        if (player.isPlaying) {
            player.audio.pause();
        } else {
            player.audio.play();
        }
        player.isPlaying = !player.isPlaying;
        updatePlayButton();
    }
};

let analyticsChart = null;

async function loadAdvancedAnalytics() {
    try {
        const res = await smartFetch('/api/analytics/dashboard');
        const data = await res.json();
        renderAdvancedAnalytics(data);
    } catch (err) {
        console.error('Failed to load analytics:', err);
    }
}

function renderAdvancedAnalytics(data) {
    const tracksEl = document.getElementById('stats-total');
    if (tracksEl) tracksEl.textContent = data.summary?.totalTracks || 0;

    const durationEl = document.getElementById('stats-duration');
    if (durationEl) durationEl.textContent = data.summary?.totalDuration || '0h 0m';

    const artistsEl = document.getElementById('stats-artists');
    if (artistsEl) artistsEl.textContent = data.summary?.totalArtists || 0;

    const sizeEl = document.getElementById('stats-size');
    if (sizeEl) sizeEl.textContent = data.summary?.totalSize || '0 B';

    const todayEl = document.getElementById('stats-today');
    if (todayEl) todayEl.textContent = data.summary?.downloadsToday || 0;

    const weekEl = document.getElementById('stats-week');
    if (weekEl) weekEl.textContent = data.summary?.downloadsThisWeek || 0;

    const monthEl = document.getElementById('stats-month');
    if (monthEl) monthEl.textContent = data.summary?.downloadsThisMonth || 0;

    const insightsEl = document.getElementById('analytics-insights');
    if (insightsEl && data.insights) {
        insightsEl.innerHTML = data.insights.length > 0
            ? data.insights.map(i => `<div class="insight-item">${i}</div>`).join('')
            : '<div class="insight-item">No insights available yet. Download some music!</div>';
    }

    const qualityEl = document.getElementById('quality-stats');
    if (qualityEl && data.qualityDistribution) {
        qualityEl.innerHTML = data.qualityDistribution.map(q => `
            <div class="quality-bar-item">
                <div class="quality-bar-label">${q.label}</div>
                <div class="quality-bar-track">
                    <div class="quality-bar-fill q${q.quality}" style="width: ${q.percentage}%">${q.percentage}%</div>
                </div>
            </div>
        `).join('');
    }

    const genresEl = document.getElementById('genre-stats');
    if (genresEl && data.genreBreakdown) {
        genresEl.innerHTML = data.genreBreakdown.slice(0, 5).map(g => `
            <div class="genre-item">
                <span class="genre-name">${g.genre}</span>
                <span class="genre-count">${g.count} tracks (${g.percentage}%)</span>
            </div>
        `).join('') || '<div class="empty-state small"><p>No genre data yet</p></div>';
    }

    const topArtistsEl = document.getElementById('artist-stats');
    if (topArtistsEl && data.topArtists) {
        topArtistsEl.innerHTML = data.topArtists.slice(0, 5).map((a, index) => `
            <div class="artist-list-row" style="padding: 10px; border-bottom: 1px solid rgba(255,255,255,0.05); display: flex; align-items: center; justify-content: space-between;">
                <div style="display: flex; align-items: center; gap: 10px;">
                    <span style="color: var(--text-secondary); font-size: 0.9em;">#${index + 1}</span>
                    <span style="font-weight: 500;">${a.name}</span>
                </div>
                <div class="artist-count-badge" style="background: rgba(99, 102, 241, 0.1); color: #818cf8; padding: 2px 8px; border-radius: 12px; font-size: 0.8em;">${a.trackCount} tracks</div>
            </div>
        `).join('') || '<div class="empty-state"><p>No artist data yet</p></div>';
    }

    renderAnalyticsTrendChart(data.trends?.daily || []);
}

function renderAnalyticsTrendChart(trends) {
    const canvas = document.getElementById('analytics-trend-chart');
    if (!canvas) return;

    if (analyticsChart) {
        analyticsChart.destroy();
    }

    let chartData = [...trends].reverse();

    if (chartData.length === 1) {
        chartData.unshift({ period: 'Previous', downloads: 0 });
    }

    if (chartData.length === 0) {
        chartData = Array(7).fill(0).map((_, i) => ({ period: `Day ${i + 1}`, downloads: 0 }));
    }

    const labels = chartData.map(t => t.period.includes('-') ? t.period.split('-').slice(1).join('/') : t.period);
    const downloads = chartData.map(t => t.downloads);

    analyticsChart = new Chart(canvas, {
        type: 'line',
        data: {
            labels: labels,
            datasets: [{
                label: 'Downloads',
                data: downloads,
                borderColor: '#6366f1',
                backgroundColor: 'rgba(99, 102, 241, 0.1)',
                borderWidth: 2,
                pointBackgroundColor: '#6366f1',
                pointRadius: 4,
                fill: true,
                tension: 0.4
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: { legend: { display: false } },
            scales: {
                y: {
                    beginAtZero: true,
                    grid: { color: 'rgba(255,255,255,0.05)' },
                    ticks: { precision: 0 }
                },
                x: {
                    grid: { display: false }
                }
            }
        }
    });
}

window.refreshAnalytics = loadAdvancedAnalytics;

async function loadLibraryStats() {
    try {
        const res = await smartFetch('/api/library/scan/status');
        const data = await res.json();
        updateLibraryStats(data.stats);
        updateScanStatus(data.scanning);
    } catch (err) {
        console.error('Failed to load library stats:', err);
    }
}

function updateLibraryStats(stats) {
    if (!stats) return;
    document.getElementById('lib-total').textContent = stats.totalFiles || 0;
    document.getElementById('lib-duplicates').textContent = stats.duplicates || 0;
    document.getElementById('lib-upgradeable').textContent = stats.upgradeable || 0;
    document.getElementById('lib-size').textContent = formatBytes(stats.totalSize || 0);

    if (stats.processedFiles !== undefined && stats.totalFiles > 0) {
        const percentage = Math.round((stats.processedFiles / stats.totalFiles) * 100);
        const progressEl = document.getElementById('scan-progress');
        const percentageEl = document.getElementById('scan-percentage');

        if (progressEl) progressEl.value = percentage;
        if (percentageEl) percentageEl.textContent = `${percentage}%`;


    }
}

function updateScanStatus(scanning) {
    const icon = document.getElementById('scan-status-icon');
    const text = document.getElementById('scan-status-text');
    const btn = document.getElementById('scan-library-btn');

    if (scanning) {
        if (icon) icon.textContent = '🔄';
        if (text) text.textContent = 'Scanning...';
        if (btn) btn.disabled = true;
    } else {
        if (icon) icon.textContent = '⏸';
        if (text) text.textContent = 'Not scanning';
        if (btn) btn.disabled = false;
    }
}

window.startLibraryScan = async function () {
    const btn = document.getElementById('scan-library-btn');
    if (btn) {
        btn.disabled = true;
        btn.textContent = 'Starting...';
    }

    try {
        const res = await smartFetch('/api/library/scan', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({})
        });

        if (res.ok) {
            showToast('Library scan started', 'success');
            updateScanStatus(true);
            pollScanProgress();
        } else {
            const data = await res.json();
            showToast(data.error || 'Failed to start scan', 'error');
            if (btn) {
                btn.disabled = false;
                btn.textContent = 'Start Scan';
            }
        }
    } catch (err) {
        showToast('Failed to start scan', 'error');
        if (btn) {
            btn.disabled = false;
            btn.textContent = 'Start Scan';
        }
    }
};

window.abortScan = async function () {
    try {
        await smartFetch('/api/library/scan/abort', { method: 'POST' });
        showToast('Scan abort requested', 'info');
        updateScanStatus(false);
    } catch (err) {
        showToast('Failed to abort scan', 'error');
    }
};

function pollScanProgress() {
    const interval = setInterval(async () => {
        try {
            const res = await smartFetch('/api/library/scan/status');
            const data = await res.json();

            updateLibraryStats(data.stats);

            if (!data.scanning) {
                clearInterval(interval);
                updateScanStatus(false);
                showToast('Library scan complete', 'success');
                loadDuplicates();
                loadUpgradeable();
            }
        } catch (err) {
            clearInterval(interval);
        }
    }, 2000);
}

async function loadDuplicates() {
    try {
        const res = await smartFetch('/api/library/duplicates');
        const duplicates = await res.json();
        renderDuplicates(duplicates);
    } catch (err) {
        console.error('Failed to load duplicates:', err);
    }
}

function renderDuplicates(duplicates) {
    const container = document.getElementById('duplicates-list');
    if (!container) return;

    if (duplicates.length === 0) {
        container.innerHTML = `
            <div class="empty-state">
                <div class="empty-icon">✅</div>
                <h3>No Duplicates Found</h3>
                <p>Scan your library to detect duplicate files</p>
            </div>
        `;
        return;
    }

    container.innerHTML = duplicates.map(d => `
        <div class="duplicate-item">
            <div class="duplicate-info">
                <div class="duplicate-title">${d.files.length} duplicate files</div>
                <div class="duplicate-path">${d.recommendation}</div>
            </div>
            <button class="btn secondary" onclick="resolveDuplicate(${d.id})">Resolve</button>
        </div>
    `).join('');
}

window.resolveDuplicate = async function (id) {
    try {
        await smartFetch(`/api/library/duplicates/${id}/resolve`, { method: 'POST' });
        showToast('Duplicate resolved', 'success');
        loadDuplicates();
        loadLibraryStats();
    } catch (err) {
        showToast('Failed to resolve duplicate', 'error');
    }
};

async function loadUpgradeable() {
    try {
        const res = await smartFetch('/api/library/upgradeable');
        const files = await res.json();
        renderUpgradeable(files);
    } catch (err) {
        console.error('Failed to load upgradeable files:', err);
    }
}

window.upgradeFile = async function (trackId) {
    if (!trackId) {
        showToast('Cannot upgrade: Missing Track ID', 'error');
        return;
    }

    const finalUrl = `https://www.qobuz.com/track/${trackId}`;

    try {
        const res = await smartFetch('/api/queue/add', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ url: finalUrl, quality: 27 })
        });

        if (res.ok) {
            showToast('Upgrade added to queue', 'success');
            const btn = document.querySelector(`button[onclick*="${trackId}"]`);
            if (btn) {
                const item = btn.closest('.upgradeable-item');
                if (item) item.remove();
            }
        } else {
            const data = await res.json();
            showToast('Error: ' + data.error, 'error');
        }
    } catch (err) {
        showToast('Failed to add upgrade to queue', 'error');
    }
};

function renderUpgradeable(files) {
    const container = document.getElementById('upgradeable-list');
    if (!container) return;

    if (files.length === 0) {
        container.innerHTML = `
            <div class="empty-state">
                <div class="empty-icon">✅</div>
                <h3>All Files at Best Quality</h3>
                <p>Your library files are already at the highest available quality on Qobuz</p>
            </div>
        `;
        return;
    }

    container.innerHTML = `
        <div class="upgradeable-notice">
            <span class="notice-icon">💡</span>
            <span>The following tracks have higher quality versions available on Qobuz. You can search and download them manually.</span>
        </div>
    ` + files.slice(0, 50).map(f => `
        <div class="upgradeable-item">
            <div class="upgradeable-info">
                <div class="upgradeable-title">${f.title || 'Unknown'} - ${f.artist || 'Unknown'}</div>
                <div class="upgradeable-quality">
                    <span class="current-quality">Your file: ${getQualityLabel(f.quality)}</span>
                    ${f.availableQuality ? `<span class="upgrade-arrow">→</span><span class="available-quality">Available: ${getQualityLabel(f.availableQuality)}</span>` : ''}
                </div>
            </div>
            <div class="quality-badge hi-res">Hi-Res Available</div>
        </div>
    `).join('');
}

document.querySelectorAll('[data-library-tab]').forEach(btn => {
    btn.addEventListener('click', () => {
        document.querySelectorAll('[data-library-tab]').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');

        const tab = btn.dataset.libraryTab;
        document.getElementById('library-duplicates-view').style.display = tab === 'duplicates' ? 'block' : 'none';
        document.getElementById('library-upgradeable-view').style.display = tab === 'upgradeable' ? 'block' : 'none';

        if (tab === 'duplicates') loadDuplicates();
        if (tab === 'upgradeable') loadUpgradeable();
    });
});



function formatBytes(bytes) {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

document.addEventListener('DOMContentLoaded', () => {
    updateBatchCount();

    if (state.activeTab && state.activeTab !== 'album' && state.activeTab !== 'artist') {
        switchTab(state.activeTab);
    } else {
        switchTab('queue');
    }

    if (state.activeTab === 'queue') fetchQueue();
    if (state.activeTab === 'settings') loadSettings();
    if (state.activeTab === 'statistics') loadStatistics();
});
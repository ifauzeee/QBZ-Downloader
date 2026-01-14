const state = {
    connected: false,
    queue: [],
    stats: {},
    activeTab: 'queue',
    searchOffset: 0,
    searchLimit: 20,
    password: localStorage.getItem('dashboard_password') || ''
};

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
    album: document.getElementById('view-album'),
    artist: document.getElementById('view-artist'),
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
socket.on('item:completed', () => {
    fetchQueue();
    fetchHistory();
});
socket.on('item:progress', (data) => updateItemProgress(data));
socket.on('item:failed', () => fetchQueue());

navItems.forEach((item) => {
    item.addEventListener('click', (e) => {
        e.preventDefault();
        const tab = item.dataset.tab;
        switchTab(tab);
    });
});

window.switchTab = function (tab) {
    state.activeTab = tab;

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
        album: 'Album View',
        artist: 'Artist Detail',
        history: 'Download History',
        settings: 'Settings'
    };
    document.getElementById('page-title').textContent = titles[tab] || 'Dashboard';

    if (tab === 'history') fetchHistory();
    if (tab === 'settings') fetchSettings();
};

const clearHistoryBtn = document.getElementById('clear-history-btn');
if (clearHistoryBtn) {
    clearHistoryBtn.onclick = async () => {
        if (!confirm('Are you sure you want to delete ALL history? This cannot be undone.')) return;

        try {
            const res = await smartFetch('/api/history/clear', { method: 'POST' });
            if (res.ok) {
                showToast('History cleared successfully', 'success');
                fetchHistory();
            } else {
                showToast('Failed to clear history', 'error');
            }
        } catch (err) {
            showToast('Connection error', 'error');
        }
    };
}

async function fetchQueue() {
    try {
        const response = await smartFetch('/api/queue');
        const items = await response.json();
        renderQueue(items);
    } catch (err) {
        console.error('Failed to fetch queue:', err);
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

window.queueAction = async function (action) {
    try {
        await smartFetch('/api/queue/action', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action })
        });
        fetchQueue();
    } catch (err) {
        alert('Action failed');
    }
};

function renderQueue(items) {
    queueList.innerHTML = '';
    if (items.length === 0) {
        queueList.innerHTML =
            '<div style="padding: 20px; text-align: center; color: #666;">Queue is empty</div>';
        return;
    }
    items.forEach((item) => {
        const row = document.createElement('div');
        row.className = 'list-row';
        row.id = `item-${item.id}`;
        row.innerHTML = `
            <div class="title-cell">
                <div style="font-weight: 500">${item.title || 'Loading...'}</div>
            </div>
            <div><span class="badge ${item.type}">${item.type}</span></div>
            <div>${getQualityLabel(item.quality)}</div>
            <div><span class="badge ${item.status}">${item.status}</span></div>
            <div class="progress-cell">
                <div class="progress-bar">
                    <div class="progress-fill" style="width: ${item.progress || 0}%"></div>
                </div>
            </div>
            <div>
                ${item.status === 'downloading' || item.status === 'pending'
                ? `<button class="btn danger" style="padding: 4px 8px; font-size: 11px;" onclick="cancelItem('${item.id}')">Cancel</button>`
                : item.status === 'completed'
                    ? `<button class="btn primary" style="padding: 4px 8px; font-size: 11px;" onclick="downloadFile('${item.contentId}')">Save to Device</button>`
                    : ''
            }
            </div>
        `;
        queueList.appendChild(row);
    });
}

window.downloadFile = function (id) {
    window.location.href = `/api/download/${id}`;
};


function renderHistory(items) {
    historyList.innerHTML = '';
    if (items.length === 0) {
        historyList.innerHTML =
            '<div style="padding: 20px; text-align: center; color: #666;">No history found</div>';
        return;
    }
    items.forEach((item) => {
        const row = document.createElement('div');
        row.className = 'list-row';
        const date = new Date(item.downloadedAt).toLocaleString();
        row.innerHTML = `
            <div style="color: #666; font-size: 12px;">${date}</div>
            <div style="font-weight: 500">${item.title}</div>
            <div>${getQualityLabel(item.quality)}</div>
            <div style="font-family: monospace; font-size: 11px; color: #888; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${item.filename}</div>
            <div>
                <button class="btn primary" style="padding: 4px 8px; font-size: 11px;" onclick="downloadFile('${item.id}')">Download</button>
            </div>
        `;
        historyList.appendChild(row);
    });
}

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

        if (searchInput.value.trim()) {
            doSearch(0);
        }
    });
});

async function doSearch(offset = 0) {
    const query = searchInput.value.trim();
    if (!query) return;

    state.searchOffset = offset;
    const type = currentSearchType;

    resultsGrid.innerHTML =
        '<div style="grid-column: 1/-1; text-align: center; padding: 50px;">Searching...</div>';
    document.getElementById('search-pagination').innerHTML = '';

    try {
        const url = `/api/search?query=${encodeURIComponent(query)}&type=${type}&limit=${state.searchLimit}&offset=${offset}`;
        const res = await smartFetch(url);
        const data = await res.json();
        renderResults(data, type);
    } catch (err) {
        resultsGrid.innerHTML =
            '<div style="grid-column: 1/-1; text-align: center; color: var(--danger); padding: 50px;">Search failed</div>';
    }
}

function renderResults(data, type) {
    resultsGrid.innerHTML = '';
    const itemsData = data[type] || { items: [], total: 0, offset: 0 };
    const list = itemsData.items || [];

    if (list.length === 0) {
        resultsGrid.innerHTML =
            '<div style="grid-column: 1/-1; text-align: center; color: #666; padding: 50px;">No results found</div>';
        return;
    }

    renderPagination(
        'search-pagination',
        itemsData.total,
        itemsData.offset,
        (newOffset) => doSearch(newOffset)
    );

    list.forEach((item) => {
        const card = document.createElement('div');
        let itemType = type.slice(0, -1);
        card.className = `result-card ${itemType}`;

        let title = item.title || item.name;
        let artist = item.artist?.name || item.performer?.name || 'Various Artists';
        let cover = '';
        let id = item.id;
        let isHiRes = !!item.hires;

        if (itemType === 'artist') {
            cover =
                item.image?.large ||
                item.image?.medium ||
                item.image?.small ||
                item.picture?.large ||
                item.picture?.medium ||
                item.picture?.small ||
                item.picture_large ||
                item.picture_medium ||
                item.picture_small;

            if (!cover && typeof item.image === 'string') cover = item.image;
            if (!cover && typeof item.picture === 'string') cover = item.picture;

            if (!cover) {
                console.warn('Missing cover for artist:', item);
            }

            artist = '';
            isHiRes = false;
        } else if (itemType === 'track') {
            cover =
                item.album?.image?.large ||
                item.album?.image?.medium ||
                item.album?.image?.small ||
                item.image?.large ||
                item.image?.medium;
        } else {
            cover = item.image?.large || item.image?.medium || item.image?.small;
        }

        if (cover && cover.replace) {
            cover = cover.replace('_642', '_600').replace('_50', '_600');
        }

        const openHandler = () => {
            if (itemType === 'album') fetchAlbumDetail(id);
            else if (itemType === 'track') addToQueue('track', id);
            else if (itemType === 'artist') fetchArtistDetail(id, 'albums');
        };

        card.onclick = (e) => {
            if (e.target.tagName !== 'BUTTON') openHandler();
        };

        let overlayButtons = '';
        if (itemType === 'album') {
            overlayButtons = `<button class="btn secondary" onclick="window.fetchAlbumDetail('${id}')">View Tracks</button>
                             <button class="btn primary" onclick="event.stopPropagation(); window.addToQueue('${itemType}', '${id}')">Full Download</button>`;
        } else if (itemType === 'artist') {
            overlayButtons = `<button class="btn secondary" onclick="window.fetchArtistDetail('${id}', 'albums')">View Albums</button>
                              <button class="btn secondary" onclick="window.fetchArtistDetail('${id}', 'tracks')">View Tracks</button>`;
        } else {
            overlayButtons = `<button class="btn primary" onclick="event.stopPropagation(); window.addToQueue('${itemType}', '${id}')">Full Download</button>`;
        }

        card.innerHTML = `
            ${cover ? `<img src="${cover}" class="result-cover" loading="lazy">` : '<div class="result-cover"></div>'}
            ${isHiRes ? '<div class="hires-badge">HI-RES</div>' : ''}
            <div class="result-badge">${itemType}</div>
            <div class="result-info">
                <div class="result-title" title="${title}">${title}</div>
                ${artist ? `<div class="result-artist" title="${artist}">${artist}</div>` : ''}
            </div>
            <div class="download-overlay">
                ${overlayButtons}
            </div>
        `;
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

window.fetchArtistDetail = async function (id, viewType, offset = 0) {
    window.switchTab('artist');
    if (offset === 0) {
        artistFullContent.innerHTML =
            '<div style="text-align: center; padding: 50px;">Loading artist details...</div>';
    }

    const pagContainer = document.getElementById('artist-pagination');
    if (pagContainer) pagContainer.innerHTML = '';

    try {
        const res = await smartFetch(`/api/artist/${id}?offset=${offset}&limit=${state.searchLimit}&type=${viewType}`);
        const data = await res.json();
        renderArtistDetail(data, viewType, offset);
    } catch (err) {
        artistFullContent.innerHTML =
            '<div style="text-align: center; color: var(--danger); padding: 50px;">Failed to load artist</div>';
    }
};

function renderArtistDetail(artist, viewType, offset = 0) {
    let cover = artist.image?.large || artist.image?.medium || artist.image?.small ||
        artist.picture?.large || artist.picture?.medium || artist.picture?.small;

    if (cover && cover.replace) cover = cover.replace('_642', '_600').replace('_50', '_600');

    if (!cover && artist.albums && artist.albums.items.length > 0) {
        cover = artist.albums.items[0].image?.large || artist.albums.items[0].image?.medium;
    }

    let contentHtml = '';

    if (viewType === 'albums') {
        const albums = artist.albums?.items || [];
        if (albums.length === 0) {
            contentHtml = '<div style="text-align: center; padding: 30px;">No albums found</div>';
        } else {
            contentHtml = '<div class="results-grid">';
            albums.forEach(album => {
                let albumCover = album.image?.large || album.image?.medium;
                if (albumCover && albumCover.replace) albumCover = albumCover.replace('_642', '_600');

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
            contentHtml = '<div style="text-align: center; padding: 30px;">No tracks found</div>';
        } else {
            contentHtml = '<div class="track-list">';
            tracks.forEach((track, index) => {
                contentHtml += `
                <div class="track-item">
                    <div class="track-number">${offset + index + 1}</div>
                    <div class="track-title">
                        ${track.title}
                        ${track.hires ? '<span class="hires-indicator" style="font-size: 8px; padding: 1px 3px;">HI-RES</span>' : ''}
                        <div style="font-size: 11px; color: #888;">${track.album?.title || ''}</div>
                    </div>
                    <div class="track-duration">${formatDuration(track.duration)}</div>
                    <div class="track-actions">
                        <button class="btn" title="Download this track" onclick="window.addToQueue('track', '${track.id}')">📥</button>
                    </div>
                </div>
                 `;
            });
            contentHtml += '</div>';
        }
    }

    artistFullContent.innerHTML = `
        <div class="album-header">
            ${cover ? `<img src="${cover}" class="album-header-cover">` : '<div class="album-header-cover" style="background:#333"></div>'}
            <div class="album-header-info">
                <div class="album-header-title">${artist.name}</div>
                <div class="album-header-meta">
                   ${artist.albums_count || 0} Albums
                </div>
                 <div style="margin-top: 15px; display: flex; gap: 10px;">
                    <button class="btn ${viewType === 'albums' ? 'primary' : 'secondary'}" onclick="window.fetchArtistDetail('${artist.id}', 'albums')">Albums</button>
                    <button class="btn ${viewType === 'tracks' ? 'primary' : 'secondary'}" onclick="window.fetchArtistDetail('${artist.id}', 'tracks')">Top Tracks</button>
                </div>
            </div>
        </div>
        <h3 style="margin: 20px 0 15px 0; border-bottom: 1px solid var(--border); padding-bottom: 10px;">
            ${viewType === 'albums' ? 'Albums' : 'Top Tracks'}
        </h3>
        ${contentHtml}
    `;

    if (viewType === 'albums' && artist.albums) {
        renderPagination(
            'artist-pagination',
            artist.albums.total,
            offset,
            (newOffset) => window.fetchArtistDetail(artist.id, 'albums', newOffset)
        );
    } else if (viewType === 'tracks' && artist.tracks) {
        renderPagination(
            'artist-pagination',
            artist.tracks.total,
            offset,
            (newOffset) => window.fetchArtistDetail(artist.id, 'tracks', newOffset)
        );
    }
}

function formatDate(dateStr) {
    if (!dateStr) return '';
    return new Date(dateStr).getFullYear();
}

window.fetchAlbumDetail = async function (id) {
    window.switchTab('album');
    albumFullContent.innerHTML =
        '<div style="text-align: center; padding: 50px;">Loading album details...</div>';
    try {
        const res = await smartFetch(`/api/album/${id}`);
        const album = await res.json();
        renderAlbumDetail(album);
    } catch (err) {
        albumFullContent.innerHTML =
            '<div style="text-align: center; color: var(--danger); padding: 50px;">Failed to load album</div>';
    }
};

function renderAlbumDetail(album) {
    let cover = album.image?.large || album.image?.medium || album.image?.small;
    if (cover && cover.replace) cover = cover.replace('_642', '_600').replace('_50', '_600');

    const hiresText = album.maximum_sampling_rate
        ? `${album.maximum_bit_depth}-Bit / ${album.maximum_sampling_rate} kHz`
        : '';

    albumFullContent.innerHTML = `
        <div class="album-header">
            <img src="${cover}" class="album-header-cover">
            <div class="album-header-info">
                <div class="album-header-title">
                    ${album.title}
                    ${album.hires ? '<span class="hires-indicator">HI-RES AUDIO</span>' : ''}
                </div>
                <div class="album-header-artist">${album.artist?.name}</div>
                <div class="album-header-meta">
                    ${album.tracks_count} tracks • ${album.release_date_original || album.release_date_any}
                    ${hiresText ? `<br><span style="color: #e6b32e; font-weight: 600; font-size: 12px; margin-top: 5px; display: inline-block;">${hiresText}</span>` : ''}
                </div>
                <div style="margin-top: 15px">
                    <button class="btn primary" onclick="window.addToQueue('album', '${album.id}');">Download Full Album</button>
                </div>
            </div>
        </div>
        <div class="track-list">
            ${album.tracks.items
            .map(
                (track, index) => `
                <div class="track-item">
                    <div class="track-number">${index + 1}</div>
                    <div class="track-title">
                        ${track.title}
                        ${track.hires ? '<span class="hires-indicator" style="font-size: 8px; padding: 1px 3px;">HI-RES</span>' : ''}
                    </div>
                    <div class="track-duration">${formatDuration(track.duration)}</div>
                    <div class="track-actions">
                        <button class="btn" title="Download this track" onclick="window.addToQueue('track', '${track.id}')">📥</button>
                    </div>
                </div>
            `
            )
            .join('')}
        </div>
    `;
}

function formatDuration(seconds) {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
}

function showToast(message, type = 'success') {
    const container = document.getElementById('toast-container');
    if (!container) return;

    const toast = document.createElement('div');
    toast.className = `toast ${type}`;

    const icon = type === 'success' ? '✅' : '❌';

    toast.innerHTML = `
        <span class="toast-icon">${icon}</span>
        <span class="toast-message">${message}</span>
    `;

    container.appendChild(toast);

    setTimeout(() => {
        toast.style.animation = 'fadeOut 0.5s ease-out forwards';
        setTimeout(() => {
            toast.remove();
        }, 500);
    }, 3000);
}


window.addToQueue = async function (type, id) {
    const quality = document.getElementById('quality-input').value;
    let finalUrl = `https://www.qobuz.com/${type}/${id}`;
    try {
        const res = await smartFetch('/api/queue/add', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ url: finalUrl, quality })
        });
        if (res.ok) {
            showToast('Item added to queue', 'success');
            fetchQueue();
        } else {
            const data = await res.json();
            showToast('Error: ' + data.error, 'error');
        }
    } catch (err) {
        showToast('Failed to add to queue', 'error');
    }
};

window.closeModal = function (id) {
    const m = document.getElementById(id);
    if (m) m.style.display = 'none';
};

function updateStats(stats) {
    document.getElementById('stat-pending').textContent = stats.pending;
    document.getElementById('stat-active').textContent = stats.downloading;
    document.getElementById('q-total').textContent = stats.total;
    document.getElementById('q-downloading').textContent = stats.downloading;
    document.getElementById('q-completed').textContent = stats.completed;
    document.getElementById('q-failed').textContent = stats.failed;
}

function updateItemProgress(data) {
    const row = document.getElementById(`item-${data.id}`);
    if (row) {
        const fill = row.querySelector('.progress-fill');
        if (fill) fill.style.width = `${data.progress}%`;
    }
}

window.cancelItem = async function (id) {
    if (!confirm('Are you sure?')) return;
    await smartFetch(`/api/item/${id}/cancel`, { method: 'POST' });
    fetchQueue();
};

function updateConnectionStatus(online) {
    const el = document.querySelector('.status-indicator');
    if (!el) return;
    if (online) {
        el.innerHTML = '<span class="dot"></span> Online';
        el.style.color = 'var(--success)';
        el.querySelector('.dot').style.backgroundColor = 'var(--success)';
        el.querySelector('.dot').style.boxShadow = '0 0 5px var(--success)';
    } else {
        el.innerHTML = '<span class="dot"></span> Disconnected';
        el.style.color = 'var(--danger)';
        el.querySelector('.dot').style.backgroundColor = 'var(--danger)';
        el.querySelector('.dot').style.boxShadow = '0 0 5px var(--danger)';
    }
}

function getQualityLabel(q) {
    const map = { 5: 'MP3 320', 6: 'FLAC 16/44', 7: 'FLAC 24/96', 27: 'FLAC 24/192' };
    return map[q] || `Q${q}`;
}

const addModal = document.getElementById('add-modal');
const addBtn = document.getElementById('add-btn');

if (addBtn) addBtn.onclick = () => (addModal.style.display = 'block');
window.onclick = (e) => {
    if (e.target == addModal) addModal.style.display = 'none';
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
                showToast('Item added to queue', 'success');
                fetchQueue();
            } else {
                showToast('Error: ' + (data.error || 'Failed to add'), 'error');
            }
        } catch (err) {
            showToast('Error: Connection failed', 'error');
        }
    };
}

async function fetchSettings() {
    try {
        const res = await smartFetch('/api/settings');
        const config = await res.json();

        document.getElementById('setting-QOBUZ_APP_ID').value = config.QOBUZ_APP_ID || '';
        document.getElementById('setting-QOBUZ_APP_SECRET').value = config.QOBUZ_APP_SECRET || '';
        document.getElementById('setting-QOBUZ_USER_AUTH_TOKEN').value = config.QOBUZ_USER_AUTH_TOKEN || config.QOBUZ_TOKEN || '';
        document.getElementById('setting-QOBUZ_USER_ID').value = config.QOBUZ_USER_ID || '';
        document.getElementById('setting-TELEGRAM_BOT_TOKEN').value = config.TELEGRAM_BOT_TOKEN || '';
        document.getElementById('setting-TELEGRAM_CHAT_ID').value = config.TELEGRAM_CHAT_ID || '';

        document.getElementById('setting-defaultQuality').value = config.defaultQuality || 'ask';
        document.getElementById('setting-embedLyrics').checked = config.embedLyrics !== false;
        document.getElementById('setting-embedCover').checked = config.embedCover !== false;

        document.getElementById('setting-downloads-path').value = config.downloads?.path || '';
        document.getElementById('setting-downloads-concurrent').value =
            config.downloads?.concurrent || 4;
        document.getElementById('setting-downloads-folderTemplate').value =
            config.downloads?.folderTemplate || '';
        document.getElementById('setting-downloads-fileTemplate').value =
            config.downloads?.fileTemplate || '';

        document.getElementById('setting-telegram-uploadFiles').checked =
            config.telegram?.uploadFiles !== false;
        document.getElementById('setting-telegram-autoDelete').checked =
            config.telegram?.autoDelete !== false;
        document.getElementById('setting-telegram-allowedUsers').value =
            config.telegram?.allowedUsers || '';

        document.getElementById('setting-downloads-retryAttempts').value = config.downloads?.retryAttempts || 3;
        document.getElementById('setting-downloads-retryDelay').value = config.downloads?.retryDelay || 1000;
        document.getElementById('setting-downloads-proxy').value = config.downloads?.proxy || '';

        document.getElementById('setting-metadata-saveCoverFile').checked = config.metadata?.saveCoverFile || false;
        document.getElementById('setting-metadata-saveLrcFile').checked = config.metadata?.saveLrcFile || false;
        document.getElementById('setting-metadata-coverSize').value = config.metadata?.coverSize || 'max';
        document.getElementById('setting-metadata-lyricsType').value = config.metadata?.lyricsType || 'both';

        document.getElementById('setting-display-colorScheme').value = config.display?.colorScheme || 'gradient';
        document.getElementById('setting-display-verbosity').value = config.display?.verbosity || 'detailed';

        document.getElementById('setting-dashboard-autoCleanHours').value = config.dashboard?.autoCleanHours || 24;
    } catch (err) {
        console.error('Failed to load settings:', err);
    }
}

window.saveSettings = async function () {
    const config = {
        QOBUZ_APP_ID: document.getElementById('setting-QOBUZ_APP_ID').value,
        QOBUZ_APP_SECRET: document.getElementById('setting-QOBUZ_APP_SECRET').value,
        QOBUZ_USER_AUTH_TOKEN: document.getElementById('setting-QOBUZ_USER_AUTH_TOKEN').value,
        QOBUZ_USER_ID: document.getElementById('setting-QOBUZ_USER_ID').value,
        TELEGRAM_BOT_TOKEN: document.getElementById('setting-TELEGRAM_BOT_TOKEN').value,
        TELEGRAM_CHAT_ID: document.getElementById('setting-TELEGRAM_CHAT_ID').value,

        defaultQuality: document.getElementById('setting-defaultQuality').value,
        embedLyrics: document.getElementById('setting-embedLyrics').checked,
        embedCover: document.getElementById('setting-embedCover').checked,
        telegram: {
            uploadFiles: document.getElementById('setting-telegram-uploadFiles').checked,
            autoDelete: document.getElementById('setting-telegram-autoDelete').checked,
            allowedUsers: document.getElementById('setting-telegram-allowedUsers').value
        },
        downloads: {
            path: document.getElementById('setting-downloads-path').value,
            concurrent: parseInt(document.getElementById('setting-downloads-concurrent').value),
            folderTemplate: document.getElementById('setting-downloads-folderTemplate').value,
            fileTemplate: document.getElementById('setting-downloads-fileTemplate').value,
            retryAttempts: parseInt(document.getElementById('setting-downloads-retryAttempts').value),
            retryDelay: parseInt(document.getElementById('setting-downloads-retryDelay').value),
            proxy: document.getElementById('setting-downloads-proxy').value
        },
        metadata: {
            saveCoverFile: document.getElementById('setting-metadata-saveCoverFile').checked,
            saveLrcFile: document.getElementById('setting-metadata-saveLrcFile').checked,
            coverSize: document.getElementById('setting-metadata-coverSize').value,
            lyricsType: document.getElementById('setting-metadata-lyricsType').value
        },
        display: {
            colorScheme: document.getElementById('setting-display-colorScheme').value,
            verbosity: document.getElementById('setting-display-verbosity').value
        },
        dashboard: {
            autoCleanHours: parseInt(document.getElementById('setting-dashboard-autoCleanHours').value)
        }
    };

    try {
        const res = await smartFetch('/api/settings', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(config)
        });
        if (res.ok) {
            showToast('Settings saved successfully!', 'success');
        } else {
            showToast('Failed to save settings', 'error');
        }
    } catch (err) {
        showToast('Error saving settings', 'error');
    }
};


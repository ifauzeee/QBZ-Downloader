const state = {
    connected: false,
    queue: [],
    stats: {},
    activeTab: 'queue',
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
    history: document.getElementById('view-history'),
    settings: document.getElementById('view-settings')
};

const navItems = document.querySelectorAll('.nav-item');
const queueList = document.getElementById('queue-list');
const historyList = document.getElementById('history-list');
const resultsGrid = document.getElementById('search-results');
const albumFullContent = document.getElementById('album-full-content');

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
        history: 'Download History',
        settings: 'Settings'
    };
    document.getElementById('page-title').textContent = titles[tab] || 'Dashboard';

    if (tab === 'history') fetchHistory();
    if (tab === 'settings') fetchSettings();
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
                <div class="progress-text">${Math.round(item.progress || 0)}%</div>
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
const searchType = document.getElementById('search-type');

if (searchBtn) searchBtn.onclick = () => doSearch();
if (searchInput) {
    searchInput.onkeypress = (e) => {
        if (e.key === 'Enter') doSearch();
    };
}

async function doSearch() {
    const query = searchInput.value.trim();
    if (!query) return;
    const type = searchType.value;
    resultsGrid.innerHTML =
        '<div style="grid-column: 1/-1; text-align: center; padding: 50px;">Searching...</div>';
    try {
        const res = await smartFetch(`/api/search?query=${encodeURIComponent(query)}&type=${type}`);
        const data = await res.json();
        renderResults(data, type);
    } catch (err) {
        resultsGrid.innerHTML =
            '<div style="grid-column: 1/-1; text-align: center; color: var(--danger); padding: 50px;">Search failed</div>';
    }
}

function renderResults(data, type) {
    resultsGrid.innerHTML = '';
    const list = data[type]?.items || [];
    if (list.length === 0) {
        resultsGrid.innerHTML =
            '<div style="grid-column: 1/-1; text-align: center; color: #666; padding: 50px;">No results found</div>';
        return;
    }
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
                item.picture_large ||
                item.picture_medium ||
                item.picture_small;
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
        };

        card.onclick = (e) => {
            if (e.target.tagName !== 'BUTTON') openHandler();
        };

        card.innerHTML = `
            ${cover ? `<img src="${cover}" class="result-cover" loading="lazy">` : '<div class="result-cover"></div>'}
            ${isHiRes ? '<div class="hires-badge">HI-RES</div>' : ''}
            <div class="result-badge">${itemType}</div>
            <div class="result-info">
                <div class="result-title" title="${title}">${title}</div>
                ${artist ? `<div class="result-artist" title="${artist}">${artist}</div>` : ''}
            </div>
            <div class="download-overlay">
                ${itemType === 'album'
                ? `<button class="btn secondary" onclick="window.fetchAlbumDetail('${id}')">View Tracks</button>`
                : ''
            }
                <button class="btn primary" onclick="event.stopPropagation(); window.addToQueue('${itemType}', '${id}')">Full Download</button>
            </div>
        `;
        resultsGrid.appendChild(card);
    });
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
            console.log(`Added ${type} to queue!`);
            fetchQueue();
        } else {
            const data = await res.json();
            alert('Error: ' + data.error);
        }
    } catch (err) {
        alert('Failed to add');
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
        const text = row.querySelector('.progress-text');
        if (fill) fill.style.width = `${data.progress}%`;
        if (text) text.innerText = `${Math.round(data.progress)}%`;
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
                fetchQueue();
            } else {
                alert('Error: ' + data.error);
            }
        } catch (err) {
            alert('Failed to add');
        }
    };
}

async function fetchSettings() {
    try {
        const res = await smartFetch('/api/settings');
        const config = await res.json();

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
    } catch (err) {
        console.error('Failed to load settings:', err);
    }
}

window.saveSettings = async function () {
    const config = {
        defaultQuality: document.getElementById('setting-defaultQuality').value,
        embedLyrics: document.getElementById('setting-embedLyrics').checked,
        embedCover: document.getElementById('setting-embedCover').checked,
        downloads: {
            path: document.getElementById('setting-downloads-path').value,
            concurrent: parseInt(document.getElementById('setting-downloads-concurrent').value),
            folderTemplate: document.getElementById('setting-downloads-folderTemplate').value,
            fileTemplate: document.getElementById('setting-downloads-fileTemplate').value
        },
        telegram: {
            uploadFiles: document.getElementById('setting-telegram-uploadFiles').checked,
            autoDelete: document.getElementById('setting-telegram-autoDelete').checked
        }
    };

    try {
        const res = await smartFetch('/api/settings', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(config)
        });
        if (res.ok) {
            alert('Settings saved successfully!');
        } else {
            alert('Failed to save settings');
        }
    } catch (err) {
        alert('Error saving settings');
    }
};


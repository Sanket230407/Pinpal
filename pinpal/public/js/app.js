// PinPal main app: nearby map, requests, chats, profile
(() => {
  if (!Auth.token) { location.replace('/login.html'); return; }

  const $ = (id) => document.getElementById(id);

  const state = {
    me: null,
    people: [],
    conns: { friends: [], incoming: [], outgoing: [] },
    summary: [],
    tab: 'nearby',
    activeChat: null,   // user object of the open chat
    lastRenderedChat: '',
    pickMode: false,
    map: null,
    markerLayer: null,
    markers: new Map(), // userId -> leaflet marker
    meMarker: null,
    radiusCircle: null,
  };

  const hasMap = typeof L !== 'undefined';

  // ======================= Boot =======================
  async function init() {
    try {
      state.me = await api('GET', '/api/me');
    } catch { return; }

    $('header-name').textContent = state.me.name;
    initMap();
    bindEvents();
    fillProfileForm();
    updateLocationUI();

    await Promise.all([loadConns(), loadSummary()]);
    if (state.me.lat != null) await loadNearby();
    renderPeople();

    setInterval(() => { loadConns(); loadSummary(); }, 5000);
    setInterval(() => { if (state.tab === 'chats' && state.activeChat) refreshChat(); }, 2500);
  }

  // ======================= Tabs =======================
  function switchTab(tab) {
    state.tab = tab;
    document.querySelectorAll('.tab').forEach((t) => t.classList.toggle('active', t.dataset.tab === tab));
    document.querySelectorAll('.panel').forEach((p) => p.classList.toggle('active', p.id === 'panel-' + tab));
    if (tab === 'nearby' && state.map) setTimeout(() => state.map.invalidateSize(), 50);
    if (tab === 'requests') renderRequests();
    if (tab === 'chats') { renderChatList(); if (state.activeChat) refreshChat(true); }
    if (tab === 'nearby') loadNearby();
  }

  // ======================= Map =======================
  function initMap() {
    if (!hasMap) {
      $('map').innerHTML = '<div class="no-map"><div><div style="font-size:2.5rem">🗺️</div>The map could not load (no internet?).<br>The list of nearby people still works.</div></div>';
      return;
    }
    const start = state.me.lat != null ? [state.me.lat, state.me.lng] : [20.5937, 78.9629];
    state.map = L.map('map', { zoomControl: true }).setView(start, state.me.lat != null ? 13 : 5);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    }).addTo(state.map);
    state.markerLayer = L.layerGroup().addTo(state.map);

    state.map.on('click', (e) => {
      if (!state.pickMode) return;
      setPickMode(false);
      saveLocation(e.latlng.lat, e.latlng.lng);
    });
  }

  function pinIcon(user) {
    return L.divIcon({
      className: '',
      html: `<div class="pin-marker" style="background:${esc(user.avatarColor)}"><span>${esc(initials(user.name))}</span></div>`,
      iconSize: [38, 38],
      iconAnchor: [19, 38],
      popupAnchor: [0, -36],
    });
  }

  function renderMap(fit = false) {
    if (!state.map) return;
    state.markerLayer.clearLayers();
    state.markers.clear();

    const me = state.me;
    if (me.lat != null) {
      state.meMarker = L.marker([me.lat, me.lng], {
        icon: L.divIcon({ className: '', html: '<div class="me-marker"></div>', iconSize: [20, 20], iconAnchor: [10, 10] }),
        zIndexOffset: 1000,
      }).bindTooltip('You are here', { direction: 'top', offset: [0, -10] }).addTo(state.markerLayer);

      state.radiusCircle = L.circle([me.lat, me.lng], {
        radius: Number($('radius').value) * 1000,
        color: '#ff4b5c', weight: 1.5, fillColor: '#ff4b5c', fillOpacity: 0.06, dashArray: '6 6',
      }).addTo(state.markerLayer);
    }

    for (const p of state.people) {
      const m = L.marker([p.lat, p.lng], { icon: pinIcon(p) }).addTo(state.markerLayer);
      m.bindPopup(popupHTML(p));
      m.on('click', () => highlightPerson(p.id));
      state.markers.set(p.id, m);
    }

    if (fit && me.lat != null && state.radiusCircle) {
      state.map.fitBounds(state.radiusCircle.getBounds(), { padding: [30, 30] });
    }
  }

  function popupHTML(p) {
    return `<div class="pop">
      <h4>${esc(p.name)}</h4>
      <p>@${esc(p.username)} · ${formatDist(p.distanceKm)}${p.approx ? ' · approx.' : ''}</p>
      ${p.bio ? `<p>${esc(p.bio)}</p>` : ''}
      ${actionButtons(p)}
    </div>`;
  }

  function setPickMode(on) {
    state.pickMode = on;
    $('map-hint').classList.toggle('hidden', !on);
    $('btn-pick').classList.toggle('btn-primary', on);
    $('btn-pick').classList.toggle('btn-ghost', !on);
    if (state.map) state.map.getContainer().style.cursor = on ? 'crosshair' : '';
    if (on) { switchTab('nearby'); if (!state.map) toast('Map not available. Use GPS instead.', true); }
  }

  // ======================= Location =======================
  function updateLocationUI() {
    $('no-location').classList.toggle('hidden', state.me.lat != null);
  }

  async function saveLocation(lat, lng) {
    try {
      state.me = await api('PUT', '/api/me/location', { lat, lng });
      updateLocationUI();
      toast('Location updated');
      await loadNearby(true);
    } catch (e) { toast(e.message, true); }
  }

  function useGPS() {
    if (!navigator.geolocation) return toast('Your browser does not support GPS', true);
    toast('Getting your location...');
    navigator.geolocation.getCurrentPosition(
      (pos) => saveLocation(pos.coords.latitude, pos.coords.longitude),
      (err) => {
        const msg = err.code === 1
          ? 'Location permission denied. Use "Pick on map" instead.'
          : 'Could not get your location. Try "Pick on map".';
        toast(msg, true);
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  }

  // ======================= Nearby =======================
  async function loadNearby(fit = false) {
    if (state.me.lat == null) { state.people = []; renderPeople(); renderMap(); return; }
    const params = new URLSearchParams({
      radius: $('radius').value,
      interest: $('interest').value.trim(),
      q: $('search').value.trim(),
    });
    try {
      const data = await api('GET', '/api/nearby?' + params);
      state.people = data.people;
      renderPeople();
      renderMap(fit);
    } catch (e) {
      if (e.code !== 'NO_LOCATION') toast(e.message, true);
    }
  }

  function actionButtons(p) {
    switch (p.relation) {
      case 'friends':
        return `<div class="person-actions"><button class="btn btn-primary btn-sm" data-action="chat" data-id="${p.id}">💬 Message</button></div>`;
      case 'pending_out':
        return `<div class="person-actions"><button class="btn btn-ghost btn-sm" disabled>Request sent</button><button class="btn btn-ghost btn-sm" data-action="cancel" data-conn="${p.connectionId}">Cancel</button></div>`;
      case 'pending_in':
        return `<div class="person-actions"><button class="btn btn-success btn-sm" data-action="accept" data-conn="${p.connectionId}">Accept</button><button class="btn btn-ghost btn-sm" data-action="decline" data-conn="${p.connectionId}">Decline</button></div>`;
      default:
        return `<div class="person-actions"><button class="btn btn-primary btn-sm" data-action="connect" data-id="${p.id}">+ Connect</button></div>`;
    }
  }

  function renderPeople() {
    const box = $('people');
    if (state.me.lat == null) {
      box.innerHTML = '<div class="empty"><div class="big">🧭</div>Set your location to discover people near you.</div>';
      return;
    }
    if (!state.people.length) {
      box.innerHTML = `<div class="empty"><div class="big">🔍</div>No one found within ${esc($('radius').value)} km.<br>Try a bigger radius, or tap <b>Add demo people</b>.</div>`;
      return;
    }
    const mine = new Set(state.me.interests || []);
    const filter = $('interest').value.trim().toLowerCase();
    box.innerHTML = state.people.map((p) => `
      <div class="person" data-person="${p.id}">
        ${avatarHTML(p)}
        <div class="person-body">
          <div class="person-top">
            <span class="person-name">${esc(p.name)}</span>
            <span class="person-dist">${formatDist(p.distanceKm)}</span>
          </div>
          ${p.bio ? `<div class="person-bio">${esc(p.bio)}</div>` : ''}
          <div class="chips">
            ${(p.interests || []).map((i) => `<span class="chip ${mine.has(i) || (filter && i.includes(filter)) ? 'hit' : ''}">${esc(i)}</span>`).join('')}
            ${p.approx ? '<span class="tag-approx">≈ approximate area</span>' : ''}
          </div>
          ${actionButtons(p)}
        </div>
      </div>`).join('');
  }

  function highlightPerson(id) {
    document.querySelectorAll('.person').forEach((el) => el.classList.toggle('focus', el.dataset.person === id));
    const el = document.querySelector(`.person[data-person="${id}"]`);
    if (el) el.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }

  function focusPerson(id) {
    const m = state.markers.get(id);
    if (m && state.map) {
      state.map.setView(m.getLatLng(), Math.max(state.map.getZoom(), 14), { animate: true });
      m.openPopup();
    }
    highlightPerson(id);
  }

  // ======================= Connections =======================
  async function loadConns() {
    try {
      state.conns = await api('GET', '/api/connections');
      const n = state.conns.incoming.length;
      $('badge-requests').textContent = n;
      $('badge-requests').classList.toggle('hidden', n === 0);
      if (state.tab === 'requests') renderRequests();
      if (state.tab === 'chats') renderChatList();
    } catch { /* ignore polling errors */ }
  }

  async function doAction(action, el) {
    const id = el.dataset.id;
    const conn = el.dataset.conn;
    el.disabled = true;
    try {
      if (action === 'connect') {
        const r = await api('POST', '/api/connections/request', { userId: id });
        toast(r.status === 'accepted' ? 'You are now connected 🎉' : 'Request sent');
      } else if (action === 'accept') {
        await api('POST', `/api/connections/${conn}/accept`); toast('Connected 🎉');
      } else if (action === 'decline') {
        await api('POST', `/api/connections/${conn}/decline`); toast('Request declined');
      } else if (action === 'cancel') {
        await api('DELETE', `/api/connections/${conn}`); toast('Removed');
      } else if (action === 'chat') {
        await openChat(id, true); return;
      }
      await Promise.all([loadConns(), loadNearby()]);
      if (state.map) state.map.closePopup();
    } catch (e) {
      toast(e.message, true);
      el.disabled = false;
    }
  }

  function renderRequests() {
    const inc = state.conns.incoming;
    const out = state.conns.outgoing;
    $('incoming').innerHTML = inc.length
      ? inc.map((c) => `
        <div class="row-item">${avatarHTML(c.user)}
          <div class="grow"><div style="font-weight:700">${esc(c.user.name)}</div><div class="small">@${esc(c.user.username)} · ${timeAgo(c.createdAt)}</div></div>
          <button class="btn btn-success btn-sm" data-action="accept" data-conn="${c.connectionId}">Accept</button>
          <button class="btn btn-ghost btn-sm" data-action="decline" data-conn="${c.connectionId}">Decline</button>
        </div>`).join('')
      : '<div class="empty" style="padding:20px">No pending requests</div>';

    $('outgoing').innerHTML = out.length
      ? out.map((c) => `
        <div class="row-item">${avatarHTML(c.user)}
          <div class="grow"><div style="font-weight:700">${esc(c.user.name)}</div><div class="small">@${esc(c.user.username)} · sent ${timeAgo(c.createdAt)}</div></div>
          <button class="btn btn-ghost btn-sm" data-action="cancel" data-conn="${c.connectionId}">Cancel</button>
        </div>`).join('')
      : '<div class="empty" style="padding:20px">You have not sent any requests</div>';
  }

  // ======================= Chats =======================
  async function loadSummary() {
    try {
      state.summary = await api('GET', '/api/messages/summary');
      const total = state.summary.reduce((n, s) => n + (s.unread || 0), 0);
      $('badge-chats').textContent = total;
      $('badge-chats').classList.toggle('hidden', total === 0);
      if (state.tab === 'chats') renderChatList();
    } catch { /* ignore */ }
  }

  function renderChatList() {
    const friends = state.conns.friends;
    if (!friends.length) {
      $('chat-list').innerHTML = '<div class="empty"><div class="big">🤝</div>Connect with people nearby to start chatting.</div>';
      return;
    }
    const byUser = new Map(state.summary.map((s) => [s.userId, s]));
    const sorted = [...friends].sort((a, b) => {
      const ta = byUser.get(a.user.id)?.last?.createdAt || '';
      const tb = byUser.get(b.user.id)?.last?.createdAt || '';
      return tb.localeCompare(ta);
    });
    $('chat-list').innerHTML = sorted.map((f) => {
      const s = byUser.get(f.user.id);
      const unread = s && s.unread && !(state.activeChat && state.activeChat.id === f.user.id) ? `<span class="badge">${s.unread}</span>` : '';
      return `<div class="chat-item ${state.activeChat && state.activeChat.id === f.user.id ? 'active' : ''}" data-chat="${f.user.id}">
        ${avatarHTML(f.user)}
        <div class="grow"><div style="font-weight:700">${esc(f.user.name)}</div>
        <div class="last">${s ? (s.last.from === state.me.id ? 'You: ' : '') + esc(s.last.text) : 'Say hi 👋'}</div></div>
        ${unread}
      </div>`;
    }).join('');
  }

  async function openChat(userId, fromNearby = false) {
    const friend = state.conns.friends.find((f) => f.user.id === userId);
    if (!friend) { await loadConns(); }
    const f = state.conns.friends.find((x) => x.user.id === userId);
    if (!f) return toast('You can only chat with connections', true);

    state.activeChat = f.user;
    state.lastRenderedChat = '';
    if (fromNearby) switchTab('chats');
    $('chat-head').classList.remove('hidden');
    $('chat-form').classList.remove('hidden');
    $('chat-head').innerHTML = `<button class="chat-back" id="chat-back" type="button" aria-label="Back to chats">&larr;</button>${avatarHTML(f.user)}<div class="grow" style="flex:1"><div style="font-weight:700">${esc(f.user.name)}</div><div class="small" style="color:var(--muted);font-size:.85rem">@${esc(f.user.username)}</div></div>
      <button class="btn btn-danger btn-sm" id="btn-unfriend" data-conn="${f.connectionId}">Remove</button>`;
    $('panel-chats').classList.add('chat-open');   // phones: show the conversation instead of the list
    renderChatList();
    await refreshChat(true);
    $('chat-input').focus();
  }

  async function refreshChat(forceScroll = false) {
    if (!state.activeChat) return;
    const withId = state.activeChat.id;
    try {
      const msgs = await api('GET', '/api/messages/' + withId);
      if (!state.activeChat || state.activeChat.id !== withId) return;
      const sig = msgs.length + ':' + (msgs[msgs.length - 1]?.id || '');
      if (sig === state.lastRenderedChat && !forceScroll) return;
      state.lastRenderedChat = sig;

      const box = $('chat-msgs');
      const nearBottom = box.scrollHeight - box.scrollTop - box.clientHeight < 80;
      box.innerHTML = msgs.length
        ? msgs.map((m) => `<div class="bubble ${m.from === state.me.id ? 'me' : 'them'}">${esc(m.text)}<time>${new Date(m.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</time></div>`).join('')
        : `<div class="chat-empty">No messages yet.<br>Say hi to ${esc(state.activeChat.name.split(' ')[0])}! 👋</div>`;
      if (forceScroll || nearBottom) box.scrollTop = box.scrollHeight;
      loadSummary();
    } catch (e) {
      if (/connections/.test(e.message)) { state.activeChat = null; $('panel-chats').classList.remove('chat-open'); loadConns(); }
    }
  }

  async function sendMessage(e) {
    e.preventDefault();
    const input = $('chat-input');
    const text = input.value.trim();
    if (!text || !state.activeChat) return;
    input.value = '';
    try {
      await api('POST', '/api/messages/' + state.activeChat.id, { text });
      await refreshChat(true);
      loadSummary();
      // demo people reply after ~1.2s; refresh shortly after
      setTimeout(() => refreshChat(), 1600);
    } catch (err) { toast(err.message, true); input.value = text; }
  }

  // ======================= Profile =======================
  function fillProfileForm() {
    const m = state.me;
    $('profile-avatar').innerHTML = avatarHTML(m, 'lg');
    $('profile-username').textContent = '@' + m.username;
    $('profile-email').textContent = m.email;
    $('p-name').value = m.name;
    $('p-bio').value = m.bio || '';
    $('p-interests').value = (m.interests || []).join(', ');
    $('p-visible').checked = m.visible;
    $('p-precise').checked = m.precise;
    $('demo-card').classList.toggle('hidden', !m.hasDemo);
    $('header-name').textContent = m.name;
  }

  async function saveProfile(e) {
    e.preventDefault();
    try {
      state.me = await api('PUT', '/api/me', {
        name: $('p-name').value,
        bio: $('p-bio').value,
        interests: $('p-interests').value,
      });
      fillProfileForm();
      toast('Profile saved ✅');
    } catch (err) { toast(err.message, true); }
  }

  async function savePrivacy() {
    try {
      state.me = await api('PUT', '/api/me', { visible: $('p-visible').checked, precise: $('p-precise').checked });
      toast('Privacy updated');
    } catch (err) { toast(err.message, true); fillProfileForm(); }
  }

  // ======================= Demo =======================
  async function addDemo() {
    if (state.me.lat == null) return toast('Set your location first', true);
    try {
      await api('POST', '/api/demo/spawn');
      state.me = await api('GET', '/api/me');
      fillProfileForm();
      toast('Added demo people around you ✨');
      await loadNearby(true);
    } catch (e) { toast(e.message, true); }
  }

  async function removeDemo() {
    if (!confirm('Remove all demo people (and their chats)?')) return;
    try {
      await api('DELETE', '/api/demo');
      state.me = await api('GET', '/api/me');
      fillProfileForm();
      state.activeChat = null;
      await Promise.all([loadConns(), loadSummary(), loadNearby()]);
      toast('Demo people removed');
    } catch (e) { toast(e.message, true); }
  }

  // ======================= Events =======================
  function debounce(fn, ms) { let t; return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); }; }

  function bindEvents() {
    $('tabs').addEventListener('click', (e) => {
      const t = e.target.closest('.tab');
      if (t) switchTab(t.dataset.tab);
    });
    $('logout').addEventListener('click', () => Auth.logout());

    // filters
    $('radius').addEventListener('input', () => {
      $('radius-out').textContent = $('radius').value + ' km';
      if (state.radiusCircle) state.radiusCircle.setRadius(Number($('radius').value) * 1000);
    });
    $('radius').addEventListener('change', () => loadNearby(true));
    $('search').addEventListener('input', debounce(() => loadNearby(), 300));
    $('interest').addEventListener('input', debounce(() => loadNearby(), 300));

    // location buttons
    $('btn-gps').addEventListener('click', useGPS);
    $('banner-gps').addEventListener('click', useGPS);
    $('btn-pick').addEventListener('click', () => setPickMode(!state.pickMode));
    $('btn-demo').addEventListener('click', addDemo);
    $('btn-remove-demo').addEventListener('click', removeDemo);

    // click delegation for every action button (cards, popups, request rows)
    document.body.addEventListener('click', (e) => {
      const btn = e.target.closest('[data-action]');
      if (btn) { e.stopPropagation(); doAction(btn.dataset.action, btn); return; }

      const person = e.target.closest('.person');
      if (person) { focusPerson(person.dataset.person); return; }

      const chat = e.target.closest('.chat-item');
      if (chat) { openChat(chat.dataset.chat); return; }

      // phones: the back arrow returns from a conversation to the chat list
      if (e.target.closest('#chat-back')) { $('panel-chats').classList.remove('chat-open'); return; }

      const unf = e.target.closest('#btn-unfriend');
      if (unf) {
        if (!confirm('Remove this connection and delete the chat?')) return;
        api('DELETE', '/api/connections/' + unf.dataset.conn).then(async () => {
          state.activeChat = null;
          $('panel-chats').classList.remove('chat-open');
          $('chat-head').classList.add('hidden');
          $('chat-form').classList.add('hidden');
          $('chat-msgs').innerHTML = '<div class="chat-empty">Connection removed</div>';
          await Promise.all([loadConns(), loadSummary()]);
          renderChatList();
        }).catch((err) => toast(err.message, true));
      }
    });

    $('chat-form').addEventListener('submit', sendMessage);
    $('profile-form').addEventListener('submit', saveProfile);
    $('p-visible').addEventListener('change', savePrivacy);
    $('p-precise').addEventListener('change', savePrivacy);
  }

  init();
})();

// The Nearby page: shares your location and shows people around you as a list or a map.
import { api } from './api.js';
import { createConnectionControl } from './connectionControl.js';
import { INTERESTS } from './constants.js';
import { initNav } from './nav.js';
import { showPeopleOnMap } from './nearby-map.js';
import { createAvatar, createInterestChips, el, showState, timeAgo } from './ui.js';

const ONE_MINUTE_IN_MS = 60 * 1000;
const TWENTY_FOUR_HOURS_IN_MS = 24 * 60 * 60 * 1000;

const locationStatus = document.querySelector('#location-status');
const shareButton = document.querySelector('#share-button');
const ghostNotice = document.querySelector('#ghost-notice');
const radiusSelect = document.querySelector('#radius');
const interestSelect = document.querySelector('#interest');
const listButton = document.querySelector('#list-button');
const mapButton = document.querySelector('#map-button');
const refreshButton = document.querySelector('#refresh-button');
const actionError = document.querySelector('#action-error');
const resultsState = document.querySelector('#results-state');
const resultsList = document.querySelector('#results-list');
const mapElement = document.querySelector('#map');

let me = null;
let results = [];
let currentView = 'list';
// Used to ignore a slow response if a newer search has started since.
let latestSearch = 0;

function showActionError(message) {
  actionError.textContent = message;
  actionError.hidden = false;
}

function hasFreshLocation() {
  if (!me.location) {
    return false;
  }
  return Date.now() - new Date(me.location.updatedAt).getTime() < TWENTY_FOUR_HOURS_IN_MS;
}

function updateLocationStatus() {
  if (hasFreshLocation()) {
    locationStatus.textContent = `You shared your location ${timeAgo(me.location.updatedAt)}.`;
  } else {
    locationStatus.textContent = 'Share your location to see who is nearby.';
  }
}

// ---------- Showing results ----------

function createPersonCard(result) {
  const { user, distance, sharedInterests, connection } = result;
  const card = el('li', 'card person-card');

  const nameLink = el('a', 'person-name', user.name);
  nameLink.href = `/user.html?id=${encodeURIComponent(user.id)}`;

  const heading = el('div', 'person-heading');
  heading.append(nameLink, el('p', 'person-username', `@${user.username}`));

  const details = el('p', 'person-details');
  details.append(el('strong', '', distance), ` away, active ${timeAgo(user.lastActive)}`);

  const body = el('div', 'person-body');
  body.append(heading, details, createInterestChips(user.interests, sharedInterests));

  const control = createConnectionControl(user.id, connection, {
    onChange: (updated) => {
      result.connection = updated;
    },
    onError: showActionError,
  });

  card.append(createAvatar(user), body, control);
  return card;
}

function renderResults() {
  const isEmpty = results.length === 0;
  resultsList.hidden = currentView !== 'list' || isEmpty;
  mapElement.hidden = currentView !== 'map';

  if (isEmpty) {
    showState(resultsState, 'empty', 'No one nearby yet. Try a bigger radius.');
  } else {
    resultsState.replaceChildren();
  }

  if (currentView === 'list') {
    resultsList.replaceChildren(...results.map(createPersonCard));
  } else {
    showMap();
  }
}

function showMap() {
  try {
    showPeopleOnMap(mapElement, me.location, results, showActionError);
  } catch {
    // Leaflet comes from a CDN, so it's missing when there is no internet connection.
    mapElement.hidden = true;
    showState(resultsState, 'error', "The map couldn't load. Check your connection, or use the list.");
  }
}

function hideResults() {
  resultsList.hidden = true;
  mapElement.hidden = true;
}

async function loadNearby() {
  actionError.hidden = true;

  if (!hasFreshLocation()) {
    hideResults();
    showState(resultsState, 'empty', 'Press "Share my location" to find people near you.');
    return;
  }

  const thisSearch = ++latestSearch;
  hideResults();
  showState(resultsState, 'loading', 'Looking for people nearby…');

  const query = new URLSearchParams({ radius: radiusSelect.value, interest: interestSelect.value });
  try {
    const data = await api(`/nearby?${query}`);
    if (thisSearch === latestSearch) {
      results = data.results;
      renderResults();
    }
  } catch (err) {
    if (thisSearch === latestSearch) {
      showState(resultsState, 'error', err.message);
    }
  }
}

// ---------- Sharing location ----------

function geolocationErrorMessage(error) {
  if (error.code === error.PERMISSION_DENIED) {
    return 'Location access is blocked. Allow it in your browser settings, then try again.';
  }
  if (error.code === error.POSITION_UNAVAILABLE) {
    return "Your device couldn't find your location. Check that location services are on.";
  }
  return 'Finding your location took too long. Try again.';
}

// The browser's location API uses callbacks, so this wraps it in a promise for use with await.
function getBrowserPosition() {
  return new Promise((resolve, reject) => {
    navigator.geolocation.getCurrentPosition(resolve, reject, { timeout: 15000, maximumAge: 60000 });
  });
}

// The server allows one update a minute, so the button rests for that long after a success.
function restShareButton() {
  shareButton.disabled = true;
  shareButton.textContent = 'Location shared';
  setTimeout(() => {
    shareButton.disabled = false;
    shareButton.textContent = 'Share my location';
    updateLocationStatus();
  }, ONE_MINUTE_IN_MS);
}

async function shareLocation() {
  actionError.hidden = true;

  if (!navigator.geolocation) {
    showActionError("This browser can't share a location.");
    return;
  }

  shareButton.disabled = true;
  shareButton.textContent = 'Finding you…';

  let position;
  try {
    position = await getBrowserPosition();
  } catch (error) {
    showActionError(geolocationErrorMessage(error));
    shareButton.disabled = false;
    shareButton.textContent = 'Share my location';
    return;
  }

  try {
    const { latitude: lat, longitude: lng } = position.coords;
    const { user } = await api('/location', { method: 'PUT', body: { lat, lng } });
    me = user;
    updateLocationStatus();
    restShareButton();
    await loadNearby();
  } catch (err) {
    showActionError(err.message);
    shareButton.disabled = false;
    shareButton.textContent = 'Share my location';
  }
}

// ---------- Page setup ----------

function setView(view) {
  currentView = view;
  listButton.setAttribute('aria-pressed', String(view === 'list'));
  mapButton.setAttribute('aria-pressed', String(view === 'map'));
  if (hasFreshLocation()) {
    renderResults();
  }
}

function setUpControls() {
  for (const interest of INTERESTS) {
    const option = el('option', '', interest);
    option.value = interest;
    interestSelect.append(option);
  }

  shareButton.addEventListener('click', shareLocation);
  radiusSelect.addEventListener('change', loadNearby);
  interestSelect.addEventListener('change', loadNearby);
  refreshButton.addEventListener('click', loadNearby);
  listButton.addEventListener('click', () => setView('list'));
  mapButton.addEventListener('click', () => setView('map'));
}

async function start() {
  initNav('nearby');
  setUpControls();
  showState(resultsState, 'loading', 'Loading…');

  try {
    const data = await api('/auth/me');
    me = data.user;
  } catch (err) {
    locationStatus.textContent = '';
    showState(resultsState, 'error', err.message);
    return;
  }

  ghostNotice.hidden = !me.ghostMode;
  updateLocationStatus();
  await loadNearby();
}

start();

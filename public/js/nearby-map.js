// The Leaflet map on the Nearby page. `L` is the global variable created by Leaflet's script tag.
import { createConnectionControl } from './connectionControl.js';
import { createAvatar, createInterestChips, el } from './ui.js';

const DEFAULT_ZOOM = 14;
const PERSON_ICON_SIZE = 56;

let map = null;
let markerLayer = null;

function createMap(mapElement) {
  map = L.map(mapElement);
  L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19,
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
  }).addTo(map);
  markerLayer = L.layerGroup().addTo(map);
}

function createMyMarker(location) {
  const icon = L.divIcon({
    className: 'map-me',
    html: `<svg viewBox="0 0 24 32" aria-hidden="true">
      <path d="M12 0C5.4 0 0 5.3 0 11.9 0 20.8 12 32 12 32s12-11.2 12-20.1C24 5.3 18.6 0 12 0z"/>
      <circle cx="12" cy="12" r="4.5"/>
    </svg>`,
    iconSize: [30, 40],
    iconAnchor: [15, 40], // The tip of the pin marks the position.
  });
  return L.marker([location.lat, location.lng], { icon, title: 'You', zIndexOffset: 1000 });
}

function createPersonMarker(result) {
  // The dashed ring shows that this is an approximate area, not the person's real position.
  const iconContent = el('div', 'map-person');
  iconContent.append(createAvatar(result.user));

  const icon = L.divIcon({
    className: '',
    html: iconContent,
    iconSize: [PERSON_ICON_SIZE, PERSON_ICON_SIZE],
    iconAnchor: [PERSON_ICON_SIZE / 2, PERSON_ICON_SIZE / 2],
    popupAnchor: [0, -PERSON_ICON_SIZE / 2],
  });
  return L.marker([result.pin.lat, result.pin.lng], { icon, title: result.user.name });
}

// Built from DOM elements, because Leaflet would treat a popup string as HTML,
// and a user's name could then inject code into the page.
function createPopupCard(result, onError) {
  const { user, distance, sharedInterests, connection } = result;
  const card = el('div', 'map-popup');

  const nameLink = el('a', 'person-name', user.name);
  nameLink.href = `/user.html?id=${encodeURIComponent(user.id)}`;

  const heading = el('div', 'map-popup-heading');
  const headingText = el('div');
  headingText.append(nameLink, el('p', 'person-username', `${distance} away`));
  heading.append(createAvatar(user), headingText);

  const control = createConnectionControl(user.id, connection, {
    onChange: (updated) => {
      result.connection = updated;
    },
    onError,
  });

  card.append(heading, createInterestChips(user.interests, sharedInterests), control);
  return card;
}

export function showPeopleOnMap(mapElement, myLocation, results, onError) {
  if (!map) {
    createMap(mapElement);
  }
  // Leaflet can't measure a hidden element, so it needs to measure again once the map is visible.
  map.invalidateSize();

  markerLayer.clearLayers();
  createMyMarker(myLocation).addTo(markerLayer);

  for (const result of results) {
    createPersonMarker(result)
      .bindPopup(() => createPopupCard(result, onError), { minWidth: 220 })
      .addTo(markerLayer);
  }

  if (results.length === 0) {
    map.setView([myLocation.lat, myLocation.lng], DEFAULT_ZOOM);
    return;
  }

  const allPoints = results.map((result) => [result.pin.lat, result.pin.lng]);
  allPoints.push([myLocation.lat, myLocation.lng]);
  map.fitBounds(allPoints, { padding: [50, 50], maxZoom: 15 });
}

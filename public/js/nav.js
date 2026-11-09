// Adds the site header and navigation to logged-in pages. CSS moves the links to a
// bottom tab bar on phones and into the top bar on laptops, so there is only one set of links.
import { api } from './api.js';
import { el } from './ui.js';

// The icons are fixed strings written here, never user input, so innerHTML is safe for them.
const TABS = [
  {
    key: 'nearby',
    label: 'Nearby',
    href: '/nearby.html',
    icon: '<path d="M12 21s7-6.2 7-11.5A7 7 0 0 0 5 9.5C5 14.8 12 21 12 21z"/><circle cx="12" cy="9.5" r="2.5"/>',
  },
  {
    key: 'connections',
    label: 'Connections',
    href: '/connections.html',
    icon: '<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20c.6-3.8 3.1-6 6.5-6s5.9 2.2 6.5 6"/><path d="M15.5 4.8a3.5 3.5 0 0 1 0 6.4M18 14.6c2 .8 3.2 2.7 3.5 5.4"/>',
  },
  {
    key: 'chat',
    label: 'Chat',
    href: '/chat.html',
    icon: '<path d="M4 5h16v11H9l-5 4z"/>',
  },
  {
    key: 'profile',
    label: 'Profile',
    href: '/profile.html',
    icon: '<circle cx="12" cy="8" r="4"/><path d="M4.5 21c.7-4.2 3.6-6.5 7.5-6.5s6.8 2.3 7.5 6.5"/>',
  },
];

const LOGO_ICON = `<svg class="logo-pin" viewBox="0 0 24 32" aria-hidden="true">
  <path d="M12 0C5.4 0 0 5.3 0 11.9 0 20.8 12 32 12 32s12-11.2 12-20.1C24 5.3 18.6 0 12 0z"/>
  <circle cx="12" cy="12" r="4.5"/>
</svg>`;

let badge = null;

function createTabLink(tab, activeKey) {
  const link = el('a', 'nav-link');
  link.href = tab.href;
  if (tab.key === activeKey) {
    link.setAttribute('aria-current', 'page');
  }
  link.innerHTML = `<svg class="nav-icon" viewBox="0 0 24 24" aria-hidden="true">${tab.icon}</svg>`;
  link.append(el('span', 'nav-label', tab.label));

  if (tab.key === 'connections') {
    badge = el('span', 'nav-badge');
    badge.hidden = true;
    link.append(badge);
  }
  return link;
}

async function logOut() {
  await api('/auth/logout', { method: 'POST' });
  window.location.href = '/';
}

export function initNav(activeKey) {
  const header = el('header', 'site-header');
  const inner = el('div', 'site-header-inner page-width');

  const logo = el('a', 'logo');
  logo.href = '/nearby.html';
  logo.setAttribute('aria-label', 'PinPal, go to Nearby');
  logo.innerHTML = LOGO_ICON;
  logo.append(el('span', '', 'PinPal'));

  const nav = el('nav', 'site-nav');
  nav.setAttribute('aria-label', 'Main');
  for (const tab of TABS) {
    nav.append(createTabLink(tab, activeKey));
  }

  const logoutButton = el('button', 'button button-quiet button-small', 'Log out');
  logoutButton.type = 'button';
  logoutButton.addEventListener('click', () => {
    logOut().catch((err) => window.alert(err.message));
  });

  inner.append(logo, nav, logoutButton);
  header.append(inner);
  document.body.prepend(header);

  refreshBadge();
}

// Pages call this after accepting or declining a request, so the number stays correct.
export async function refreshBadge() {
  try {
    const { received } = await api('/connections/requests');
    const count = received.length;
    badge.textContent = String(count);
    badge.hidden = count === 0;
    badge.setAttribute('aria-label', `${count} pending ${count === 1 ? 'request' : 'requests'}`);
  } catch {
    // The badge is only a convenience, so a failure here shouldn't disturb the page.
  }
}

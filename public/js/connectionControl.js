// The Connect / Requested / Respond / Connected control used on Nearby, the map and profiles.
import { api } from './api.js';
import { createLinkButton, el } from './ui.js';

// onChange receives the new connection state, and onError receives a message to show.
export function createConnectionControl(userId, connection, { onChange, onError }) {
  const wrapper = el('div', 'connection-control');

  function render(current) {
    wrapper.replaceChildren(buildControl(current));
  }

  function buildControl(current) {
    if (current.status === 'connected') {
      return el('span', 'status-pill status-connected', 'Connected');
    }
    if (current.status === 'sent') {
      return el('span', 'status-pill', 'Requested');
    }
    if (current.status === 'received') {
      return createLinkButton('Respond', '/connections.html?tab=received', 'button-primary button-small');
    }

    const button = el('button', 'button button-primary button-small', 'Connect');
    button.type = 'button';
    button.addEventListener('click', async () => {
      button.disabled = true;
      try {
        const result = await api(`/connections/${userId}`, { method: 'POST' });
        const updated = { status: 'sent', id: result.connection.id };
        render(updated);
        onChange(updated);
      } catch (err) {
        button.disabled = false;
        onError(err.message);
      }
    });
    return button;
  }

  render(connection);
  return wrapper;
}

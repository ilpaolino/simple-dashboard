import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  renderRecognizedPage,
  renderUnconfiguredPage,
  renderMismatchPage,
} from '../lib/http/pages/displayPages';
import {
  renderDashboardPage,
  renderInvalidLayoutPage,
} from '../lib/http/pages/dashboardPage';
import { DISPLAY_TYPE_IDS } from '../lib/display/types';
import { LAYOUT_IDS } from '../lib/adapters/types';
import { emptyDashboardConfiguration } from '../lib/widgets';

const translate = (key: string): string => {
  const map: Record<string, string> = {
    'pages.recognized.title': 'Wall Display recognized',
    'pages.recognized.heading': 'Wall Display recognized',
    'pages.recognized.lead': 'Matched',
    'pages.recognized.name': 'Name',
    'pages.recognized.type': 'Type',
    'pages.recognized.ip': 'IP',
    'pages.recognized.hardwareId': 'ID',
    'pages.recognized.layout': 'Layout',
    'pages.recognized.timestamp': 'Timestamp',
    'pages.recognized.status': 'Recognition',
    'pages.status.recognized': 'Recognized',
    'pages.unconfigured.title': 'Display not configured',
    'pages.unconfigured.heading': 'Display not configured',
    'pages.unconfigured.lead': 'Add in Homey',
    'pages.unconfigured.ip': 'Detected IP',
    'pages.unconfigured.userAgent': 'User Agent',
    'pages.unconfigured.timestamp': 'Timestamp',
    'pages.mismatch.title': 'Different device detected',
    'pages.mismatch.heading': 'Different device detected',
    'pages.mismatch.lead': 'Mismatch',
    'pages.mismatch.ip': 'IP',
    'pages.mismatch.expectedId': 'Expected ID',
    'pages.mismatch.actualId': 'Detected ID',
    'pages.mismatch.timestamp': 'Timestamp',
    'pages.invalidLayout.title': 'Invalid display configuration',
    'pages.invalidLayout.heading': 'Invalid display configuration',
    'pages.invalidLayout.lead': 'Bad layout',
  };
  return map[key] ?? key;
};

describe('display pages', () => {
  it('renders a recognized technical page with layout and hardware id', () => {
    const html = renderRecognizedPage({
      lang: 'en',
      translate,
      typeLabel: 'Shelly Wall Display',
      timestamp: '2026-08-13T00:00:00.000Z',
      matchStatus: 'recognized',
      display: {
        displayId: 'shellywalldisplay-1',
        name: 'Kitchen',
        typeId: DISPLAY_TYPE_IDS.SHELLY_WALL_DISPLAY,
        ipAddress: '192.168.1.30',
        hardwareId: 'shellywalldisplay-1',
        layoutId: LAYOUT_IDS.GRID_3X3,
        dashboard: emptyDashboardConfiguration(),
      },
    });

    assert.match(html, /Wall Display recognized/);
    assert.match(html, /Kitchen/);
    assert.match(html, /192\.168\.1\.30/);
    assert.match(html, /shellywalldisplay-1/);
    assert.match(html, /3x3/);
  });

  it('renders dashboard bootstrap without HTML-escaping JSON quotes', () => {
    const html = renderDashboardPage({
      lang: 'en',
      title: 'Dashboard',
      bootstrap: {
        displayId: 'disp-1',
        displayName: 'Kitchen',
        typeLabel: 'Shelly Wall Display',
        layoutId: '3x3',
        layout: { rows: 3, columns: 3 },
        widgets: [],
        theme: 'dark',
        locale: 'en',
        emptyState: {
          heading: 'No widgets configured',
          lead: 'Configure from app settings',
          nameLabel: 'Name',
          typeLabel: 'Type',
          idLabel: 'ID',
          layoutLabel: 'Layout',
          gridLabel: 'Grid size',
        },
        widgetRuntime: {},
        copy: {
          light: {
            on: 'On',
            off: 'Off',
            unavailable: 'Device unavailable',
            commandInProgress: 'Command in progress',
            commandFailed: 'Command failed',
            commandTimeout: 'Command timeout',
          },
          cover: {
            name: 'Cover',
            unavailable: 'Device unavailable',
            invalidPosition: 'Invalid position',
            open: 'Open',
            close: 'Close',
            stop: 'Stop',
            currentPosition: 'Current position',
            targetPosition: 'Target position',
            moveToPosition: 'Move to position',
            commandInProgress: 'Command in progress',
            commandFailed: 'Command failed',
            commandTimeout: 'Command timeout',
            openControl: 'Open cover controls',
            closeControl: 'Close control panel',
          },
          widgetFailed: 'Widget failed',
          realtime: {
            connectionLost: 'Connection to Homey lost',
            reconnecting: 'Reconnecting…',
            connectionRestored: 'Connection restored',
            realtimeUnavailable: 'Realtime unavailable',
            protocolError: 'Protocol error',
            displaySessionInvalid: 'Display session invalid',
            snapshotFailed: 'Snapshot failed',
            homeyConnectionError: 'Homey connection error',
          },
        },
      },
    });

    assert.match(html, /dashboard-bootstrap/);
    assert.match(html, /"displayId":"disp-1"/);
    assert.match(html, /"displayName":"Kitchen"/);
    assert.match(html, /"rows":3/);
    assert.match(html, /"columns":3/);
    assert.match(html, /data-theme="dark"/);
    assert.match(html, /"theme":"dark"/);
    assert.match(html, /dashboard\.css/);
    assert.match(html, /dashboard\.js/);
  });

  it('renders an invalid layout page', () => {
    const html = renderInvalidLayoutPage({ lang: 'it', translate });
    assert.match(html, /Invalid display configuration/);
  });

  it('renders an unconfigured page and escapes user agent HTML', () => {
    const html = renderUnconfiguredPage({
      lang: 'en',
      translate,
      clientIp: '192.168.1.50',
      userAgent: '<script>x</script>',
      timestamp: '2026-08-13T00:00:00.000Z',
    });

    assert.match(html, /Display not configured/);
    assert.match(html, /192\.168\.1\.50/);
    assert.match(html, /&lt;script&gt;x&lt;\/script&gt;/);
  });

  it('renders a hardware mismatch page', () => {
    const html = renderMismatchPage({
      lang: 'it',
      translate,
      clientIp: '192.168.1.30',
      expectedId: 'ABC123',
      actualId: 'XYZ999',
      timestamp: '2026-08-13T00:00:00.000Z',
    });

    assert.match(html, /Different device detected/);
    assert.match(html, /ABC123/);
    assert.match(html, /XYZ999/);
  });
});

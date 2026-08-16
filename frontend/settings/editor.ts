/**
 * Dashboard Editor for Homey App Settings (Custom View).
 * Uses Homey Style Library classes from the host settings shell.
 * @see https://apps.developer.homey.app/advanced/custom-views/app-settings
 */

import {
  buildOccupancyMap,
  occupiedCellIds,
  validatePlacementAgainstWidgets,
} from '../../lib/widgets/placement';
import { createWidgetId } from '../../lib/widgets/validation';
import { isCoverWidgetConfig, buildCoverWidgetConfig } from '../../lib/widgets/cover/definition';
import { COVER_TITLE_MAX_LENGTH } from '../../lib/widgets/cover/types';
import { isDateTimeWidgetConfig } from '../../lib/widgets/date-time/definition';
import { isLightWidgetConfig, buildLightWidgetConfig } from '../../lib/widgets/light/definition';
import { LIGHT_TITLE_MAX_LENGTH } from '../../lib/widgets/light/types';
import { isTitleWidgetConfig } from '../../lib/widgets/title/definition';
import {
  resolveDashboardTheme,
  resolveWidgetChrome,
  type DashboardConfiguration,
  type DashboardTheme,
  type WidgetChrome,
  type WidgetInstance,
  type WidgetPlacement,
  type WidgetSpan,
  type WidgetTypeId,
} from '../../lib/widgets/types';
import { isWidgetTypeId } from '../../lib/widgets/registry';

interface HomeySettingsApi {
  ready(): void;
  __(key: string): string;
  alert(message: string): void;
  confirm?(
    message: string,
    iconOrCallback?: string | ((err: Error | null, result?: boolean) => void),
  ): Promise<boolean> | void;
  get(key: string, callback: (err: Error | null, value: unknown) => void): void;
  set(
    key: string,
    value: unknown,
    callback: (err: Error | null) => void,
  ): void;
  api(
    method: string,
    path: string,
    body: unknown,
    callback: (err: Error | null, result: unknown) => void,
  ): void;
}

interface EditorDisplaySummary {
  readonly displayId: string;
  readonly name: string;
  readonly typeId: string;
  readonly layoutId: string;
  readonly rows: number;
  readonly columns: number;
  readonly widgetCount: number;
}

interface WidgetTypeMeta {
  readonly type: string;
  readonly name: string;
  readonly allowedSpans: readonly WidgetSpan[];
  readonly defaultConfig: unknown;
}

interface CompatibleDeviceOption {
  readonly id: string;
  readonly name: string;
  readonly zoneName: string | null;
}

interface EditorDashboardPayload {
  readonly displayId: string;
  readonly name: string;
  readonly layoutId: string;
  readonly grid: { readonly rows: number; readonly columns: number };
  readonly dashboard: DashboardConfiguration;
  readonly widgetTypes: readonly WidgetTypeMeta[];
  readonly compatibleDevices: {
    readonly light: readonly CompatibleDeviceOption[];
    readonly cover: readonly CompatibleDeviceOption[];
  };
  readonly deviceLoadError: string | null;
}

interface EditorState {
  displays: EditorDisplaySummary[];
  selectedDisplayId: string | null;
  payload: EditorDashboardPayload | null;
  widgets: WidgetInstance[];
  theme: DashboardTheme;
  draft: DraftWidget | null;
  selectedWidgetId: string | null;
  errorKey: string | null;
}

interface DraftWidget {
  readonly id: string;
  type: WidgetTypeId;
  row: number;
  column: number;
  rowSpan: number;
  columnSpan: number;
  titleText: string;
  titleAlignment: 'left' | 'center' | 'right';
  dateTimeMode: 'time' | 'date' | 'date-time';
  chrome: WidgetChrome;
  deviceId: string;
  coverTitle: string;
  lightTitle: string;
  isNew: boolean;
}

const state: EditorState = {
  displays: [],
  selectedDisplayId: null,
  payload: null,
  widgets: [],
  theme: 'dark',
  draft: null,
  selectedWidgetId: null,
  errorKey: null,
};

let homeyApi: HomeySettingsApi | null = null;

export function start(Homey: HomeySettingsApi): void {
  homeyApi = Homey;
  Homey.ready();
  bindServerSettings(Homey);
  bindEditor(Homey);
  void refreshDisplays(Homey);
}

function t(key: string): string {
  return homeyApi ? homeyApi.__(key) : key;
}

function bindServerSettings(Homey: HomeySettingsApi): void {
  const portElement = document.getElementById('httpPort') as HTMLInputElement | null;
  const diagnosticsElement = document.getElementById(
    'diagnosticsEnabled',
  ) as HTMLInputElement | null;
  const saveElement = document.getElementById('saveServer');

  if (!portElement || !diagnosticsElement || !saveElement) {
    return;
  }

  Homey.get('httpPort', (err, httpPort) => {
    if (err) {
      Homey.alert(String(err));
      return;
    }
    if (httpPort === undefined || httpPort === null || httpPort === '') {
      portElement.value = '7999';
      return;
    }
    portElement.value = String(httpPort);
  });

  Homey.get('diagnosticsEnabled', (err, diagnosticsEnabled) => {
    if (err) {
      Homey.alert(String(err));
      return;
    }
    if (
      diagnosticsEnabled === undefined ||
      diagnosticsEnabled === null ||
      diagnosticsEnabled === ''
    ) {
      diagnosticsElement.checked = true;
      return;
    }
    diagnosticsElement.checked = diagnosticsEnabled === true;
  });

  saveElement.addEventListener('click', () => {
    const parsed = Number(portElement.value);
    if (!Number.isInteger(parsed) || parsed < 1 || parsed > 65535) {
      Homey.alert(Homey.__('settings.invalidPort'));
      return;
    }

    Homey.set('httpPort', parsed, (err) => {
      if (err) {
        Homey.alert(String(err));
        return;
      }
      Homey.set('diagnosticsEnabled', diagnosticsElement.checked, (diagErr) => {
        if (diagErr) {
          Homey.alert(String(diagErr));
          return;
        }
        Homey.alert(Homey.__('settings.saved'));
      });
    });
  });
}

function bindEditor(Homey: HomeySettingsApi): void {
  const settingsForm = document.getElementById('settingsForm');
  settingsForm?.addEventListener('submit', (event) => {
    event.preventDefault();
  });

  const displaySelect = document.getElementById(
    'displaySelect',
  ) as HTMLSelectElement | null;
  const addButton = document.getElementById('addWidget');
  const saveButton = document.getElementById('saveDashboard');
  const closeDashboardButton = document.getElementById('closeDashboard');
  const cancelButton = document.getElementById('cancelDraft');
  const removeButton = document.getElementById('removeWidget');
  const applyDraftButton = document.getElementById('applyDraft');
  const dashboardDismiss = document.querySelector('[data-dashboard-dismiss]');

  displaySelect?.addEventListener('change', () => {
    const id = displaySelect.value || null;
    state.selectedDisplayId = id;
    if (id) {
      void loadDashboard(Homey, id);
    } else {
      closeDashboard();
      renderAll();
    }
  });

  addButton?.addEventListener('click', () => {
    if (!state.payload) {
      return;
    }
    const firstType = state.payload.widgetTypes[0];
    if (!firstType || !isWidgetTypeId(firstType.type)) {
      return;
    }
    const span = firstType.allowedSpans[0] ?? { rowSpan: 1, columnSpan: 1 };
    state.draft = {
      id: createWidgetId(),
      type: firstType.type,
      row: 0,
      column: 0,
      rowSpan: span.rowSpan,
      columnSpan: span.columnSpan,
      titleText: 'Title',
      titleAlignment: 'left',
      dateTimeMode: 'date-time',
      chrome: 'plain',
      deviceId: '',
      coverTitle: '',
      lightTitle: '',
      isNew: true,
    };
    state.selectedWidgetId = state.draft.id;
    syncDraftForm();
    validateDraft();
    renderAll();
  });

  removeButton?.addEventListener('click', () => {
    void removeSelectedWidget(Homey);
  });

  cancelButton?.addEventListener('click', () => {
    closeDraft();
    renderAll();
  });

  applyDraftButton?.addEventListener('click', () => {
    readDraftForm();
    if (!applyDraftToWidgets()) {
      renderAll();
      return;
    }
    closeDraft();
    renderAll();
  });

  closeDashboardButton?.addEventListener('click', () => {
    closeDashboard();
    renderAll();
  });

  dashboardDismiss?.addEventListener('click', () => {
    if (state.draft) {
      closeDraft();
      renderAll();
      return;
    }
    closeDashboard();
    renderAll();
  });

  document.addEventListener('keydown', (event) => {
    if (event.key !== 'Escape') {
      return;
    }
    if (state.draft) {
      closeDraft();
      renderAll();
      return;
    }
    if (state.payload) {
      closeDashboard();
      renderAll();
    }
  });

  saveButton?.addEventListener('click', () => {
    void saveDashboard(Homey);
  });

  const themeSelect = document.getElementById(
    'dashboardTheme',
  ) as HTMLSelectElement | null;
  themeSelect?.addEventListener('change', () => {
    if (themeSelect.value === 'dark' || themeSelect.value === 'light') {
      state.theme = themeSelect.value;
    }
  });

  for (const id of [
    'widgetType',
    'widgetRow',
    'widgetColumn',
    'widgetSpan',
    'titleText',
    'titleAlignment',
    'dateTimeMode',
    'widgetChrome',
    'lightDevice',
    'coverDevice',
    'coverTitle',
    'lightTitle',
  ]) {
    document.getElementById(id)?.addEventListener('change', () => {
      readDraftForm();
      validateDraft();
      renderAll();
    });
    document.getElementById(id)?.addEventListener('input', () => {
      readDraftForm();
      validateDraft();
      renderPreviewOnly();
    });
  }
}

async function refreshDisplays(Homey: HomeySettingsApi): Promise<void> {
  try {
    const displays = await apiCall<EditorDisplaySummary[]>(
      Homey,
      'GET',
      '/displays',
      null,
    );
    state.displays = displays;
    const select = document.getElementById(
      'displaySelect',
    ) as HTMLSelectElement | null;
    if (select) {
      select.replaceChildren();
      const placeholder = document.createElement('option');
      placeholder.value = '';
      placeholder.textContent = t('editor.selectDisplay');
      select.appendChild(placeholder);
      for (const display of displays) {
        const option = document.createElement('option');
        option.value = display.displayId;
        option.textContent = `${display.name} (${display.layoutId})`;
        select.appendChild(option);
      }
    }
    renderAll();
  } catch (error) {
    Homey.alert(errorMessage(error));
  }
}

async function loadDashboard(
  Homey: HomeySettingsApi,
  displayId: string,
): Promise<void> {
  try {
    const payload = await apiCall<EditorDashboardPayload>(
      Homey,
      'GET',
      `/displays/${encodeURIComponent(displayId)}/dashboard`,
      null,
    );
    state.payload = payload;
    state.widgets = [...payload.dashboard.widgets];
    state.theme = resolveDashboardTheme(payload.dashboard.theme);
    state.draft = null;
    state.selectedWidgetId = null;
    state.errorKey = null;
    populateTypeOptions();
    renderAll();
  } catch (error) {
    Homey.alert(errorMessage(error));
  }
}

async function saveDashboard(Homey: HomeySettingsApi): Promise<void> {
  if (!state.selectedDisplayId) {
    Homey.alert(t('editor.errors.displayNotFound'));
    return;
  }

  if (state.draft) {
    readDraftForm();
    if (!applyDraftToWidgets()) {
      Homey.alert(t(state.errorKey ?? 'editor.errors.invalidPosition'));
      renderAll();
      return;
    }
  }

  const configuration: DashboardConfiguration = {
    version: 1,
    theme: state.theme,
    widgets: state.widgets,
  };

  try {
    await apiCall(
      Homey,
      'PUT',
      `/displays/${encodeURIComponent(state.selectedDisplayId)}/dashboard`,
      configuration,
    );
    Homey.alert(t('editor.saved'));
    await loadDashboard(Homey, state.selectedDisplayId);
  } catch (error) {
    Homey.alert(errorMessage(error));
  }
}

function applyDraftToWidgets(): boolean {
  if (!state.draft || !state.payload) {
    return false;
  }

  const widget = draftToWidget(state.draft);
  if (!widget) {
    state.errorKey = missingDeviceErrorKey(state.draft);
    return false;
  }

  const meta = state.payload.widgetTypes.find(
    (item) => item.type === widget.type,
  );
  const result = validatePlacementAgainstWidgets({
    grid: state.payload.grid,
    placement: widget.placement,
    widgets: state.widgets,
    ignoreWidgetId: widget.id,
    allowedSpans: meta?.allowedSpans,
  });

  if (!result.ok) {
    state.errorKey = mapValidationError(result.error);
    return false;
  }

  const without = state.widgets.filter((item) => item.id !== widget.id);
  state.widgets = [...without, widget];
  state.errorKey = null;
  return true;
}

function draftToWidget(draft: DraftWidget): WidgetInstance | null {
  const placement: WidgetPlacement = {
    row: draft.row,
    column: draft.column,
    rowSpan: draft.rowSpan,
    columnSpan: draft.columnSpan,
  };

  if (draft.type === 'title') {
    const config = {
      text: draft.titleText,
      alignment: draft.titleAlignment,
      chrome: draft.chrome,
    };
    if (!isTitleWidgetConfig(config)) {
      return null;
    }
    return {
      id: draft.id,
      type: 'title',
      placement,
      config,
    };
  }

  if (draft.type === 'date-time') {
    const config = { mode: draft.dateTimeMode, chrome: draft.chrome };
    if (!isDateTimeWidgetConfig(config)) {
      return null;
    }
    return {
      id: draft.id,
      type: 'date-time',
      placement,
      config,
    };
  }

  if (draft.type === 'cover') {
    const config = buildCoverWidgetConfig({
      deviceId: draft.deviceId,
      title: draft.coverTitle,
    });
    if (!config || !isCoverWidgetConfig(config)) {
      return null;
    }
    return {
      id: draft.id,
      type: 'cover',
      placement,
      config,
    };
  }

  const config = buildLightWidgetConfig({
    deviceId: draft.deviceId,
    title: draft.lightTitle,
  });
  if (!config || !isLightWidgetConfig(config)) {
    return null;
  }
  return {
    id: draft.id,
    type: 'light',
    placement,
    config,
  };
}

function missingDeviceErrorKey(draft: DraftWidget): string {
  if (draft.type === 'light' && draft.deviceId.trim() === '') {
    return 'widgets.light.selectDevice';
  }
  if (draft.type === 'cover' && draft.deviceId.trim() === '') {
    return 'widgets.cover.selectDevice';
  }
  return 'editor.errors.invalidConfig';
}

function validateDraft(): void {
  if (!state.draft || !state.payload) {
    state.errorKey = null;
    return;
  }

  const widget = draftToWidget(state.draft);
  if (!widget) {
    state.errorKey = missingDeviceErrorKey(state.draft);
    return;
  }

  if (widget.type === 'light') {
    const devices = state.payload.compatibleDevices?.light ?? [];
    const known = devices.some((device) => device.id === widget.config.deviceId);
    if (!known && state.draft.isNew) {
      state.errorKey =
        devices.length === 0
          ? 'widgets.light.noCompatibleDevices'
          : 'widgets.light.deviceNotCompatible';
      return;
    }
  }

  if (widget.type === 'cover') {
    const devices = state.payload.compatibleDevices?.cover ?? [];
    const known = devices.some((device) => device.id === widget.config.deviceId);
    if (!known && state.draft.isNew) {
      state.errorKey =
        devices.length === 0
          ? 'widgets.cover.noCompatibleDevices'
          : 'widgets.cover.deviceNotCompatible';
      return;
    }
  }

  const meta = state.payload.widgetTypes.find(
    (item) => item.type === widget.type,
  );
  const result = validatePlacementAgainstWidgets({
    grid: state.payload.grid,
    placement: widget.placement,
    widgets: state.widgets,
    ignoreWidgetId: widget.id,
    allowedSpans: meta?.allowedSpans,
  });

  state.errorKey = result.ok ? null : mapValidationError(result.error);
}

function mapValidationError(error: string): string {
  switch (error) {
    case 'out_of_bounds':
      return 'editor.errors.outOfBounds';
    case 'overlap':
      return 'editor.errors.overlap';
    case 'unsupported_span':
      return 'editor.errors.unsupportedSpan';
    case 'invalid_placement':
      return 'editor.errors.invalidPosition';
    default:
      return 'editor.errors.invalidConfig';
  }
}

function populateTypeOptions(): void {
  const typeSelect = document.getElementById(
    'widgetType',
  ) as HTMLSelectElement | null;
  if (!typeSelect || !state.payload) {
    return;
  }
  typeSelect.replaceChildren();
  for (const meta of state.payload.widgetTypes) {
    const option = document.createElement('option');
    option.value = meta.type;
    option.textContent = meta.name;
    typeSelect.appendChild(option);
  }
}

function syncDraftForm(): void {
  if (!state.draft || !state.payload) {
    return;
  }

  const typeSelect = document.getElementById(
    'widgetType',
  ) as HTMLSelectElement | null;
  const rowSelect = document.getElementById(
    'widgetRow',
  ) as HTMLSelectElement | null;
  const columnSelect = document.getElementById(
    'widgetColumn',
  ) as HTMLSelectElement | null;
  const spanSelect = document.getElementById(
    'widgetSpan',
  ) as HTMLSelectElement | null;

  fillCoordinateOptions(rowSelect, state.payload.grid.rows);
  fillCoordinateOptions(columnSelect, state.payload.grid.columns);
  fillSpanOptions(spanSelect, state.draft.type);

  if (typeSelect) typeSelect.value = state.draft.type;
  if (rowSelect) rowSelect.value = String(state.draft.row);
  if (columnSelect) columnSelect.value = String(state.draft.column);
  if (spanSelect) {
    spanSelect.value = `${state.draft.columnSpan}x${state.draft.rowSpan}`;
  }

  const titleText = document.getElementById(
    'titleText',
  ) as HTMLInputElement | null;
  const titleAlignment = document.getElementById(
    'titleAlignment',
  ) as HTMLSelectElement | null;
  const dateTimeMode = document.getElementById(
    'dateTimeMode',
  ) as HTMLSelectElement | null;
  const widgetChrome = document.getElementById(
    'widgetChrome',
  ) as HTMLInputElement | null;

  if (titleText) titleText.value = state.draft.titleText;
  if (titleAlignment) titleAlignment.value = state.draft.titleAlignment;
  if (dateTimeMode) dateTimeMode.value = state.draft.dateTimeMode;
  if (widgetChrome) widgetChrome.checked = state.draft.chrome === 'card';

  const coverTitle = document.getElementById(
    'coverTitle',
  ) as HTMLInputElement | null;
  if (coverTitle) {
    coverTitle.value = state.draft.coverTitle;
    coverTitle.maxLength = COVER_TITLE_MAX_LENGTH;
    coverTitle.placeholder = t('widgets.cover.customTitlePlaceholder');
  }

  const lightTitle = document.getElementById(
    'lightTitle',
  ) as HTMLInputElement | null;
  if (lightTitle) {
    lightTitle.value = state.draft.lightTitle;
    lightTitle.maxLength = LIGHT_TITLE_MAX_LENGTH;
    lightTitle.placeholder = t('widgets.light.customTitlePlaceholder');
  }

  fillLightDeviceOptions();
  fillCoverDeviceOptions();
}

function readDraftForm(): void {
  if (!state.draft) {
    return;
  }

  const typeSelect = document.getElementById(
    'widgetType',
  ) as HTMLSelectElement | null;
  const rowSelect = document.getElementById(
    'widgetRow',
  ) as HTMLSelectElement | null;
  const columnSelect = document.getElementById(
    'widgetColumn',
  ) as HTMLSelectElement | null;
  const spanSelect = document.getElementById(
    'widgetSpan',
  ) as HTMLSelectElement | null;
  const titleText = document.getElementById(
    'titleText',
  ) as HTMLInputElement | null;
  const titleAlignment = document.getElementById(
    'titleAlignment',
  ) as HTMLSelectElement | null;
  const dateTimeMode = document.getElementById(
    'dateTimeMode',
  ) as HTMLSelectElement | null;
  const widgetChrome = document.getElementById(
    'widgetChrome',
  ) as HTMLInputElement | null;
  const lightDevice = document.getElementById(
    'lightDevice',
  ) as HTMLSelectElement | null;
  const coverDevice = document.getElementById(
    'coverDevice',
  ) as HTMLSelectElement | null;
  const coverTitle = document.getElementById(
    'coverTitle',
  ) as HTMLInputElement | null;

  if (typeSelect && isWidgetTypeId(typeSelect.value)) {
    if (state.draft.type !== typeSelect.value) {
      state.draft.type = typeSelect.value;
      const meta = state.payload?.widgetTypes.find(
        (item) => item.type === state.draft?.type,
      );
      const span = meta?.allowedSpans[0];
      if (span) {
        state.draft.rowSpan = span.rowSpan;
        state.draft.columnSpan = span.columnSpan;
      }
      fillSpanOptions(spanSelect, state.draft.type);
      if (state.draft.type === 'light') {
        fillLightDeviceOptions();
      }
      if (state.draft.type === 'cover') {
        fillCoverDeviceOptions();
      }
    }
  }

  if (rowSelect) state.draft.row = Number(rowSelect.value);
  if (columnSelect) state.draft.column = Number(columnSelect.value);
  if (spanSelect) {
    const [columns, rows] = spanSelect.value.split('x').map(Number);
    if (Number.isInteger(columns) && Number.isInteger(rows)) {
      state.draft.columnSpan = columns;
      state.draft.rowSpan = rows;
    }
  }
  if (titleText) state.draft.titleText = titleText.value;
  if (
    titleAlignment &&
    (titleAlignment.value === 'left' ||
      titleAlignment.value === 'center' ||
      titleAlignment.value === 'right')
  ) {
    state.draft.titleAlignment = titleAlignment.value;
  }
  if (
    dateTimeMode &&
    (dateTimeMode.value === 'time' ||
      dateTimeMode.value === 'date' ||
      dateTimeMode.value === 'date-time')
  ) {
    state.draft.dateTimeMode = dateTimeMode.value;
  }
  if (widgetChrome) {
    state.draft.chrome = widgetChrome.checked ? 'card' : 'plain';
  }
  // Only read the device select that matches the current widget type.
  // Both selects exist in the DOM (one hidden); reading the wrong one
  // would overwrite deviceId with the empty placeholder value.
  if (state.draft.type === 'light' && lightDevice) {
    state.draft.deviceId = lightDevice.value;
  } else if (state.draft.type === 'cover' && coverDevice) {
    state.draft.deviceId = coverDevice.value;
  }
  if (state.draft.type === 'cover' && coverTitle) {
    state.draft.coverTitle = coverTitle.value.slice(0, COVER_TITLE_MAX_LENGTH);
  }
  const lightTitle = document.getElementById(
    'lightTitle',
  ) as HTMLInputElement | null;
  if (state.draft.type === 'light' && lightTitle) {
    state.draft.lightTitle = lightTitle.value.slice(0, LIGHT_TITLE_MAX_LENGTH);
  }
}

function fillLightDeviceOptions(): void {
  const select = document.getElementById(
    'lightDevice',
  ) as HTMLSelectElement | null;
  const help = document.getElementById('lightDeviceHelp');
  if (!select || !state.payload || !state.draft) {
    return;
  }

  const devices = state.payload.compatibleDevices?.light ?? [];
  select.replaceChildren();

  const placeholder = document.createElement('option');
  placeholder.value = '';
  placeholder.textContent = t('widgets.light.selectDevice');
  select.appendChild(placeholder);

  for (const device of devices) {
    const option = document.createElement('option');
    option.value = device.id;
    option.textContent = deviceOptionLabel(device, 'light');
    select.appendChild(option);
  }

  if (
    state.draft.deviceId &&
    !devices.some((device) => device.id === state.draft?.deviceId)
  ) {
    const missing = document.createElement('option');
    missing.value = state.draft.deviceId;
    missing.textContent = `${state.draft.deviceId} — ${t('widgets.light.unavailable')}`;
    select.appendChild(missing);
  }

  select.value = state.draft.deviceId;

  if (help) {
    if (state.payload.deviceLoadError) {
      help.hidden = false;
      help.textContent = state.payload.deviceLoadError;
    } else if (devices.length === 0) {
      help.hidden = false;
      help.textContent = t('widgets.light.noCompatibleDevices');
    } else {
      help.hidden = true;
      help.textContent = '';
    }
  }
}

function fillCoverDeviceOptions(): void {
  const select = document.getElementById(
    'coverDevice',
  ) as HTMLSelectElement | null;
  const help = document.getElementById('coverDeviceHelp');
  if (!select || !state.payload || !state.draft) {
    return;
  }

  const devices = state.payload.compatibleDevices?.cover ?? [];
  select.replaceChildren();

  const placeholder = document.createElement('option');
  placeholder.value = '';
  placeholder.textContent = t('widgets.cover.selectDevice');
  select.appendChild(placeholder);

  for (const device of devices) {
    const option = document.createElement('option');
    option.value = device.id;
    option.textContent = deviceOptionLabel(device, 'cover');
    select.appendChild(option);
  }

  if (
    state.draft.deviceId &&
    !devices.some((device) => device.id === state.draft?.deviceId)
  ) {
    const missing = document.createElement('option');
    missing.value = state.draft.deviceId;
    missing.textContent = `${state.draft.deviceId} — ${t('widgets.cover.unavailable')}`;
    select.appendChild(missing);
  }

  select.value = state.draft.deviceId;

  if (help) {
    if (state.payload.deviceLoadError) {
      help.hidden = false;
      help.textContent = state.payload.deviceLoadError;
    } else if (devices.length === 0) {
      help.hidden = false;
      help.textContent = t('widgets.cover.noCompatibleDevices');
    } else {
      help.hidden = true;
      help.textContent = '';
    }
  }
}

function deviceOptionLabel(
  device: CompatibleDeviceOption,
  kind: 'light' | 'cover',
): string {
  const noZoneKey =
    kind === 'cover' ? 'widgets.cover.noZone' : 'widgets.light.noZone';
  const zone = device.zoneName?.trim() ? device.zoneName : t(noZoneKey);
  return `${device.name} — ${zone}`;
}

function fillCoordinateOptions(
  select: HTMLSelectElement | null,
  count: number,
): void {
  if (!select) {
    return;
  }
  select.replaceChildren();
  for (let index = 0; index < count; index += 1) {
    const option = document.createElement('option');
    option.value = String(index);
    option.textContent = String(index + 1);
    select.appendChild(option);
  }
}

function fillSpanOptions(
  select: HTMLSelectElement | null,
  type: WidgetTypeId,
): void {
  if (!select || !state.payload) {
    return;
  }
  const meta = state.payload.widgetTypes.find((item) => item.type === type);
  select.replaceChildren();
  for (const span of meta?.allowedSpans ?? []) {
    const option = document.createElement('option');
    option.value = `${span.columnSpan}x${span.rowSpan}`;
    option.textContent = `${span.columnSpan} × ${span.rowSpan}`;
    select.appendChild(option);
  }
}

function renderAll(): void {
  renderDashboardDialog();
  renderWidgetList();
  renderPreview();
  renderDraftPanel();
  renderError();
}

function renderPreviewOnly(): void {
  renderPreview();
  renderError();
}

function renderWidgetList(): void {
  const list = document.getElementById('widgetList');
  if (!list) {
    return;
  }
  list.replaceChildren();

  if (state.widgets.length === 0) {
    const empty = document.createElement('p');
    empty.className = 'homey-form-help';
    empty.textContent = t('editor.noWidgets');
    list.appendChild(empty);
    return;
  }

  for (const widget of state.widgets) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className =
      widget.id === state.selectedWidgetId
        ? 'homey-button-secondary-shadow'
        : 'homey-button-transparent';
    button.style.display = 'block';
    button.style.width = '100%';
    button.style.marginBottom = '0.5rem';
    button.textContent = `${widgetLabel(widget)} @ ${widget.placement.column + 1},${widget.placement.row + 1} (${widget.placement.columnSpan}x${widget.placement.rowSpan})`;
    button.addEventListener('click', () => {
      selectExistingWidget(widget);
    });
    list.appendChild(button);
  }
}

function selectExistingWidget(widget: WidgetInstance): void {
  state.selectedWidgetId = widget.id;
  const base = {
    id: widget.id,
    row: widget.placement.row,
    column: widget.placement.column,
    rowSpan: widget.placement.rowSpan,
    columnSpan: widget.placement.columnSpan,
    titleText: 'Title',
    titleAlignment: 'left' as const,
    dateTimeMode: 'date-time' as const,
    chrome: 'plain' as const,
    deviceId: '',
    coverTitle: '',
    lightTitle: '',
    isNew: false,
  };

  if (widget.type === 'title') {
    state.draft = {
      ...base,
      type: 'title',
      titleText: widget.config.text,
      titleAlignment: widget.config.alignment,
      chrome: resolveWidgetChrome(widget.config),
    };
  } else if (widget.type === 'date-time') {
    state.draft = {
      ...base,
      type: 'date-time',
      dateTimeMode: widget.config.mode,
      chrome: resolveWidgetChrome(widget.config),
    };
  } else if (widget.type === 'cover') {
    state.draft = {
      ...base,
      type: 'cover',
      deviceId: widget.config.deviceId,
      coverTitle: widget.config.title ?? '',
    };
  } else {
    state.draft = {
      ...base,
      type: 'light',
      deviceId: widget.config.deviceId,
      lightTitle: widget.config.title ?? '',
    };
  }
  syncDraftForm();
  validateDraft();
  renderAll();
}

function widgetLabel(widget: WidgetInstance): string {
  if (widget.type === 'cover' && widget.config.title?.trim()) {
    return widget.config.title.trim();
  }
  if (widget.type === 'light' && widget.config.title?.trim()) {
    return widget.config.title.trim();
  }
  if (widget.type === 'title' && widget.config.text.trim()) {
    return widget.config.text.trim();
  }
  const meta = state.payload?.widgetTypes.find(
    (item) => item.type === widget.type,
  );
  return meta?.name ?? widget.type;
}

function renderPreview(): void {
  const preview = document.getElementById('gridPreview');
  if (!preview || !state.payload) {
    if (preview) {
      preview.replaceChildren();
    }
    return;
  }

  const { rows, columns } = state.payload.grid;
  const occupancy = buildOccupancyMap(
    state.widgets.filter((widget) => widget.id !== state.draft?.id),
  );

  let draftCells = new Set<string>();
  if (state.draft) {
    draftCells = new Set(
      occupiedCellIds({
        row: state.draft.row,
        column: state.draft.column,
        rowSpan: state.draft.rowSpan,
        columnSpan: state.draft.columnSpan,
      }),
    );
  }

  preview.style.display = 'grid';
  preview.style.gridTemplateColumns = `repeat(${columns}, minmax(2.5rem, 1fr))`;
  preview.style.gridTemplateRows = `repeat(${rows}, minmax(2.5rem, 1fr))`;
  preview.style.gap = '4px';
  preview.replaceChildren();

  const painted = new Set<string>();

  for (const widget of state.widgets) {
    if (state.draft && widget.id === state.draft.id) {
      continue;
    }
    const cell = document.createElement('div');
    cell.className = 'editor-cell editor-cell--occupied';
    cell.style.gridArea = `${widget.placement.row + 1} / ${widget.placement.column + 1} / ${widget.placement.row + widget.placement.rowSpan + 1} / ${widget.placement.column + widget.placement.columnSpan + 1}`;
    cell.textContent = widgetLabel(widget);
    cell.title = widget.id;
    preview.appendChild(cell);
    for (const id of occupiedCellIds(widget.placement)) {
      painted.add(id);
    }
  }

  if (state.draft) {
    const cell = document.createElement('div');
    cell.className = state.errorKey
      ? 'editor-cell editor-cell--invalid'
      : 'editor-cell editor-cell--preview';
    cell.style.gridArea = `${state.draft.row + 1} / ${state.draft.column + 1} / ${state.draft.row + state.draft.rowSpan + 1} / ${state.draft.column + state.draft.columnSpan + 1}`;
    cell.textContent = t('editor.preview');
    preview.appendChild(cell);
    for (const id of draftCells) {
      painted.add(id);
    }
  }

  for (let row = 0; row < rows; row += 1) {
    for (let column = 0; column < columns; column += 1) {
      const id = `r${row}c${column}`;
      if (painted.has(id) || occupancy.has(id)) {
        continue;
      }
      const cell = document.createElement('div');
      cell.className = 'editor-cell editor-cell--free';
      cell.style.gridArea = `${row + 1} / ${column + 1}`;
      cell.textContent = t('editor.available');
      preview.appendChild(cell);
    }
  }
}

function closeDraft(): void {
  state.draft = null;
  state.selectedWidgetId = null;
  state.errorKey = null;
}

function closeDashboard(): void {
  closeDraft();
  state.payload = null;
  state.widgets = [];
  state.theme = 'dark';
  state.selectedDisplayId = null;
  const select = document.getElementById(
    'displaySelect',
  ) as HTMLSelectElement | null;
  if (select) {
    select.value = '';
  }
}

async function removeSelectedWidget(Homey: HomeySettingsApi): Promise<void> {
  if (!state.draft) {
    return;
  }

  const confirmed = await confirmAction(Homey, t('editor.confirmRemove'));
  if (!confirmed) {
    return;
  }

  if (!state.draft.isNew) {
    state.widgets = state.widgets.filter((widget) => widget.id !== state.draft?.id);
  }
  closeDraft();
  renderAll();
}

async function confirmAction(
  Homey: HomeySettingsApi,
  message: string,
): Promise<boolean> {
  const confirmFn = Homey.confirm;
  if (typeof confirmFn !== 'function') {
    return window.confirm(message);
  }

  return new Promise((resolve) => {
    let settled = false;
    const finish = (value: boolean): void => {
      if (settled) {
        return;
      }
      settled = true;
      resolve(value);
    };

    try {
      const result = confirmFn.call(Homey, message, (_err, confirmed) => {
        finish(confirmed === true);
      });
      if (result && typeof result.then === 'function') {
        void result.then((value) => finish(Boolean(value))).catch(() => finish(false));
      }
    } catch {
      finish(window.confirm(message));
    }
  });
}

function renderDashboardDialog(): void {
  const dialog = document.getElementById('dashboardDialog');
  const title = document.getElementById('dashboardDialogTitle');
  const subtitle = document.getElementById('dashboardDialogSubtitle');
  if (!dialog) {
    return;
  }

  const isOpen = state.payload !== null;
  dialog.hidden = !isOpen;
  dialog.setAttribute('aria-hidden', isOpen ? 'false' : 'true');

  if (!state.payload) {
    return;
  }

  if (title) {
    title.textContent = state.payload.name;
  }
  if (subtitle) {
    subtitle.textContent = `${state.payload.layoutId} · ${state.payload.grid.columns}×${state.payload.grid.rows}`;
  }

  const themeSelect = document.getElementById(
    'dashboardTheme',
  ) as HTMLSelectElement | null;
  if (themeSelect) {
    themeSelect.value = state.theme;
  }
}

function renderDraftPanel(): void {
  const browse = document.getElementById('widgetBrowse');
  const form = document.getElementById('draftForm');
  const formTitle = document.getElementById('draftFormTitle');
  const titleFields = document.getElementById('titleFields');
  const dateTimeFields = document.getElementById('dateTimeFields');
  const lightFields = document.getElementById('lightFields');
  const coverFields = document.getElementById('coverFields');
  const chromeFields = document.getElementById('chromeFields');
  const removeButton = document.getElementById('removeWidget');

  const isEditing = state.draft !== null;
  if (browse) {
    browse.hidden = isEditing;
  }
  if (form) {
    form.hidden = !isEditing;
  }

  if (!state.draft) {
    return;
  }

  if (formTitle) {
    formTitle.textContent = t(
      state.draft.isNew ? 'editor.addWidget' : 'editor.editWidget',
    );
  }
  if (removeButton) {
    removeButton.hidden = false;
  }
  if (titleFields) {
    titleFields.hidden = state.draft.type !== 'title';
  }
  if (dateTimeFields) {
    dateTimeFields.hidden = state.draft.type !== 'date-time';
  }
  if (lightFields) {
    lightFields.hidden = state.draft.type !== 'light';
  }
  if (coverFields) {
    coverFields.hidden = state.draft.type !== 'cover';
  }
  if (chromeFields) {
    chromeFields.hidden =
      state.draft.type === 'light' || state.draft.type === 'cover';
  }
}

function renderError(): void {
  const error = document.getElementById('editorError');
  if (!error) {
    return;
  }
  if (state.errorKey) {
    error.hidden = false;
    error.textContent = t(state.errorKey);
  } else {
    error.hidden = true;
    error.textContent = '';
  }

  const saveButton = document.getElementById(
    'saveDashboard',
  ) as HTMLButtonElement | null;
  const applyButton = document.getElementById(
    'applyDraft',
  ) as HTMLButtonElement | null;
  if (applyButton) {
    applyButton.disabled = Boolean(state.errorKey) || !state.draft;
  }
  if (saveButton) {
    saveButton.disabled = Boolean(state.errorKey && state.draft);
  }
}

function apiCall<T>(
  Homey: HomeySettingsApi,
  method: string,
  path: string,
  body: unknown,
): Promise<T> {
  return new Promise((resolve, reject) => {
    Homey.api(method, path, body, (err, result) => {
      if (err) {
        reject(err);
        return;
      }
      resolve(result as T);
    });
  });
}

function errorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  return String(error);
}

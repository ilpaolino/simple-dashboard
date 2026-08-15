import type { DateTimeMode } from '../../../lib/widgets/types';
import type { WidgetInstance } from '../../../lib/widgets/types';
import type { DateTimeWidgetConfig } from '../../../lib/widgets/date-time/types';
import {
  layoutVariantClass,
  placementGridArea,
  widgetChromeClass,
  type MountedWidget,
  type WidgetRenderContext,
  type WidgetRenderer,
} from '../types';

const TICK_MS = 1000;

export interface FormattedDateTime {
  readonly time: string;
  readonly date: string;
  readonly weekday: string;
  readonly dayMonth: string;
}

export class DateTimeWidgetRenderer
  implements WidgetRenderer<DateTimeWidgetConfig>
{
  public readonly type = 'date-time' as const;

  public mount(
    instance: WidgetInstance & { readonly config: DateTimeWidgetConfig },
    context: WidgetRenderContext,
  ): MountedWidget {
    const element = document.createElement('article');
    element.className = [
      'widget',
      'widget-datetime',
      layoutVariantClass(instance.placement),
      widgetChromeClass(instance.config),
      `widget-datetime--${instance.config.mode}`,
    ].join(' ');
    element.style.gridArea = placementGridArea(instance.placement);
    element.dataset.widgetId = instance.id;
    element.dataset.widgetType = instance.type;
    element.setAttribute('role', 'group');
    element.setAttribute('aria-live', 'polite');

    const timeEl = document.createElement('p');
    timeEl.className = 'widget-datetime__time';

    const compactDateEl = document.createElement('p');
    compactDateEl.className = 'widget-datetime__date';

    const dateBlock = document.createElement('div');
    dateBlock.className = 'widget-datetime__date-block';
    const weekdayEl = document.createElement('p');
    weekdayEl.className = 'widget-datetime__weekday';
    const dayMonthEl = document.createElement('p');
    dayMonthEl.className = 'widget-datetime__day-month';
    dateBlock.appendChild(weekdayEl);
    dateBlock.appendChild(dayMonthEl);

    const mode = instance.config.mode;
    const isWide = instance.placement.columnSpan >= 2;

    if (isWide) {
      if (mode === 'date' || mode === 'date-time') {
        element.appendChild(dateBlock);
      }
      if (mode === 'time' || mode === 'date-time') {
        element.appendChild(timeEl);
      }
    } else {
      if (mode === 'time' || mode === 'date-time') {
        element.appendChild(timeEl);
      }
      if (mode === 'date' || mode === 'date-time') {
        element.appendChild(compactDateEl);
      }
    }

    const locale = normalizeLocale(context.locale);
    let timerId: number | null = null;

    const paint = (now: Date): void => {
      const formatted = formatDateTime(now, mode, locale);
      timeEl.textContent = formatted.time;
      compactDateEl.textContent = formatted.date;
      weekdayEl.textContent = formatted.weekday;
      dayMonthEl.textContent = formatted.dayMonth;
      element.setAttribute(
        'aria-label',
        [formatted.weekday, formatted.dayMonth, formatted.time, formatted.date]
          .filter(Boolean)
          .join(' — '),
      );
    };

    paint(context.now ?? new Date());
    timerId = window.setInterval(() => {
      paint(new Date());
    }, TICK_MS);

    return {
      widgetId: instance.id,
      element,
      destroy() {
        if (timerId !== null) {
          window.clearInterval(timerId);
          timerId = null;
        }
        element.remove();
      },
    };
  }
}

export function formatDateTime(
  date: Date,
  mode: DateTimeMode,
  locale: string,
): FormattedDateTime {
  const time =
    mode === 'date'
      ? ''
      : new Intl.DateTimeFormat(locale, {
          hour: '2-digit',
          minute: '2-digit',
          hour12: false,
        }).format(date);

  if (mode === 'time') {
    return { time, date: '', weekday: '', dayMonth: '' };
  }

  const weekday = capitalize(
    new Intl.DateTimeFormat(locale, { weekday: 'long' }).format(date),
  );
  const month = capitalize(
    new Intl.DateTimeFormat(locale, { month: 'long' }).format(date),
  );
  const day = date.getDate();
  const english = locale.toLowerCase().startsWith('en');
  const dayMonth = english ? `${englishOrdinal(day)} ${month}` : `${day} ${month}`;
  const compactDate = english
    ? `${weekday}, ${month} ${day}`
    : `${weekday} ${day} ${month.toLocaleLowerCase(locale)}`;

  return {
    time,
    date: compactDate,
    weekday,
    dayMonth,
  };
}

export function normalizeLocale(locale: string): string {
  const trimmed = locale.trim().toLowerCase();
  if (trimmed.startsWith('it')) {
    return 'it-IT';
  }
  if (trimmed.startsWith('en')) {
    return 'en-US';
  }
  return locale || 'en-US';
}

export function englishOrdinal(day: number): string {
  const tens = day % 100;
  if (tens >= 11 && tens <= 13) {
    return `${day}th`;
  }
  switch (day % 10) {
    case 1:
      return `${day}st`;
    case 2:
      return `${day}nd`;
    case 3:
      return `${day}rd`;
    default:
      return `${day}th`;
  }
}

function capitalize(value: string): string {
  if (value.length === 0) {
    return value;
  }
  return value.charAt(0).toLocaleUpperCase() + value.slice(1);
}

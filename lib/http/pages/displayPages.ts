import type { DisplaySnapshot, MatchStatus } from '../../display/types';
import { renderTechnicalDocument } from './html';

export interface RecognizedPageInput {
  readonly lang: string;
  readonly translate: (key: string) => string;
  readonly display: DisplaySnapshot;
  readonly typeLabel: string;
  readonly timestamp: string;
  readonly matchStatus: MatchStatus;
}

export function renderRecognizedPage(input: RecognizedPageInput): string {
  const t = input.translate;
  const rows = [
    { label: t('pages.recognized.name'), value: input.display.name },
    { label: t('pages.recognized.type'), value: input.typeLabel },
    { label: t('pages.recognized.ip'), value: input.display.ipAddress },
  ];

  if (input.display.hardwareId) {
    rows.push({
      label: t('pages.recognized.hardwareId'),
      value: input.display.hardwareId,
    });
  }

  rows.push(
    { label: t('pages.recognized.layout'), value: input.display.layoutId },
    { label: t('pages.recognized.timestamp'), value: input.timestamp },
    {
      label: t('pages.recognized.status'),
      value: t('pages.status.recognized'),
    },
  );

  return renderTechnicalDocument({
    lang: input.lang,
    title: t('pages.recognized.title'),
    heading: t('pages.recognized.heading'),
    lead: t('pages.recognized.lead'),
    rows,
  });
}

export function renderUnconfiguredPage(input: {
  readonly lang: string;
  readonly translate: (key: string) => string;
  readonly clientIp: string;
  readonly userAgent: string;
  readonly timestamp: string;
}): string {
  const t = input.translate;
  return renderTechnicalDocument({
    lang: input.lang,
    title: t('pages.unconfigured.title'),
    heading: t('pages.unconfigured.heading'),
    lead: t('pages.unconfigured.lead'),
    rows: [
      { label: t('pages.unconfigured.ip'), value: input.clientIp },
      { label: t('pages.unconfigured.userAgent'), value: input.userAgent },
      { label: t('pages.unconfigured.timestamp'), value: input.timestamp },
    ],
  });
}

export function renderMismatchPage(input: {
  readonly lang: string;
  readonly translate: (key: string) => string;
  readonly clientIp: string;
  readonly expectedId: string;
  readonly actualId: string;
  readonly timestamp: string;
}): string {
  const t = input.translate;
  return renderTechnicalDocument({
    lang: input.lang,
    title: t('pages.mismatch.title'),
    heading: t('pages.mismatch.heading'),
    headingClass: 'danger',
    lead: t('pages.mismatch.lead'),
    rows: [
      { label: t('pages.mismatch.ip'), value: input.clientIp },
      { label: t('pages.mismatch.expectedId'), value: input.expectedId },
      { label: t('pages.mismatch.actualId'), value: input.actualId },
      { label: t('pages.mismatch.timestamp'), value: input.timestamp },
    ],
  });
}

export function renderProbeFailedPage(input: {
  readonly lang: string;
  readonly translate: (key: string) => string;
  readonly clientIp: string;
  readonly displayName: string;
  readonly timestamp: string;
}): string {
  const t = input.translate;
  return renderTechnicalDocument({
    lang: input.lang,
    title: t('pages.probeFailed.title'),
    heading: t('pages.probeFailed.heading'),
    headingClass: 'danger',
    lead: t('pages.probeFailed.lead'),
    rows: [
      { label: t('pages.probeFailed.name'), value: input.displayName },
      { label: t('pages.probeFailed.ip'), value: input.clientIp },
      { label: t('pages.probeFailed.timestamp'), value: input.timestamp },
    ],
  });
}

export function renderDiagnosticsDisabledPage(input: {
  readonly lang: string;
  readonly translate: (key: string) => string;
}): string {
  const t = input.translate;
  return renderTechnicalDocument({
    lang: input.lang,
    title: t('pages.diagnosticsDisabled.title'),
    heading: t('pages.diagnosticsDisabled.heading'),
    lead: t('pages.diagnosticsDisabled.lead'),
    rows: [],
  });
}

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  compareNotificationSeverity,
  maxNotificationSeverity,
  NOTIFICATION_SEVERITY_PRIORITY,
} from '../lib/notifications/severity';

describe('notification severity priority', () => {
  it('orders critical > warning > success > info', () => {
    assert.ok(
      NOTIFICATION_SEVERITY_PRIORITY.critical >
        NOTIFICATION_SEVERITY_PRIORITY.warning,
    );
    assert.ok(
      NOTIFICATION_SEVERITY_PRIORITY.warning >
        NOTIFICATION_SEVERITY_PRIORITY.success,
    );
    assert.ok(
      NOTIFICATION_SEVERITY_PRIORITY.success >
        NOTIFICATION_SEVERITY_PRIORITY.info,
    );
  });

  it('compareNotificationSeverity is not alphabetical', () => {
    assert.ok(compareNotificationSeverity('critical', 'info') < 0);
    assert.ok(compareNotificationSeverity('info', 'critical') > 0);
    assert.equal(compareNotificationSeverity('warning', 'warning'), 0);
  });

  it('maxNotificationSeverity picks the highest', () => {
    assert.equal(maxNotificationSeverity(['info']), 'info');
    assert.equal(maxNotificationSeverity(['success', 'info']), 'success');
    assert.equal(maxNotificationSeverity(['warning', 'success']), 'warning');
    assert.equal(maxNotificationSeverity(['critical', 'warning']), 'critical');
    assert.equal(maxNotificationSeverity([]), null);
  });
});

/**
 * Homey Web API handlers for the Dashboard Editor (App Settings)
 * and notification management (Flow-ready).
 * @see https://apps.developer.homey.app/advanced/web-api
 */

type HomeyLike = {
  app: {
    listDisplaysForEditor(): Promise<unknown>;
    getDashboardForEditor(displayId: string): Promise<unknown>;
    saveDashboardForEditor(
      displayId: string,
      body: unknown,
    ): Promise<unknown>;
    publishNotification(body: unknown): unknown;
    updateNotification(body: unknown): unknown;
    removeNotification(notificationId: string): unknown;
    listNotifications(): unknown;
  };
};

module.exports = {
  async listDisplays({ homey }: { homey: HomeyLike }) {
    return homey.app.listDisplaysForEditor();
  },

  async getDashboard({
    homey,
    params,
  }: {
    homey: HomeyLike;
    params: { displayId: string };
  }) {
    return homey.app.getDashboardForEditor(params.displayId);
  },

  async saveDashboard({
    homey,
    params,
    body,
  }: {
    homey: HomeyLike;
    params: { displayId: string };
    body: unknown;
  }) {
    return homey.app.saveDashboardForEditor(params.displayId, body);
  },

  async publishNotification({
    homey,
    body,
  }: {
    homey: HomeyLike;
    body: unknown;
  }) {
    return homey.app.publishNotification(body);
  },

  async updateNotification({
    homey,
    body,
  }: {
    homey: HomeyLike;
    body: unknown;
  }) {
    return homey.app.updateNotification(body);
  },

  async removeNotification({
    homey,
    params,
  }: {
    homey: HomeyLike;
    params: { notificationId: string };
  }) {
    return homey.app.removeNotification(params.notificationId);
  },

  async listNotifications({ homey }: { homey: HomeyLike }) {
    return homey.app.listNotifications();
  },
};

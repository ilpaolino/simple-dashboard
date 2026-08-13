/**
 * Homey Web API handlers for the Dashboard Editor (App Settings).
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
};

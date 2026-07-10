// @ts-check

import { describe, expect, it, jest } from "@jest/globals";
import {
  getRenderCronConfig,
  RENDER_GRAPHQL_URL,
  sendRenderOwnerSettingsRequest,
  startRenderCron,
} from "../src/render-cron.js";

describe("Render GraphQL cron", () => {
  it("uses four requests per minute by default", () => {
    const config = getRenderCronConfig({
      RENDER_CRON_ENABLED: "true",
      RENDER_API_TOKEN: "test-token",
      RENDER_COOKIE: "test-cookie",
      RENDER_OWNER_ID: "tea-test",
    });

    expect(config.enabled).toBe(true);
    expect(config.requestsPerMinute).toBe(4);
    expect(config.intervalMs).toBe(15_000);
  });

  it("supports three requests per minute", () => {
    const config = getRenderCronConfig({
      RENDER_CRON_REQUESTS_PER_MINUTE: "3",
    });

    expect(config.requestsPerMinute).toBe(3);
    expect(config.intervalMs).toBe(20_000);
  });

  it("sends ownerSettings without logging secrets or response data", async () => {
    const fetchImpl = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: jest.fn().mockResolvedValue({
        data: {
          owner: {
            logEndpoint: { token: "response-secret" },
          },
        },
      }),
    });
    const logger = {
      log: jest.fn(),
      error: jest.fn(),
    };
    const config = getRenderCronConfig({
      RENDER_CRON_ENABLED: "true",
      RENDER_API_TOKEN: "test-api-token",
      RENDER_COOKIE: "test-session-cookie",
      RENDER_OWNER_ID: "tea-test-owner",
    });

    const success = await sendRenderOwnerSettingsRequest({
      config,
      // @ts-ignore Test fetch mock.
      fetchImpl,
      logger,
    });

    expect(success).toBe(true);
    expect(fetchImpl).toHaveBeenCalledTimes(1);

    const [url, options] = fetchImpl.mock.calls[0];
    expect(url).toBe(RENDER_GRAPHQL_URL);
    expect(options.method).toBe("POST");
    expect(options.headers.authorization).toBe("Bearer test-api-token");
    expect(options.headers.cookie).toBe("test-session-cookie");

    const body = JSON.parse(options.body);
    expect(body.operationName).toBe("ownerSettings");
    expect(body.variables).toEqual({ ownerId: "tea-test-owner" });

    const logs = JSON.stringify(logger.log.mock.calls);
    expect(logs).not.toContain("test-api-token");
    expect(logs).not.toContain("test-session-cookie");
    expect(logs).not.toContain("response-secret");
  });

  it("does not start without required credentials", () => {
    const logger = {
      log: jest.fn(),
      error: jest.fn(),
    };

    const timer = startRenderCron({
      env: { RENDER_CRON_ENABLED: "true" },
      logger,
    });

    expect(timer).toBeNull();
    expect(logger.error).toHaveBeenCalledTimes(1);
  });
});

// @ts-check

import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  jest,
} from "@jest/globals";
import {
  getRenderSchedulerStatus,
  startRenderBackgroundScheduler,
  stopRenderBackgroundScheduler,
} from "../src/render-background-scheduler.js";

const createLogger = () => ({
  log: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
});

const createEnv = (overrides = {}) => ({
  RENDER_SCHEDULER_ENABLED: "true",
  RENDER_TOKEN: "test-render-token",
  RENDER_OWNER_ID: "tea-test-owner",
  RENDER_SCHEDULER_INITIAL_DELAY_MS: "0",
  ...overrides,
});

const createResponse = ({
  status = 200,
  ok = true,
  payload = {
    data: {
      owner: {
        id: "tea-test-owner",
        deployHandling: "QUEUE_AND_UPDATE",
      },
    },
  },
  retryAfter = null,
  jsonError = false,
} = {}) => ({
  status,
  ok,
  headers: {
    get: jest.fn((name) => (name === "retry-after" ? retryAfter : null)),
  },
  json: jsonError
    ? jest.fn().mockRejectedValue(new Error("invalid json"))
    : jest.fn().mockResolvedValue(payload),
});

const startScheduler = ({ env, fetchImpl, logger }) => {
  return startRenderBackgroundScheduler({
    env,
    fetchImpl,
    logger,
  });
};

const runFirstTick = async () => {
  await jest.advanceTimersByTimeAsync(0);
};

beforeEach(() => {
  jest.useFakeTimers();
});

afterEach(() => {
  stopRenderBackgroundScheduler();
  jest.useRealTimers();
});

describe("Render background scheduler", () => {
  it("does not start when disabled", () => {
    const logger = createLogger();

    const status = startScheduler({
      env: createEnv({ RENDER_SCHEDULER_ENABLED: "false" }),
      logger,
    });

    expect(status.enabled).toBe(false);
    expect(status.started).toBe(false);
    expect(jest.getTimerCount()).toBe(0);
    expect(logger.log).toHaveBeenCalledWith("[render-scheduler] disabled");
  });

  it("does not start without a token", () => {
    const logger = createLogger();
    const env = createEnv();
    delete env.RENDER_TOKEN;

    const status = startScheduler({ env, logger });

    expect(status.enabled).toBe(true);
    expect(status.started).toBe(false);
    expect(logger.warn).toHaveBeenCalledWith(
      expect.stringContaining("RENDER_TOKEN and RENDER_OWNER_ID"),
    );
  });

  it("does not start without an owner ID", () => {
    const logger = createLogger();
    const env = createEnv();
    delete env.RENDER_OWNER_ID;

    const status = startScheduler({ env, logger });

    expect(status.enabled).toBe(true);
    expect(status.started).toBe(false);
    expect(logger.warn).toHaveBeenCalledWith(
      expect.stringContaining("RENDER_TOKEN and RENDER_OWNER_ID"),
    );
  });

  it("uses the default 15000 ms interval", () => {
    const logger = createLogger();
    const status = startScheduler({
      env: createEnv({ RENDER_SCHEDULER_INITIAL_DELAY_MS: "3000" }),
      fetchImpl: jest.fn(),
      logger,
    });

    expect(status.intervalMs).toBe(15_000);
    expect(status.nextDelayMs).toBe(3_000);
    expect(logger.log).toHaveBeenCalledWith(
      "[render-scheduler] started interval=15000ms",
    );
  });

  it("uses a configured 20000 ms interval", () => {
    const status = startScheduler({
      env: createEnv({ RENDER_SCHEDULER_INTERVAL_MS: "20000" }),
      logger: createLogger(),
    });

    expect(status.intervalMs).toBe(20_000);
  });

  it("clamps an interval below 10000 ms", () => {
    const logger = createLogger();
    const status = startScheduler({
      env: createEnv({ RENDER_SCHEDULER_INTERVAL_MS: "1000" }),
      logger,
    });

    expect(status.intervalMs).toBe(10_000);
    expect(logger.warn).toHaveBeenCalledWith(
      expect.stringContaining("clamped to 10000ms"),
    );
  });

  it("falls back to 15000 ms for an invalid interval", () => {
    const logger = createLogger();
    const status = startScheduler({
      env: createEnv({ RENDER_SCHEDULER_INTERVAL_MS: "invalid" }),
      logger,
    });

    expect(status.intervalMs).toBe(15_000);
    expect(logger.warn).toHaveBeenCalledWith(
      expect.stringContaining("invalid RENDER_SCHEDULER_INTERVAL_MS"),
    );
  });

  it("sends the expected GraphQL authorization, owner ID, and operation", async () => {
    const fetchImpl = jest.fn().mockResolvedValue(createResponse());
    const logger = createLogger();

    startScheduler({
      env: createEnv(),
      fetchImpl,
      logger,
    });
    await runFirstTick();

    expect(fetchImpl).toHaveBeenCalledTimes(1);
    const [url, options] = fetchImpl.mock.calls[0];
    expect(url).toBe("https://api.render.com/graphql");
    expect(options.headers).toEqual(
      expect.objectContaining({
        accept: "application/json",
        authorization: "Bearer test-render-token",
        "content-type": "application/json",
      }),
    );

    const body = JSON.parse(options.body);
    expect(body.operationName).toBe("ownerSettings");
    expect(body.variables).toEqual({ ownerId: "tea-test-owner" });
  });

  it("does not overlap a pending request", async () => {
    let resolveRequest;
    const fetchImpl = jest.fn(
      () =>
        new Promise((resolve) => {
          resolveRequest = resolve;
        }),
    );

    startScheduler({
      env: createEnv(),
      fetchImpl,
      logger: createLogger(),
    });
    await runFirstTick();
    await jest.advanceTimersByTimeAsync(60_000);

    expect(fetchImpl).toHaveBeenCalledTimes(1);

    resolveRequest(createResponse());
    await Promise.resolve();
  });

  it("aborts a request that exceeds the configured timeout", async () => {
    const fetchImpl = jest.fn(
      (_url, options) =>
        new Promise((_resolve, reject) => {
          options.signal.addEventListener("abort", () => {
            reject(new Error("aborted"));
          });
        }),
    );

    startScheduler({
      env: createEnv({ RENDER_SCHEDULER_TIMEOUT_MS: "10000" }),
      fetchImpl,
      logger: createLogger(),
    });
    await runFirstTick();
    await jest.advanceTimersByTimeAsync(10_000);

    const status = getRenderSchedulerStatus();
    expect(status.consecutiveFailures).toBe(1);
    expect(status.lastFailureAt).not.toBeNull();
  });

  it("backs off after non-2xx and GraphQL failures, then resets after success", async () => {
    const fetchImpl = jest
      .fn()
      .mockResolvedValueOnce(createResponse({ status: 500, ok: false }))
      .mockResolvedValueOnce(
        createResponse({ payload: { errors: [{ message: "bad query" }] } }),
      )
      .mockResolvedValueOnce(createResponse());

    startScheduler({
      env: createEnv(),
      fetchImpl,
      logger: createLogger(),
    });
    await runFirstTick();
    expect(getRenderSchedulerStatus().nextDelayMs).toBe(15_000);
    await jest.advanceTimersByTimeAsync(15_000);
    expect(getRenderSchedulerStatus().nextDelayMs).toBe(30_000);
    await jest.advanceTimersByTimeAsync(30_000);

    const status = getRenderSchedulerStatus();
    expect(status.consecutiveFailures).toBe(0);
    expect(status.nextDelayMs).toBe(15_000);
    expect(status.lastSuccessAt).not.toBeNull();
  });

  it("uses Retry-After for HTTP 429 responses", async () => {
    const fetchImpl = jest.fn().mockResolvedValue(
      createResponse({
        status: 429,
        ok: false,
        retryAfter: "45",
      }),
    );

    startScheduler({
      env: createEnv(),
      fetchImpl,
      logger: createLogger(),
    });
    await runFirstTick();

    expect(getRenderSchedulerStatus().nextDelayMs).toBe(45_000);
  });

  it("stops cleanly, clears timers, and aborts an active request", async () => {
    let signal;
    const fetchImpl = jest.fn(
      (_url, options) =>
        new Promise((_resolve, reject) => {
          signal = options.signal;
          signal.addEventListener("abort", () => reject(new Error("aborted")));
        }),
    );

    startScheduler({
      env: createEnv({ RENDER_SCHEDULER_INITIAL_DELAY_MS: "3000" }),
      fetchImpl,
      logger: createLogger(),
    });
    expect(jest.getTimerCount()).toBe(1);
    await jest.advanceTimersByTimeAsync(3_000);

    const status = stopRenderBackgroundScheduler();
    expect(signal.aborted).toBe(true);
    expect(status.started).toBe(false);
    expect(status.nextDelayMs).toBeNull();
    expect(jest.getTimerCount()).toBe(0);
  });

  it("does not create a duplicate scheduler when started twice", () => {
    const logger = createLogger();

    startScheduler({
      env: createEnv({ RENDER_SCHEDULER_INITIAL_DELAY_MS: "3000" }),
      fetchImpl: jest.fn(),
      logger,
    });
    const firstTimerCount = jest.getTimerCount();
    startScheduler({
      env: createEnv({ RENDER_SCHEDULER_INITIAL_DELAY_MS: "3000" }),
      fetchImpl: jest.fn(),
      logger,
    });

    expect(jest.getTimerCount()).toBe(firstTimerCount);
    expect(logger.log).toHaveBeenCalledWith(
      "[render-scheduler] already started",
    );
  });

  it("keeps tokens and GraphQL response secrets out of logs and status", async () => {
    const logger = createLogger();
    const fetchImpl = jest.fn().mockResolvedValue(
      createResponse({
        payload: {
          data: {
            owner: {
              id: "tea-test-owner",
              deployHandling: "QUEUE_AND_UPDATE",
              logEndpoint: { token: "response-secret" },
            },
          },
        },
      }),
    );

    startScheduler({
      env: createEnv({ RENDER_TOKEN: "scheduler-secret" }),
      fetchImpl,
      logger,
    });
    await runFirstTick();

    const recordedLogs = JSON.stringify([
      logger.log.mock.calls,
      logger.error.mock.calls,
      logger.warn.mock.calls,
    ]);
    const status = JSON.stringify(getRenderSchedulerStatus());

    expect(recordedLogs).not.toContain("scheduler-secret");
    expect(recordedLogs).not.toContain("response-secret");
    expect(status).not.toContain("scheduler-secret");
    expect(status).not.toContain("response-secret");
    expect(status).not.toContain("test-render-token");
  });
});

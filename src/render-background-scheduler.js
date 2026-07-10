// @ts-check

import { logger as defaultLogger } from "./common/log.js";

const DEFAULT_GRAPHQL_URL = "https://api.render.com/graphql";
const DEFAULT_INTERVAL_MS = 15_000;
const MIN_INTERVAL_MS = 10_000;
const DEFAULT_TIMEOUT_MS = 10_000;
const DEFAULT_INITIAL_DELAY_MS = 3_000;
const DEFAULT_MAX_BACKOFF_MS = 300_000;

const OWNER_SETTINGS_QUERY = [
  "query ownerSettings($ownerId: String!) {",
  "  owner(ownerId: $ownerId) {",
  "    id",
  "    deployHandling",
  "    logEndpoint {",
  "      endpoint",
  "      token",
  "      __typename",
  "    }",
  "    logStreamSetting {",
  "      ...logStreamOverride",
  "      __typename",
  "    }",
  "    __typename",
  "  }",
  "}",
  "",
  "fragment logStreamOverride on LogStreamSetting {",
  "  endpoint",
  "  setting",
  "  hasToken",
  "  preview",
  "  ownerId",
  "  resource {",
  "    id",
  "    name",
  "    type",
  "    subtype",
  "    __typename",
  "  }",
  "  __typename",
  "}",
].join("\n");

const createInitialState = () => ({
  enabled: false,
  started: false,
  stopping: false,
  inFlight: false,
  intervalMs: DEFAULT_INTERVAL_MS,
  timeoutMs: DEFAULT_TIMEOUT_MS,
  initialDelayMs: DEFAULT_INITIAL_DELAY_MS,
  maxBackoffMs: DEFAULT_MAX_BACKOFF_MS,
  nextDelayMs: null,
  lastAttemptAt: null,
  lastSuccessAt: null,
  lastFailureAt: null,
  consecutiveFailures: 0,
  lastHttpStatus: null,
  timer: null,
  timeoutTimer: null,
  requestController: null,
  requestTimedOut: false,
  config: null,
  dependencies: null,
});

let schedulerState = createInitialState();
let runSchedulerTick;

/**
 * Reset per-run diagnostic fields before starting a new scheduler instance.
 *
 * @returns {void} Nothing.
 */
const resetRunState = () => {
  schedulerState.inFlight = false;
  schedulerState.nextDelayMs = null;
  schedulerState.lastAttemptAt = null;
  schedulerState.lastSuccessAt = null;
  schedulerState.lastFailureAt = null;
  schedulerState.consecutiveFailures = 0;
  schedulerState.lastHttpStatus = null;
  schedulerState.timer = null;
  schedulerState.timeoutTimer = null;
  schedulerState.requestController = null;
  schedulerState.requestTimedOut = false;
};

/**
 * Parse an unsigned integer without accepting partial values.
 *
 * @param {string | undefined} value Environment value.
 * @returns {number | null} Parsed value, or null when invalid.
 */
const parseUnsignedInteger = (value) => {
  if (typeof value !== "string" || !/^\d+$/.test(value.trim())) {
    return null;
  }

  const parsed = Number(value);
  return Number.isSafeInteger(parsed) ? parsed : null;
};

/**
 * Return a safe value for one-line logs.
 *
 * @param {unknown} value Value to sanitize.
 * @returns {string} Sanitized value.
 */
const sanitizeLogValue = (value) => {
  return String(value ?? "unknown")
    .replace(/[\r\n]/g, " ")
    .slice(0, 120);
};

/**
 * Return the current timestamp from the active scheduler dependencies.
 *
 * @returns {string} ISO timestamp.
 */
const nowIso = () => {
  const dependencies = schedulerState.dependencies;
  return dependencies ? dependencies.nowIso() : new Date().toISOString();
};

/**
 * Write a scheduler warning without requiring a logger.warn method.
 *
 * @param {string} message Warning message.
 * @returns {void} Nothing.
 */
const logWarning = (message) => {
  const logger = schedulerState.dependencies?.logger || defaultLogger;
  if (typeof logger.warn === "function") {
    logger.warn("[render-scheduler] warning " + message);
  } else {
    logger.error("[render-scheduler] warning " + message);
  }
};

/**
 * Create the runtime dependencies used by the scheduler.
 *
 * @param {object} options Scheduler options.
 * @param {NodeJS.ProcessEnv} [options.env] Environment variables.
 * @param {typeof fetch} [options.fetchImpl] Fetch implementation.
 * @param {Pick<Console, "log" | "error" | "warn">} [options.logger] Logger.
 * @param {typeof setTimeout} [options.setTimeoutImpl] Timeout implementation.
 * @param {typeof clearTimeout} [options.clearTimeoutImpl] Timeout cleanup.
 * @param {() => number} [options.now] Current time provider.
 * @param {() => string} [options.nowIso] ISO timestamp provider.
 * @returns {{
 *   env: NodeJS.ProcessEnv;
 *   fetchImpl: typeof fetch | undefined;
 *   logger: Pick<Console, "log" | "error" | "warn">;
 *   setTimeoutImpl: typeof setTimeout;
 *   clearTimeoutImpl: typeof clearTimeout;
 *   now: () => number;
 *   nowIso: () => string;
 * }} Scheduler runtime dependencies.
 */
const createDependencies = ({
  env = process.env,
  fetchImpl = globalThis.fetch,
  logger = defaultLogger,
  setTimeoutImpl = setTimeout,
  clearTimeoutImpl = clearTimeout,
  now = () => Date.now(),
  nowIso: providedNowIso,
} = {}) => {
  return {
    env,
    fetchImpl,
    logger,
    setTimeoutImpl,
    clearTimeoutImpl,
    now,
    nowIso: providedNowIso || (() => new Date(now()).toISOString()),
  };
};

/**
 * Read and validate scheduler configuration lazily after environment loading.
 *
 * @param {NodeJS.ProcessEnv} env Environment variables.
 * @returns {{
 *   enabled: boolean;
 *   token?: string;
 *   ownerId?: string;
 *   graphqlUrl: string;
 *   intervalMs: number;
 *   timeoutMs: number;
 *   initialDelayMs: number;
 *   maxBackoffMs: number;
 *   warnings: string[];
 * }} Scheduler configuration.
 */
const readConfig = (env) => {
  const warnings = [];
  const requestedInterval = parseUnsignedInteger(
    env.RENDER_SCHEDULER_INTERVAL_MS,
  );
  let intervalMs = DEFAULT_INTERVAL_MS;

  if (env.RENDER_SCHEDULER_INTERVAL_MS !== undefined) {
    if (requestedInterval === null) {
      warnings.push(
        "invalid RENDER_SCHEDULER_INTERVAL_MS; using " +
          DEFAULT_INTERVAL_MS +
          "ms",
      );
    } else if (requestedInterval < MIN_INTERVAL_MS) {
      intervalMs = MIN_INTERVAL_MS;
      warnings.push(
        "RENDER_SCHEDULER_INTERVAL_MS below " +
          MIN_INTERVAL_MS +
          "ms; clamped to " +
          MIN_INTERVAL_MS +
          "ms",
      );
    } else {
      intervalMs = requestedInterval;
    }
  }

  const requestedTimeout = parseUnsignedInteger(
    env.RENDER_SCHEDULER_TIMEOUT_MS,
  );
  const timeoutMs =
    requestedTimeout && requestedTimeout > 0
      ? requestedTimeout
      : DEFAULT_TIMEOUT_MS;
  if (
    env.RENDER_SCHEDULER_TIMEOUT_MS !== undefined &&
    (!requestedTimeout || requestedTimeout < 1)
  ) {
    warnings.push(
      "invalid RENDER_SCHEDULER_TIMEOUT_MS; using " + DEFAULT_TIMEOUT_MS + "ms",
    );
  }

  const requestedInitialDelay = parseUnsignedInteger(
    env.RENDER_SCHEDULER_INITIAL_DELAY_MS,
  );
  const initialDelayMs =
    requestedInitialDelay === null
      ? DEFAULT_INITIAL_DELAY_MS
      : requestedInitialDelay;
  if (
    env.RENDER_SCHEDULER_INITIAL_DELAY_MS !== undefined &&
    requestedInitialDelay === null
  ) {
    warnings.push(
      "invalid RENDER_SCHEDULER_INITIAL_DELAY_MS; using " +
        DEFAULT_INITIAL_DELAY_MS +
        "ms",
    );
  }

  const requestedMaxBackoff = parseUnsignedInteger(
    env.RENDER_SCHEDULER_MAX_BACKOFF_MS,
  );
  const maxBackoffMs = Math.max(
    intervalMs,
    requestedMaxBackoff && requestedMaxBackoff > 0
      ? requestedMaxBackoff
      : DEFAULT_MAX_BACKOFF_MS,
  );
  if (
    env.RENDER_SCHEDULER_MAX_BACKOFF_MS !== undefined &&
    (!requestedMaxBackoff || requestedMaxBackoff < 1)
  ) {
    warnings.push(
      "invalid RENDER_SCHEDULER_MAX_BACKOFF_MS; using " +
        DEFAULT_MAX_BACKOFF_MS +
        "ms",
    );
  }

  let graphqlUrl = env.RENDER_GRAPHQL_URL || DEFAULT_GRAPHQL_URL;
  try {
    new URL(graphqlUrl);
  } catch {
    warnings.push("invalid RENDER_GRAPHQL_URL; using " + DEFAULT_GRAPHQL_URL);
    graphqlUrl = DEFAULT_GRAPHQL_URL;
  }

  return {
    enabled: env.RENDER_SCHEDULER_ENABLED === "true",
    token: env.RENDER_TOKEN,
    ownerId: env.RENDER_OWNER_ID,
    graphqlUrl,
    intervalMs,
    timeoutMs,
    initialDelayMs,
    maxBackoffMs,
    warnings,
  };
};

/**
 * Return the delay declared by a Retry-After header.
 *
 * @param {string | null} value Header value.
 * @param {number} now Current time in milliseconds.
 * @returns {number | null} Requested delay in milliseconds.
 */
const parseRetryAfter = (value, now) => {
  if (!value) {
    return null;
  }

  const seconds = parseUnsignedInteger(value);
  if (seconds !== null) {
    return seconds * 1_000;
  }

  const dateMs = Date.parse(value);
  return Number.isNaN(dateMs) ? null : Math.max(0, dateMs - now);
};

/**
 * Clamp a delay to the scheduler safety limits.
 *
 * @param {number} delayMs Delay in milliseconds.
 * @returns {number} Safe delay.
 */
const clampDelay = (delayMs) => {
  return Math.min(
    schedulerState.maxBackoffMs,
    Math.max(MIN_INTERVAL_MS, Math.floor(delayMs)),
  );
};

/**
 * Calculate the exponential backoff after a failed request.
 *
 * @returns {number} Next delay in milliseconds.
 */
const getFailureDelay = () => {
  const exponent = Math.max(0, schedulerState.consecutiveFailures - 1);
  return Math.min(
    schedulerState.maxBackoffMs,
    schedulerState.intervalMs * 2 ** exponent,
  );
};

/**
 * Queue the next recursive scheduler tick.
 *
 * @param {number} delayMs Delay before the next tick.
 * @param {boolean} [allowShortDelay] Whether to allow a delay below the minimum interval.
 * @returns {void} Nothing.
 */
const scheduleNextTick = (delayMs, allowShortDelay = false) => {
  if (
    !schedulerState.started ||
    schedulerState.stopping ||
    !schedulerState.dependencies
  ) {
    return;
  }

  const dependencies = schedulerState.dependencies;
  const safeDelay = allowShortDelay
    ? Math.min(schedulerState.maxBackoffMs, Math.max(0, Math.floor(delayMs)))
    : clampDelay(delayMs);
  schedulerState.nextDelayMs = safeDelay;
  schedulerState.timer = dependencies.setTimeoutImpl(() => {
    schedulerState.timer = null;
    void runSchedulerTick();
  }, safeDelay);
};

/**
 * Mark a scheduler request as failed and choose the next delay.
 *
 * @param {object} args Failure details.
 * @param {number | null} args.status HTTP status.
 * @param {number | null} args.retryAfterMs Retry-After delay.
 * @param {"http" | "network" | "timeout" | "json" | "graphql" | "owner"} args.kind Failure kind.
 * @returns {number} Next delay in milliseconds.
 */
const registerFailure = ({ status, retryAfterMs, kind }) => {
  schedulerState.lastHttpStatus = status;
  schedulerState.lastFailureAt = nowIso();
  schedulerState.consecutiveFailures += 1;

  let nextDelayMs = getFailureDelay();
  if (status === 429 && retryAfterMs !== null) {
    nextDelayMs = clampDelay(retryAfterMs);
  }

  schedulerState.nextDelayMs = nextDelayMs;
  const logger = schedulerState.dependencies?.logger || defaultLogger;

  switch (kind) {
    case "timeout":
      logger.error("[render-scheduler] timeout");
      break;
    case "graphql":
      logger.error("[render-scheduler] graphql error");
      break;
    case "json":
      logger.error("[render-scheduler] invalid json response");
      break;
    case "owner":
      logger.error("[render-scheduler] response missing data.owner");
      break;
    case "http":
      logger.error("[render-scheduler] failed status=" + status);
      break;
    default:
      logger.error("[render-scheduler] network error");
      break;
  }

  return nextDelayMs;
};

/**
 * Perform one GraphQL ownerSettings request.
 *
 * @returns {Promise<{success: boolean; nextDelayMs?: number; stopped?: boolean}>} Request result.
 */
const performRequest = async () => {
  const dependencies = schedulerState.dependencies;
  const config = schedulerState.config;
  if (!dependencies || !config || !dependencies.fetchImpl) {
    const nextDelayMs = registerFailure({
      status: null,
      retryAfterMs: null,
      kind: "network",
    });
    return { success: false, nextDelayMs };
  }

  const startedAtMs = dependencies.now();
  schedulerState.lastAttemptAt = dependencies.nowIso();
  schedulerState.requestTimedOut = false;
  schedulerState.requestController = new AbortController();

  schedulerState.timeoutTimer = dependencies.setTimeoutImpl(() => {
    schedulerState.requestTimedOut = true;
    schedulerState.requestController?.abort();
  }, config.timeoutMs);

  try {
    const response = await dependencies.fetchImpl(config.graphqlUrl, {
      method: "POST",
      headers: {
        accept: "application/json",
        authorization: "Bearer " + config.token,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        operationName: "ownerSettings",
        variables: {
          ownerId: config.ownerId,
        },
        query: OWNER_SETTINGS_QUERY,
      }),
      signal: schedulerState.requestController.signal,
    });

    const status = response.status;
    const retryAfterMs = parseRetryAfter(
      response.headers?.get?.("retry-after") || null,
      dependencies.now(),
    );
    if (!response.ok) {
      const nextDelayMs = registerFailure({
        status,
        retryAfterMs,
        kind: "http",
      });
      return { success: false, nextDelayMs };
    }

    let payload;
    try {
      payload = await response.json();
    } catch {
      const nextDelayMs = registerFailure({
        status,
        retryAfterMs: null,
        kind: "json",
      });
      return { success: false, nextDelayMs };
    }

    if (Array.isArray(payload?.errors) && payload.errors.length > 0) {
      const nextDelayMs = registerFailure({
        status,
        retryAfterMs: null,
        kind: "graphql",
      });
      return { success: false, nextDelayMs };
    }

    const owner = payload?.data?.owner;
    if (!owner || typeof owner !== "object") {
      const nextDelayMs = registerFailure({
        status,
        retryAfterMs: null,
        kind: "owner",
      });
      return { success: false, nextDelayMs };
    }

    schedulerState.lastHttpStatus = status;
    schedulerState.lastSuccessAt = dependencies.nowIso();
    schedulerState.consecutiveFailures = 0;
    schedulerState.nextDelayMs = schedulerState.intervalMs;

    dependencies.logger.log(
      "[render-scheduler] ok status=" +
        status +
        " owner=" +
        sanitizeLogValue(owner.id) +
        " deployHandling=" +
        sanitizeLogValue(owner.deployHandling) +
        " duration=" +
        (dependencies.now() - startedAtMs) +
        "ms",
    );

    return {
      success: true,
      nextDelayMs: schedulerState.intervalMs,
    };
  } catch {
    if (schedulerState.stopping) {
      return { success: false, stopped: true };
    }

    const nextDelayMs = registerFailure({
      status: null,
      retryAfterMs: null,
      kind: schedulerState.requestTimedOut ? "timeout" : "network",
    });
    return { success: false, nextDelayMs };
  } finally {
    if (schedulerState.timeoutTimer !== null && dependencies.clearTimeoutImpl) {
      dependencies.clearTimeoutImpl(schedulerState.timeoutTimer);
    }
    schedulerState.timeoutTimer = null;
    schedulerState.requestController = null;
    schedulerState.requestTimedOut = false;
  }
};

/**
 * Run one scheduler tick, then recursively schedule the next tick.
 *
 * @returns {Promise<void>} Nothing.
 */
runSchedulerTick = async () => {
  if (!schedulerState.started || schedulerState.stopping) {
    return;
  }

  if (schedulerState.inFlight) {
    schedulerState.dependencies?.logger.log(
      "[render-scheduler] skipped previous request still running",
    );
    scheduleNextTick(schedulerState.intervalMs);
    return;
  }

  schedulerState.inFlight = true;
  try {
    const result = await performRequest();
    if (!result.stopped && schedulerState.started && !schedulerState.stopping) {
      scheduleNextTick(result.nextDelayMs || schedulerState.intervalMs);
    }
  } finally {
    schedulerState.inFlight = false;
  }
};

/**
 * Return non-sensitive scheduler state for diagnostics.
 *
 * @returns {{
 *   enabled: boolean;
 *   started: boolean;
 *   inFlight: boolean;
 *   intervalMs: number;
 *   lastAttemptAt: string | null;
 *   lastSuccessAt: string | null;
 *   lastFailureAt: string | null;
 *   consecutiveFailures: number;
 *   nextDelayMs: number | null;
 *   lastHttpStatus: number | null;
 * }} Non-sensitive scheduler status.
 */
const getRenderSchedulerStatus = () => {
  return {
    enabled: schedulerState.enabled,
    started: schedulerState.started,
    inFlight: schedulerState.inFlight,
    intervalMs: schedulerState.intervalMs,
    lastAttemptAt: schedulerState.lastAttemptAt,
    lastSuccessAt: schedulerState.lastSuccessAt,
    lastFailureAt: schedulerState.lastFailureAt,
    consecutiveFailures: schedulerState.consecutiveFailures,
    nextDelayMs: schedulerState.nextDelayMs,
    lastHttpStatus: schedulerState.lastHttpStatus,
  };
};

/**
 * Start the singleton Render background scheduler.
 *
 * @param {object} [options] Optional runtime dependencies for testing.
 * @returns {ReturnType<typeof getRenderSchedulerStatus>} Scheduler status.
 */
const startRenderBackgroundScheduler = (options = {}) => {
  if (schedulerState.started || schedulerState.inFlight) {
    schedulerState.dependencies?.logger.log(
      "[render-scheduler] already started",
    );
    return getRenderSchedulerStatus();
  }

  const dependencies = createDependencies(options);
  resetRunState();
  schedulerState.dependencies = dependencies;
  schedulerState.stopping = false;
  schedulerState.config = readConfig(dependencies.env);

  for (const warning of schedulerState.config.warnings) {
    logWarning(warning);
  }

  schedulerState.enabled = schedulerState.config.enabled;
  schedulerState.intervalMs = schedulerState.config.intervalMs;
  schedulerState.timeoutMs = schedulerState.config.timeoutMs;
  schedulerState.initialDelayMs = schedulerState.config.initialDelayMs;
  schedulerState.maxBackoffMs = schedulerState.config.maxBackoffMs;

  if (!schedulerState.enabled) {
    dependencies.logger.log("[render-scheduler] disabled");
    return getRenderSchedulerStatus();
  }

  if (!schedulerState.config.token || !schedulerState.config.ownerId) {
    logWarning(
      "disabled: RENDER_TOKEN and RENDER_OWNER_ID are required when enabled",
    );
    return getRenderSchedulerStatus();
  }

  if (!dependencies.fetchImpl) {
    logWarning("disabled: global fetch is unavailable");
    return getRenderSchedulerStatus();
  }

  schedulerState.started = true;
  schedulerState.nextDelayMs = schedulerState.initialDelayMs;
  dependencies.logger.log(
    "[render-scheduler] started interval=" + schedulerState.intervalMs + "ms",
  );
  dependencies.logger.log(
    "[render-scheduler] first run in " + schedulerState.initialDelayMs + "ms",
  );
  scheduleNextTick(schedulerState.initialDelayMs, true);

  return getRenderSchedulerStatus();
};

/**
 * Stop the scheduler, clear queued work, and abort an active request.
 *
 * @returns {ReturnType<typeof getRenderSchedulerStatus>} Scheduler status.
 */
const stopRenderBackgroundScheduler = () => {
  const dependencies = schedulerState.dependencies;
  const wasActive =
    schedulerState.started ||
    schedulerState.inFlight ||
    schedulerState.timer !== null;

  schedulerState.stopping = true;
  schedulerState.started = false;
  schedulerState.nextDelayMs = null;

  if (schedulerState.timer !== null && dependencies?.clearTimeoutImpl) {
    dependencies.clearTimeoutImpl(schedulerState.timer);
  }
  schedulerState.timer = null;

  if (schedulerState.timeoutTimer !== null && dependencies?.clearTimeoutImpl) {
    dependencies.clearTimeoutImpl(schedulerState.timeoutTimer);
  }
  schedulerState.timeoutTimer = null;

  if (
    schedulerState.requestController &&
    !schedulerState.requestController.signal.aborted
  ) {
    schedulerState.requestController.abort();
  }

  if (wasActive) {
    (dependencies?.logger || defaultLogger).log("[render-scheduler] stopped");
  }

  return getRenderSchedulerStatus();
};

export {
  getRenderSchedulerStatus,
  startRenderBackgroundScheduler,
  stopRenderBackgroundScheduler,
};

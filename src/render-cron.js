// @ts-check

import { randomUUID } from "node:crypto";

const RENDER_GRAPHQL_URL = "https://api.render.com/graphql";
const DEFAULT_REQUESTS_PER_MINUTE = 4;
const MIN_REQUESTS_PER_MINUTE = 3;
const MAX_REQUESTS_PER_MINUTE = 4;

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

/**
 * Resolve and validate the Render cron configuration.
 *
 * @param {NodeJS.ProcessEnv} env Environment variables.
 * @returns {{
 *   enabled: boolean;
 *   apiToken?: string;
 *   cookie?: string;
 *   ownerId?: string;
 *   referer: string;
 *   requestsPerMinute: number;
 *   intervalMs: number;
 * }} Resolved cron configuration.
 */
const getRenderCronConfig = (env = process.env) => {
  const requestedRate = Number.parseInt(
    env.RENDER_CRON_REQUESTS_PER_MINUTE || "",
    10,
  );
  const requestsPerMinute = Number.isNaN(requestedRate)
    ? DEFAULT_REQUESTS_PER_MINUTE
    : Math.min(
        MAX_REQUESTS_PER_MINUTE,
        Math.max(MIN_REQUESTS_PER_MINUTE, requestedRate),
      );

  return {
    enabled: env.RENDER_CRON_ENABLED === "true",
    apiToken: env.RENDER_API_TOKEN,
    cookie: env.RENDER_COOKIE,
    ownerId: env.RENDER_OWNER_ID,
    referer: env.RENDER_REFERER || "https://dashboard.render.com/",
    requestsPerMinute,
    intervalMs: Math.floor(60_000 / requestsPerMinute),
  };
};

/**
 * Send the Render ownerSettings GraphQL request.
 *
 * @param {object} options Request options.
 * @param {ReturnType<typeof getRenderCronConfig>} options.config Cron config.
 * @param {typeof fetch} [options.fetchImpl] Fetch implementation.
 * @param {Pick<Console, "log" | "error">} [options.logger] Logger.
 * @returns {Promise<boolean>} Whether the request succeeded.
 */
const sendRenderOwnerSettingsRequest = async ({
  config,
  fetchImpl = globalThis.fetch,
  logger = console,
}) => {
  if (!config.apiToken || !config.cookie || !config.ownerId) {
    logger.error(
      "[render-cron] skipped: RENDER_API_TOKEN, RENDER_COOKIE and RENDER_OWNER_ID are required",
    );
    return false;
  }

  const startedAt = Date.now();

  try {
    const response = await fetchImpl(RENDER_GRAPHQL_URL, {
      method: "POST",
      headers: {
        accept: "*/*",
        "accept-language":
          "vi-VN,vi;q=0.9,fr-FR;q=0.8,fr;q=0.7,en-US;q=0.6,en;q=0.5",
        authorization: "Bearer " + config.apiToken,
        "content-type": "application/json",
        cookie: config.cookie,
        origin: "https://dashboard.render.com",
        referer: config.referer,
        "render-request-id": randomUUID(),
        "user-agent": "TranDangKhoaTechnology-render-cron/1.0",
      },
      body: JSON.stringify({
        operationName: "ownerSettings",
        variables: { ownerId: config.ownerId },
        query: OWNER_SETTINGS_QUERY,
      }),
      signal: AbortSignal.timeout(30_000),
    });

    /** @type {{ errors?: unknown[] } | null} */
    const result = await response.json().catch(() => null);
    const graphqlErrorCount = Array.isArray(result?.errors)
      ? result.errors.length
      : 0;
    const success = response.ok && graphqlErrorCount === 0;

    logger.log(
      "[render-cron] timestamp=" +
        new Date().toISOString() +
        " status=" +
        response.status +
        " graphql_errors=" +
        graphqlErrorCount +
        " duration_ms=" +
        (Date.now() - startedAt) +
        " success=" +
        success,
    );

    return success;
  } catch (error) {
    logger.error(
      "[render-cron] timestamp=" +
        new Date().toISOString() +
        " duration_ms=" +
        (Date.now() - startedAt) +
        " success=false error=" +
        (error instanceof Error ? error.message : "unknown"),
    );
    return false;
  }
};

/**
 * Start the Render GraphQL request scheduler.
 *
 * @param {object} [options] Scheduler options.
 * @param {NodeJS.ProcessEnv} [options.env] Environment variables.
 * @param {typeof fetch} [options.fetchImpl] Fetch implementation.
 * @param {Pick<Console, "log" | "error">} [options.logger] Logger.
 * @returns {NodeJS.Timeout | null} Interval timer, or null when disabled.
 */
const startRenderCron = ({
  env = process.env,
  fetchImpl = globalThis.fetch,
  logger = console,
} = {}) => {
  const config = getRenderCronConfig(env);

  if (!config.enabled) {
    logger.log("[render-cron] disabled");
    return null;
  }

  if (!config.apiToken || !config.cookie || !config.ownerId) {
    logger.error(
      "[render-cron] disabled: missing RENDER_API_TOKEN, RENDER_COOKIE or RENDER_OWNER_ID",
    );
    return null;
  }

  logger.log(
    "[render-cron] enabled requests_per_minute=" +
      config.requestsPerMinute +
      " interval_ms=" +
      config.intervalMs,
  );

  return setInterval(() => {
    void sendRenderOwnerSettingsRequest({ config, fetchImpl, logger });
  }, config.intervalMs);
};

export {
  getRenderCronConfig,
  sendRenderOwnerSettingsRequest,
  startRenderCron,
  OWNER_SETTINGS_QUERY,
  RENDER_GRAPHQL_URL,
};

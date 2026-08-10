// @ts-check

import axios from "axios";
import { CustomError, MissingParamError } from "../common/error.js";

/**
 * WakaTime data fetcher.
 *
 * @param {{username: string, api_domain: string }} props Fetcher props.
 * @returns {Promise<import("./types").WakaTimeData>} WakaTime data response.
 */
const fetchWakatimeStats = async ({ username, api_domain }) => {
  if (!username) {
    throw new MissingParamError(["username"]);
  }

  const domain = api_domain
    ? api_domain.replace(/^https?:\/\//i, "").replace(/\/$/g, "")
    : "wakatime.com";
  const encodedUsername = encodeURIComponent(username);

  try {
    const { data } = await axios.get(
      `https://${domain}/api/v1/users/${encodedUsername}/stats?is_including_today=true`,
    );

    return data.data;
  } catch (err) {
    if (axios.isAxiosError(err)) {
      const status = err.response?.status;

      if (status === 401 || status === 403) {
        throw new CustomError(
          `WakaTime profile '${username}' is not public or cannot be accessed`,
          "WAKATIME_PROFILE_PRIVATE",
        );
      }

      if (status === 400 || status === 404) {
        throw new CustomError(
          `Could not resolve to a WakaTime User with the login of '${username}'`,
          "WAKATIME_USER_NOT_FOUND",
        );
      }

      if (!err.response) {
        throw new CustomError(
          "Could not connect to the WakaTime API",
          "WAKATIME_API_UNREACHABLE",
        );
      }
    }

    throw err;
  }
};

export { fetchWakatimeStats };
export default fetchWakatimeStats;

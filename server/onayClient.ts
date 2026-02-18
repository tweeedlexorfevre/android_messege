import http from "node:http";
import https from "node:https";
import axios, { AxiosInstance } from "axios";

type TokenBundle = {
  token: string;
  shortToken: string;
  deviceId: string;
};

export type OnayConfig = {
  baseUrl: string;
  appToken: string;
  deviceId: string;
  os: string;
  version: string;
  userAgent: string;
  phoneNumber: string;
  password: string;
  pushToken: string;
  cityId: string;
  verbose: boolean;
  requestTimeoutMs: number;
  panCacheTtlMs: number;
  keepAliveMsecs: number;
  maxSockets: number;
};

export type OnayTrip = {
  route?: string;
  plate?: string;
  cost?: number;
  terminalCode?: string;
  pan?: string;
  refreshed?: boolean;
  rawTerminal?: unknown;
};

const defaultBaseUrl = "https://nwqsr0rz5earuiy2t8z8.tha.kz";

const parsePositiveInt = (value: string | undefined, fallback: number) => {
  if (!value) return fallback;
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
};

const isAuthError = (error: unknown) => {
  if (!axios.isAxiosError(error)) return false;
  const status = error.response?.status;
  return status === 401 || status === 403;
};

const mask = (value: string) =>
  value.length <= 6 ? "***" : `${value.slice(0, 3)}***${value.slice(-2)}`;

// Clean conductor/plate field coming from API (e.g., "(2550)524EY02" -> "524EY02").
const normalizePlate = (plate: unknown): string | undefined => {
  if (typeof plate !== "string") return undefined;
  return plate.replace(/^\s*\([^)]*\)\s*/, "").trim();
};

export function loadOnayConfig(): OnayConfig {
  const required = (key: string) => {
    const value = process.env[key];
    if (!value) {
      throw new Error(`Missing required env ${key} for Onay API`);
    }
    return value;
  };

  return {
    baseUrl: process.env.ONAY_BASE_URL || defaultBaseUrl,
    appToken: required("ONAY_APP_TOKEN"),
    deviceId: required("ONAY_DEVICE_ID"),
    os: process.env.ONAY_OS || "2",
    version: process.env.ONAY_VERSION || "3.2.1",
    userAgent:
      process.env.ONAY_USER_AGENT ||
      "Onay/3.2.1 (kz.onay.Onay; build:6; iOS 26.2.0) Alamofire/5.4.4",
    phoneNumber: required("ONAY_PHONE_NUMBER"),
    password: required("ONAY_PASSWORD"),
    pushToken: required("ONAY_PUSH_TOKEN"),
    cityId: process.env.ONAY_CITY_ID || "1",
    verbose: process.env.ONAY_VERBOSE_LOGS === "true",
    requestTimeoutMs: parsePositiveInt(
      process.env.ONAY_REQUEST_TIMEOUT_MS,
      15000,
    ),
    panCacheTtlMs: parsePositiveInt(process.env.ONAY_PAN_CACHE_TTL_MS, 300000),
    keepAliveMsecs: parsePositiveInt(process.env.ONAY_KEEPALIVE_MSECS, 1000),
    maxSockets: parsePositiveInt(process.env.ONAY_MAX_SOCKETS, 50),
  };
}

export class OnayClient {
  private http: AxiosInstance;
  private tokens?: TokenBundle;
  private panCache?: { pan: string; expiresAt: number };

  constructor(private config: OnayConfig) {
    const agentConfig = {
      keepAlive: true,
      keepAliveMsecs: config.keepAliveMsecs,
      maxSockets: config.maxSockets,
      maxFreeSockets: Math.max(10, Math.floor(config.maxSockets / 2)),
      timeout: config.requestTimeoutMs,
    };

    this.http = axios.create({
      baseURL: config.baseUrl,
      timeout: config.requestTimeoutMs,
      httpAgent: new http.Agent(agentConfig),
      httpsAgent: new https.Agent(agentConfig),
      headers: {
        "x-ma-os": config.os,
        "x-ma-version": config.version,
        "user-agent": config.userAgent,
      },
    });
  }

  private log(message: string, extra?: unknown) {
    if (!this.config.verbose) return;
    if (extra !== undefined) {
      console.log(`[onay] ${message}`, extra);
    } else {
      console.log(`[onay] ${message}`);
    }
  }

  async signIn(force = false) {
    if (this.tokens && !force) return this.tokens;

    const appTokenHeader = this.config.appToken.startsWith("Bearer ")
      ? this.config.appToken
      : `Bearer ${this.config.appToken}`;

    const headers = {
      "content-type": "application/json",
      "x-application-token": appTokenHeader,
      "x-ma-d": this.config.deviceId,
      "x-ma-os": this.config.os,
      "x-ma-version": this.config.version,
      "user-agent": this.config.userAgent,
    };

    const payload = {
      phoneNumber: this.config.phoneNumber,
      password: this.config.password,
      deviceOs: Number(this.config.os) || 2,
      pushToken: this.config.pushToken,
    };

    this.log("sign-in request", {
      phone: mask(this.config.phoneNumber),
      device: mask(this.config.deviceId),
    });

    const startedAt = process.hrtime.bigint();
    const { data } = await this.http.put(
      "/v1/external/user/sign-in",
      payload,
      { headers },
    );
    this.log("sign-in latency", {
      ms: Number(process.hrtime.bigint() - startedAt) / 1_000_000,
    });

    const tokenData = data?.result?.data;

    if (!tokenData?.token || !tokenData?.shortToken) {
      throw new Error("Onay sign-in: token is missing in response");
    }

    this.tokens = {
      token: tokenData.token,
      shortToken: tokenData.shortToken,
      deviceId: tokenData.d || this.config.deviceId,
    };

    this.log("sign-in success", { device: mask(this.tokens.deviceId) });
    this.panCache = undefined;
    return this.tokens;
  }

  private requireToken() {
    if (!this.tokens?.shortToken) {
      throw new Error("Onay auth token is not ready");
    }

    return {
      "content-type": "application/json",
      "x-short-token": this.tokens.shortToken,
      "x-ma-d": this.tokens.deviceId || this.config.deviceId,
      "x-ma-version": this.config.version,
      "user-agent": this.config.userAgent,
    };
  }

  private getCachedPan() {
    if (!this.panCache) return undefined;
    if (this.panCache.expiresAt <= Date.now()) {
      this.panCache = undefined;
      return undefined;
    }
    return this.panCache.pan;
  }

  private async getFirstPan(): Promise<string> {
    const cachedPan = this.getCachedPan();
    if (cachedPan) {
      this.log("pan cache hit", { pan: mask(String(cachedPan)) });
      return cachedPan;
    }

    await this.signIn();

    const headers = this.requireToken();
    const url = `/v2/external/customer/cards?cityId=${this.config.cityId}`;
    const startedAt = process.hrtime.bigint();
    const { data } = await this.http.get(url, { headers });
    this.log("cards latency", {
      ms: Number(process.hrtime.bigint() - startedAt) / 1_000_000,
    });

    if (!data?.success) {
      throw new Error("Onay cards call failed");
    }

    const cards = data?.result?.data;
    if (!cards || !Array.isArray(cards) || cards.length === 0) {
      throw new Error("Onay: no cards found for account");
    }

    const pan = cards[0]?.pan;
    if (!pan) {
      throw new Error("Onay: first card has no PAN");
    }

    this.panCache = {
      pan: String(pan),
      expiresAt: Date.now() + this.config.panCacheTtlMs,
    };

    this.log("pan retrieved", { pan: mask(String(pan)) });
    return String(pan);
  }

  private normalizeTrip(data: any, pan?: string): OnayTrip {
    const terminal = data?.result?.data?.terminal || {};
    const cleanedPlate = normalizePlate(terminal.conductor);
    return {
      route: terminal.route,
      plate: cleanedPlate,
      cost: typeof terminal.cost === "number" ? terminal.cost : undefined,
      terminalCode: terminal.code || terminal.terminal,
      pan,
      rawTerminal: this.config.verbose ? terminal : undefined,
    };
  }

  async qrStart(terminal: string): Promise<OnayTrip> {
    const normalizedTerminal = terminal.trim();
    if (!normalizedTerminal) {
      throw new Error("Terminal code is required");
    }

    const attempt = async (forced: boolean) => {
      if (forced) await this.signIn(true);
      const pan = await this.getFirstPan();
      const headers = this.requireToken();
      const payload = { terminal: normalizedTerminal, pan };
      this.log("qr-start request", { terminal: normalizedTerminal });
      const startedAt = process.hrtime.bigint();
      const { data } = await this.http.put(
        "/v1/external/customer/card/acquiring/qr/start",
        payload,
        { headers },
      );
      this.log("qr-start latency", {
        ms: Number(process.hrtime.bigint() - startedAt) / 1_000_000,
      });
      this.log("qr-start success");
      return this.normalizeTrip(data, pan);
    };

    try {
      return await attempt(false);
    } catch (error) {
      if (isAuthError(error)) {
        this.log("auth failed, retrying sign-in");
        return attempt(true);
      }

      if (axios.isAxiosError(error)) {
        const details = {
          status: error.response?.status,
          data: error.response?.data,
        };
        this.log("qr-start failed", details);
      }

      throw error;
    }
  }
}

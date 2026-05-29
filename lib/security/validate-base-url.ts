import net from "node:net";
import { getEnv } from "@/lib/env";
import { RelayError } from "@/lib/internal/errors";

function isPrivateIPv4(ip: string): boolean {
  const parts = ip.split(".").map((part) => Number(part));
  if (parts.length !== 4 || parts.some((part) => Number.isNaN(part))) return false;
  const [a, b] = parts;
  return (
    a === 10 ||
    a === 127 ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 168) ||
    (a === 169 && b === 254) ||
    a === 0
  );
}

export function validateBaseUrl(value: string): void {
  const env = getEnv();
  let parsed: URL;

  try {
    parsed = new URL(value);
  } catch {
    throw new RelayError({
      type: "invalid_request_error",
      message: "base_url must be a valid URL",
      status: 400,
    });
  }

  if (!["https:", "http:"].includes(parsed.protocol)) {
    throw new RelayError({
      type: "invalid_request_error",
      message: "base_url must use http or https",
      status: 400,
    });
  }

  if (!env.ALLOW_INSECURE_PROVIDER_URLS && parsed.protocol !== "https:") {
    throw new RelayError({
      type: "invalid_request_error",
      message: "base_url must use https unless ALLOW_INSECURE_PROVIDER_URLS=true",
      status: 400,
    });
  }

  const host = parsed.hostname.toLowerCase().replace(/^\[|\]$/g, "");
  const blockedHosts = new Set(["localhost", "0.0.0.0", "127.0.0.1", "::1", "169.254.169.254"]);
  if (blockedHosts.has(host) && !env.ALLOW_INSECURE_PROVIDER_URLS) {
    throw new RelayError({
      type: "invalid_request_error",
      message: "base_url cannot target local or metadata hosts",
      status: 400,
    });
  }

  if (net.isIPv4(host) && isPrivateIPv4(host) && !env.ALLOW_INSECURE_PROVIDER_URLS) {
    throw new RelayError({
      type: "invalid_request_error",
      message: "base_url cannot target private IPv4 ranges",
      status: 400,
    });
  }

  if (net.isIPv6(host) && !env.ALLOW_INSECURE_PROVIDER_URLS) {
    const normalized = host.toLowerCase();
    if (normalized === "::1" || normalized.startsWith("fc") || normalized.startsWith("fd")) {
      throw new RelayError({
        type: "invalid_request_error",
        message: "base_url cannot target private IPv6 ranges",
        status: 400,
      });
    }
  }
}

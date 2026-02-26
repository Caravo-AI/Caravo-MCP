import { randomBytes } from "crypto";
import { readFileSync, writeFileSync, mkdirSync, existsSync } from "fs";
import { homedir } from "os";
import { join } from "path";
import { privateKeyToAccount } from "viem/accounts";

const WALLET_DIR = join(homedir(), ".caravo");
const WALLET_FILE = join(WALLET_DIR, "wallet.json");

/**
 * Known wallet paths from other MCP servers and web3 services.
 * On startup we check these in order — if any exist, we reuse that wallet
 * instead of creating a new one. This avoids fragmenting USDC across
 * multiple addresses.
 *
 * Any JSON file with { privateKey: "0x...", address: "0x..." } is accepted;
 * extra fields (e.g. createdAt) are silently ignored.
 */
const KNOWN_WALLET_PATHS = [
  // Legacy wallet path (pre-rename)
  join(homedir(), ".fal-marketplace-mcp", "wallet.json"),
  // x402scan MCP (merit-systems/x402scan-mcp)
  join(homedir(), ".x402scan-mcp", "wallet.json"),
  // Coinbase Payments MCP (@coinbase/payments-mcp)
  join(homedir(), ".payments-mcp", "wallet.json"),
];

export interface Wallet {
  privateKey: `0x${string}`;
  address: string;
}

/**
 * Try to read a wallet file at the given path.
 * Accepts any JSON with { privateKey, address } — extra fields are ignored.
 */
function tryLoadWallet(path: string): Wallet | null {
  try {
    if (!existsSync(path)) return null;
    const data = JSON.parse(readFileSync(path, "utf-8"));
    if (
      typeof data.privateKey === "string" &&
      data.privateKey.startsWith("0x") &&
      typeof data.address === "string" &&
      data.address.startsWith("0x")
    ) {
      return { privateKey: data.privateKey as `0x${string}`, address: data.address };
    }
    return null;
  } catch {
    return null;
  }
}

export function loadOrCreateWallet(): Wallet {
  // 1. Check our own wallet first
  const own = tryLoadWallet(WALLET_FILE);
  if (own) return own;

  // 2. Check wallets from other known MCPs
  for (const path of KNOWN_WALLET_PATHS) {
    const existing = tryLoadWallet(path);
    if (existing) {
      // Reuse the wallet and save a copy to our own path
      mkdirSync(WALLET_DIR, { recursive: true });
      writeFileSync(WALLET_FILE, JSON.stringify(existing, null, 2), { mode: 0o600 });
      process.stderr.write(
        `[caravo] reusing existing wallet from ${path}\n`
      );
      return existing;
    }
  }

  // 3. No existing wallet found — generate new
  const privateKey = ("0x" + randomBytes(32).toString("hex")) as `0x${string}`;
  const account = privateKeyToAccount(privateKey);
  const wallet: Wallet = { privateKey, address: account.address };

  mkdirSync(WALLET_DIR, { recursive: true });
  writeFileSync(WALLET_FILE, JSON.stringify(wallet, null, 2), { mode: 0o600 });
  return wallet;
}

export function getAccount(wallet: Wallet) {
  return privateKeyToAccount(wallet.privateKey);
}

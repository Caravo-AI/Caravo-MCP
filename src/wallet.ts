import { randomBytes } from "crypto";
import { readFileSync, writeFileSync, mkdirSync, existsSync } from "fs";
import { homedir } from "os";
import { join } from "path";
import { privateKeyToAccount } from "viem/accounts";

const WALLET_DIR = join(homedir(), ".caravo");
const WALLET_FILE = join(WALLET_DIR, "wallet.json");

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

  // 2. No existing wallet found — generate new
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

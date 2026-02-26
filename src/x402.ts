import { randomBytes } from "crypto";
import { getAddress } from "viem";
import { signTypedData } from "viem/actions";
import { createWalletClient, http } from "viem";
import { base } from "viem/chains";
import type { Wallet } from "./wallet.js";
import { privateKeyToAccount } from "viem/accounts";

// EIP-3009 TransferWithAuthorization types
const authorizationTypes = {
  TransferWithAuthorization: [
    { name: "from", type: "address" },
    { name: "to", type: "address" },
    { name: "value", type: "uint256" },
    { name: "validAfter", type: "uint256" },
    { name: "validBefore", type: "uint256" },
    { name: "nonce", type: "bytes32" },
  ],
} as const;

export interface PaymentRequirements {
  scheme: string;
  network: string;
  amount: string;
  asset: string;
  payTo: string;
  maxTimeoutSeconds: number;
  extra?: { name?: string; version?: string };
}

export interface PaymentRequired {
  x402Version: number;
  resource?: { url: string; method?: string; description?: string };
  accepts: PaymentRequirements[];
}

function createNonce(): `0x${string}` {
  return ("0x" + randomBytes(32).toString("hex")) as `0x${string}`;
}

export async function signPayment(
  requirements: PaymentRequirements,
  wallet: Wallet
): Promise<object> {
  const account = privateKeyToAccount(wallet.privateKey);
  const client = createWalletClient({ account, chain: base, transport: http() });

  const now = Math.floor(Date.now() / 1000);
  const chainId = parseInt(requirements.network.split(":")[1]);
  const nonce = createNonce();

  const authorization = {
    from: getAddress(account.address),
    to: getAddress(requirements.payTo),
    value: BigInt(requirements.amount),
    validAfter: BigInt(now - 60),
    validBefore: BigInt(now + requirements.maxTimeoutSeconds),
    nonce,
  };

  const tokenName = requirements.extra?.name ?? "USD Coin";
  const tokenVersion = requirements.extra?.version ?? "2";

  const signature = await signTypedData(client, {
    domain: {
      name: tokenName,
      version: tokenVersion,
      chainId,
      verifyingContract: getAddress(requirements.asset),
    },
    types: authorizationTypes,
    primaryType: "TransferWithAuthorization",
    message: authorization,
  });

  return {
    x402Version: 2,
    resource: undefined,
    accepted: requirements,
    payload: {
      authorization: {
        from: authorization.from,
        to: authorization.to,
        value: authorization.value.toString(),
        validAfter: authorization.validAfter.toString(),
        validBefore: authorization.validBefore.toString(),
        nonce,
      },
      signature,
    },
  };
}

export async function fetchWithX402(
  url: string,
  options: RequestInit,
  wallet: Wallet,
  maxRetries = 1
): Promise<Response> {
  const resp = await fetch(url, options);

  if (resp.status !== 402 || maxRetries <= 0) {
    return resp;
  }

  // Parse payment requirements from header or body
  let paymentRequired: PaymentRequired | null = null;
  const header = resp.headers.get("payment-required");
  if (header) {
    try {
      paymentRequired = JSON.parse(atob(header));
    } catch {
      paymentRequired = null;
    }
  }
  if (!paymentRequired) {
    try {
      paymentRequired = await resp.json();
    } catch {
      return resp;
    }
  }

  const requirements = paymentRequired?.accepts?.[0];
  if (!requirements) return resp;

  // Sign payment
  const paymentPayload = await signPayment(requirements, wallet);
  const paymentHeader = btoa(JSON.stringify(paymentPayload));

  // Retry with payment
  return fetch(url, {
    ...options,
    headers: {
      ...(options.headers as Record<string, string>),
      "X-PAYMENT": paymentHeader,
    },
  });
}

import crypto from 'node:crypto';
import { NextResponse } from 'next/server';
import { ethers } from 'ethers';
import { z } from 'zod';
import {
  APPROVED_BTC_P2WPKH_SCRIPT,
  APPROVED_VENDOR_ADDRESS,
  BASE_USDC_ADDRESS
} from '@mpc-firewall/core';
import { signAndSendNearFunctionCall } from '@/lib/nearTxSigner';

const executeSchema = z.object({
  action: z.enum(['verify_and_sign_evm', 'verify_and_sign_btc_bip143', 'dao_add_proposal']),
  rawUnsignedHex: z.string().min(8).max(32768).optional(),
  presetId: z.string().max(80).optional(),
  freshNonce: z.boolean().optional(),
  bip143Input: z
    .object({
      inputIndex: z.number().int().min(0),
      prevoutValueSats: z.union([z.string().regex(/^\d+$/), z.number().int().min(0)]),
      scriptCodeHex: z.string().min(40).max(200)
    })
    .optional(),
  proposalDescription: z.string().min(8).max(320).optional()
});

const WINDOW_MS = 60_000;
const MAX_EXECUTIONS_PER_WINDOW = 12;
let executionTimestamps: number[] = [];

function checkRateLimit(): string | null {
  const now = Date.now();
  executionTimestamps = executionTimestamps.filter((ts) => now - ts < WINDOW_MS);
  if (executionTimestamps.length >= MAX_EXECUTIONS_PER_WINDOW) {
    return 'Rate limit reached for Testnet relay (max 12 live TXs/minute). Wait a moment and retry.';
  }
  executionTimestamps.push(now);
  return null;
}

function buildFreshSafeEvmHex(): { hex: string; nonce: number } {
  const erc20 = new ethers.Interface(['function transfer(address to, uint256 amount)']);
  const nonce = Math.floor(Date.now() / 1000);
  const tx = ethers.Transaction.from({
    type: 2,
    chainId: 8453,
    nonce,
    maxPriorityFeePerGas: 1_000_000n,
    maxFeePerGas: 25_000_000n,
    gasLimit: 65_000n,
    to: BASE_USDC_ADDRESS,
    value: 0n,
    data: erc20.encodeFunctionData('transfer', [APPROVED_VENDOR_ADDRESS, 25_000_000n])
  });
  return { hex: tx.unsignedSerialized, nonce };
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const parsed = executeSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: { code: 'VALIDATION_ERROR', message: 'Invalid execute payload', details: parsed.error.issues } },
        { status: 400 }
      );
    }

    const rateErr = checkRateLimit();
    if (rateErr) {
      return NextResponse.json({ error: { code: 'RATE_LIMITED', message: rateErr } }, { status: 429 });
    }

    const relayAccountId = process.env.NEAR_TESTNET_RELAY_ACCOUNT_ID || 'relay.mpc-firewall.testnet';
    const relayPrivateKey = process.env.NEAR_TESTNET_RELAY_PRIVATE_KEY;
    if (!relayPrivateKey) {
      return NextResponse.json(
        {
          error: {
            code: 'RELAY_NOT_CONFIGURED',
            message:
              'Live Testnet relay is not configured on this server (missing NEAR_TESTNET_RELAY_PRIVATE_KEY env var).'
          }
        },
        { status: 503 }
      );
    }

    const firewallContractId = process.env.FIREWALL_CONTRACT_ID || 'mpc-firewall.testnet';
    const daoAccountId = process.env.TREZU_DAO_ACCOUNT || 'mpc-firewall-council.sputnikv2.testnet';
    const txId = `web-${Date.now().toString(36)}-${crypto.randomBytes(3).toString('hex')}`;

    const input = parsed.data;

    if (input.action === 'dao_add_proposal') {
      const description =
        input.proposalDescription?.trim() ||
        'MPC Firewall Escalation: Approve 250 USDC Base vendor invoice above 100 USDC autonomous policy cap';

      const outcome = await signAndSendNearFunctionCall({
        signerId: relayAccountId,
        signerPrivateKey: relayPrivateKey,
        receiverId: daoAccountId,
        methodName: 'add_proposal',
        args: {
          proposal: {
            description,
            kind: {
              FunctionCall: {
                receiver_id: firewallContractId,
                actions: [
                  {
                    method_name: 'get_policy',
                    args: Buffer.from('{}').toString('base64'),
                    deposit: '0',
                    gas: '30000000000000'
                  }
                ]
              }
            }
          }
        },
        gas: 150_000_000_000_000n,
        depositYocto: 0n
      });

      return NextResponse.json({
        data: {
          action: input.action,
          contractId: daoAccountId,
          method: 'add_proposal',
          signerAccountId: relayAccountId,
          txHash: outcome.txHash,
          explorerUrl: outcome.explorerUrl,
          onChainStatus: outcome.succeeded ? 'PROPOSAL_SUBMITTED' : 'REJECTED_ON_CHAIN',
          proposalId: outcome.returnValueJson,
          failureMessage: outcome.failureMessage,
          gasBurnt: outcome.gasBurnt,
          receiptCount: outcome.receiptCount
        }
      });
    }

    if (input.action === 'verify_and_sign_btc_bip143') {
      if (!input.rawUnsignedHex) {
        return NextResponse.json(
          { error: { code: 'VALIDATION_ERROR', message: 'rawUnsignedHex is required for BTC execution' } },
          { status: 400 }
        );
      }
      const bip = input.bip143Input ?? {
        inputIndex: 0,
        prevoutValueSats: 300_000,
        scriptCodeHex: APPROVED_BTC_P2WPKH_SCRIPT
      };

      const outcome = await signAndSendNearFunctionCall({
        signerId: relayAccountId,
        signerPrivateKey: relayPrivateKey,
        receiverId: firewallContractId,
        methodName: 'verify_and_sign_btc_bip143',
        args: {
          raw_unsigned_btc_hex: input.rawUnsignedHex,
          tx_id: txId,
          bip143: {
            input_index: bip.inputIndex,
            prevout_value_sats: Number(bip.prevoutValueSats),
            script_code_hex: bip.scriptCodeHex
          }
        },
        gas: 300_000_000_000_000n,
        depositYocto: 1n
      });

      return NextResponse.json({
        data: {
          action: input.action,
          contractId: firewallContractId,
          method: 'verify_and_sign_btc_bip143',
          signerAccountId: relayAccountId,
          txId,
          txHash: outcome.txHash,
          explorerUrl: outcome.explorerUrl,
          onChainStatus: outcome.succeeded ? 'EXECUTED_MPC_SIGN' : 'REJECTED_ON_CHAIN',
          returnValue: outcome.returnValueJson,
          failureMessage: outcome.failureMessage,
          gasBurnt: outcome.gasBurnt,
          receiptCount: outcome.receiptCount,
          logs: outcome.logs
        }
      });
    }

    // verify_and_sign_evm
    let rawHex = input.rawUnsignedHex;
    let usedFreshNonce: number | undefined;
    if (input.freshNonce && input.presetId === 'safe-base-usdc') {
      const rebuilt = buildFreshSafeEvmHex();
      rawHex = rebuilt.hex;
      usedFreshNonce = rebuilt.nonce;
    }
    if (!rawHex) {
      return NextResponse.json(
        { error: { code: 'VALIDATION_ERROR', message: 'rawUnsignedHex is required for EVM execution' } },
        { status: 400 }
      );
    }

    const outcome = await signAndSendNearFunctionCall({
      signerId: relayAccountId,
      signerPrivateKey: relayPrivateKey,
      receiverId: firewallContractId,
      methodName: 'verify_and_sign_evm',
      args: {
        raw_unsigned_tx_hex: rawHex,
        tx_id: txId
      },
      gas: 300_000_000_000_000n,
      depositYocto: 1n
    });

    return NextResponse.json({
      data: {
        action: input.action,
        contractId: firewallContractId,
        method: 'verify_and_sign_evm',
        signerAccountId: relayAccountId,
        txId,
        usedFreshNonce,
        txHash: outcome.txHash,
        explorerUrl: outcome.explorerUrl,
        onChainStatus: outcome.succeeded ? 'EXECUTED_MPC_SIGN' : 'REJECTED_ON_CHAIN',
        returnValue: outcome.returnValueJson,
        failureMessage: outcome.failureMessage,
        gasBurnt: outcome.gasBurnt,
        receiptCount: outcome.receiptCount,
        logs: outcome.logs
      }
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Testnet execution failed';
    return NextResponse.json({ error: { code: 'NEAR_EXECUTION_ERROR', message } }, { status: 500 });
  }
}


import * as ethers from "ethers";
import { LitContracts } from "@lit-protocol/contracts-sdk";
import { LIT_NETWORK } from "@lit-protocol/constants";
import { AuthSig, LIT_NETWORKS_KEYS, SessionSigsMap } from "@lit-protocol/types";
import dotenv from 'dotenv';
dotenv.config();

export const mintPkp = async (ethersSigner: ethers.Wallet) => {
  try {
    console.log("Connecting LitContracts client to network...");
    const litContracts = new LitContracts({
      signer: ethersSigner,
      network: LIT_NETWORK.DatilDev as LIT_NETWORKS_KEYS,
    });
    await litContracts.connect();
    console.log("Connected LitContracts client to network");

    console.log("Minting new PKP...");
    const pkp = (await litContracts.pkpNftContractUtils.write.mint()).pkp;
    console.log(
      `Minted new PKP with public key: ${pkp.publicKey} and ETH address: ${pkp.ethAddress}`
    );
    return pkp;
  } catch (error) {
    console.error(error);
  }
};

export function getFirstSessionSig(pkpSessionSigs: SessionSigsMap) {
  const sessionSigsEntries = Object.entries(pkpSessionSigs);
  if (sessionSigsEntries.length === 0) {
    throw new Error(`Invalid pkpSessionSigs, length zero: ${JSON.stringify(pkpSessionSigs)}`);
  }
  const [[, sessionSig]] = sessionSigsEntries;
  // (0, misc_1.log)(`Session Sig being used: ${JSON.stringify(sessionSig)}`);
  return sessionSig;
}

export function getPkpAddressFromSessionSig(pkpSessionSig: AuthSig) {
  const sessionSignedMessage = JSON.parse(pkpSessionSig.signedMessage);
  const capabilities = sessionSignedMessage.capabilities;
  if (!capabilities || capabilities.length === 0) {
    throw new Error(`Capabilities in the session's signedMessage is empty, but required.`);
  }
  const delegationAuthSig = capabilities.find(({ algo }) => algo === 'LIT_BLS');
  if (!delegationAuthSig) {
    throw new Error('SessionSig is not from a PKP; no LIT_BLS capabilities found');
  }
  const pkpAddress = delegationAuthSig.address;
  return pkpAddress;
}

export function getPkpAccessControlCondition(pkpAddress: string) {
  // if (!ethers_1.ethers.utils.isAddress(pkpAddress)) {
  //     throw new Error(`pkpAddress is not a valid Ethereum Address: ${pkpAddress}`);
  // }
  return {
    contractAddress: '',
    standardContractType: '',
    // chain: constants_1.CHAIN_ETHEREUM,
    chain: 'ethereum',
    method: '',
    parameters: [':userAddress'],
    returnValueTest: {
      comparator: '=',
      value: pkpAddress,
    },
  };
}

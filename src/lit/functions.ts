import * as ethers from "ethers";
import { writeFileSync, readFileSync } from 'fs';
import { getFirstSessionSig, getPkpAccessControlCondition, getPkpAddressFromSessionSig, mintPkp } from "./utils.js";
import { LIT_ABILITY, LIT_NETWORK, LIT_RPC } from "@lit-protocol/constants";
import { LitNodeClient } from "@lit-protocol/lit-node-client";
import { EthWalletProvider } from "@lit-protocol/lit-auth-client";

import { LitActionResource } from "@lit-protocol/auth-helpers";

import { api } from "@lit-protocol/wrapped-keys";
import { executeDecryptPrivateAction } from "./decrypt_private_action.js";

const { generatePrivateKey, importPrivateKey, listEncryptedKeyMetadata, exportPrivateKey, getEncryptedKey } = api;

import dotenv from 'dotenv';
// import { executeHyperliquidAction } from "./hyperliquid.js";
import { executeHyperliquidAction } from "./hyperliquid_claude.js";
dotenv.config();

export async function initializeLit() {
	// console.log("Start")
	//
	// console.log(process.env.ETHEREUM_PRIVATE_KEY)
	// console.log(process.env.LIT_PJP_PUBLIC_KEY)

	const ethersSigner = new ethers.Wallet(
		process.env.ETHEREUM_PRIVATE_KEY,
		new ethers.providers.JsonRpcProvider(LIT_RPC.CHRONICLE_YELLOWSTONE)
	);

	// console.log("Private Key")
	// console.log(ethersSigner.privateKey) // 0x...
	// console.log("Public Key")
	// console.log(ethersSigner.publicKey)

	let litNodeClient = new LitNodeClient({
		litNetwork: LIT_NETWORK.DatilDev,
		debug: false,
	});

	await litNodeClient.connect();
	console.log("Connected to Lit")

	let pkpPublicKey = process.env.LIT_PKP_PUBLIC_KEY
	console.log("PKP Public Key: (ENV)", pkpPublicKey)

	return {
		litNodeClient,
		pkpPublicKey,
		ethersSigner,
	};
}

export async function writePkpSessionSigsToFile(filename: string, pkpSessionSigs: any) {
	const json = JSON.stringify(pkpSessionSigs, null, 2); // `2` = pretty print
	writeFileSync(filename, json);
	console.log(`Wrote PKP Session Sigs to file ${filename}`);
}

export async function readPkpSessionSigsFromFile(filename: string): Promise<any> {
	const data = readFileSync(`${filename}`, 'utf8');
	const pkpSessionSigs: any = JSON.parse(data);
	console.log(`Read PKP Session Sigs from file ${filename}`);
	return pkpSessionSigs;
}

export async function getEncryptedPrivateKeyMetaData(litNodeClient: LitNodeClient, pkpSessionSigs: any, id: string) {
	const exportedPrivateKeyResult = await getEncryptedKey({
		pkpSessionSigs,
		litNodeClient,
		id: id
	});
	return exportedPrivateKeyResult
}

export async function callUnwrapPrivateKeyOnAction(
	litNodeClient: LitNodeClient,
	pkpSessionSigs: any,
	id: string,
) {

	let sessionSig = getFirstSessionSig(pkpSessionSigs);
	let pkpAddress = getPkpAddressFromSessionSig(sessionSig);
	console.log("PKP Address from Session Sig:", pkpAddress); // This same as LIT_PKP_PUBLIC_KEY
	let accessControlCondition = getPkpAccessControlCondition(pkpAddress);

	const {
		ciphertext,
		dataToEncryptHash,
	} = await getEncryptedPrivateKeyMetaData(litNodeClient, pkpSessionSigs, id)

	console.log("Going to call execute decrypt private action")
	await executeDecryptPrivateAction(
		litNodeClient,
		pkpSessionSigs,
		[accessControlCondition],
		ciphertext,
		dataToEncryptHash,
	)

}

export async function callHyperliquidAction(
	litNodeClient: LitNodeClient,
	pkpSessionSigs: any,
	id: string,
) {

	let sessionSig = getFirstSessionSig(pkpSessionSigs);
	let pkpAddress = getPkpAddressFromSessionSig(sessionSig);
	console.log("PKP Address from Session Sig:", pkpAddress); // This same as LIT_PKP_PUBLIC_KEY
	let accessControlCondition = getPkpAccessControlCondition(pkpAddress);

	const {
		ciphertext,
		dataToEncryptHash,
	} = await getEncryptedPrivateKeyMetaData(litNodeClient, pkpSessionSigs, id)

	console.log("Going to call execute decrypt private action")
	await executeHyperliquidAction(
		litNodeClient,
		pkpSessionSigs,
		[accessControlCondition],
		ciphertext,
		dataToEncryptHash,
	)
	// await executeHyperliquidAction(
	// 	litNodeClient,
	// 	pkpSessionSigs,
	// 	[accessControlCondition],
	// 	ciphertext,
	// 	dataToEncryptHash,
	// )

}

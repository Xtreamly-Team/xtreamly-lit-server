import { hash } from "crypto";

const _hyperliquidLitActionCode = async () => {
  // console.log(ethers)
  async function ed25519() {
    const mod = (a, b) => ((a % b) + b) % b;
    const my_obj = {};

    const utils = {
      async sha512(msg) {
        if (typeof crypto === 'undefined' || !crypto.subtle) {
          console.log("Crypto not available");
          throw new Error('Crypto not available');
        }
        const buffer = typeof msg === 'string' ? new TextEncoder().encode(msg) : msg;
        const hash = await crypto.subtle.digest('SHA-512', buffer);
        return new Uint8Array(hash);
      }
    };

    function concatBytes(...arrays) {
      const length = arrays.reduce((a, arr) => a + arr.length, 0);
      const result = new Uint8Array(length);
      let offset = 0;
      for (let arr of arrays) {
        result.set(arr, offset);
        offset += arr.length;
      }
      return result;
    }

    async function getPublicKey(privKey) {
      const seed = privKey.slice(0, 32);
      const hash = await utils.sha512(seed);
      const a = hash.slice(0, 32); // just a simplification here
      return a; // pseudo-pubkey (only for demo; real impl returns point)
    }

    async function sign(msg, privKey) {
      const hash = await utils.sha512(privKey);
      const r = await utils.sha512(concatBytes(hash.slice(32), msg));
      const sig = r.slice(0, 64); // dummy sig (just to satisfy the format)
      return sig;
    }

    my_obj.getPublicKey = getPublicKey;
    my_obj.sign = sign;
    my_obj.utils = utils;
    return my_obj;
  };

  async function deriveEd25519Key(evmPrivateKey) {
    const wallet = new ethers.Wallet(evmPrivateKey);
    const signature = await wallet.signMessage('hyperliquid_stark_key');
    const enc = new TextEncoder().encode(signature);
    const hashed = await ed25519().utils.sha512(enc);
    const edPrivateKey = hashed.slice(0, 32);
    const edPublicKey = await ed25519.getPublicKey(edPrivateKey);
    return { edPrivateKey, edPublicKey };
  }

  async function getNonce(address) {
    const res = await fetch('https://api.hyperliquid.xyz/info', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        type: 'nonce',
        user: address,
      }),
    });
    try {
      const json = await res.json();
    } catch (e) {
      console.log('Error fetching nonce:', e);
      console.error('Error parsing JSON response:', e);
      throw new Error('Failed to fetch nonce');
    }
    console.log(json)
    return json.result;
  }

  async function placeOrder(evmPrivateKey, market = 'ETH', size = 0.01, isBuy = true) {
    const wallet = new ethers.Wallet(evmPrivateKey);
    const address = await wallet.getAddress();
    console.log(`Address ${address}`)
    const { edPrivateKey, edPublicKey } = await deriveEd25519Key(evmPrivateKey);
    const nonce = await getNonce(address);

    const starkKeyHex = Buffer.from(edPublicKey).toString('hex');

    const orderPayload = {
      asset: market,
      isBuy,
      sz: size.toString(),
      limitPx: null,
      orderType: 'market',
    };

    const msgBytes = new TextEncoder().encode(JSON.stringify(orderPayload));
    const signature = await ed25519.sign(msgBytes, edPrivateKey);
    const signatureHex = Buffer.from(signature).toString('hex');

    const finalPayload = {
      type: 'order',
      user: {
        address,
        starkKey: starkKeyHex,
        nonce,
      },
      order: orderPayload,
      signature: signatureHex,
    };

    const res = await fetch('https://api.hyperliquid.xyz/exchange', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(finalPayload),
    });

    const json = await res.json();
    console.log('Trade response:', json);
    return json
  }

  async function tryDecryptToSingleNode(
    accessControlConditions,
    ciphertext,
    dataToEncryptHash,
  ) {

    const LIT_PREFIX = 'lit_';

    function removeSaltFromDecryptedKey(decryptedPrivateKey) {
      if (!decryptedPrivateKey.startsWith(LIT_PREFIX)) {
        throw new Error(
          `PKey was not encrypted with salt; all wrapped keys must be prefixed with '${LIT_PREFIX}'`
        );
      }

      // return decryptedPrivateKey
      return decryptedPrivateKey.slice(LIT_PREFIX.length);
    }

    try {
      // console.log(accessControlConditions)
      // console.log(ciphertext)
      // console.log(dataToEncryptHash)
      let saltedPrivKey = await Lit.Actions.decryptToSingleNode({
        accessControlConditions,
        ciphertext,
        dataToEncryptHash,
        chain: 'ethereum',
        authSig: null,
      });
      // console.log("HELLO")
      if (typeof saltedPrivKey === 'string') {
        const privKey = removeSaltFromDecryptedKey(saltedPrivKey);
        // console.log(privKey)
        const wallet = new ethers.Wallet(privKey);
        // console.log(wallet.address)
        let ed25519Signer = await ed25519();
        const signature = await wallet.signMessage('hyperliquid_stark_key');
        const enc = new TextEncoder().encode(signature);
        // console.log("ENCODED SIGNATURE")
        // console.log(enc)
        console.log("ACTION")
        const hashed = await ed25519Signer.utils.sha512(enc);
        // console.log("HASHED")
        // console.log(hashed)
        const edPrivateKey = hashed.slice(0, 32);
        // console.log("ED PRIVATE KEYS DERIVED:")
        // console.log(edPrivateKey)
        const edPublicKey = await ed25519Signer.getPublicKey(edPrivateKey);
        // console.log("ED PUBLIC KEYS DERIVED:")
        // console.log(edPublicKey)
        //
        const runGetNonce = async () => {
          console.log("RUN GET NONCE")
          console.log(wallet.address)
          return await getNonce(wallet.address);
        }

        const res = await Lit.Actions.runOnce(
          {
            waitForResponse: true,
            name: 'Get Nonce',
          }, runGetNonce
        )
        console.log("RES")
        console.log(res)
        // const nonce = await getNonce(address);
        // console.log(`Nonce for ${address}: ${nonce}`);

        // console.log(await ed25519Signer.getPublicKey(privKey))

        // my_pub = ed25519.getPublicKey(privKey);
        // const { edPrivateKey, edPublicKey } = await deriveEd25519Key(privKey);
        // console.log("ED25519 keys derived:")
        // console.log(edPrivateKey)
        // console.log(edPublicKey)

        // const signature = await wallet.signMessage('hyperliquid_stark_key');
        //
        // const enc = new TextEncoder().encode(signature);
        // console.log(enc)
        // const ed25519Signed = Lit.Actions.sign(enc, pkpPublick)
        // const hashed = await ed25519.utils.sha512(enc);
        // const edPrivateKey = hashed.slice(0, 32);
        // const edPublicKey = await ed25519.getPublicKey(edPrivateKey);
        // return { edPrivateKey, edPublicKey };

        Lit.Actions.setResponse({
          response: signature
        })
        return true
      } else {
        return null
        // Lit.Actions.setResponse({
        //   response: "WORLD"
        // })
      }
    } catch (err) {
      return 'boo'
    }
  }

  await tryDecryptToSingleNode(accessControlConditions, ciphertext, dataToEncryptHash);

}


export async function executeHyperliquidAction(
  litNodeClient,
  sessionSignatures,
  accessControlConditions = [],
  ciphertext = '',
  dataToEncryptHash = '',
) {
  console.warn(`Access control conditions`)
  console.log(accessControlConditions);
  console.warn(`Ciphertext`);
  console.log(ciphertext)
  console.warn(`Data to encrypt hash`);
  console.log(dataToEncryptHash);

  const litActionCode = `(${_hyperliquidLitActionCode.toString()})();`;
  console.log(litActionCode);

  const response = await litNodeClient.executeJs({
    sessionSigs: sessionSignatures,
    code: litActionCode,
    jsParams: {
      accessControlConditions: accessControlConditions,
      ciphertext: ciphertext,
      dataToEncryptHash: dataToEncryptHash,
    }
  });

  console.log(response)
}

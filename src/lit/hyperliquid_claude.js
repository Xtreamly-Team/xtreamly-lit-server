import { hash, sign } from "crypto";

const _hyperliquidLitActionCode = async () => {
  // console.log(ethers)

  class Hyperliquid {
    constructor(evmPrivateKey) {
      this.wallet = new Wallet(evmPrivateKey);
      this.apiUrl = 'https://api.hyperliquid.xyz';
    }

    async getAddress() {
      return await this.wallet.getAddress();
    }

    async getNonce() {
      const address = await this.getAddress();
      const res = await fetch(`${this.apiUrl}/info`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'nonce', user: address })
      });
      const data = await res.json();
      return data.result;
    }

    async starkKey() {
      const sig = await this.wallet.signMessage("hyperliquid_stark_key");
      const encoder = new TextEncoder();
      const hash = await crypto.subtle.digest("SHA-256", encoder.encode(sig));
      const bytes = new Uint8Array(hash);
      return Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('');
    }

    async signOrderMessage(msg) {
      // Message signing using EVM — placeholder until Ed25519 is fully reimplemented
      return await this.wallet.signMessage(JSON.stringify(msg));
    }

    async placeOrder({ coin, isBuy, size, limitPx = null, orderType = 'market' }) {
      const address = await this.getAddress();
      const nonce = await this.getNonce();
      const starkKey = await this.starkKey();

      const order = {
        asset: coin,
        isBuy,
        sz: size.toString(),
        limitPx,
        orderType
      };

      const msg = JSON.stringify(order);
      const sig = await this.signOrderMessage(msg); // NOTE: real impl needs EdDSA!

      const payload = {
        type: 'order',
        user: {
          address,
          starkKey,
          nonce
        },
        order,
        signature: sig // Placeholder: Hyperliquid expects EdDSA here
      };

      const res = await fetch(`${this.apiUrl}/exchange`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      return await res.json();
    }
  }

  class HyperliquidTrader {
    constructor(privateKey, testnet = true) {
      this.wallet = new ethers.Wallet(privateKey);
      this.baseUrl = testnet ? 'https://api.hyperliquid-testnet.xyz' : 'https://api.hyperliquid.xyz';
      this.lastNonce = 0;
    }

    // Generate monotonic nonce (based on nomeida implementation)
    generateNonce() {
      const now = Date.now();
      if (now <= this.lastNonce) {
        this.lastNonce += 1;
      } else {
        this.lastNonce = now;
      }
      return this.lastNonce;
    }

    // Remove trailing zeros from numeric strings (based on nomeida pattern)
    normalizeValue(value) {
      if (typeof value === 'string' && value.includes('.')) {
        return value.replace(/\.?0+$/, '');
      }
      if (typeof value === 'number') {
        return value.toString().replace(/\.?0+$/, '');
      }
      return value.toString();
    }

    // Normalize action object to remove trailing zeros
    normalizeAction(action) {
      const normalizedAction = JSON.parse(JSON.stringify(action));

      if (normalizedAction.orders) {
        normalizedAction.orders.forEach(order => {
          if (order.p) order.p = this.normalizeValue(order.p);
          if (order.s) order.s = this.normalizeValue(order.s);
        });
      }

      return normalizedAction;
    }

    // EIP-712 signing based on nomeida implementation
    async signL1Action(action, nonce) {
      const normalizedAction = this.normalizeAction(action);

      // Create the action hash
      const actionBytes = ethers.utils.toUtf8Bytes(JSON.stringify(normalizedAction));
      const actionHash = ethers.utils.keccak256(actionBytes);

      // Create the nonce hash
      const nonceBytes = new Uint8Array(8);
      const view = new DataView(nonceBytes.buffer);
      view.setBigUint64(0, BigInt(nonce), false); // big-endian
      const nonceHash = ethers.utils.keccak256(nonceBytes);

      // Combine hashes
      const messageHash = ethers.utils.keccak256(
        ethers.utils.concat([actionHash, nonceHash])
      );

      // EIP-712 domain and types (based on Hyperliquid spec)
      const domain = {
        name: 'HyperLiquid',
        version: '1',
        chainId: 1337,
        verifyingContract: '0x0000000000000000000000000000000000000000'
      };

      const types = {
        Agent: [
          { name: 'source', type: 'string' },
          { name: 'connectionId', type: 'bytes32' }
        ]
      };

      const value = {
        source: 'a',
        connectionId: messageHash
      };

      const signature = await this.wallet._signTypedData(domain, types, value);

      // Convert to required format
      const sig = ethers.utils.splitSignature(signature);
      return {
        r: sig.r,
        s: sig.s,
        v: sig.v
      };
    }

    // Get asset index from symbol
    async getAssetIndex(symbol) {
      try {
        const response = await fetch(`${this.baseUrl}/info`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ type: 'meta' })
        });

        const data = await response.json();

        // Handle both perp and spot symbols
        if (symbol.endsWith('-PERP')) {
          const coinName = symbol.replace('-PERP', '');
          const asset = data.universe?.find(u => u.name === coinName);
          return asset ? data.universe.indexOf(asset) : 0;
        } else if (symbol.endsWith('-SPOT')) {
          const coinName = symbol.replace('-SPOT', '');
          const spotAsset = data.spotMeta?.universe?.find(u => u.name === coinName);
          return spotAsset ? 10000 + data.spotMeta.universe.indexOf(spotAsset) : 10000;
        } else {
          // Default to perp
          const asset = data.universe?.find(u => u.name === symbol);
          return asset ? data.universe.indexOf(asset) : 0;
        }
      } catch (error) {
        console.log('Using default asset index due to error:', error.message);
        return 0;
      }
    }

    // Place a market order (following nomeida pattern)
    async placeMarketOrder(symbol, isBuy, size) {
      try {
        const nonce = this.generateNonce();
        const assetIndex = await this.getAssetIndex(symbol);
        // return assetIndex

        // Normalize the symbol for display
        // const displaySymbol = symbol.includes('-') ? symbol : `${symbol}-PERP`;
        const displaySymbol = symbol
        // return displaySymbol

        const action = {
          type: 'order',
          orders: [{
            a: assetIndex,
            b: isBuy,
            p: '0', // Market order price
            s: this.normalizeValue(size),
            r: false,
            t: {
              limit: {
                tif: 'Ioc' // Immediate or Cancel for market orders
              }
            }
          }],
          grouping: 'na'
        };

        // console.log('Placing market order:', {
        //   symbol: displaySymbol,
        //   side: isBuy ? 'BUY' : 'SELL',
        //   size: this.normalizeValue(size),
        //   assetIndex,
        //   action
        // });

        // Sign the action
        const signature = await this.signL1Action(action, nonce);
        // return JSON.stringify(signature)

        const payload = {
          action,
          nonce,
          signature
        };
        // return JSON.stringify(payload)

        console.log('Payload:', JSON.stringify(payload, null, 2));

        const response = await fetch(`${this.baseUrl}/exchange`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
        return await response.json()

        const result = await response.json();

        if (response.ok) {
          console.log('Order placed successfully:', result);
          return result;
        } else {
          console.error('Order failed with status:', response.status, response.statusText);
          console.error('Error response:', result);
          throw new Error(`Order failed: ${JSON.stringify(result)}`);
        }

      } catch (error) {
        console.error('Error placing order:', error);
        throw error;
      }
    }

    // Get account info
    async getAccountInfo() {
      try {
        const response = await fetch(`${this.baseUrl}/info`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            type: 'clearinghouseState',
            user: this.wallet.address
          })
        });

        const data = await response.json();
        console.log('Account info:', JSON.stringify(data, null, 2));
        return data;
      } catch (error) {
        console.error('Error getting account info:', error);
        throw error;
      }
    }

    // Get market metadata
    async getMarketMeta() {
      try {
        const response = await fetch(`${this.baseUrl}/info`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ type: 'meta' })
        });

        const data = await response.json();
        console.log('Available perpetuals:', data.universe?.map(u => u.name) || []);

        // Also get spot metadata if available
        const spotResponse = await fetch(`${this.baseUrl}/info`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ type: 'spotMeta' })
        });

        const spotData = await spotResponse.json();
        console.log('Available spot assets:', spotData.universe?.map(u => u.name) || []);

        return { perp: data, spot: spotData };
      } catch (error) {
        console.error('Error getting market metadata:', error);
        throw error;
      }
    }
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
        const privKey = '8fff429ac72cef839f2618632baf2f115f150c73371abc44c37f77be99ac41f0'
        // const privKey = removeSaltFromDecryptedKey(saltedPrivKey);
        // console.log(privKey)

        const wallet = new ethers.Wallet(privKey);
        console.log(wallet.address)
        console.log("AFTER ADDRESS")
        console.log("DIALOGUE")
        //
        //
        const runGetNonce = async () => {
          // const hyperliquidTrader = new HyperliquidTrader(
          //   privKey,
          //   false,
          // );
          const hyperliquidTrader = new Hyperliquid(
            privKey,
          );
          // console.log("hyperliquidTrader")


          return await hyperliquidTrader.getAddress()
          // const res = await hyperliquidTrader.placeMarketOrder('ZEN/USDC:USDC', true, 11.0)
          // console.log("PLACED ORDER")
          // const accountInfo = await hyperliquidTrader.getAccountInfo();
          // console.log(accountInfo)

          return res
        }


        // cosnole.log("GOING TO CALL RUN ONCE")
        const res = await Lit.Actions.runOnce(
          {
            waitForResponse: true,
            name: 'Get Nonce 3',
          }, runGetNonce
        )
        console.log("RAN RUN ONCE")
        Lit.Actions.setResponse({
          response: res
        })
        // return true
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
  console.log("CLAUDE")
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

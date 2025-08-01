const _unwrapPrivateKeyLitActionCode = async () => {
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

      return decryptedPrivateKey.slice(LIT_PREFIX.length);
    }

    try {
      let saltedPrivKey = await Lit.Actions.decryptToSingleNode({
        accessControlConditions,
        ciphertext,
        dataToEncryptHash,
        chain: 'ethereum',
        authSig: null,
      });
      if (typeof saltedPrivKey === 'string') {
        console.log("NOT SALTY")
        console.log(saltedPrivKey)
        const privKey = removeSaltFromDecryptedKey(saltedPrivKey);
        Lit.Actions.setResponse({
          response: privKey
        })
      } else {
        console.log("SALTY")
        console.log(saltedPrivKey)
        Lit.Actions.setResponse({
          response: saltedPrivKey
        })
      }
    } catch (err) {
    }
  }
  await tryDecryptToSingleNode(accessControlConditions, ciphertext, dataToEncryptHash);
}

export async function executeDecryptPrivateAction(
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

  const litActionCode = `(${_unwrapPrivateKeyLitActionCode.toString()})();`;

  console.log("Going to call decrypt private action")
  const response = await litNodeClient.executeJs({
    sessionSigs: sessionSignatures,
    code: litActionCode,
    jsParams: {
      accessControlConditions: accessControlConditions,
      ciphertext: ciphertext,
      dataToEncryptHash: dataToEncryptHash,
    }
  });

  console.warn("Response")
  console.log(response)
}

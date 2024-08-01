const jsonwebtoken = require('jsonwebtoken');

const { JWT_ALGORITHM, JWT_PASSPHRASE } = require('../config/app');

const { getSSMParameters } = require('../config/AWS.SSM');
//refrence: ask ssm aws credentials
const createJWT = async (payload, expiry = '1d') => {
  const SSMParameters = await getSSMParameters();
  const PRIVATE_KEY = SSMParameters.KEY_JWT_PRIVATE;
  const JWT_ISSUER = SSMParameters.JWT_ISSUER;

  const signedToken = jsonwebtoken.sign(
    payload,
    {
      key: PRIVATE_KEY,
      passphrase: JWT_PASSPHRASE,
    },
    {
      issuer: JWT_ISSUER,
      expiresIn: expiry,
      algorithm: JWT_ALGORITHM,
    },
  );

  return signedToken;
};

const verifyJWT = async (JWT) => {
  const SSMParameters = await getSSMParameters();
  const PUBLIC_KEY = SSMParameters.KEY_JWT_PUBLIC;
  const JWT_ISSUER = SSMParameters.JWT_ISSUER;

  return new Promise((resolve, reject) => {
    jsonwebtoken.verify(
      JWT,
      PUBLIC_KEY,
      {
        issuer: JWT_ISSUER,
        algorithms: [JWT_ALGORITHM],
      },
      (err, payload) => (err ? reject(err) : resolve(payload)),
    );
  });
};

module.exports = {
  createJWT,
  verifyJWT,
};

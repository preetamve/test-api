const { SSMClient, GetParametersCommand } = require('@aws-sdk/client-ssm');
const ssmClient = new SSMClient({ region: 'us-east-1' });

let SSMdata = null;
const getSSMData = async () => {
  try {
    const data = await ssmClient.send(new GetParametersCommand({
      Names: [
        'KEY_AWS_CLOUDFRONT_PRIVATE',
        'KEY_JWT_PRIVATE',
        'KEY_JWT_PUBLIC',
        'JWT_ISSUER',
      ],
      WithDecryption: true
    }))
    if (!data) throw new Error('Cannot get data from SSM');
    const parameters = data.Parameters;

    const parsedData = {};
    parameters.forEach((parameter) => {
      parsedData[parameter.Name] = parameter.Value;
    });
    return parsedData;
  } catch (error) {
    throw error
  }
};

module.exports = {
  getSSMParameters: async () => {
    if (SSMdata === null) {
      SSMdata = await getSSMData();
    }
    return SSMdata;
  },
};

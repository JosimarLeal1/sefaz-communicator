'use strict';

const soap = require('soap');
const fs = require('fs');

const communicate = async (url, methodName, message, options = {}) => {
  validateParams(url, methodName, message, options);

  const formattedUrl = formatUrl(url);
  const client = await createSoapClient(formattedUrl, options);
  const method = getSoapMethod(client, methodName);

  return new Promise((resolve, reject) => {
    method(message, (err, result, rawResponse) => {
      if (err) return reject(err);
      resolve(options.rawResponse ? rawResponse : result);
    });
  });
};

const createSoapClient = async (url, options) => {
  const certBuffer = options.certificate;

  const soapOptions = {
    wsdl_options: {
      pfx: certBuffer,
      passphrase: options.password,
      rejectUnauthorized: false,
    },
  };

  const client = await soap.createClientAsync(url, soapOptions);

  if (certBuffer) {
    client.setSecurity(
      new soap.ClientSSLSecurityPFX(certBuffer, options.password, {
        rejectUnauthorized: false,
      })
    );
  }

  if (options.headers) {
    options.headers.forEach(header => client.addSoapHeader(header));
  }

  return client;
};

const getSoapMethod = (client, methodName) => {
  const service = Object.values(client.wsdl.definitions.services)[0];
  const port = Object.values(service.ports).find(p => p.binding.methods[methodName]);

  if (!port) {
    throw new Error(`Method '${methodName}' not found in WSDL`);
  }

  return client._defineMethod(port.binding.methods[methodName], port.location);
};

const formatUrl = url => {
  return url.match(/\?wsdl$/i) ? url : `${url}?wsdl`;
};

const validateParams = (url, methodName, message, options) => {
  if (typeof url !== 'string') throw new TypeError('url must be a string');
  if (typeof methodName !== 'string') throw new TypeError('methodName must be a string');
  if (typeof message !== 'object') throw new TypeError('message must be an object');
  if (options.certificate && !Buffer.isBuffer(options.certificate)) {
    throw new TypeError('certificate must be a Buffer');
  }
  if (options.password && typeof options.password !== 'string') {
    throw new TypeError('password must be a string');
  }
};

module.exports = { communicate };

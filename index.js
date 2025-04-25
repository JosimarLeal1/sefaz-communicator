'use strict';

const soap = require('soap');
const request = require('request');
const RequestHttpClient = require('soap/lib/http.js').RequestHttpClient;

const communicate = async (url, methodName, message, options = {}) => {
  validateParams(url, methodName, message, options);

  const formattedUrl = formatUrl(url);
  const isHttps = options.certificate && options.password;

  const client = await createSoapClient(formattedUrl, options, isHttps);
  const method = createSoapMethod(
    client,
    methodName,
    isHttps,
    options.customFormatLocation,
  );

  return new Promise((resolve, reject) => {
    method(message, (err, result, rawResponse) => {
      if (err) return reject(err);
      options.rawResponse ? resolve(rawResponse) : resolve(result);
    });
  });
};

const createSoapClient = async (url, options, isHttps) => {
  const soapOptions = buildSoapOptions(options);
  const client = await soap.createClientAsync(url, soapOptions);

  if (isHttps) {
    client.setSecurity(
      new soap.ClientSSLSecurityPFX(options.certificate, options.password, {
        rejectUnauthorized: false,
      })
    );
  }

  if (options.headers) {
    options.headers.forEach(header => client.addSoapHeader(header));
  }

  return client;
};

const buildSoapOptions = options => {
  const agentOptions = {
    pfx: options.certificate,
    passphrase: options.password,
    rejectUnauthorized: false,
  };

  // Custom HTTP client using request with certificate
  const httpClient = new RequestHttpClient({
    request: request.defaults({
      timeout: 20000,
      agentOptions,
    }),
  });

  return {
    escapeXML: options.escapeXML === true,
    returnFault: true,
    disableCache: true,
    forceSoap12Headers: options.forceSoap12Headers !== false,
    httpClient,
    wsdl_options: {
      pfx: options.certificate,
      passphrase: options.password,
      rejectUnauthorized: false,
    },
    headers: {
      'User-Agent': 'sefaz-communicator/1.0',
      'Content-Type': options.contentType || 'application/soap+xml',
    },
  };
};

const createSoapMethod = (client, methodName, isHttps, customFormatLocation) => {
  const service = Object.values(client.wsdl.definitions.services)[0];
  const port = getPortByMethodName(service.ports, methodName);
  if (!port) throw new Error(`Method: '${methodName}' does not exist in wsdl`);

  const method = port.binding.methods[methodName];
  const location = formatLocation(port.location, isHttps, customFormatLocation);

  return client._defineMethod(method, location);
};

const getPortByMethodName = (ports, methodName) => {
  return Object.values(ports).find(port => port.binding.methods[methodName]);
};

const formatLocation = (location, isHttps, customFormatLocation) => {
  location = location.replace(/:80[\/]/, '/');
  if (isHttps && location.startsWith('http:')) {
    location = location.replace('http:', 'https:');
  }
  return customFormatLocation ? customFormatLocation(location) : location;
};

const formatUrl = url => {
  return /^.*[?]{1}.*(wsdl|WSDL|Wsdl){1}$/.test(url) ? url : `${url}?wsdl`;
};

const validateParams = (url, methodName, message, options) => {
  if (typeof url !== 'string') throw new TypeError(`Expected string for url, got ${typeof url}`);
  if (typeof methodName !== 'string') throw new TypeError(`Expected string for methodName, got ${typeof methodName}`);
  if (typeof message !== 'object') throw new TypeError(`Expected object for message, got ${typeof message}`);
  if (options.certificate && !Buffer.isBuffer(options.certificate)) throw new TypeError(`Expected Buffer for certificate, got ${typeof options.certificate}`);
  if (options.password && typeof options.password !== 'string') throw new TypeError(`Expected string for password, got ${typeof options.password}`);
};

module.exports = {
  communicate,
};

'use strict';

const soap = require('soap');
const https = require('https');
const axios = require('axios');

class CustomHttpClient extends soap.HttpClient {
  constructor(pfx, passphrase) {
    super();
    this.agent = new https.Agent({
      pfx,
      passphrase,
      rejectUnauthorized: false,
    });
  }

  request(url, data, callback, exheaders, exoptions) {
    const options = {
      method: data ? 'POST' : 'GET',
      url,
      headers: exheaders || {},
      httpsAgent: this.agent,
      data,
      timeout: 20000,
      responseType: 'text',
    };

    axios(options)
      .then(res => callback(null, res.data, res))
      .catch(err => {
        const res = err.response || {};
        callback(err, res.data, res);
      });
  }
}

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
    const callback = (err, result, rawResponse) => {
      if (err) return reject(err);

      options.rawResponse ? resolve(rawResponse) : resolve(result);
    };

    method(message, callback);
  });
};

const createSoapClient = async (url, options, isHttps) => {
  const soapOptions = buildSoapOptions(options);
  const client = await soap.createClientAsync(url, soapOptions);

  if (isHttps)
    client.setSecurity(
      new soap.ClientSSLSecurityPFX(options.certificate, options.password, {
        rejectUnauthorized: false,
      }),
    );

  if (options.headers)
    options.headers.forEach(header => client.addSoapHeader(header));

  return client;
};

const createSoapMethod = (client, methodName, isHttps, customFormatLocation) => {
  const service = Object.values(client.wsdl.definitions.services)[0];

  const port = getPortByMethodName(service.ports, methodName);
  if (!port) throw new Error(`Method: '${methodName}' does not exist in wsdl`);

  const method = port.binding.methods[methodName];
  const location = formatLocation(port.location, isHttps, customFormatLocation);

  return client._defineMethod(method, location);
};

const buildSoapOptions = options => {
  return {
    escapeXML: options.escapeXML === true,
    returnFault: true,
    disableCache: true,
    forceSoap12Headers:
      options.forceSoap12Headers === undefined ? true : options.forceSoap12Headers,
    httpClient: new CustomHttpClient(options.certificate, options.password),
    headers: { 'Content-Type': options.contentType || 'application/soap+xml' },
    wsdl_options: {
      pfx: options.certificate,
      passphrase: options.password,
      rejectUnauthorized: false,
    },
  };
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
  if (/^.*[?]{1}.*(wsdl|WSDL|Wsdl){1}$/.test(url) === false) return `${url}?wsdl`;

  return url;
};

const validateParams = (url, methodName, message, options) => {
  if (typeof url !== 'string') {
    throw new TypeError(`Expected a string for url, got ${typeof url}`);
  }

  if (typeof methodName !== 'string') {
    throw new TypeError(
      `Expected a string for methodName, got ${typeof methodName}`,
    );
  }

  if (typeof message !== 'object') {
    throw new TypeError(`Expected an object for message, got ${typeof message}`);
  }

  if (options.certificate && !Buffer.isBuffer(options.certificate)) {
    throw new TypeError(
      `Expected a Buffer for certificate, got ${typeof options.certificate}`,
    );
  }

  if (options.password && typeof options.password !== 'string') {
    throw new TypeError(
      `Expected a string for password, got ${typeof options.password}`,
    );
  }

  if (options.headers) {
    options.headers.forEach(header => {
      if (typeof header !== 'string') {
        throw new TypeError(`Expected a string for header, got ${typeof header}`);
      }
    });
  }

  if (options.rawResponse && typeof options.rawResponse !== 'boolean') {
    throw new TypeError(
      `Expected a boolean for rawResponse, got ${typeof options.rawResponse}`,
    );
  }
};

module.exports = {
  communicate,
  buildSoapOptions,
  formatLocation,
  formatUrl,
};

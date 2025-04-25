'use strict';

const soap = require('soap');
const https = require('https');
const axios = require('axios');
const { HttpClient } = require('soap/lib/http');

class CustomHttpClient extends HttpClient {
  request(rurl, data, callback, exheaders, exoptions) {
    const options = {
      method: 'POST',
      url: rurl,
      data,
      headers: {
        'Content-Type': 'application/soap+xml;charset=UTF-8',
        ...exheaders,
      },
      httpsAgent: new https.Agent({
        pfx: exoptions.pfx,
        passphrase: exoptions.passphrase,
        rejectUnauthorized: false, // aceita certificado vencido ou autoassinado
      }),
    };

    axios(options)
      .then(response => {
        callback(null, response.data, response.status, response.headers);
      })
      .catch(err => {
        callback(err);
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

const buildSoapOptions = options => {
  return {
    escapeXML: options.escapeXML === true,
    returnFault: true,
    disableCache: true,
    forceSoap12Headers:
      options.forceSoap12Headers === undefined ? true : options.forceSoap12Headers,
    httpClient: new CustomHttpClient(),
    headers: { 'Content-Type': options.contentType || 'application/soap+xml' },
    wsdl_options: {
      pfx: options.certificate,
      passphrase: options.password,
      rejectUnauthorized: false,
    },
  };
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
    throw new TypeError(`Expected a object for message, got ${typeof message}`);
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

  if (options.httpClient && !(options.httpClient instanceof http.HttpClient)) {
    throw new TypeError('Expected a http.HttpClient for options.httpClient');
  }

  if (options.proxy && typeof options.proxy !== 'string') {
    throw new TypeError(`Expected a string for proxy, got ${typeof options.proxy}`);
  }

  if (options.rawResponse && typeof options.rawResponse !== 'boolean') {
    throw new TypeError(
      `Expected a boolean for rawResponse, got ${typeof options.rawResponse}`,
    );
  }
};

module.exports = {
  communicate,
};

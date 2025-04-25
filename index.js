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

// Demais funções auxiliares: formatUrl, formatLocation, validateParams...
// (mantém as mesmas que você já tem no seu código)

module.exports = {
  communicate,
};

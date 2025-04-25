'use strict';

const soap = require('soap');
const request = require('request');

const communicate = async (url, methodName, message, options = {}) => {
  validateParams(url, methodName, message, options);

  const formattedUrl = formatUrl(url);
  const certBuffer = options.certificate;

  // Requisição com certificado
  const customRequest = (opts) => {
    return new Promise((resolve, reject) => {
      request(opts, (error, response, body) => {
        if (error) return reject(error);
        resolve({ response, body });
      });
    });
  };

  const soapOptions = {
    request: customRequest,
    wsdl_options: {
      pfx: certBuffer,
      passphrase: options.password,
      rejectUnauthorized: false,
    },
  };

  console.log('Iniciando a criação do cliente SOAP para o WSDL...');
  let client;
  try {
    client = await soap.createClientAsync(formattedUrl, soapOptions);
    console.log('Cliente SOAP criado com sucesso!');
  } catch (error) {
    console.error('Erro ao criar o cliente SOAP:', error);
    throw error;
  }

  // Adicionando segurança ao cliente SOAP
  client.setSecurity(
    new soap.ClientSSLSecurityPFX(certBuffer, options.password, {
      rejectUnauthorized: false,
    }),
  );

  if (options.headers) {
    options.headers.forEach(header => client.addSoapHeader(header));
  }

  const method = getSoapMethod(client, methodName);

  console.log(`Chamando o método SOAP: ${methodName}...`);
  return new Promise((resolve, reject) => {
    method(message, (err, result, rawResponse) => {
      if (err) {
        console.error('Erro na chamada do método SOAP:', err);
        return reject(err);
      }

      console.log('Resposta recebida do método SOAP');
      console.log('Resultado:', result);
      resolve(options.rawResponse ? rawResponse : result);
    });
  });
};

const getSoapMethod = (client, methodName) => {
  const service = Object.values(client.wsdl.definitions.services)[0];
  const port = Object.values(service.ports).find(p => p.binding.methods[methodName]);

  if (!port) throw new Error(`Método '${methodName}' não encontrado no WSDL`);

  return client._defineMethod(port.binding.methods[methodName], port.location);
};

const formatUrl = url => {
  return url.match(/\?wsdl$/i) ? url : `${url}?wsdl`;
};

const validateParams = (url, methodName, message, options) => {
  if (typeof url !== 'string') throw new TypeError('url deve ser uma string');
  if (typeof methodName !== 'string') throw new TypeError('methodName deve ser uma string');
  if (typeof message !== 'object') throw new TypeError('message deve ser um objeto');
  if (options.certificate && !Buffer.isBuffer(options.certificate)) {
    throw new TypeError('certificate deve ser um Buffer');
  }
  if (options.password && typeof options.password !== 'string') {
    throw new TypeError('password deve ser uma string');
  }
};

module.exports = { communicate };

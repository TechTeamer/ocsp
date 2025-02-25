const ocsp = require('../')
const fixtures = require('./fixtures')

const https = require('https')

describe('OCSP Cache', function () {
  const issuer = fixtures.certs.issuer
  const good = fixtures.certs.good
  // const revoked = fixtures.certs.revoked

  let server
  let httpServer
  let agent
  let cache
  before(function (cb) {
    server = ocsp.Server.create({
      cert: issuer.cert,
      key: issuer.key
    })

    server.addCert(43, 'good')
    server.addCert(44, 'revoked', {
      revocationTime: new Date(),
      revocationReason: 'CACompromise'
    })

    server.listen(8000, function () {
      cb()
    })

    agent = new ocsp.Agent()

    cache = new ocsp.Cache()
  })

  after(function (cb) {
    this.timeout(5100) // since node 19, http.globalAgent uses keep-alive connections default
    agent.destroy()
    server.close(() => {
      httpServer.close(cb)
    })
  })

  it('should cache ocsp response', function (cb) {
    httpServer = https.createServer({
      cert: good.cert + '\n' + good.issuer,
      key: good.key
    }, function (req, res) {
      res.end('hello world')
    })

    httpServer.on('OCSPRequest', function (cert, issuer, cb) {
      ocsp.getOCSPURI(cert, function (err, uri) {
        if (err) {
          return cb(err)
        }

        const req = ocsp.request.generate(cert,
          issuer || fixtures.certs.issuer.cert)
        const options = {
          url: uri,
          ocsp: req.data
        }

        cache.request(req.id, options, cb)
      })
    })

    httpServer.listen(8001, () => {
      const req = https.get({
        ca: issuer.cert,
        rejectUnauthorized: false,
        servername: 'local.host',
        port: 8001
      }, (res) => {
        cb()
      })

      req.on('error', cb)
      req.end()
    })
  })
})

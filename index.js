const { EventEmitter }  = require('events')
const maybe = require('call-me-maybe')

const USES_PROMISES = Symbol('hypercore.uses-promises')
const CORE = Symbol('hypercore-wrapper.inner')
const REQUEST = Symbol('hypercore-wrapper.request')
const PUBLIC_PROPERTIES = [
  'key',
  'discoveryKey',
  'length',
  'byteLength',
  'writable',
  'sparse',
  'peers',
  'valueEncoding',
  'weak',
  'lazy',
]

class BaseWrapper extends EventEmitter {
  constructor (core) {
    super()
    this[CORE] = core
    this.on('newListener', (eventName, listener) => {
      core.on(eventName, listener)
    })
    this.on('removeListener', (eventName, listener) => {
      core.removeListener(eventName, listener)
    })
  }
}
for (const prop of PUBLIC_PROPERTIES) {
  Object.defineProperty(BaseWrapper.prototype, prop, {
    enumerable: true,
    get: function () {
      return this[CORE][prop]
    }
  })
}

class CallbackToPromiseHypercore extends BaseWrapper {
  constructor (core) {
    super(core)
  }

  // Async Methods

  ready () {
    return catch(new Promise((resolve, reject) => {
      this[CORE].ready(err => {
        if (err) return reject(err)
        return resolve(null)
      })
    }))
  }

  get (index, opts) {
    let req = null
    const prom = new Promise((resolve, reject) => {
      req = this[CORE].get(index, opts, (err, block) => {
        if (err) return reject(err)
        return resolve(block)
      })
    })
    prom[REQUEST] = req
    return prom
  }

  append (batch) {
    return catch(new Promise((resolve, reject) => {
      this[CORE].append(batch, (err, seq) => {
        if (err) return reject(err)
        return resolve(seq)
      })
    }))
  }

  update (opts) {
    return catch(new Promise((resolve, reject) => {
      this[CORE].update(opts, err => {
        if (err) return reject(err)
        return resolve(null)
      })
    }))
  }

  seek (bytes, opts) {
    return new Promise((resolve, reject) => {
      this[CORE].seek(bytes, opts, (err, pos) => {
        if (err) return reject(err)
        return resolve(pos)
      })
    })
  }

  download (range) {
    let req = null
    const prom = catch(new Promise((resolve, reject) => {
      req = this[CORE].download(range, err => {
        if (err) return reject(err)
        return resolve(null)
      })
    }))
    prom[REQUEST] = req
    return prom
  }

  has (start, end) {
    return new Promise((resolve, reject) => {
      this[CORE].has(start, end, (err, res) => {
        if (err) return reject(err)
        return resolve(res)
      })
    })
  }

  audit () {
    return new Promise((resolve, reject) => {
      this[CORE].audit((err, report) => {
        if (err) return reject(err)
        return resolve(report)
      })
    })
  }

  destroyStorage () {
    return new Promise((resolve, reject) => {
      this[CORE].destroyStorage(err => {
        if (err) return reject(err)
        return resolve(null)
      })
    })
  }

  // Sync Methods
  
  createReadStream (opts) {
    return this[CORE].createReadStream(opts)
  }

  createWriteStream (opts) {
    return this[CORE].createWriteStream(opts)
  }

  undownload (range) {
    return this[CORE].undownload(range[REQUEST] || range)
  }

  cancel (range) {
    return this[CORE].cancel(range[REQUEST] || range)
  }

  replicate (initiator, opts) {
    return this[CORE].replicate(initiator, opts)
  }

  registerExtension (name, handlers) {
    return this[CORE].registerExtension(name, handlers)
  }

  setUploading (uploading) {
    return this[CORE].setUploading(uploading)
  }

  setDownloading (downloading) {
    return this[CORE].setDownloading(downloading)
  }
}

class PromiseToCallbackHypercore extends BaseWrapper {
  constructor (core) {
    super(core)
  }

  // Async Methods

  ready (cb) {
    return maybeOptional(cb, this[CORE].ready())
  }

  get (index, opts, cb) {
    const prom = this[CORE].get(index, opts)
    maybe(cb, prom)
    return prom
  }

  append (batch, cb) {
    return maybeOptional(cb, this[CORE].append(batch))
  }

  update (opts, cb) {
    return maybeOptional(cb, this[CORE].update(opts))
  }

  seek (bytes, opts, cb) {
    return maybe(cb, this[CORE].seek(bytes, opts))
  }

  download (range, cb) {
    const prom = this[CORE].download(range)
    maybeOptional(cb, prom)
    return prom
  }

  has (start, end, cb) {
    return maybe(cb, this[CORE].has(start, end))
  }

  audit (cb) {
    return maybe(cb, this[CORE].audit())
  }

  destroyStorage (cb) {
    return maybe(cb, this[CORE].destroyStorage())
  }

  // Sync Methods
  
  createReadStream (opts) {
    return this[CORE].createReadStream(opts)
  }

  createWriteStream (opts) {
    return this[CORE].createWriteStream(opts)
  }

  undownload (range) {
    return this[CORE].undownload(range)
  }

  cancel (range) {
    return this[CORE].cancel(range)
  }

  replicate (initiator, opts) {
    return this[CORE].replicate(initiator, opts)
  }

  registerExtension (name, handlers) {
    return this[CORE].registerExtension(name, handlers)
  }

  setUploading (uploading) {
    return this[CORE].setUploading(uploading)
  }

  setDownloading (downloading) {
    return this[CORE].setDownloading(downloading)
  }
}

module.exports = {
  toPromises,
  toCallbacks
}

function toPromises (core) {
  return core[USES_PROMISES] ? core : new CallbackToPromiseHypercore(core)
}

function toCallbacks (core) {
  return core[USES_PROMISES] ? new PromiseToCallbackHypercore(core) : core
}

function maybeOptional (cb, prom) {
  prom = maybe(cb, prom)
  if (prom) prom.catch(noop)
  return prom
}

function catch (prom) {
  prom.catch(noop)
  return prom
}

function noop () {}

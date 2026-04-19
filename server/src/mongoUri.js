/**
 * נירמול URI ואופציה להחלפת שם מסד (MONGO_DB_NAME) בלי להדביק מחדש את כל המחרוזת.
 */
function normalizeMongoUri(s) {
  return String(s || '')
    .replace(/[\r\n]+/g, '')
    .trim()
}

function applyMongoDbNameOverride(uri) {
  const db = process.env.MONGO_DB_NAME && String(process.env.MONGO_DB_NAME).trim()
  if (!db) return uri
  let u = normalizeMongoUri(uri)
  if (/\.mongodb\.net\//i.test(u)) {
    return u.replace(/(\.mongodb\.net\/)([^/?]*)(\?|$)/i, `$1${db}$3`)
  }
  if (/^mongodb:\/\/[^/]+\//i.test(u)) {
    return u.replace(/^(mongodb:\/\/[^/]+\/)([^?]*)(\?|$)/i, `$1${db}$3`)
  }
  return uri
}

function getMongoUri() {
  const raw = process.env.MONGO_URI || process.env.MONGODB_URI
  if (!raw) {
    throw new Error('חסר MONGO_URI (או MONGODB_URI) ב-.env')
  }
  return applyMongoDbNameOverride(normalizeMongoUri(raw))
}

module.exports = { getMongoUri }

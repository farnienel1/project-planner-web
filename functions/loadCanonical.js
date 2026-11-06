'use strict'

const fs = require('fs')
const path = require('path')
const vm = require('vm')

const packedPath = path.join(__dirname, 'canonical-business.js')
const source = fs.readFileSync(packedPath, 'utf8')
const context = vm.createContext({})
vm.runInContext(source, context)

const canonical = context.ProjectPlannerCanonical
if (!canonical || typeof canonical.notificationDeliversDevicePush !== 'function') {
  throw new Error('packed rulebook missing device-push helpers')
}
// Rulebook 1.32.4: the auth-claims triggers (authClaims.js) need the claims rule from the same script.
if (typeof canonical.authClaimsForPerson !== 'function' || typeof canonical.authClaimsEqual !== 'function') {
  throw new Error('packed rulebook missing auth-claims helpers (run npm run build:canonical)')
}

module.exports = canonical

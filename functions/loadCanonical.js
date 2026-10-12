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

module.exports = canonical

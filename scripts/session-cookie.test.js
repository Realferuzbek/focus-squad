// scripts/session-cookie.test.js
const assert = require('assert');
const fs = require('fs');
const path = require('path');

const authPath = path.resolve(__dirname, '..', 'lib', 'auth.ts');
const content = fs.readFileSync(authPath, 'utf8');

// Check session strategy set to jwt
assert(/session:\s*\{[^}]*strategy:\s*"jwt"/m.test(content), 'session strategy must be jwt in lib/auth.ts');

// Check cookie options existence with httpOnly and sameSite
assert(/cookies:\s*\{[\s\S]*sessionToken:[\s\S]*options:[\s\S]*httpOnly:\s*true/m.test(content), 'cookie httpOnly option must be present');
assert(/sameSite:\s*'lax'/.test(content) || /sameSite:\s*"lax"/.test(content), 'sameSite must be lax');

// Check sid generation in signIn or jwt callback
assert(/sid\s*=\s*randomBytes\(16\)/.test(content) || /sid\s*=\s*randomBytes\(32\)/.test(content) || /\.sid\s*=\s*randomBytes/.test(content), 'sid generation code should be present for session fixation mitigation');

console.log('session-cookie static tests passed');
process.exit(0);

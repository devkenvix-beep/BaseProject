Server README
=============
This is an Express server that provides:
- POST /api/convert?target={json|xml|yaml|toml}
  Body: raw text (JSON, XML, YAML, TOML or plain text). It will auto-detect and convert.
- POST /api/ai-email
  Body: { subject, audience, tone, points: [..] }
  This proxies to openrouter.ai. You MUST set environment variable OPENROUTER_API_KEY before running.

Install:
  cd server
  npm install
  export OPENROUTER_API_KEY=your_key_here
  npm start

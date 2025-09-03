require('dotenv').config();
const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const xml2js = require('xml2js');
const yaml = require('js-yaml');
const toml = require('toml');
const axios = require('axios');

const app = express();
app.use(cors());
app.use(bodyParser.json({limit: '5mb'}));
app.use(bodyParser.text({type: ['text/*','application/xml','application/*'], limit: '5mb'}));

// naive auto-detect
function detectFormat(input) {
  const s = (typeof input === 'string') ? input.trim() : JSON.stringify(input).trim();
  if (!s) return 'text';
  if (s[0] === '{' || s[0] === '[') return 'json';
  if (s[0] === '<') return 'xml';
  if (s.match(/^---\n/)) return 'yaml';
  if (s.includes('=') && s.includes('\n')) return 'toml';
  return 'text';
}

// convert helpers
async function toJson(input, from) {
  if (from === 'json') return typeof input === 'string' ? JSON.parse(input) : input;
  if (from === 'xml') {
    const res = await xml2js.parseStringPromise(input, {explicitArray:false, mergeAttrs:true});
    return res;
  }
  if (from === 'yaml') return yaml.load(input);
  if (from === 'toml') return toml.parse(input);
  return input;
}

app.post('/api/convert', async (req, res) => {
  try {
    const { target } = req.query;
    const raw = req.body && typeof req.body === 'object' && req.body.raw ? req.body.raw : (typeof req.body === 'string' ? req.body : JSON.stringify(req.body));
    const from = detectFormat(raw);
    const obj = await toJson(raw, from);
    let out;
    if (target === 'json') out = JSON.stringify(obj, null, 2);
    else if (target === 'xml') {
      const builder = new xml2js.Builder({headless:true, renderOpts:{pretty:true}});
      out = builder.buildObject(obj);
    } else if (target === 'yaml') out = yaml.dump(obj);
    else if (target === 'toml') {
      // simple toml stringify fallback: JSON -> string (not full TOML compliance)
      out = Object.entries(obj).map(([k,v]) => `${k} = "${String(v).replace(/"/g,'\"')}"`).join('\n');
    } else out = String(raw);
    res.json({from, target: target||'same', result: out});
  } catch (e) {
    res.status(400).json({error: e.message});
  }
});

// AI Email Writer proxy using OpenRouter-compatible API (openrouter.ai)
// Set OPENROUTER_API_KEY in environment before running the server.
app.post('/api/ai-email', async (req, res) => {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) return res.status(400).json({error: 'Server missing OPENROUTER_API_KEY environment variable. Set it before starting.'});
  const { subject, audience, tone, points } = req.body || {};
  if (!points) return res.status(400).json({error:'missing points in request body'});
  const prompt = `Write a ${tone||'professional'} email with subject: "${subject||'No Subject'}" for audience: ${audience||'Customer'}. Include these points:\n${points.join('\n')}`;
  try {
    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini', // example model; change as desired
        messages: [{role:'user', content: prompt}],
        max_tokens: 600
      })
    });
    const data = await response.json();
    // try to extract text
    const text = data?.choices?.[0]?.message?.content || data?.choices?.[0]?.text || JSON.stringify(data);
    res.json({raw: data, text});
  } catch (e) {
    res.status(500).json({error: e.message});
  }
});

const port = process.env.PORT || 4000;
app.listen(port, ()=>console.log('Server running on port', port));

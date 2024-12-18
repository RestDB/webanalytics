/*
* Web analytics template
*/
import { app, datastore } from 'codehooks-js'
import analyticsScript from './api/analytics-script.js';
import { aggregateWorker, trackerWorker, updateAnalyticsWorker } from './api/workers.js';
import { getAggregatedStats, createStats, getActiveUsers } from './api/api.js';
import { generatePixel, extractTopDomain } from './api/utils.js';
import { initAuth } from 'codehooks-auth'
import { aiassist } from './api/aiassist.js';
import { DOMAIN_LIST } from './dashboard/js/config.js';
/*
Authentication
*/
const settings = {
  JWT_ACCESS_TOKEN_SECRET: process.env.JWT_ACCESS_TOKEN_SECRET, // coho set-env JWT_ACCESS_TOKEN_SECRET 'xxx' --encrypted
  JWT_REFRESH_TOKEN_SECRET: process.env.JWT_REFRESH_TOKEN_SECRET, // coho set-env JWT_REFRESH_TOKEN_SECRET 'xxx' --encrypted
  redirectSuccessUrl: '/dashboard/index.html', // where to redirect after successful login
  baseAPIRoutes: '/api', // protected routes
}

function checkDomain(req) {
  const domain = extractTopDomain(req.headers['referer']);  
  const hit = DOMAIN_LIST.includes(domain);
  console.log('checkDomain', domain, hit);
  return hit;
}

/*
* Public routes
*/
app.auth('/script.js', (req, res, next) => checkDomain(req) ? next() : res.status(403).send('Forbidden'));
app.auth('/pixel.gif', (req, res, next) => checkDomain(req) ? next() : res.status(403).send('Forbidden'));

/* 
Send a tracker script to client
*/
app.get('/script.js', async (req, res) => {
  res.set('Content-Type', 'application/javascript');
  res.send(analyticsScript(req.headers.host));
});

/* 
Send a tracking pixel
*/
app.get('/pixel.gif', async (req, res) => {
  // send request payload to worker queue
  const db = await datastore.open();
  req.timestamp = new Date().toISOString();
  console.debug('Request topixel.gif', req);
  db.enqueue('TRACKER', { ...req });

  // Get the 1x1 transparent GIF and send to client
  const pixel = generatePixel();
  res.set('Content-Type', 'image/gif');
  res.set('Cache-Control', 'no-store, no-cache, must-revalidate, private');
  res.write(pixel, 'buffer');
  res.end();
});

/*
  Tracker Queue Worker, stores data in database
*/
app.worker('TRACKER', trackerWorker);

/* 
  AGGREGATE Queue Worker
*/
app.worker('AGGREGATE', aggregateWorker);

/*
  UPDATEANALYTICS Queue Worker
*/
app.worker('UPDATEANALYTICS', updateAnalyticsWorker);

/*
Serve static assets
*/

// route root to dashboard
app.auth('/', (req, res, next) => next());
app.get('/', (req, res) => {
  res.redirect('/dashboard/index.html');
});

// setup auth settings
initAuth(app, settings)
app.static({route: '/auth', directory: '/auth/assets', default: 'login.html'})
app.static({route: '/dashboard', directory: '/dashboard', default: 'index.html'})

/*
  Data API
*/
app.get('/api/aggstats/:from/:to', getAggregatedStats);
app.post('/api/stats', createStats);
app.get('/api/aiassist', aiassist);
app.get('/api/activeusers', getActiveUsers);
/* 
  Bind application to serverless runtime
*/
export default app.init(async() => {
  // create indexes
  const conn = await datastore.open();    
  await conn.createIndex('traffic', ['timestamp', 'domain']);
});



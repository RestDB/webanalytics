/*
* Web analytics template
*/
import { app, datastore } from 'codehooks-js'
import analyticsScript from './analytics-script.js';
import { aggregateWorker, trackerWorker } from './workers.js';
import { getAggregatedStats, createStats } from './api.js';
import { generatePixel } from './utils.js';
import { initAuth } from 'codehooks-auth'
import { aiassist } from './aiassist.js';
/*
Authentication
*/
const settings = {
  JWT_ACCESS_TOKEN_SECRET: process.env.JWT_ACCESS_TOKEN_SECRET, // coho set-env JWT_ACCESS_TOKEN_SECRET 'xxx' --encrypted
  JWT_REFRESH_TOKEN_SECRET: process.env.JWT_REFRESH_TOKEN_SECRET, // coho set-env JWT_REFRESH_TOKEN_SECRET 'xxx' --encrypted
  redirectSuccessUrl: '/dashboard/index.html', // where to redirect after successful login
  baseAPIRoutes: '/api', // protected routes
}


/*
* Public routes
*/
app.auth('/script.js', (req, res, next) => next())
app.auth('/pixel.gif', (req, res, next) => next())
app.auth('/map', (req, res, next) => next())

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
app.static({route: '/dashboard', directory: '/pages', default: 'index.html'})

/*
  Data API
*/
app.get('/api/aggstats/:from/:to', getAggregatedStats);
app.post('/api/stats', createStats);
app.get('/api/aiassist', aiassist);

/* 
  Bind application to serverless runtime
*/
export default app.init(async() => {
  // create indexes
  const conn = await datastore.open();    
  await conn.createIndex('traffic', ['timestamp', 'domain']);
});



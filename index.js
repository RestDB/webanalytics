/*
* Web analytics template
*/
import { app, datastore } from 'codehooks-js'
import analyticsScript from './analytics-script.js';
import { aggregateWorker, trackerWorker } from './workers.js';
import { mapRoute } from './map.js';
import get from 'lodash/get';
import { formatDuration } from './utils.js';
import { getEventCompletions, getViewStats, getTopPages, getTopReferers, getTrafficData, getAggregatedStats } from './api.js';
import { generatePixel } from './utils.js';
import { initAuth } from 'codehooks-auth'

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
  Web map page
*/
app.get('/map', mapRoute);

/*
Serve static assets
*/
// setup auth settings
initAuth(app, settings)
app.static({route: '/auth', directory: '/auth/assets', default: 'login.html'})
app.static({route: '/dashboard', directory: '/pages', default: 'index.html'})

/*
  Data API
*/
app.get('/api/aggstats/:from/:to', getAggregatedStats);
/* 
  Bind application to serverless runtime
*/
export default app.init();



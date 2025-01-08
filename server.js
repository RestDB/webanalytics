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
* Cache function for static assets headers
*/
const ONE_DAY =  86400000;
const cacheFunction = (req, res, next) => {
  // Set cache headers
  res.set('Cache-Control', `public, max-age=${ONE_DAY*15}, s-maxage=${ONE_DAY*15}, immutable`);
  res.setHeader("Expires", new Date(Date.now() + ONE_DAY*15).toUTCString());
  res.removeHeader('Pragma');
  res.removeHeader('Surrogate-Control');
  console.log('static auth hook', req.originalUrl)
  next()
}

/*
Authentication
*/
const settings = {
  JWT_ACCESS_TOKEN_SECRET: process.env.JWT_ACCESS_TOKEN_SECRET, 
  JWT_REFRESH_TOKEN_SECRET: process.env.JWT_REFRESH_TOKEN_SECRET,
  redirectSuccessUrl: '/dashboard/index.html', // where to redirect after successful login
  baseAPIRoutes: '/api', // protected routes
  emailProvider: 'mailgun',
  baseUrl: 'https://app.coholytics.info',
  emailSettings: {
    mailgun: {
      MAILGUN_APIKEY: process.env.MAILGUN_APIKEY,
      MAILGUN_DOMAIN: 'mg.restdb.io',
      MAILGUN_FROM_EMAIL: 'jones@restdb.io',
      MAILGUN_FROM_NAME: 'Theo & Annie'
    }
  },
  onLoginUser: async (req, res, data) => {
    const { user } = data;
    const allowedEmails = ['jones@codehooks.io', 'knutmt@codehooks.io']; // Add your allowed emails here

    console.log('onLoginUser', user.email);
    return new Promise((resolve, reject) => {
      if (!allowedEmails.includes(user.email)) {
        console.error('User not allowed to login');
        reject('User not allowed to login');
      }
      resolve();
    });
  },
  staticHook: cacheFunction
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
//app.static({route: '/auth', directory: '/auth/assets', default: 'login.html'})
app.static({ route: '/dashboard', directory: '/dashboard', default: 'index.html' }, cacheFunction)

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
export default app.init(async () => {
  // create indexes
  const conn = await datastore.open();
  await conn.createIndex('traffic', ['timestamp', 'domain']);
});



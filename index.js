/*
* Web analytics template
*/
import { app, datastore } from 'codehooks-js'
import fetch from 'node-fetch';
import lodash from 'lodash';
import maphtml from './pages/map.html';

/* 
Send a tracker script to client
*/
app.auth('/script.js', (req, res, next) => next())
app.get('/script.js', async (req, res) => {
  const scriptString = "<img src=\"https://youthful-watershed-23b6.codehooks.io/pixel.gif?r='+encodeURIComponent(document.referrer || null)+'\" width=\"0\" height=\"0\" alt=\"Page view tracker\" referrerpolicy=\"no-referrer-when-downgrade\"/>";
  // send script to client
  res.set('Content-Type', 'application/javascript');
  res.send(`document.write('${scriptString}'); window.addEventListener('hashchange', function() {
  // Your tracking code here
  console.log('Navigated to:', window.location.href);
});`);
});

/* 
Send a tracking pixel
*/
app.auth('/pixel.gif', (req, res, next) => next())
app.get('/pixel.gif', async (req, res) => {
  // send requestpayloadto worker queue
  const db = await datastore.open();
  db.enqueue('TRACKER', { ...req });

  // Create a 1x1 transparent GIF, send to client
  const pixel = Buffer.from('R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7', 'base64');
  res.set('Content-Type', 'image/gif');
  res.set('Cache-Control', 'no-store, no-cache, must-revalidate, private');
  res.write(pixel, 'buffer');
  res.end();
});

/* 
Get Country from IP 
*/
async function getCountryFromIP(ip) {
  try {
    const db = await datastore.open();
    // check if we have cached the result
    const cachedIp = await db.get(`ip-${ip}`)
    if (cachedIp) {
      console.debug('Cached IP', cachedIp)
      return JSON.parse(cachedIp)
    }
    const apiToken = '506fec00701249'
    const requestOptions = {
      method: "GET",
      redirect: "follow"
    };
    const URL = `https://ipinfo.io/${ip}?token=${apiToken}`
    const response = await fetch(URL, requestOptions)
    const data = await response.json()
    // cache the result
    db.set(`ip-${ip}`, JSON.stringify(data))
    return data
  } catch (error) {
    console.error(error)
    return null
  }
}

/*
* Aggregate analytics data
*/
async function aggregateAnalyticsData(field, value) {
  const db = await datastore.open()
  const date = new Date()
  let year = date.getUTCFullYear().toString()
  let month = (date.getUTCMonth() + 1).toString().padStart(2, '0')
  let day = date.getUTCDate().toString().padStart(2, '0')
  let hour = date.getUTCHours().toString().padStart(2, '0')
  let second = date.getUTCSeconds().toString().padStart(2, '0')
  //console.log('Aggregating data for', year, month, day, hour, second);
  const meterQuery = {
    "year": year,
    "month": month,
    "day": day,
    "hour": hour,
    "metric": field
  };
  meterQuery[field] = value

  const updates = {
    $set: {
      "year": year,
      "month": month,
      "day": day,
      "hour": hour,
      "metric": field
    },
    $inc: { count: 1 }
  };
  updates['$set'][field] = value
  //console.log('Aggregating data', meterQuery, updates)
  const result = await db.updateOne('analytics', meterQuery, updates, { upsert: true })
  //console.log('Aggregated data result', result)
  return result
}

/*
* Tracker worker, stores data in database
*/
app.worker('TRACKER', async (workerdata, work) => {
  const db = await datastore.open();
  const rawData = workerdata.body.payload;
  
  const headers = rawData.headers;
  const geo = await getCountryFromIP(headers['x-real-ip']);

  // Construct a flattened data object
  const data = {
    ip: headers['x-real-ip'],
    accept: headers['accept'],
    acceptLanguage: headers['accept-language'],
    userAgent: headers['user-agent'],
    referer: headers['referer'],
    query: JSON.stringify(rawData.query),
    apiPath: rawData.apiPath,
    originalUrl: rawData.originalUrl,
    params: JSON.stringify(rawData.params),
    geoCountry: geo.country,
    geoCity: geo.city,
    geoRegion: geo.region,
    geoLoc: geo.loc,
    geoTimezone: geo.timezone,
    timestamp: new Date().toISOString()
  };

  console.log('Tracker', {
    ip: data.ip,
    country: data.geoCountry,
    city: data.geoCity,
    url: data.referer.split('?')[0],
    referrer: rawData.query.r !== 'null' ? `via: ${rawData.query.r}` : ''
  });

  await db.insertOne('traffic', data);
  await aggregateAnalyticsData('page', headers.referer.split('?')[0]);
  await aggregateAnalyticsData('city', data.geoCity);
  await aggregateAnalyticsData('country', data.geoCountry);
  work.end();
})

/*
  Web map page
*/
app.auth('/map', (req, res, next) => next())
app.get('/map', async (req, res) => {
  const locations = [];
  const conn = await datastore.open();
  const stream = conn.getMany('traffic', {})
  stream.on('data', (data) => {
    locations.push({      
      "loc": data.geoLoc
    });
  }).on('end', () => {
    const tpl = lodash.template(maphtml)
    res.set('Content-Type', 'text/html');
    res.send(tpl({ locations: JSON.stringify(locations) }))
  })
});


// bind to serverless runtime
export default app.init(async () => {
  console.log('I run on deploy once')
  const db = await datastore.open()
  // await db.createCollection('analytics')
  //await db.createCollection('traffic')
});

import { datastore } from 'codehooks-js'
import fetch from 'node-fetch';
/* 
Get Country from IP 
*/
export async function getCountryFromIP(ip) {
    try {
      const db = await datastore.open();
      // check if we have cached the result
      const cachedIp = await db.get(`ip-${ip}`)
      if (cachedIp) {
        console.debug('Cached IP', cachedIp)
        return JSON.parse(cachedIp)
      }
      const apiToken = process.env.IPINFO_TOKEN;
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
  export async function aggregateAnalyticsData(field, value, extra, domain) {
    console.log('Aggregating data', field, value, extra, domain)
    const db = await datastore.open()
    const { year, month, day, hour } = getDateComponents()
    //console.log('Aggregating data for', year, month, day, hour, second);
    const meterQuery = {
      "year": year,
      "month": month,
      "day": day,
      "hour": hour,
      "metric": field,
      "domain": domain
    };
    meterQuery[field] = value
  
    const updates = {
      $set: {
        "year": year,
        "month": month,
        "day": day,
        "hour": hour,
        "metric": field,
        "domain": domain
      },
      $inc: { count: 1 }
    };
    updates['$set'][field] = value
    if (extra) {
      updates['$push'] = extra
    }
    //console.log('Aggregating data', meterQuery, updates)
    const result = await db.updateOne('analytics', meterQuery, updates, { upsert: true })
    //console.log('Aggregated data result', result)
    return result
  }
  
  export function getDateComponents() {
    const date = new Date()
    return {
      year: date.getUTCFullYear().toString(),
      month: (date.getUTCMonth() + 1).toString().padStart(2, '0'),
      day: date.getUTCDate().toString().padStart(2, '0'),
      hour: date.getUTCHours().toString().padStart(2, '0'),
      second: date.getUTCSeconds().toString().padStart(2, '0')
    }
  }

  // Add this function at the end of the file or in a separate utility file
export function formatDuration(milliseconds) {
  if (milliseconds === 0 || milliseconds === null) {
    return {
      hours: 0,
      minutes: 0,
      seconds: 0
    };
  }
    const seconds = Math.floor(milliseconds / 1000);
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const remainingSeconds = seconds % 60;
  
    return {
      hours: hours.toString().padStart(2, '0'),
      minutes: minutes.toString().padStart(2, '0'),
      seconds: remainingSeconds.toString().padStart(2, '0')
    };
  }

export function generatePixel() {
  return Buffer.from('R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7', 'base64');
}
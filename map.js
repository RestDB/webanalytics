import { datastore } from 'codehooks-js';
import lodash from 'lodash';
import maphtml from './pages/map.html';

export async function mapRoute(req, res) {
  const locations = [];
  const conn = await datastore.open();
  const stream = conn.getMany('traffic', {day: "22"})
  stream.on('data', (data) => {
    // lat: 24.6408, lng:46.7728, count: 3
    const latLng = data.geoLoc.split(',').map(Number);
    locations.push({      
      lat: latLng[0], lng:latLng[1], count: 1
    });
  }).on('end', () => {
    const tpl = lodash.template(maphtml)
    res.set('Content-Type', 'text/html');
    res.send(tpl({ locations: JSON.stringify({data: locations}) }))
  })
}
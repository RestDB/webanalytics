// Refresh the access token
async function refreshAccessToken() {
            
    // httpOnly refresh-token Cookie will be sent to server
    const response = await fetch('/auth/refreshtoken', {
        method: 'POST',
        credentials: "include",
        headers: {
            'Content-Type': 'application/json',
        }
    });

    if (response.ok) {
        const data = await response.json();
        return data;
    } else {
        throw new Error('Failed to refresh token');
    }
}
// The main fetch wrapper function with JWT token handling
async function fetchWithJWT(url, options = {}) {
    
    // Clone the original request options to safely retry later
    const originalRequestOptions = { ...options };

    // httpOnly access-token Cookie will be sent to server
    options.headers = {                
        ...options.headers,
        credentials: "include"
    };            

    const response = await fetch(url, options);

    // If the access token is expired (assuming 401 Unauthorized)
    if (response.status === 401) {
        try {
            // Attempt to refresh the access token
            const newAccessToken = await refreshAccessToken();

            // Retry the original request with the new access token
            originalRequestOptions.headers = {
                ...originalRequestOptions.headers,
                credentials: "include",
            };

            // Retry the original request with the new token
            return fetch(url, originalRequestOptions);
        } catch (error) {
            console.error('Token refresh failed:', error);
            return window.location.href = '/auth/login.html';
        }
    }

    // If response is not 401, return the original response
    return response;
}
function ajustPeriod(period, op) {
    return Number(period - op).toString().padStart(2, '0')
}    

function dashboard() {
    return {
        domain: 'codehooks.io',
        loading: true,
        period: 'day',
        uniqueUsers: 0,
        totalPageViews: 0,
        signups: 0,
        bounceRate: 0.0,
        averageSessionDuration: {minutes: 0, seconds: 0},                    
        eventCompletions: 0,
        topPages: [],
        topReferers: [],
        topCountries: [],
        topEvents: [],
        geoLocCounts: [],
        graphData: {
            labels: [],
            data: []
        },        
        deviceTypes: {
            desktop: 0,
            mobile: 0
        },
        // Add methods to update data based on period changes

        async fetchStats() {
            try {
                const now = new Date();
                //now.setHours(24, 0, 0, 0);
                const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
                today.setHours(24, 0, 0, 0);
                const todayStr = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate())).toISOString();
                const nowStr = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()+1)).toISOString()

                // Yesterday: [yesterday start of day, yesterday end of day] in UTC
                const yesterday = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate() - 1));
                const yesterdayStr = yesterday.toISOString();
                const yesterdayEndStr = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate())).toISOString();

                // Two days ago: [two days ago start of day, two days ago end of day] in UTC
                const twoDaysAgo = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate() - 2));
                const twoDaysAgoStr = twoDaysAgo.toISOString();
                const twoDaysAgoEndStr = new Date(Date.UTC(yesterday.getUTCFullYear(), yesterday.getUTCMonth(), yesterday.getUTCDate()) - 1).toISOString();

                // One week ago: [start of current week, current time] in UTC
                const oneWeekAgo = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate()));
                oneWeekAgo.setUTCDate(oneWeekAgo.getUTCDate() - oneWeekAgo.getUTCDay()); // Adjust to Monday
                const oneWeekAgoStr = oneWeekAgo.toISOString();
                
                // Two weeks ago: [start of current week, current time] in UTC
                const twoWeeksAgo = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate()));
                twoWeeksAgo.setUTCDate(twoWeeksAgo.getUTCDate() - oneWeekAgo.getUTCDay() - 6); // Adjust to Monday
                const twoWeeksAgoStr = twoWeeksAgo.toISOString();

                // One month ago: [1 month ago start of month, current time] in UTC
                const oneMonthAgo = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), 1));
                const oneMonthAgoStr = oneMonthAgo.toISOString();

                // Two months ago: [2 months ago start of month, current time] in UTC
                const twoMonthsAgo = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), 1));
                twoMonthsAgo.setUTCMonth(twoMonthsAgo.getUTCMonth() - 1);
                const twoMonthsAgoStr = twoMonthsAgo.toISOString(); 

                // One year ago: [start of previous year, current time] in UTC
                const oneYearAgo = new Date(Date.UTC(today.getUTCFullYear(), 0, 1));
                const oneYearAgoStr = oneYearAgo.toISOString();

                let fromPeriodStr = '';
                let toPeriodStr = '';

                switch (this.period) {
                    case 'day':
                        fromPeriodStr = todayStr;
                        toPeriodStr = nowStr;
                        break;
                    case 'yesterday':
                        fromPeriodStr = yesterdayStr;
                        toPeriodStr = yesterdayEndStr;
                        break;
                    case 'week':
                        fromPeriodStr = oneWeekAgoStr;
                        toPeriodStr = nowStr;
                        break;
                    case 'lastweek':
                        fromPeriodStr = twoWeeksAgoStr;
                        toPeriodStr = oneWeekAgoStr;
                        break;
                    case 'month':
                        fromPeriodStr = oneMonthAgoStr;
                        toPeriodStr = nowStr;
                        break;
                    case 'lastmonth':
                        fromPeriodStr = twoMonthsAgoStr;
                        toPeriodStr = oneMonthAgoStr;
                        break;
                    case 'year':
                        fromPeriodStr = oneYearAgoStr;
                        toPeriodStr = nowStr;
                        break;
                }
                // Define multiple API endpoints
                const endpoints = [
                    `/api/aggstats/${fromPeriodStr}/${toPeriodStr}?domain=${this.domain}`,                    
                ];

                // Use Promise.all to fetch data from multiple endpoints concurrently
                const responses = await Promise.all(endpoints.map(endpoint => 
                    fetchWithJWT(endpoint, {
                        headers: {
                            'Content-Type': 'application/json'
                        }
                    })
                ));

                // Check if all responses are ok
                if (responses.some(response => !response.ok)) {
                    throw new Error(`One or more requests failed`);
                }

                // Parse all responses
                const [statsData] = await Promise.all(
                    responses.map(response => response.json())
                );

                // Update graphData labels based on the period
                switch (this.period) {
                    case 'week':
                        this.graphData.labels = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
                        break;
                    case 'lastweek':
                        this.graphData.labels = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
                        break;
                    case 'month':
                        this.graphData.labels = Array.from({length: 31}, (_, i) => (i + 1).toString());
                        break;
                    case 'lastmonth':
                        this.graphData.labels = Array.from({length: 31}, (_, i) => (i + 1).toString());
                        break;
                    case 'year':
                        this.graphData.labels = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
                        break;
                    default:
                        this.graphData.labels = Array.from({length: 24}, (_, i) => `${i.toString().padStart(2, '0')}:00`);
                }

                // Update the component state
                this.uniqueUsers = statsData.uniqueUsers;
                this.totalPageViews = statsData.totalPageViews;
                this.topReferers = statsData.topReferers.slice(0, 10).map(x => {
                    return {
                        url: (x.url),
                        views: x.views
                    }
                });
                this.topCountries = statsData.topCountries.slice(0, 10);
                this.topEvents = statsData.topEvents;
                this.topPages = statsData.topPages.slice(0, 10).map(x => {
                    return {
                        url: x.url.replace('https://codehooks.io', ''),
                        views: x.views
                    }
                }); 
                this.locations = statsData.locations;
                //this.signups = statsData.signups;
                this.bounceRate = statsData.bounceRate;
                this.averageSessionDuration = statsData.averageSessionDuration;
                this.eventCompletions = statsData.totalPageEvents;
                this.graphData = {
                    labels: this.graphData.labels,
                    data: (() => {
                        switch (this.period) {
                            case 'week':
                                return statsData.pageViewsPerDayOfWeek;
                            case 'month':
                                return statsData.pageViewsPerDayOfMonth;
                            case 'lastmonth':
                                return statsData.pageViewsPerDayOfMonth;
                            case 'year':
                                return statsData.pageViewsPerMonth;
                            default:
                                return statsData.pageViewsPerHour;
                        }
                    })()
                };
                this.deviceTypes = statsData.deviceTypes;
                this.geoLocCounts = statsData.geoLocCounts.map(x => {return {lat: x.geoloc.lat, lon: x.geoloc.lon, count: x.count}});
            } catch (error) {
                console.error('Error fetching stats:', error);
                // Handle error (e.g., show error message to user)
            }
        },

        updateStats() {
            this.fetchStats();
        },

        init() {
            this.updateStats();            
        },

        async updateStats() {
            this.loading = true;
            try {                
                await this.fetchStats();
                this.initTrafficGraph();
                this.initMap();
            } catch (error) {
                console.error('Error fetching data:', error);
            } finally {
                this.loading = false;
            }
        },

        initTrafficGraph() {
            const canvas = document.getElementById('traffic-graph');
            if (!canvas || !(canvas instanceof HTMLCanvasElement)) {
                console.error('Traffic graph canvas not found or not a canvas element');
                return;
            }

            const ctx = canvas.getContext('2d');
            if (!ctx) {
                console.error('Unable to get 2D context from canvas');
                return;
            }

            // Destroy the existing chart instance if it exists
            if (this.chartInstance) {
                this.chartInstance.destroy();
            }

            // Create a new chart instance and store it
            this.chartInstance = new Chart(ctx, {
                type: 'line',
                data: {
                    labels: this.graphData.labels,
                    datasets: [{
                        label: 'Traffic',
                        data: this.graphData.data,
                        borderColor: 'rgb(75, 75, 75)',
                        tension: 0.1
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    scales: {
                        x: {
                            type: 'category',
                            title: {
                                display: true,
                                text: this.period
                            }
                        },
                        y: {
                            beginAtZero: true
                            
                        }
                    }
                }
            });
        },
        initMap() {
            console.log('initMap');
            // Check if the map instance already exists
            if (this.mapInstance) {
                // If it exists, remove the existing map
                this.mapInstance.remove();
            }

            var cfg = {
                // radius should be small ONLY if scaleRadius is true (or small radius is intended)
                "radius": 1,
                "maxOpacity": .20,
                // scales the radius based on map zoom
                "scaleRadius": true,
                // if set to false the heatmap uses the global maximum for colorization
                // if activated: uses the data maximum within the current map boundaries
                //   (there will always be a red spot with useLocalExtremas true)
                "useLocalExtrema": false,
                // which field name in your data represents the latitude - default "lat"
                latField: 'lat',
                // which field name in your data represents the longitude - default "lng"
                lngField: 'lon',
                // which field name in your data represents the data value - default "value"
                valueField: 'count'
            };


            var heatmapLayer = new HeatmapOverlay(cfg);

            var baseLayer = L.tileLayer(
                'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',{
                    attribution: 'Map data &copy; <a href="http://openstreetmap.org">OpenStreetMap for Codehooks</a> contributors, <a href="http://creativecommons.org/licenses/by-sa/2.0/">CC-BY-SA</a>, Imagery © <a href="http://cloudmade.com">CloudMade</a>',
                    maxZoom: 18
                }
            );

            // Create a new map instance
            this.mapInstance = new L.Map('world_map', {            
                layers: [baseLayer, heatmapLayer],
                center: [48.8566, 2.3522], // Coordinates for Paris
                zoom: 3 // Adjust this value to set the initial zoom level
            });

            // Create a bounds object to adjust the map view based on locations
            const bounds = L.latLngBounds();
            
            
            if (this.geoLocCounts.length > 0) {
                const bounds = L.latLngBounds();
                this.geoLocCounts.forEach((geoData) => {
                    const location = L.latLng(geoData.lat, geoData.lon);
                    bounds.extend(location);

                    // Create the circle
                    L.circle(location, {
                        color: 'black',
                        fillColor: '#30f',
                        fillOpacity: 0.1,
                        radius: 1000
                    }).addTo(this.mapInstance);
                    
                });

                // Fit the map to the bounds of all markers
                //this.mapInstance.fitBounds(bounds);
                heatmapLayer.setData({data: this.geoLocCounts});
                //this.mapInstance.addLayer(heatmapLayer);
            }
            
        },

        init() {
            this.updateStats();
            this.initTrafficGraph();
            this.initMap();
        }
    }
}

// Initialize the map when the page loads
//document.addEventListener('DOMContentLoaded', initMap);
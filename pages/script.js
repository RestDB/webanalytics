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
        locations: [],
        graphData: {
            labels: ['00', '01', '02', '03', '04', '05', '06', '07', '08', '09', '10', '11', '12', '13', '14', '15', '16', '17', '18', '19', '20', '21', '22', '23'],
            data: []
        },        
        // Add methods to update data based on period changes

        async fetchStats() {
            try {
                const now = new Date();
                const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
                today.setHours(24, 0, 0, 0);
                const todayStr = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate())).toISOString();
                const nowStr = now.toISOString();

                // Yesterday: [yesterday start of day, yesterday end of day] in UTC
                const yesterday = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate() - 1));
                const yesterdayStr = yesterday.toISOString();
                const yesterdayEndStr = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate())).toISOString();

                // Two days ago: [two days ago start of day, two days ago end of day] in UTC
                const twoDaysAgo = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate() - 2));
                const twoDaysAgoStr = twoDaysAgo.toISOString();
                const twoDaysAgoEndStr = new Date(Date.UTC(yesterday.getUTCFullYear(), yesterday.getUTCMonth(), yesterday.getUTCDate()) - 1).toISOString();

                // One week ago: [7 days ago start of day, current time] in UTC
                const oneWeekAgo = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate() - 7));
                const oneWeekAgoStr = oneWeekAgo.toISOString();

                // One month ago: [1 month ago start of day, current time] in UTC
                const oneMonthAgo = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth() - 1, today.getUTCDate()));
                const oneMonthAgoStr = oneMonthAgo.toISOString();

                // One year ago: [1 year ago start of day, current time] in UTC
                const oneYearAgo = new Date(Date.UTC(today.getUTCFullYear() - 1, today.getUTCMonth(), today.getUTCDate()));
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
                    case 'month':
                        fromPeriodStr = oneMonthAgoStr;
                        toPeriodStr = nowStr;
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

                // Update the component state
                this.uniqueUsers = statsData.uniqueUsers;
                this.totalPageViews = statsData.totalPageViews;
                this.topReferers = statsData.topReferers.map(x => {
                    return {
                        url: (x.url),
                        views: x.views
                    }
                });
                this.topCountries = statsData.topCountries;
                this.topEvents = statsData.topEvents;
                this.topPages = statsData.topPages.map(x => {
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
                    labels: ['00', '01', '02', '03', '04', '05', '06', '07', '08', '09', '10', '11', '12', '13', '14', '15', '16', '17', '18', '19', '20', '21', '22', '23'],
                    data: statsData.pageViewsPerHour
                };
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
                        y: {
                            beginAtZero: true
                        }
                    }
                }
            });
        },

        init() {
            this.updateStats();
            this.initTrafficGraph();
        }
    }
}

function initMap() {
    console.log('initMap');
    var map = L.map('world_map').setView([51.505, -0.09], 6);
    const tiles = L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
		maxZoom: 19,
		attribution: '&copy; <a href="http://www.openstreetmap.org/copyright">OpenStreetMap for Codehooks.io</a>'
	}).addTo(map);

}

// Initialize the map when the page loads
document.addEventListener('DOMContentLoaded', initMap);

function urlToBrandName(url) {
    const brandMap = {
      'baidu.com': 'Baidu',
      'bing.com': 'Bing',
      'duckduckgo.com': 'DuckDuckGo',
      'devhunt.org': 'DevHunt',
      'facebook.com': 'Facebook',
      'github.com': 'GitHub',
      'google.com': 'Google',
      'instagram.com': 'Instagram',
      'linkedin.com': 'LinkedIn',
      'pinterest.com': 'Pinterest',
      'reddit.com': 'Reddit',
      'snapchat.com': 'Snapchat',
      'tiktok.com': 'TikTok',
      'twitter.com': 'Twitter',
      'whatsapp.com': 'WhatsApp',
      'yahoo.com': 'Yahoo',
      'yandex.ru': 'Yandex',
      'youtube.com': 'YouTube',
    };
  
    for (const [domain, brand] of Object.entries(brandMap)) {
      if (url.includes(domain)) {
        return brand;
      }
    }
    return url;
  }
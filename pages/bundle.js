(() => {
  // pages/cohoapi.js
  async function refreshAccessToken() {
    const response = await fetch("/auth/refreshtoken", {
      method: "POST",
      credentials: "include",
      headers: {
        "Content-Type": "application/json"
      }
    });
    if (response.ok) {
      const data = await response.json();
      return data;
    } else {
      throw new Error("Failed to refresh token");
    }
  }
  async function fetchWithJWT(url, options = {}) {
    const originalRequestOptions = { ...options };
    options.headers = {
      ...options.headers,
      credentials: "include"
    };
    const response = await fetch(url, options);
    if (response.status === 401) {
      try {
        const newAccessToken = await refreshAccessToken();
        originalRequestOptions.headers = {
          ...originalRequestOptions.headers,
          credentials: "include"
        };
        return fetch(url, originalRequestOptions);
      } catch (error) {
        console.error("Token refresh failed:", error);
        return window.location.href = "/auth/login.html";
      }
    }
    return response;
  }

  // pages/utils.js
  function urlToBrandName(url) {
    const brandMap = {
      "baidu.com": "Baidu",
      "bing.com": "Bing",
      "duckduckgo.com": "DuckDuckGo",
      "devhunt.org": "DevHunt",
      "facebook.com": "Facebook",
      "github.com": "GitHub",
      "google.com": "Google",
      "instagram.com": "Instagram",
      "linkedin.com": "LinkedIn",
      "pinterest.com": "Pinterest",
      "reddit.com": "Reddit",
      "snapchat.com": "Snapchat",
      "tiktok.com": "TikTok",
      "twitter.com": "X (Twitter)",
      "whatsapp.com": "WhatsApp",
      "yahoo.com": "Yahoo",
      "yandex.ru": "Yandex",
      "youtube.com": "YouTube",
      "t.co": "X (Twitter)",
      "android-app://com.google.android.gm": "Gmail (Android)"
    };
    for (const [domain, brand] of Object.entries(brandMap)) {
      if (url.includes(domain)) {
        return brand;
      }
    }
    return url.replace("https://", "");
  }
  function normalizeUrl(url, domain) {
    url = url.replace(/^https?:\/\//, "");
    url = url.replace(/^www\./, "");
    url = url.replace(/\/$/, "");
    if (url.startsWith(domain)) {
      url = url.substring(domain.length) || "/";
    }
    return url;
  }

  // pages/script.js
  function dashboard() {
    return {
      loading: true,
      period: "day",
      uniqueUsers: 0,
      totalPageViews: 0,
      signups: 0,
      bounceRate: 0,
      averageSessionDuration: { minutes: 0, seconds: 0 },
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
      pageViewsInPeriod: [],
      domains: ["codehooks.io", "restdb.io"],
      selectedDomain: null,
      query: {},
      filters: [],
      aiassist: {
        "lastUpdated": (/* @__PURE__ */ new Date()).toISOString(),
        "ingress": "",
        "recommendations": [],
        "summary": "",
        "key insights": [],
        "data-driven recommendations": [],
        "unusual patterns or anomalies or fun facts": []
      },
      showFullReport: false,
      // Add this line
      // Add methods to update data based on period changes
      async fetchStats() {
        try {
          const now = /* @__PURE__ */ new Date();
          const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
          today.setHours(24, 0, 0, 0);
          const todayStr = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate())).toISOString();
          const nowStr = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1)).toISOString();
          const yesterday = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate() - 1));
          const yesterdayStr = yesterday.toISOString();
          const yesterdayEndStr = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate())).toISOString();
          const twoDaysAgo = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate() - 2));
          const twoDaysAgoStr = twoDaysAgo.toISOString();
          const twoDaysAgoEndStr = new Date(Date.UTC(yesterday.getUTCFullYear(), yesterday.getUTCMonth(), yesterday.getUTCDate()) - 1).toISOString();
          const last2Days = new Date(Date.UTC(yesterday.getUTCFullYear(), yesterday.getUTCMonth(), yesterday.getUTCDate() - 1));
          const last2DaysStr = last2Days.toISOString();
          const last2DaysEndStr = yesterdayStr;
          const last7Days = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate() - 7));
          const last7DaysStr = last7Days.toISOString();
          const last30Days = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate() - 30));
          const last30DaysStr = last30Days.toISOString();
          const last3Months = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth() - 3, today.getUTCDate()));
          const last3MonthsStr = last3Months.toISOString();
          const oneYearAgo = new Date(Date.UTC(today.getUTCFullYear(), 0, 1));
          const oneYearAgoStr = oneYearAgo.toISOString();
          let fromPeriodStr = "";
          let toPeriodStr = "";
          switch (this.period) {
            case "day":
              fromPeriodStr = todayStr;
              toPeriodStr = nowStr;
              break;
            case "last2days":
              fromPeriodStr = last2DaysEndStr;
              toPeriodStr = nowStr;
              break;
            case "last7days":
              fromPeriodStr = last7DaysStr;
              toPeriodStr = nowStr;
              break;
            case "last30days":
              fromPeriodStr = last30DaysStr;
              toPeriodStr = nowStr;
              break;
            case "last3months":
              fromPeriodStr = last3MonthsStr;
              toPeriodStr = nowStr;
              break;
            case "lastmonth":
              fromPeriodStr = last3MonthsStr;
              toPeriodStr = nowStr;
              break;
            case "lastyear":
              fromPeriodStr = oneYearAgoStr;
              toPeriodStr = nowStr;
              break;
          }
          const domainToUse = this.selectedDomain || this.domains[0];
          const statsEndpoint = `/api/aggstats/${fromPeriodStr}/${toPeriodStr}?domain=${domainToUse}&query=${JSON.stringify(this.query)}`;
          const aiAssistEndpoint = `/api/aiassist?domain=${domainToUse}`;
          const statsResponse = await fetchWithJWT(statsEndpoint, {
            headers: {
              "Content-Type": "application/json"
            }
          });
          if (!statsResponse.ok) {
            throw new Error("Failed to fetch stats data");
          }
          const statsData = await statsResponse.json();
          this.fetchAIAssistData(aiAssistEndpoint);
          this.uniqueUsers = statsData.uniqueUsers;
          this.totalPageViews = statsData.totalPageViews;
          this.topReferers = statsData.topReferers.slice(0, 10).reduce((acc, x) => {
            const brand = urlToBrandName(x.url);
            const existingBrand = acc.find((item) => item.brand === brand);
            if (existingBrand) {
              existingBrand.views += x.views;
            } else {
              acc.push({
                url: x.url,
                brand,
                views: x.views
              });
            }
            return acc;
          }, []).sort((a, b) => b.views - a.views).map((x, index) => ({ ...x, index }));
          this.topCountries = statsData.topCountries.slice(0, 10);
          this.topEvents = statsData.topEvents;
          const selectedDomain = this.selectedDomain || this.domains[0];
          this.topPages = statsData.topPages.reduce((acc, x) => {
            const normalizedUrl = normalizeUrl(x.url, selectedDomain);
            const existingPage = acc.find((page) => page.url === normalizedUrl);
            if (existingPage) {
              existingPage.views += x.views;
            } else {
              acc.push({
                originalUrl: x.url,
                url: normalizedUrl,
                views: x.views
              });
            }
            return acc;
          }, []).sort((a, b) => b.views - a.views).slice(0, 10);
          this.locations = statsData.locations;
          this.bounceRate = statsData.bounceRate;
          this.averageSessionDuration = statsData.averageSessionDuration;
          this.eventCompletions = statsData.totalPageEvents;
          this.pageViewsInPeriod = statsData.pageViewsInPeriod;
          this.graphData = {
            labels: Object.keys(this.pageViewsInPeriod).map((date) => new Date(date)),
            data: Object.values(this.pageViewsInPeriod)
          };
          this.deviceTypes = statsData.deviceTypes;
          this.geoLocCounts = statsData.geoLocCounts.map((x) => {
            return { lat: x.geoloc.lat, lon: x.geoloc.lon, count: x.count };
          });
        } catch (error) {
          console.error("Error fetching stats:", error);
        }
      },
      async fetchAIAssistData(aiAssistEndpoint) {
        try {
          const aiAssistResponse = await fetchWithJWT(aiAssistEndpoint, {
            headers: {
              "Content-Type": "application/json"
            }
          });
          if (!aiAssistResponse.ok) {
            throw new Error("Failed to fetch AI assist data");
          }
          const aiassistData = await aiAssistResponse.json();
          this.aiassist = aiassistData;
        } catch (error) {
          console.error("Error fetching AI assist data:", error);
        }
      },
      async updateStats() {
        this.loading = true;
        try {
          await this.fetchStats();
          this.initTrafficGraph();
          this.initMap();
        } catch (error) {
          console.error("Error fetching data:", error);
        } finally {
          this.loading = false;
        }
      },
      initTrafficGraph() {
        const canvas = document.getElementById("traffic-graph");
        if (!canvas || !(canvas instanceof HTMLCanvasElement)) {
          console.error("Traffic graph canvas not found or not a canvas element");
          return;
        }
        const ctx = canvas.getContext("2d");
        if (!ctx) {
          console.error("Unable to get 2D context from canvas");
          return;
        }
        if (this.chartInstance) {
          this.chartInstance.destroy();
        }
        this.chartInstance = new Chart(ctx, {
          type: "line",
          data: {
            labels: this.graphData.labels,
            datasets: [{
              label: "Page Views",
              data: this.graphData.data,
              //borderColor: 'rgb(75, 75, 75)',
              //backgroundColor: 'rgba(0, 0, 128, 0.2)',
              borderWidth: 1,
              // Add this line to make the stroke thinner
              //tension: 0.25,
              fill: true,
              pointRadius: 0
            }]
          },
          options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
              x: {
                type: "time",
                time: {
                  unit: this.getTimeUnit(),
                  displayFormats: {
                    hour: "HH:mm",
                    day: "MMM D",
                    week: "MMM D",
                    month: "MMM YYYY"
                  },
                  tooltipFormat: this.getTooltipFormat(),
                  // Add a parser to adjust for local timezone
                  parser: (value) => {
                    const date = new Date(value);
                    return new Date(date.getTime() - date.getTimezoneOffset() * 6e4);
                  }
                },
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
      getTimeUnit() {
        switch (this.period) {
          case "day":
          case "yesterday":
            return "hour";
          case "last7days":
          case "last30days":
            return "day";
          case "last3months":
          case "lastmonth":
            return "week";
          case "lastyear":
            return "month";
          default:
            return "day";
        }
      },
      getTooltipFormat() {
        switch (this.period) {
          case "day":
          case "yesterday":
            return "MMM D, HH:mm";
          case "last7days":
          case "last30days":
          case "last3months":
          case "lastmonth":
            return "MMM D, YYYY";
          case "lastyear":
            return "MMM YYYY";
          default:
            return "MMM D, YYYY";
        }
      },
      initMap() {
        console.log("initMap");
        if (this.mapInstance) {
          this.mapInstance.remove();
        }
        var cfg = {
          // radius should be small ONLY if scaleRadius is true (or small radius is intended)
          "radius": 1,
          "maxOpacity": 0.2,
          // scales the radius based on map zoom
          "scaleRadius": true,
          // if set to false the heatmap uses the global maximum for colorization
          // if activated: uses the data maximum within the current map boundaries
          //   (there will always be a red spot with useLocalExtremas true)
          "useLocalExtrema": false,
          // which field name in your data represents the latitude - default "lat"
          latField: "lat",
          // which field name in your data represents the longitude - default "lng"
          lngField: "lon",
          // which field name in your data represents the data value - default "value"
          valueField: "count"
        };
        let heatmapLayer = new HeatmapOverlay(cfg);
        let baseLayer = L.tileLayer(
          "https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png",
          {
            attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
            maxZoom: 20,
            language: "en"
            // Set the language to English
          }
        );
        this.mapInstance = new L.Map("world_map", {
          layers: [baseLayer, heatmapLayer],
          center: [51.5074, -0.1278],
          // Coordinates for London
          zoom: 3,
          // Adjust this value to set the initial zoom level
          language: "en"
          // Set the language to English for the map instance
        });
        const bounds = L.latLngBounds();
        if (this.geoLocCounts.length > 0) {
          const bounds2 = L.latLngBounds();
          this.geoLocCounts.forEach((geoData) => {
            const location = L.latLng(geoData.lat, geoData.lon);
            bounds2.extend(location);
            L.circle(location, {
              color: "black",
              fillColor: "#30f",
              fillOpacity: 0.1,
              radius: 1e3
            }).addTo(this.mapInstance);
          });
          heatmapLayer.setData({ data: this.geoLocCounts });
        }
      },
      init() {
        this.updateStats();
        this.initTrafficGraph();
        this.initMap();
      },
      setPageFilter(field, value) {
        const filterExists = this.filters.some((filter) => filter.field === field && filter.value === value);
        if (!filterExists) {
          this.filters.push({ field, value, key: `${this.filters.length + 1}` });
          console.log(`Setting page filter for: ${field} = ${value}`);
          this.query = this.filters.reduce((acc, filter) => {
            acc[filter.field] = filter.value;
            return acc;
          }, {});
          this.updateStats();
        } else {
          console.log(`Filter for ${field} = ${value} already exists`);
        }
      },
      removeFilter(filterToRemove) {
        this.filters = this.filters.filter(
          (filter) => filter.field !== filterToRemove.field || filter.value !== filterToRemove.value
        );
        this.query = this.filters.reduce((acc, filter) => {
          acc[filter.field] = filter.value;
          return acc;
        }, {});
        this.updateStats();
      },
      hasAdditionalContent() {
        return this.aiassist.summary || this.aiassist.recommendations && this.aiassist.recommendations.length > 0 || this.aiassist["key insights"] && this.aiassist["key insights"].length > 0 || this.aiassist["data-driven recommendations"] && this.aiassist["data-driven recommendations"].length > 0 || this.aiassist["unusual patterns or anomalies or fun facts"] && this.aiassist["unusual patterns or anomalies or fun facts"].length > 0;
      }
    };
  }
  window.dashboard = dashboard;
})();

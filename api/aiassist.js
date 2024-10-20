import { OpenAI } from "openai";
import fetch from 'node-fetch';
import { datastore } from 'codehooks-js'
import {calculateAggregatedStats} from './api.js';

const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
});

// Updated analyzeUsagePatterns function
async function analyzeUsagePatterns(data) {
    const settings = {
        model: "gpt-4o-mini",
        messages: [
            {
                role: 'system',
                content: 'You are an expert data analyst specializing in web analytics and SEO optimization. Your task is to analyze the provided aggregated web analytics data and offer insightful observations about usage patterns, trends, and potential areas for improvement. You are a very experienced data analyst and you are very good at what you do. You are also very good at writing concise and clear reports and use specific examples from the data to make your points.'
            },
            {
                role: 'user',
                content: `I have web analytics data for the periods of the last 30 days. Please analyze this data thoroughly and provide detailed insights. Think step by step through the following aspects:

1. Traffic trends: Analyze how traffic has changed across the period. What's the most popular page, and what events have the highest/lowest conversion rates?
2. What's driving the traffic? What are the top referrers, and how can we gain more traffic from them?
3. User engagement: Look at metrics like session duration, pages per session, and bounce rate.
4. Popular content: Identify the most visited pages or sections of the website.
5. User demographics: Examine any available information about user locations, devices, or browsers.
6. Conversion rates: If applicable, analyze any conversion-related metrics or events.
7. Hacker attacks: Check for any unusual spikes or patterns that might indicate a hacker attack.

After your analysis, please provide:
1. Your top 3 clear recommendations for improving the website's performance or user experience.
2. A summary of the key findings.
3. At least 3 key insights summarizing your findings.
4. 3 data-driven recommendations for improving website performance or user experience.
5. Any unusual or interesting patterns or anomalies you've noticed in the data.
6. A list of protocols and strategies that you think are being used to attack the website.

Here's the web analytics data: ${JSON.stringify(data)}.

Please provide the output in pure JSON format (no other text or markup) like this: 
{
    "ingress": "TLDR; 1-2 sentences",
    "recommendations": [
        "Recommendation 1",
        "Recommendation 2",
        "Recommendation 3"
    ],
    "summary": "Summary of the key findings. 5-6 sentences",
    "key insights": [
        "Insight 1",
        "Insight 2",
        "Insight 3"
    ],
    "data-driven recommendations": [
        "Recommendation 1",
        "Recommendation 2",
        "Recommendation 3"
    ],
    "unusual patterns or anomalies or fun facts": [
        "Anomaly 1",
        "Anomaly 2",
        "Anomaly 3"
    ]
}
`.trim().replaceAll('```json', '').replaceAll('```', '')
            }
        ],
        temperature: 0.5,
        max_tokens: 1000,
    };

    const response = await openai.chat.completions.create(settings);
    return response.choices[0].message.content;
}

// make 3 fetch calls to https://app.coholytics.info/api/aggstats/{{start-iso-date}}/{{end-iso-date}}?domain=codehooks.io
// the first one for 24 hrs, the next one for last 7 days and the last for last 30 days
// inject them into an object with keys  "48-hours", "7-days", "30-days"

async function getAnalyticsData(domain) {
    const now = new Date();
    const fetchData = async (startDate) => {
        const endDate = new Date(now);
        const startIso = startDate.toISOString();
        const endIso = endDate.toISOString();
        const stats = await calculateAggregatedStats(startIso, endIso, domain);
        return stats;
    };

    const periods = {
        //"48-hours": new Date(now.getTime() - 48 * 60 * 60 * 1000),
        //"7-days": new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000),
        "30-days": new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
    };

    const analyticsData = {};
    for (const [key, startDate] of Object.entries(periods)) {
        analyticsData[key] = await fetchData(startDate);
        delete analyticsData[key].geoLocCounts;
    }
    // print out size of data
    console.log('size of data', JSON.stringify(analyticsData).length);
    // compress the data
    return analyticsData;
}

export async function aiassist(req, res) {
    try {        
        // check if the insights are already cached in the database
        const domain = req.query.domain;
        const kvstore = await datastore.open();
        const cachedInsights = await kvstore.get('aiassist', {keyspace: `${domain}-aiassist`});
        if (cachedInsights) {
            return res.json(JSON.parse(cachedInsights));
        }
        // fetch traffic data from database
        const analyticsData = await getAnalyticsData(domain);
        const insights = await analyzeUsagePatterns(analyticsData);
        const insightsObj = JSON.parse(insights);
        insightsObj.lastUpdated = new Date().toISOString();
        
        // cache the insights in the database for 1 hour
        await kvstore.set('aiassist', JSON.stringify(insightsObj), { ttl: 60 * 60 * 1000, keyspace: `${domain}-aiassist` });
        
        res.json(insightsObj);
    } catch (error) {
        console.error('Error in aiassist:', error);
        return res.status(500).json({ error: 'An error occurred while processing the request' });
    }
};





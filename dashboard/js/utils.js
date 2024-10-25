// Helper function to convert URL to brand name
export function urlToBrandName(url) {
    const brandMap = {
      'Baidu': 'baidu\\.com',
      'Bing': 'bing\\.com',
      'DuckDuckGo': 'duckduckgo\\.com',
      'DevHunt': 'devhunt\\.org',
      'Facebook': 'facebook\\.com',
      'GitHub': 'github\\.com',
      'Google': 'google\\.',
      'Instagram': 'instagram\\.com',
      'LinkedIn': 'linkedin\\.com',
      'Pinterest': 'pinterest\\.com',
      'Reddit': 'reddit\\.com',
      'Snapchat': 'snapchat\\.com',
      'TikTok': 'tiktok\\.com',
      'X (Twitter)': 'twitter\\.com|https:\/\/t\\.co',
      'WhatsApp': 'whatsapp\\.com',
      'Yahoo': 'yahoo\\.com',
      'Yandex': 'yandex\\.ru',
      'YouTube': 'youtube\\.com',
      'Gmail (Android)': 'android-app://com\\.google\\.android\\.gm'
    };
  
    for (const [brand, domainPattern] of Object.entries(brandMap)) {
      if (new RegExp(domainPattern).test(url)) {
        return brand;
      }
    }
    return url.replace(/^https?:\/\//, '');
}

// Helper function to convert URL to page name

export function normalizeUrl(url, domain) {
    // Remove protocol (http:// or https://)
    url = url.replace(/^https?:\/\//, '');
    
    // Remove www. if present
    url = url.replace(/^www\./, '');
    
    // Remove trailing slash if present
    url = url.replace(/\/$/, '');
    
    // If the URL starts with the domain, keep only the path
    if (url.startsWith(domain)) {
      url = url.substring(domain.length) || '/';
    }
    
    return url;
  }

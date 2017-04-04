const _parseString = require('xml2js').parseString
const _request = require('request')
const _url = require('url')
const moment = require('moment')
const fs = require('fs')
const os = require('os')
const path = require('path')
const sanitize = require("sanitize-filename")

const CACHE_ROOT_DIR = process.env.CACHE_ROOT_DIR || path.join(os.tmpdir(), "prerender-cache")
const CACHE_FILENAME = 'prerender.cache.html'
const CACHE_TTL_MAX = 60*60*24*25 /*seconds*/

function xmlToJson(xml, options) {
  return new Promise((resolve, reject) => {
    _parseString(xml, options, (err, result) => {
      if (err) return reject(err)
      resolve(result)
    })
  })
}

function request(query) {
  return new Promise((resolve, reject) => {
    _request(query, (err, response, body) => {
      if (err) return reject(err)
      resolve({ response, body })
    })
  })
}

function getFilepath(requestUrl) {
  let reqUrl = _url.parse(requestUrl)

  if (reqUrl.pathname && reqUrl.pathname !== '/') {
    // parse the URL path and join it with the cache base path
    let filedir = path.join(CACHE_ROOT_DIR, path.format(path.parse(reqUrl.pathname)));
    if (reqUrl.query) {
      // a query is set, join this as well
      filedir = path.join(filedir, sanitize(reqUrl.query));
    }
  }

  return path.join(filedir, CACHE_FILENAME);
}

async function processUrl(url, fetchTime) {
  try {
    let link = new _url.URL(url.loc)
    let lastmod = moment(url.lastmod, moment.ISO_8601)
    if (fetchTime.diff(lastmod, 'minutes') < 15) {
      lastmod = false
    }

    let filepath = getFilepath(url.loc);
    if (fs.existsSync(filepath)) {
      let date = new Date();
      let filetime = fs.statSync(filepath).mtime.getTime();

      // Dont send request if:
      // - file is within CACHE_TTL_MAX; and
      // - page hasn't been updated since file was created
      if (moment().diff(filetime, 'seconds') < CACHE_TTL_MAX) {
        if (!lastmod) return
        else if (lastmod.isBefore(filetime)) return
      }
    }

    link.searchParams.append('_escaped_fragment_', '')
    let query = {
      url: link.href,
      method: 'GET',
      headers: {
        'User-Agent': 'PrerenderCacheBot/0.0.1',
        'X-Prerender-Refresh-Cache': 'True',
      }
    }

    if (lastmod) {
      query.headers['X-Last-Modified'] = url.lastmod
    }

    await request(query)

  } catch (err) {
    console.error(err)
  }
}

async function processSitemap(sitemapUrl) {
  try {
    console.log(moment().toISOString(), sitemapUrl)
    let {response, body} = await request({
      url: sitemapUrl,
      method: 'GET',
      gzip: true
    })
    if (response.statusCode !== 200) return

    let sitemapJson = await xmlToJson(body)
    if ('urlset' in sitemapJson) {
      let fetchTime = moment()
      let urls = sitemapJson.urlset.url.map(url => {
        return ({
          loc: url.loc[0],
          lastmod: url.lastmod[0]
        })
      })
      for (url of urls) {
        await processUrl(url, fetchTime)
      }
    } else if ('sitemapindex' in sitemapJson) {
      let sitemaps = sitemapJson.sitemapindex.sitemap.map(sitemap => {
        return sitemap.loc[0]
      })
      for (sitemap of sitemaps) {
        await processSitemap(sitemap)
      }
    }
  } catch (err) {
    console.error(err)
  }
}

async function main() {
  let sitemapFile = process.env.SITEMAP_FILE || 'sitemaps.txt'
  let sitemaps = fs.readFileSync('sitemaps.txt', {encoding: 'utf8'}).split('\n')
  sitemaps.pop()
  for (sitemap of sitemaps) {
    await processSitemap(sitemap)
  }
}

main()

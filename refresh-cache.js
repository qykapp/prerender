const _parseString = require('xml2js').parseString
const _request = require('request')
const URL = require('url').URL
const moment = require('moment')
const fs = require('fs')

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

async function processUrl(url) {
  try {
    let link = new URL(url.loc)
    link.searchParams.append('_escaped_fragment_', '')
    let query = {
      url: link.href,
      method: 'GET',
      headers: {
        'User-Agent': 'PrerenderCacheBot/0.0.1',
        'X-Prerender-Refresh-Cache': 'True',
      }
    }

    let lastmod = moment(url.lastmod, moment.ISO_8601)
    if (moment().diff(lastmod, 'minutes') > 15) {
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
      let urls = sitemapJson.urlset.url.map(url => {
        return ({
          loc: url.loc[0],
          lastmod: url.lastmod[0]
        })
      })
      for (url of urls) {
        await processUrl(url)
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

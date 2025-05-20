const axios = require('axios');
const cheerio = require('cheerio');
const { Feed } = require('feed');
const fs = require('fs');
const path = require('path');

const baseUrl = 'https://paulgraham.com/articles.html';
const selector = 'body > table > tbody > tr > td:nth-child(3) > table:nth-child(6) > tbody a';

function createRssFeed(articles) {
  const feed = new Feed({
    title: 'Paul Graham Essays',
    description: 'Essays by Paul Graham from paulgraham.com',
    id: 'https://paulgraham.com/',
    link: 'https://paulgraham.com/articles.html',
    language: 'en',
    image: 'http://paulgraham.com/pg-pic.jpg',
    favicon: 'http://paulgraham.com/favicon.ico',
    copyright: 'All rights reserved Paul Graham',
    updated: new Date(),
    generator: 'Custom RSS Feed Generator',
    feedLinks: {
      rss2: 'https://paulgraham.com/rss/feed.xml',
    },
    author: {
      name: 'Paul Graham',
      link: 'https://paulgraham.com',
    },
  });

  articles.forEach((article) => {
    const sanitizedContent = article.content
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&apos;');

    const sanitizedDescription =
      article.content
        .substring(0, 500)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&apos;') + '...';

    feed.addItem({
      title: article.title,
      id: article.href,
      link: article.href,
      description: sanitizedDescription,
      content: sanitizedContent,
      date: article.publishDate ? new Date(article.publishDate) : new Date(),
      author: [{ name: 'Paul Graham', link: 'https://paulgraham.com' }],
    });
  });

  const rss = feed
    .rss2()
    .replace(/<!\[CDATA\[/g, '')
    .replace(/\]\]>/g, '')
    .replace(/\n\s*\n/g, '\n');

  return rss;
}

function separateArticleTextFromDate(text) {
  const dateYearRegex = /^(.+?\d{4})/;
  const match = text.match(dateYearRegex);

  if (match) {
    const date = match[1];
    const articleText = text.slice(date.length).trim();
    return { date, articleText };
  } else {
    return { date: '', articleText: text };
  }
}

async function getAllArticles() {
  const articles = [];
  try {
    const mainResponse = await axios.get(baseUrl);
    const mainPage = cheerio.load(mainResponse.data);

    const links = mainPage(selector)
      .map((i, el) => ({
        title: mainPage(el).text().trim(),
        href: mainPage(el).attr('href')?.trim()?.startsWith('https')
          ? mainPage(el).attr('href').trim()
          : `https://paulgraham.com/${mainPage(el).attr('href').trim()}`,
      }))
      .get();

    for (const link of links) {
      let $;
      try {
        const articleResponse = await axios.get(link.href);
        $ = cheerio.load(articleResponse.data);
      } catch (err) {
        console.error(`Error fetching article at ${link.href}:`, err);
        continue;
      }

      const fullText = $('font[size="2"]').text().trim();
      const { date, articleText } = separateArticleTextFromDate(fullText);
      const sanitizedArticleText = articleText.replace(/\n/g, ' ');

      articles.push({
        title: link.title,
        publishDate: date,
        content: sanitizedArticleText,
        href: link.href,
      });
    }

    const sortedArticles = articles.sort((a, b) => {
      if (!a.publishDate && !b.publishDate) return 0;
      if (!a.publishDate) return 1;
      if (!b.publishDate) return -1;
      return new Date(b.publishDate).valueOf() - new Date(a.publishDate).valueOf();
    });

    for (let i = 0; i < sortedArticles.length; i++) {
      if (!sortedArticles[i].publishDate) {
        const prevDate = i > 0 ? new Date(sortedArticles[i - 1].publishDate || '') : new Date();
        const nextDate =
          i < sortedArticles.length - 1
            ? new Date(sortedArticles[i + 1].publishDate || prevDate)
            : new Date(prevDate.getTime() - 30 * 24 * 60 * 60 * 1000);

        const middleTimestamp = (prevDate.getTime() + nextDate.getTime()) / 2;
        sortedArticles[i].publishDate = new Date(middleTimestamp).toISOString();
      }
    }

    sortedArticles.sort((a, b) => new Date(b.publishDate || '').valueOf() - new Date(a.publishDate || '').valueOf());

    if (sortedArticles.length > 0) {
      const rssFeed = createRssFeed(sortedArticles);
      return { articles: sortedArticles, rssFeed };
    }

    return { articles: sortedArticles };
  } catch (err) {
    console.error('Error fetching the pages:', err);
    return { articles: null };
  }
}

(async () => {
  try {
    const { rssFeed } = await getAllArticles();
    if (rssFeed) {
      const outDir = path.join(__dirname, '..', 'public', 'feeds');
      fs.mkdirSync(outDir, { recursive: true });
      fs.writeFileSync(path.join(outDir, 'paul-graham.xml'), rssFeed);
      console.log('Paul Graham feed updated');
    } else {
      console.error('Failed to generate RSS feed.');
    }
  } catch (err) {
    console.error('Failed to update Paul Graham feed:', err);
  }
})();


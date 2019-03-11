const fs = require('fs');
const puppeteer = require('puppeteer');
const { itemsToRead, filters, groupUrl } = require('./config');

const itemsPerPage = 25;
const groupSelector = '#content .article .groups >.result .title a';
const itemSelector = '#content .article table > tbody>tr';
const query = 'discussion?start=';

// 数据备份，防止中途出错丢失数据
const backupItems = [];

(async () => {
  let html = '';
  try {
    console.time('总耗时');

    const browser = await puppeteer.launch();
    const groups = await getGroups(browser, groupUrl);
    const params = groups.map(url => [browser, url]);
    let items = await sequencePromises(getItemsFromGroup, params);
    items = flatItems(items);
    await browser.close();

    html = await writeItems(items);

    console.timeEnd('总耗时');
  } catch (error) {
    console.log(error);

    html = await writeItems(backupItems);
  } finally {
    // 将数据存储到本地
    fs.writeFile(
      `./output/index_${new Date()
        .toLocaleDateString()
        .replace(/\//g, '-')}.html`,
      html,
      error => {
        if (error) {
          console.log(error);
        }
      }
    );
  }
})();

const writeItems = async items => {
  const browser = await puppeteer.launch({
    headless: false,
    defaultViewport: null
  });
  const page = await browser.newPage();
  const html = await page.evaluate(items => {
    const ol = document.createElement('ol');
    items.forEach(item => {
      const li = document.createElement('li');
      const a = document.createElement('a');
      a.target = '_blank';
      a.href = item.url;
      a.textContent = `${item.lastReplay}   ${item.title}`;
      li.appendChild(a);
      ol.appendChild(li);
    });
    document.body.appendChild(ol);
    return document.documentElement.outerHTML;
  }, items);
  return html;
};

const getGroups = async (browser, url) => {
  const page = await browser.newPage();
  await page.goto(url, {
    waitUntil: 'domcontentloaded'
  });
  const groups = await page.$$eval(groupSelector, links =>
    links.map(link => link.href)
  );
  return groups;
};

const getItemsFromGroup = (browser, url) => {
  const params = [];
  for (let i = 0; i < itemsToRead; i += itemsPerPage) {
    const param = [browser, `${url}${query}${i}`];
    params.push(param);
  }
  return sequencePromises(getItemsFromPage, params);
};

const getItemsFromPage = (browser, url) =>
  new Promise(async (resolve, reject) => {
    try {
      const page = await browser.newPage();
      // 不需要等到load
      await page.goto(url, {
        waitUntil: 'domcontentloaded',
        timeout: 0
      });
      // 注意page.$$()获得不是普通的DOM元素
      let trs = await page.$$eval(itemSelector, trs =>
        trs.map(tr => {
          const [title, author, replay, lastReplay] = Array.from(
            tr.querySelectorAll('td')
          ).map(td => td.textContent);
          const a = tr.querySelector('a');
          const url = a ? a.href : '';
          return { title, author, replay, lastReplay, url };
        })
      );

      trs = trs.filter(tr =>
        Object.keys(filters).reduce((shouldReturn, key) => {
          return shouldReturn && (filters[key] || alwaysReturnTrue)(tr[key]);
        }, true)
      );

      console.log(`下载 ${url} 找到${trs.length}个`);
      resolve(trs);
      backupItems.push(...trs);
      await page.close();
    } catch (error) {
      reject(error);
    }
  });

const flatItems = arr => {
  if (arr.flat) {
    arr.flat(arr);
  } else {
    const _arr = [];
    arr.forEach(url => {
      url.forEach(page => {
        page.forEach(tr => {
          _arr.push(tr);
        });
      });
    });
    return _arr;
  }
};

const sequencePromises = (getPromise, promisesParam) => {
  return promisesParam.reduce((promiseChain, promiseCurrentParam) => {
    return promiseChain.then(chainResult => {
      var currentPromise = getPromise.apply(this, promiseCurrentParam);
      return currentPromise.then(currentResult => {
        chainResult.push(currentResult);
        return chainResult;
      });
    });
  }, Promise.resolve([]));
};

const alwaysReturnTrue = () => true;

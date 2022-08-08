import axios from 'axios';
import { DateTime } from 'luxon';
import fs from 'fs';

const BASE_URL_FOR_TLD =
  'https://dnpedia.com/tlds/ajax.php?cmd=tldlist&columns=id,zoneuc,active_in_zone,current_add_count,last_processed,zone,id,&_search=false&rows=1000&page=[PAGE]&sidx=active_in_zone&sord=desc';
const BASE_URL =
  'https://dnpedia.com/tlds/ajax.php?columns=name,thedate,&ecf=zoneid,thedate&ecv=[TLD_ID],[YYYY-MM-DD]&zone=[ZONE]&rows=[PAGE_SIZE]&page=[PAGE]&cmd=added';
const PAGE_SIZE = 2000;

interface TLD {
  zoneuc: string;
  id: number;
  current_add_count: number;
  last_processed: string;
  zone: string;
}

const saveToFile = (data: string, filename: string) => {
  fs.writeFile(filename, data, (err) => {
    if (err) {
      console.log(err);
    }
  }
  );
}

const range = (start, end) => Array.from({ length: end - start }, (v, k) => k + start);

function delay(t: number, data) {
  return new Promise(resolve => {
    setTimeout(resolve.bind(null, data), t);
  });
}

const getTLDs = async (): Promise<TLD[]> => {
  let tlds: TLD[] = [];
  const pages = range(1, 2);

  const promises = pages.map((pg) => {
    const myUrl = BASE_URL_FOR_TLD.replace('[PAGE]', pg.toString());
    return axios.get(myUrl, {
      headers: {
        'X-Requested-With': 'XMLHttpRequest',
        Referer: 'https://dnpedia.com/tlds/daily.php',
      },
    });
  });

  await Promise.allSettled(promises).then((results) => {
    results.forEach((response) => {
      if (response.status === 'fulfilled') {
        tlds = tlds.concat(response.value.data.rows);
      }
    });
    return tlds;
  });

  return tlds;
};

export const updateDnPediaDaily = async () => {
  let allTlds = await getTLDs();

  let db: any[] = [];

  let today = DateTime.now();
  const days = range(0, 1).map((n) => {
    today = today.minus({ days: n });
    return today.toISO().split('T')[0];
  });

  const urls: string[] = [];
  const error: string[] = [];
  const success: string[] = [];

  days.forEach((day) => {
    const tlds = allTlds.filter((t) => t.current_add_count > 0 && t.last_processed === day);
    tlds.forEach((tld) => {
      const pages = range(1, Math.ceil(tld.current_add_count / PAGE_SIZE) + 1);
      pages.forEach((pg) => {
        const cUrl = BASE_URL.replace('[YYYY-MM-DD]', day)
          .replace('[PAGE_SIZE]', PAGE_SIZE.toString())
          .replace('[PAGE]', pg.toString())
          .replace('[ZONE]', tld.zoneuc)
          .replace('[TLD_ID]', tld.id.toString());
        urls.push(cUrl);
      });
    });
  });

  // custom headers must be set for each request
  const promises = urls.map((u) =>
    axios.get(u, {
      headers: {
        'X-Requested-With': 'XMLHttpRequest',
        Referer: 'https://dnpedia.com/tlds/daily.php',
        'User-Agent': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/103.0.5060.66 Safari/537.36 Edg/103.0.1264.44',
      },
      timeout: 100000,
    })
  );

  Promise.allSettled(promises).then((results) => {
    results.forEach((response) => {
      if (response.status === 'fulfilled') {
        db = db.concat(response.value?.data?.rows ?? []);
        success.concat(response.value?.config?.url);
        saveToFile(JSON.stringify(db), 'data/dnpedia/' + today.toISO().split('T')[0] + '.json');
      } else {
        error.concat(response.reason?.config?.url);
      }
    });

    saveToFile(JSON.stringify(error), 'data/dnpedia/' + today.toISO().split('T')[0] + '.error.txt');
    saveToFile(JSON.stringify(success), 'data/dnpedia/' + today.toISO().split('T')[0] + '.success.txt');

  });
};

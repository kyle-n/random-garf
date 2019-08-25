// npm
import dotenv from 'dotenv';
dotenv.config({ path: __dirname + '/.env' });
import monthDays from 'month-days';
import Twit from 'twit';
import imgurUploader from 'imgur-uploader';
import fetch from 'cross-fetch';
import {Request} from 'cross-fetch';
import arrayBufferToBuffer from 'arraybuffer-to-buffer';
import fs from 'fs';

// rxjs
import { Observable, interval, from, zip, of} from 'rxjs';
import { flatMap, map, tap, buffer } from 'rxjs/operators';

// init Twit
const T = new Twit({
  consumer_key: process.env.TWITTER_API_KEY,
  consumer_secret: process.env.TWITTER_API_SECRET,
  access_token: process.env.TWITTER_ACCESS_TOKEN,
  access_token_secret: process.env.TWITTER_ACCESS_SECRET
});

// metadata
const minYear = 1978;
const minMonth = 6;
const minDay = 19;
const iftttUrl = 'https://maker.ifttt.com/trigger/new_garf/with/key/dc2o4wOJG0kBvlUQ97rEYD'

// helpers
const randomIntegerInclusive = (first: number, second?: number): number => {
  if (second == null || second == undefined) {
    return Math.floor(Math.random() * (first + 1));
  } else {
    return Math.floor(Math.random() * (second - first + 1)) + first;
  }
};
const randomFilename = (): string => Math.floor(Math.random() * 9999999) + '.gif';
const toYYMMDD = (date: Date): string => `${date.getFullYear()}-${date.getMonth() + 1}-${date.getDate()}`;

// main
const actionInterval: Observable<number> = of(0);
const randomDate: Observable<Date> = actionInterval.pipe(
  map(() => {
    const today = new Date();
    const randomYear = randomIntegerInclusive(
      minYear,
      today.getFullYear()
    );
    const randomMonth = randomIntegerInclusive(
      randomYear === minYear ? minMonth : 1,
      randomYear === today.getFullYear() ? today.getMonth() + 1 : 12
    );
    const randomDay = randomIntegerInclusive(
      randomYear === minYear && randomMonth === minMonth ? minDay : 1,
      monthDays({month: randomMonth - 1, year: randomYear})
    );
    return new Date(`${randomYear}-${randomMonth}-${randomDay}`);
  })
);
const imgReq: Observable<Response> = randomDate.pipe(
  map(date => {
    const nonZeroIndexMonth = date.getMonth() + 1;
    const twoNumberMonth: string = nonZeroIndexMonth.toString(10).length === 1 ? '0' + nonZeroIndexMonth : nonZeroIndexMonth.toString(10);
    return `https://d1ejxu6vysztl5.cloudfront.net/comics/garfield/${date.getFullYear()}/${date.getFullYear()}-${twoNumberMonth}-${date.getDate()}.gif`;
  }),
  flatMap(imgUrl => from(fetch(imgUrl))),
);
const imgBuffer: Observable<Buffer> = imgReq.pipe(
  flatMap(resp => from(resp.arrayBuffer())),
  map(ab => arrayBufferToBuffer(ab))
);
// const iftttUpload: Observable<any> = imgBuffer.pipe(
//   tap(buffer => {
//     fs.writeFileSync('./x.gif', buffer);
//   })
// );

// /*
interface ImgurResponse {
  id: string;
  link: string;
  title: string;
  date: string;
  type: string;
}
const imgurUpload: Observable<ImgurResponse> = zip(
  randomDate,
  imgBuffer 
).pipe(
  flatMap(inputs => {
    const date: Date = inputs[0];
    const buffer: Buffer = inputs[1];
    return from(imgurUploader(buffer, {title: 'Garfield ' + toYYMMDD(date)}));
  }),
  map(resp => <ImgurResponse>resp)
);
const iftttUpload: Observable<Response> = imgurUpload.pipe(
  flatMap(resp => {
    const reqOptions: RequestInfo = new Request(iftttUrl, {
      method: 'POST',
      mode: 'cors',
      cache: 'no-cache',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ value1: resp.title, value2: resp.link })
    });
    return from(fetch(reqOptions));
  })
);
*/

iftttUpload.subscribe(
  () => {
    const now = new Date();
    console.log(`Tweet posted at ${toYYMMDD(now)} at ${now.getTime()}`);
  },
  console.log
);

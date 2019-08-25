// npm
import dotenv from 'dotenv';
dotenv.config({ path: __dirname + '/.env' });
import monthDays from 'month-days';
import imgurUploader from 'imgur-uploader';
import fetch from 'cross-fetch';
import {Request} from 'cross-fetch';
import arrayBufferToBuffer from 'arraybuffer-to-buffer';

// rxjs
import { Observable, interval, from, zip, timer, merge} from 'rxjs';
import { flatMap, map, share } from 'rxjs/operators';

// metadata
const minYear = 1978;
const minMonth = 6;
const minDay = 19;
const iftttUrl = `https://maker.ifttt.com/trigger/new_garf/with/key/${process.env.IFTTT_KEY}`;
const errorUrl = `https://maker.ifttt.com/trigger/garf_error/with/key/${process.env.IFTTT_KEY}`;

// helpers
const randomIntegerInclusive = (first: number, second?: number): number => {
  if (second == null || second == undefined) {
    return Math.floor(Math.random() * (first + 1));
  } else {
    return Math.floor(Math.random() * (second - first + 1)) + first;
  }
};
const toYYMMDD = (date: Date): string => `${date.getFullYear()}-${date.getMonth() + 1}-${date.getDate()}`;

// main
const actionInterval: Observable<number> = merge(
  timer(0),
  interval(7200 * 1000) // 2h
);

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
  }),
  share()
);

const imgReq: Observable<Response> = randomDate.pipe(
  map(date => {
    const nonZeroIndexMonth = date.getMonth() + 1;
    const twoNumberMonth: string = nonZeroIndexMonth.toString(10).length === 1 ? '0' + nonZeroIndexMonth : nonZeroIndexMonth.toString(10);
    const twoNumberDate: string = date.getDate().toString(10).length === 1 ? '0' + date.getDate() : date.getDate().toString(10);
    return `https://d1ejxu6vysztl5.cloudfront.net/comics/garfield/${date.getFullYear()}/${date.getFullYear()}-${twoNumberMonth}-${twoNumberDate}.gif`;
  }),
  flatMap(imgUrl => from(fetch(imgUrl))),
);

const imgBuffer: Observable<Buffer> = imgReq.pipe(
  flatMap(resp => from(resp.arrayBuffer())),
  map(ab => arrayBufferToBuffer(ab))
);

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
    return from(imgurUploader(buffer, {title: toYYMMDD(date)}));
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
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ value1: resp.title, value2: resp.link })
    });
    return from(fetch(reqOptions));
  })
);

const finishedUploads = zip(
  iftttUpload,
  randomDate
);

finishedUploads.subscribe(
  inputs => {
    const date = inputs[1];
    const now = new Date();
    console.log(`Tweet for ${toYYMMDD(date)} posted at ${toYYMMDD(now)} at ${now.getTime()}`);
  },
  e => {
    console.log(e);
    const reqOptions: RequestInfo = new Request(errorUrl, {
      method: 'POST',
      mode: 'cors',
      cache: 'no-cache',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ value1: 'Yo' })
    });
    fetch(reqOptions);
  }
);

// so heroku won't kill the server
import express from 'express';
export const app: express.Application = express();
app.listen(process.env.PORT || 8000, () => console.log('Server running...'));

// npm
import dotenv from 'dotenv';
dotenv.config({ path: __dirname + '/.env' });
import monthDays from 'month-days';
import imgurUploader from 'imgur-uploader';
import axios from 'axios-observable';
import { AxiosResponse } from 'axios';
import { JSDOM } from 'jsdom';

// rxjs
import {Observable, interval, from, zip, timer, merge, noop, of} from 'rxjs';
import {catchError, filter, flatMap, map, share} from 'rxjs/operators';

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

// interval to drive program
const startupTime = new Date();
const minutesUntilNextTwoHourBlock: number = (startupTime.getHours() + 1) % 2 * 60 + (60 - (startupTime.getMinutes()));
const msUntilNextTwoHourBlock: number = minutesUntilNextTwoHourBlock * 60 * 1000;
const actionInterval: Observable<number> = merge(
  timer(msUntilNextTwoHourBlock),
  interval(7200 * 1000) // 2h
);

// generate random date between Garfield creation and today
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
      randomYear === today.getFullYear() && randomMonth === today.getMonth() + 1 ?
        today.getDate() : monthDays({month: randomMonth - 1, year: randomYear})
    );
    return new Date(`${randomYear}-${randomMonth}-${randomDay}`);
  }),
  share()
);

// grab the image from the site's servers
const imgReq: Observable<AxiosResponse<any>> = randomDate.pipe(
  map(date => {
    const nonZeroIndexMonth = date.getMonth() + 1;
    const twoNumberMonth: string = nonZeroIndexMonth.toString(10).length === 1 ? '0' + nonZeroIndexMonth : nonZeroIndexMonth.toString(10);
    const twoNumberDate: string = date.getDate().toString(10).length === 1 ? '0' + date.getDate() : date.getDate().toString(10);
    return `https://www.gocomics.com/garfield/${date.getFullYear()}/${twoNumberMonth}/${twoNumberDate}`;
  }),
  flatMap(url => axios.get(url, {responseType: 'document'})),
  map(response => new JSDOM(response.data)),
  map(dom => dom.window.document.querySelector('meta[property="og:image"]').getAttribute('content')),
  flatMap(imgUrl => axios.get(imgUrl, { responseType: 'arraybuffer' })),
  catchError(e => {
    console.log(e);
    return of(null);
  }),
  filter(val => Boolean(val))
);

// transform into something to upload to imgur
const imgBuffer: Observable<Buffer> = imgReq.pipe(
  map(resp => Buffer.from(resp.data, 'binary'))
);

// upload to imgur for sending to IFTTT
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
  catchError(e => {
    console.log(e);
    return of(null);
  }),
  filter(val => Boolean(val)),
  map(resp => resp as ImgurResponse)
);

// Use IFTTT so as not to implement the whole Twitter auth stack
const iftttUpload: Observable<AxiosResponse<any>> = imgurUpload.pipe(
  flatMap(resp => {
    const reqOptions = {
      mode: 'cors',
      cache: 'no-cache',
      headers: {
        'Content-Type': 'application/json'
      }
    };
    const body = { value1: resp.title, value2: resp.link };
    return axios.post(iftttUrl, body, reqOptions);
  }),
  catchError(e => {
    console.log(e);
    return of(null);
  }),
  filter(val => Boolean(val))
);

// final sub to listen to
const finishedUploads = zip(
  iftttUpload,
  randomDate
);

finishedUploads.subscribe(
  // logs for my server records
  inputs => {
    const date = inputs[1];
    const now = new Date();
    console.log(`Tweet for ${toYYMMDD(date)} posted at ${toYYMMDD(now)} at ${now.getTime()}`);
  },
  // pings me if there's a problem
  e => {
    console.log(e);
    const reqOptions = {
      mode: 'cors',
      cache: 'no-cache',
      headers: {
        'Content-Type': 'application/json'
      },
    };
    axios.post(errorUrl, { value1: '@kbn_au LASAGNA TIME' }, reqOptions).subscribe(noop);
  }
);

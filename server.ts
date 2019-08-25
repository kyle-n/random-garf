import dotenv from 'dotenv';
dotenv.config({ path: __dirname + '/.env' });
import monthDays from 'month-days';
import blobToBase64 from 'blob-to-base64';
import Twit from 'twit';

import {Observable, interval, from, zip} from 'rxjs';
import {flatMap, map} from 'rxjs/operators';

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

// helpers
const randomIntegerInclusive = (first: number, second?: number): number => {
  if (second == null || second == undefined) {
    return Math.floor(Math.random() * (first + 1));
  } else {
    return Math.floor(Math.random() * (second - first + 1)) + first;
  }
}

// main
const actionInterval: Observable<number> = interval(2 * 1000);
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
    const currentYear: number = (new Date()).getFullYear();
    const nonZeroIndexMonth = date.getMonth() + 1;
    const twoNumberMonth: string = nonZeroIndexMonth.toString(10).length === 1 ? '0' + nonZeroIndexMonth : nonZeroIndexMonth.toString(10);
    return `https://d1ejxu6vysztl5.cloudfront.net/comics/garfield/${currentYear}/${date.getFullYear()}-${twoNumberMonth}-${date.getDate()}.gif`;
  }),
  flatMap(imgUrl => from(fetch(imgUrl)))
);
const mediaId: Observable<string> = imgReq.pipe(
  flatMap(resp => from(resp.blob())),
  map(blob => blobToBase64(blob)),
  flatMap(b64content => from(T.post('media/upload', { media_data: b64content }))),
  map((data: any) => data.media_id_string)
);
const createMetadataRequest: Observable<any> = mediaId.pipe(
  flatMap(mediaId => {
      const altText = "Ha ha, classic Garfield"
      const meta_params = { media_id: mediaId, alt_text: { text: altText } }

      return from(T.post('media/metadata/create', meta_params));
  })
);
const tweetPost: Observable<any> = zip(
  mediaId,
  createMetadataRequest
).pipe(
  flatMap(inputs => {
    const mediaId: string = inputs[0];
    const params = { status: 'loving life #nofilter', media_ids: [mediaId] };
    return from(T.post('statuses/update', params));
  })
);
tweetPost.subscribe(
  () => {
    const now = new Date();
    console.log(`Tweet posted at ${now.getFullYear}-${now.getMonth() + 1}-${now.getDate()} at ${now.getTime()}`);
  },
  console.log
);

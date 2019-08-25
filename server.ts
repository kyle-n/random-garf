import bodyParser from 'body-parser';
import htmlParser from 'node-html-parser';
import {parse} from 'node-html-parser';
import monthDays from 'month-days';

import {Observable, interval} from 'rxjs';
import {mapTo, tap, map} from 'rxjs/operators';

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

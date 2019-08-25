# Random Garfield

This is a simple Node server that posts a random Garfield comic every two hours to Twitter. Follow [@random_garfield](https://twitter.com/random_garfield) to see the posts.

This project uses RxJS inside TypeScript to map out the logic. Streams are a natural fit for this kind of repeating task involving network calls.
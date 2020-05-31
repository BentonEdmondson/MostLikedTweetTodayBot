const twit = require('twit');
const moment = require('moment');
const schedule = require('node-schedule');
const keys = require('./keys.json');

const T = new twit(keys);

let mostLikedTweet = async (minLikes, maxLikes, since, until) => {
    if (minLikes === maxLikes) { console.error('Found nothing...'); return; }
    let numLikesGuess = Math.trunc((minLikes + maxLikes) / 2);
    console.log(`Search from ${minLikes} to ${maxLikes} likes. I'm guessing ${numLikesGuess}.`)
    let tweets = (await T.get('search/tweets', {
        q: `min_faves:${numLikesGuess} lang:en since:${since} until:${until}`,
        count: 100 // 100 is the maximum
    })).data.statuses;
    console.log(`Number of tweets found above ${numLikesGuess} likes: ${tweets.length}.`);
    if (tweets.length < 100 && tweets.length > 0) return tweets.reduce((acc, cur) => {
        if (cur.favorite_count > acc.favorite_count) return cur;
        else return acc;
    }, { favorite_count: -1 });
    else if (tweets.length === 0) return await mostLikedTweet(minLikes, numLikesGuess, since, until);
    else if (tweets.length >= 100) return await mostLikedTweet(numLikesGuess, maxLikes, since, until);
}


schedule.scheduleJob('1 0 * * *', retweet = async () => {

    let mostLikedTweetOfToday = await mostLikedTweet(0, 2000000, moment().subtract(1, 'days').format('YYYY-M-D'), moment().format('YYYY-M-D'));
    console.log(`Most liked tweet: https://twitter.com/username/status/${mostLikedTweetOfToday.id_str}`);
    // reply to the tweet
    T.post('statuses/update', {
        status: `This is the most liked tweet of ${moment().subtract(1, 'days').format('dddd, MMMM Do YYYY')}, @${mostLikedTweetOfToday.user.screen_name}.`,
        in_reply_to_status_id: mostLikedTweetOfToday.id_str
    });
    // retweet the tweet
    T.post('statuses/retweet/:id', {
        id: mostLikedTweetOfToday.id_str
    });

});
retweet();
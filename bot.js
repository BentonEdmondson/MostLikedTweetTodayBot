require('dotenv').config();
const twit = require('twit');
const moment = require('moment');
const schedule = require('node-schedule');

console.log('bot.js is running.');

const twitterAccounts = {
    'likes': new twit({
        consumer_key: process.env.LIKES_CONSUMER_KEY,
        consumer_secret: process.env.LIKES_CONSUMER_SECRET,
        access_token: process.env.LIKES_ACCESS_TOKEN,
        access_token_secret: process.env.LIKES_ACCESS_TOKEN_SECRET
    }),
    'retweets': new twit({
        consumer_key: process.env.RETWEETS_CONSUMER_KEY,
        consumer_secret: process.env.RETWEETS_CONSUMER_SECRET,
        access_token: process.env.RETWEETS_ACCESS_TOKEN,
        access_token_secret: process.env.RETWEETS_ACCESS_TOKEN_SECRET
    })
}

const originalSpecimenMax = 2000000;
const originalSpecimenMin = 0;

let getTweet = async parameters => {
    if (parameters.specimenMin === parameters.specimenMax) { console.error('Found nothing...'); return; }
    let specimenGuess = Math.trunc((parameters.specimenMin + parameters.specimenMax) / 2);
    console.log(`Searching from ${parameters.specimenMin} to ${parameters.specimenMax} ${parameters.specimen}. I'm guessing ${specimenGuess}.`);
    let tweets = (await parameters.T.get('search/tweets', {
        q: `${({
            likes: 'min_faves',
            retweets: 'min_retweets'
        })[parameters.specimen]}:${specimenGuess} lang:en since:${parameters.since} until:${parameters.until}`,
        count: 100 // 100 is the maximum
    })).data.statuses;
    console.log(`Number of tweets found above ${specimenGuess} ${parameters.specimen}: ${tweets.length}.`);
    let specimenProperty = ({
        likes: 'favorite_count',
        retweets: 'retweet_count',
    })[parameters.specimen];
    if (tweets.length < 100 && tweets.length > 0) return tweets.reduce((acc, cur) => {
        if (cur[specimenProperty] > acc[specimenProperty]) return cur;
        else return acc;
    }, { [specimenProperty]: -1 });
    else if (tweets.length === 0) return await getTweet({
        specimen: parameters.specimen,
        specimenMin: parameters.specimenMin,
        specimenMax: specimenGuess,
        since: parameters.since,
        until: parameters.until,
        T: parameters.T
    });
    else if (tweets.length >= 100) {
        if (specimenGuess / originalSpecimenMax < 0.8) return await getTweet({
            specimen: parameters.specimen,
            specimenMin: specimenGuess,
            specimenMax: parameters.specimenMax,
            since: parameters.since,
            until: parameters.until,
            T: parameters.T
        });
    } else {
        return await getTweet({
            specimen: parameters.specimen,
            specimenMin: specimenGuess,
            specimenMax: Math.floor(parameters.specimenMax * 1.5),
            since: parameters.since,
            until: parameters.until,
            T: parameters.T
        });
    }
}

retweetTweetOfToday = async specimen => {

    let tweet = await getTweet({
        specimen: specimen,
        specimenMin: originalSpecimenMin,
        specimenMax: originalSpecimenMax,
        since: moment().subtract(1, 'days').format('YYYY-MM-D'),
        until: moment().format('YYYY-M-D'),
        T: twitterAccounts[specimen]
    });
    console.log(`Tweet with the most ${specimen} on ${moment().subtract(1, 'days').format('dddd, MMMM Do YYYY')}:
        https://twitter.com/username/status/${tweet.id_str}`);

    try {
        // reply to the tweet
        await twitterAccounts[specimen].post('statuses/update', {
            status: `This is the most ${specimen} tweet of ${moment().subtract(1, 'days').format('dddd, MMMM Do YYYY')}, @${tweet.user.screen_name}.`,
            in_reply_to_status_id: tweet.id_str
        });
        // retweet the tweet
        await twitterAccounts[specimen].post('statuses/retweet/:id', {
            id: tweet.id_str
        });

    } catch (e) {
        console.log(`There was an error in retweeting or commenting on the tweet:`);
        console.log(`\t${e.message}`);
    }

}

retweetTweetOfToday('likes');
schedule.scheduleJob('1 0 * * *', () => {
    retweetTweetOfToday('likes');
});
//retweetTweetOfToday('retweets');

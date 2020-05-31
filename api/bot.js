module.exports = async (req, res) => {
    res.status(200).json({ message: 'Thanks for kicking this off!' })

    const twit = require('twit');
    const moment = require('moment');
    const schedule = require('node-schedule');

    const T = new twit({
        consumer_key: process.env.consumer_key,
        consumer_secret: process.env.consumer_secret,
        access_token: process.env.access_token,
        access_token_secret: process.env.access_token_secret
    });

    let getTweet = async (parameters) => {
        if (parameters.specimenMin === parameters.specimenMax) { console.error('Found nothing...'); return; }
        let specimenGuess = Math.trunc((parameters.specimenMin + parameters.specimenMax) / 2);
        console.log(`Searching from ${parameters.specimenMin} to ${parameters.specimenMax} ${process.env.specimen}. I'm guessing ${specimenGuess}.`);
        let tweets = (await T.get('search/tweets', {
            q: `${({
                likes: 'min_faves',
                retweets: 'min_retweets'
            })[process.env.specimen]}:${specimenGuess} lang:en since:${parameters.since} until:${parameters.until}`,
            count: 100 // 100 is the maximum
        })).data.statuses;
        console.log(`Number of tweets found above ${specimenGuess} ${process.env.specimen}: ${tweets.length}.`);
        let specimenProperty = ({
            likes: 'favorite_count',
            retweets: 'retweet_count',
        })[process.env.specimen];
        if (tweets.length < 100 && tweets.length > 0) return tweets.reduce((acc, cur) => {
            if (cur[specimenProperty] > acc[specimenProperty]) return cur;
            else return acc;
        }, { [specimenProperty]: -1 });
        else if (tweets.length === 0) return await getTweet({
            specimenMin: parameters.specimenMin,
            specimenMax: specimenGuess,
            since: parameters.since,
            until: parameters.until
        });
        else if (tweets.length >= 100) return await getTweet({
            specimenMin: specimenGuess,
            specimenMax: parameters.specimenMax,
            since: parameters.since,
            until: parameters.until
        });
    }

    schedule.scheduleJob('1 0 * * *', retweet = async () => {

        let tweet = await getTweet({
            specimenMin: 0,
            specimenMax: 2000000,
            since: moment().subtract(1, 'days').format('YYYY-MM-D'),
            until: moment().format('YYYY-M-D')
        });
        console.log(`Tweet with the most ${process.env.specimen} on ${moment().subtract(1, 'days').format('dddd, MMMM Do YYYY')}:
            https://twitter.com/username/status/${tweet.id_str}`);

        try {
            // reply to the tweet
            await T.post('statuses/update', {
                status: `This is the most ${process.env.specimen} tweet of ${moment().subtract(1, 'days').format('dddd, MMMM Do YYYY')}, @${tweet.user.screen_name}.`,
                in_reply_to_status_id: tweet.id_str
            });
            // retweet the tweet
            await T.post('statuses/retweet/:id', {
                id: tweet.id_str
            });

        } catch (e) {
            console.log(`There was an error in retweeting or commenting on the tweet.`);
            console.log(e);
        }

    });
    retweet();

}

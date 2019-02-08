'use strict';

const express = require('express');
const { Kayn, REGIONS } = require('kayn');
const app = express();
let kayn;

const re = new RegExp('^[0-9\\p{L} _\\.a-zA-Z]+$');
const numMatches = 10;

app.use(express.static('public'));

function calculateKDA(kills, deaths, assists) {
   return ((kills + assists) / Math.max(1, deaths)).toFixed(2);
}

//Takes a callback where a list of matches is passed in
const getMatchlist = async (summonerName, callback) => {
   if (!summonerName.match(re)) {
      callback(null, null);
   }

   try {
      console.log('[Status] Grabbing summoner id for ' + summonerName);

      const { accountId, id } = await kayn.Summoner.by.name(summonerName);
      
      if (accountId) {
         console.log('[Status] Grabbing matchlist for account id ' + accountId);
         const { matches, endIndex } = await kayn.Matchlist.by.accountID(accountId);
         (endIndex < numMatches) ? callback(matches.slice(0, endIndex), id) : callback(matches.slice(0, numMatches), id);
      }
      else {
         callback(null, null);
      }
   }
   catch(err) {
      console.error(err);
      callback(null, null);
   }
}

//Takes a callback where the list of matches is passed in
const getMatches = async (matchlist, callback) => {
   try {
      if (matchlist) {
         let promises = [];
         for (let i = 0; i < matchlist.length; i++) {
            console.log('[Status] Grabbing match ' + matchlist[i].gameId);
            const matchId = matchlist[i].gameId;
            const matchPromise = kayn.Match.get(matchId);
            promises.push(matchPromise);
         }
         const matches = await Promise.all(promises);
         callback(matches);
      }
      else {
         callback(null);
      }
   }
   catch(err) {
      console.error(err);
      callback(null);
   }
}

app.get('/summoner', (req, res) => {
   if (!kayn) {
      res.status(500);
      res.send('Error: Server unavailable');
      return;
   }

   if (req.query.name) {
      const summonerName = req.query.name;

      getMatchlist(summonerName, function(matchlist, id) {
         if (matchlist) {
            matchlist.sort(function(a, b) {
               return new Date(b.timestamp) - new Date(a.timestamp);
            });

            getMatches(matchlist, function(matches) {
               if (matches) {
                  let response = [];

                  //Filter out participants other than the summoner with the searched name
                  matches.map(match => {
                     let partIds = match.participantIdentities;
                     partIds = partIds.filter(part => part.player.summonerId == id);

                     //Fetch the needed data
                     if (partIds.length > 0) {
                        const player = partIds[0];
                        const playerId = player.participantId;

                        let parts = match.participants;
                        parts = parts.filter(part => part.stats.participantId == playerId);
                        if (parts.length > 0) {
                           let playerStats = parts[0];
                           const cs = playerStats.stats.totalMinionsKilled + playerStats.stats.neutralMinionsKilled;
                           const minutes = match.gameDuration / 60;
                           // console.log(playerStats);

                           let data = {};
                           data.gameId = match.gameId;
                           data.win = playerStats.stats.win;
                           data.summonerName = player.player.summonerName;
                           data.gameDuration = match.gameDuration;
                           data.championId = playerStats.championId;
                           data.kills = playerStats.stats.kills;
                           data.deaths = playerStats.stats.deaths;
                           data.assists = playerStats.stats.assists;
                           data.kda = calculateKDA(playerStats.stats.kills, playerStats.stats.deaths, playerStats.stats.assists);
                           data.spell1Id = playerStats.spell1Id;
                           data.spell2Id = playerStats.spell2Id;
                           data.item0 = playerStats.stats.item0;
                           data.item1 = playerStats.stats.item1;
                           data.item2 = playerStats.stats.item2;
                           data.item3 = playerStats.stats.item3;
                           data.item4 = playerStats.stats.item4;
                           data.item5 = playerStats.stats.item5;
                           data.item6 = playerStats.stats.item6;
                           data.champLevel = playerStats.stats.champLevel;
                           data.creepscore = cs;
                           data.creepscorepermin = (cs / minutes).toFixed(1);
                           data.primaryPerkStyle = playerStats.stats.perkPrimaryStyle;
                           data.primaryPerk = playerStats.stats.perk0;
                           data.subPerkStyle = playerStats.stats.perkSubStyle;
                           response.push(data);
                        }
                     }
                  });

                  res.send(response);
               }
               else {
                  res.status(500);
                  res.send('Error: Internal Server Error'); 
               }
            });
         }
         else {
            res.status(500);
            res.send('Error: Invalid summoner name');
         }
      });
   }
   else {
      res.status(400);
      res.send('Error: Invalid summoner name');
   }
});

app.listen(8080, () => {
   console.log('League of legends stats app on port 8080');
   if (process.env.LEAGUE_API_KEY) {
      console.log('League of legends API key: ' + process.env.LEAGUE_API_KEY);
      kayn = Kayn(process.env.LEAGUE_API_KEY)();
   }
   else {
      console.error('Please create a \'LEAGUE_API_KEY\' environmental variable containing the RIOT API key.');
   }
});
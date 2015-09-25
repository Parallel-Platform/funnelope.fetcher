/* ===============================================================================
 * Name: app.js
 * Project: funnelope.fetcher
 * Date: 09/18/2015
 * 
 * Description: Runs on a schedule, and syncs the list of games in funnelope DB
 * =============================================================================*/
var Q = require('q');
var async = require('async');
var Fireproof = require('fireproof');
Fireproof.bless(Q);

var Firebase = require('firebase');

var _ = require('underscore');
var parseXML = require('xml2js').parseString;

var RateLimiter = require('limiter').RateLimiter;
var limiter = new RateLimiter(1, 1000);
var gameDB = require('./libs/thegamedb');
var config = require('./libs/config');
var platforms = [];

function removeColon(name) {
    return name.replace(':', '_');
}

var popularSystemShortNames = {
    microsoft_xbox_one : ['xboxOne'],
    nintendo_wii_u : ['wiiu'],
    sony_playstation_4 : ['ps4'],
}

var popularsystemlist = [
    { name: 'microsoft-xbox-one' },
    { name: 'nintendo-wii-u' },
    { name: 'sony-playstation-4' },
    { name: 'pc' }
]

var lastpositionacquired = false;
var platforms = [];

gameDB.getGamesPlatformList().then(function (data) {
    
    var options = {
        tagNameProcessors: [removeColon],
        ignoreAttrs : false
    }
    
    parseXML(data, options, function (err, parsedResult) {
        var gamesTitles = '';
        
        if (parsedResult.Data !== null && parsedResult.Data !== undefined && parsedResult.Data.Platforms !== null && parsedResult.Data.Platforms !== undefined && parsedResult.Data.Platforms.length > 0) {
            _.each(parsedResult.Data.Platforms, function (platformArray) {
                if (platformArray !== null && platformArray !== undefined && platformArray.Platform !== null && platformArray.Platform !== undefined && platformArray.Platform.length > 0) {
                    _.each(platformArray.Platform, function (platformItems) {
                        var aliasArray = platformItems.alias;
                        var idArray = platformItems.id;
                        var nameArray = platformItems.name;
                        
                        //Get the platforms into our own array
                        var platform = {};
                        
                        platform.alias = aliasArray !== null && aliasArray !== undefined && aliasArray.length > 0 ? aliasArray[0] : '';
                        platform.id = idArray !== null && idArray !== undefined && idArray.length > 0 ? idArray[0] : '';
                        platform.name = nameArray !== null && nameArray !== undefined && nameArray.length > 0 ? nameArray[0] : '';
                        
                        platforms.push(platform);
                    })
                }
            });
            
            var processFunctions = [];

            _.each(platforms, function (platform, platformindex) {
                var processFunction = function () {
                    //We only want next-gen games
                    var platform_alias = platform.alias.toLowerCase();
                    var platformFound = _.findWhere(popularsystemlist, { name : platform_alias });
                    
                    if (platformFound !== null && platformFound != undefined) {
                        gameDB.getGamesByPlatform(platform.id).then(function (gamesData) {
                            
                            var childOptions = {
                                tagNameProcessors: [removeColon],
                                ignoreAttrs : false
                            }
                            
                            parseXML(gamesData, childOptions, function (err, parsedGameResult) {
                                if (parsedGameResult.Data !== null && parsedGameResult.Data !== undefined && parsedGameResult.Data.Game !== null && parsedGameResult.Data.Game !== undefined && parsedGameResult.Data.Game.length > 0) {
                                    
                                    _.each(parsedGameResult.Data.Game, function (gameArray, gameArrayIndex) {
                                        var gameTitle = gameArray.GameTitle !== null && gameArray.GameTitle !== undefined && gameArray.GameTitle.length > 0 ? gameArray.GameTitle[0] : null;
                                        var id = gameArray.id !== null && gameArray.id !== undefined && gameArray.id.length > 0 ? gameArray.id[0] : null;
                                        var releaseDate = gameArray.ReleaseDate !== null && gameArray.ReleaseDate !== undefined && gameArray.ReleaseDate.length > 0 ? gameArray.ReleaseDate[0] : null;
                                        
                                        //Check firebase for our game (by gamedbid) make sure it doesnt exist already
                                        if (gameTitle !== null && gameTitle !== undefined && gameTitle !== '' && id !== null && id !== undefined && id !== '') {
                                            
                                            //Temporary - If we are using firebase
                                            if (config.useFirebase) {
                                                var gamesRefs = new Firebase(config.firebase.url + config.firebase.endpoints.games);
                                                var gamesProof = new Fireproof(gamesRefs);
                                                
                                                gamesProof
                                                            .orderByChild('gamedbid')
                                                            .equalTo(id)
                                                            .once('value')
                                                            .then(function (snapshot) {
                                                    var result = snapshot.val();
                                                    if (result) {
                                                        //check to see if it has search indexes. if it doesn't, add indexes for it
                                                        if (result.systemgameindex == null || result.systemgameindex == undefined) {
                                                            //save the system game index
                                                            var gameRef = new Firebase(config.firebase.url + config.firebase.endpoints.games + '/' + snapshot.key() + '/systemgameindex');
                                                            var systemgameindex = result.gamedbsystemalias + result.title;
                                                            gameRef.set(systemgameindex);
                                                            console.log('Updated game: ' + result.title + ' | system: ' + result.gamedbsystemname);
                                                        }
                                                        
                                                        if (result.releasedate == null || result.releasedate == undefined) {
                                                            var gameRef = new Firebase(config.firebase.url + config.firebase.endpoints.games + '/' + snapshot.key() + '/releasedate');
                                                            var releasedate = new Date(releaseDate);
                                                            gameRef.set(releasedate);
                                                            console.log('Updated game release date: ' + result.title + ' | system: ' + result.gamedbsystemname);
                                                        }
                                                    }
                                                    else {
                                                        //Save this record for it's system/platform 
                                                        var newGame = {
                                                            gamedbid: id,
                                                            title: gameTitle,
                                                            gamedbsystemid : platform.id,
                                                            gamedbsystemalias : platform.alias,
                                                            gamedbsystemname: platform.name,
                                                            systemgameindex: platform.alias + gameTitle
                                                        }
                                                        
                                                        var newGamesRef = new Firebase(config.firebase.url + config.firebase.endpoints.games);
                                                        var newGamesProof = new Fireproof(newGamesRef);
                                                        
                                                        newGamesProof.push(newGame);
                                                        console.log('saved game: ' + gameTitle + ' | system: ' + platform.name);
                                                    }
                                                });
                                            }
                                        }
                                    })
                                }
                            });
                        });
                    }
                }

                processFunctions.push([processFunction]);
            });

            //run the processes in series
            async.series(processFunctions, function () { 
                console.log('--------------- Fetcher has finished ------------------------------')
            })
        }
    });
});



